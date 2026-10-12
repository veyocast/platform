import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { execFile } from "node:child_process";
import { EventEmitter } from "node:events";
import { createServer } from "node:net";
import process from "node:process";
import { setImmediate } from "node:timers";
import { checkServerIdentity } from "node:tls";
import { fileURLToPath, URL } from "node:url";
import test from "node:test";
import { probeDatabaseTransport } from "./probe-database-transport.mjs";

const PRIVATE_URL = "postgresql://private-user:private-password@private-db.example:6543/private-database?sslmode=require";
const PRIVATE_ERROR = "private-password private-user private-db.example 192.0.2.9 certificate-private-detail";

class FakeSocket extends EventEmitter {
  writes = [];
  destroyed = false;
  authorized = true;
  response = Buffer.from("S");
  pause() { return this; }
  resume() { return this; }
  destroy() { this.destroyed = true; return this; }
  write(bytes, callback) {
    this.writes.push(Buffer.from(bytes));
    callback?.();
    if (this.response) setImmediate(() => this.emit("data", this.response));
    return true;
  }
}

function fixture(overrides = {}) {
  const socket = new FakeSocket();
  const tlsSocket = new FakeSocket();
  const calls = { dns: [], tcp: [], tls: [] };
  const options = {
    environment: {},
    lookup(host, flags, callback) {
      calls.dns.push({ host, flags });
      setImmediate(() => callback(null, [{ address: "192.0.2.9", family: 4 }]));
    },
    connect(flags) {
      calls.tcp.push(flags);
      setImmediate(() => socket.emit("connect"));
      return socket;
    },
    startTls(flags) {
      calls.tls.push(flags);
      setImmediate(() => tlsSocket.emit("secureConnect"));
      return tlsSocket;
    },
    ...overrides
  };
  return { socket, tlsSocket, calls, options };
}

function assertPrivate(result) {
  const output = JSON.stringify(result);
  for (const secret of [PRIVATE_URL, ...PRIVATE_ERROR.split(" "), "private-database"]) {
    assert.equal(output.includes(secret), false);
  }
  assert.deepEqual(Object.keys(result).sort(), ["schemaVersion", "event", "mode", "tlsPolicy", "routeScope", "status", "code", "elapsedMs", "stages"].sort());
  assert.ok(Number.isInteger(result.elapsedMs) && result.elapsedMs >= 0);
  for (const stage of result.stages) {
    assert.deepEqual(Object.keys(stage).sort(), ["stage", "status", "code", "elapsedMs"].sort());
    assert.ok(Number.isInteger(stage.elapsedMs) && stage.elapsedMs >= 0);
  }
}

test("successful lower stages send only SSLRequest and strictly verify the original hostname", async () => {
  const f = fixture();
  const result = await probeDatabaseTransport(PRIVATE_URL, f.options);
  assert.equal(result.status, "passed");
  assert.equal(result.code, "TRANSPORT_PASSED_AUTH_UNTESTED");
  assert.equal(result.tlsPolicy, "strict_verification_independent_of_cli");
  assert.equal(result.routeScope, "native_hostname_connection_attempt");
  assert.deepEqual(result.stages.map((row) => row.stage), ["dns", "tcp", "postgres_ssl_request", "tls"]);
  assert.deepEqual(f.calls.tcp, [{ host: "private-db.example", port: 6543 }]);
  const tlsOptions = f.calls.tls[0];
  assert.deepEqual(Object.keys(tlsOptions).sort(), ["socket", "servername", "rejectUnauthorized", "checkServerIdentity"].sort());
  assert.equal(tlsOptions.socket, f.socket);
  assert.equal(tlsOptions.servername, "private-db.example");
  assert.equal(tlsOptions.rejectUnauthorized, true);
  assert.equal(tlsOptions.checkServerIdentity, checkServerIdentity);
  assert.equal(tlsOptions.checkServerIdentity(tlsOptions.servername, { subjectaltname: "DNS:other.example" }).code, "ERR_TLS_CERT_ALTNAME_INVALID");
  assert.equal(f.socket.writes.length, 1);
  assert.equal(f.socket.writes[0].length, 8);
  assert.equal(f.socket.writes[0].readUInt32BE(0), 8);
  assert.equal(f.socket.writes[0].readUInt32BE(4), 80_877_103);
  assert.equal(f.tlsSocket.writes.length, 0);
  assert.ok(f.socket.destroyed && f.tlsSocket.destroyed);
  assertPrivate(result);
});

test("ordinary TLS modes retain the independent strict verification policy", async () => {
  for (const mode of ["prefer", "require", "verify-ca", "verify-full"]) {
    const f = fixture();
    const result = await probeDatabaseTransport(PRIVATE_URL.replace("sslmode=require", `sslmode=${mode}&connect_timeout=30`), f.options);
    assert.equal(result.status, "passed");
    assert.equal(f.calls.tls[0].rejectUnauthorized, true);
  }
});

test("complex, malformed and plaintext configurations fail before any transport", async () => {
  const unsupported = [
    "host=private-db.example user=private-user password=private-password",
    "postgres://private-db.example,other.example/database",
    "postgres://127.0.0.1/database", "postgres://[::1]/database",
    "postgres://%2Fvar%2Frun%2Fpostgresql/database",
    "postgres://private-db.example/database?sslmode=disable",
    "postgres://private-db.example/database?sslmode=allow",
    "postgres://private-db.example/database?sslrootcert=/private/path",
    "postgres://private-db.example/database?sslcert=/private/path&sslkey=/private/key",
    "postgres://private-db.example/database?service=private-service",
    "postgres://private-db.example/database?options=reference%3Dprivate-project",
    "postgres://private-db.example/database?sslmode=require&sslmode=disable",
    "postgres://private-db.example/database?password=private-password",
    "postgres://private-db.example/database#private-fragment",
    "postgres://private-db.example:70000/database",
    "postgres://private-user:%zz@private-db.example/database",
    "postgres://private-db.example/database?connect_timeout=invalid",
    undefined, "", " private-url", "https://private-db.example/database"
  ];
  for (const value of unsupported) {
    const f = fixture();
    const result = await probeDatabaseTransport(value, f.options);
    assert.equal(result.status, "unsupported");
    assert.deepEqual(f.calls, { dns: [], tcp: [], tls: [] });
    assertPrivate(result);
  }
  for (const key of ["PGSERVICE", "PGSERVICEFILE", "PGSSLMODE", "PGSSLROOTCERT", "PGSSLCERT", "PGSSLKEY", "PGSSLPASSWORD", "PGHOSTADDR", "PGOPTIONS"]) {
    const f = fixture({ environment: { [key]: PRIVATE_ERROR } });
    const result = await probeDatabaseTransport(PRIVATE_URL, f.options);
    assert.equal(result.code, "CONFIG_UNSUPPORTED");
    assert.deepEqual(f.calls, { dns: [], tcp: [], tls: [] });
    assertPrivate(result);
  }
});

test("PostgreSQL refuses TLS without any plaintext retry or authentication", async () => {
  const f = fixture();
  f.socket.response = Buffer.from("N");
  const result = await probeDatabaseTransport(PRIVATE_URL, f.options);
  assert.equal(result.status, "unsupported");
  assert.equal(result.code, "POSTGRES_TLS_UNAVAILABLE");
  assert.equal(f.calls.tcp.length, 1);
  assert.equal(f.calls.tls.length, 0);
  assert.equal(f.socket.writes.length, 1);
  assert.ok(f.socket.destroyed);
  assertPrivate(result);
});

test("unexpected PostgreSQL response bytes cannot be consumed as TLS", async () => {
  for (const response of [Buffer.from("X"), Buffer.from("Sextra")]) {
    const f = fixture();
    f.socket.response = response;
    const result = await probeDatabaseTransport(PRIVATE_URL, f.options);
    assert.equal(result.code, "POSTGRES_SSL_RESPONSE_INVALID");
    assert.equal(f.calls.tls.length, 0);
    assert.ok(f.socket.destroyed);
    assertPrivate(result);
  }
});

test("DNS and TCP failures emit fixed categories without arbitrary driver details", async () => {
  for (const [stage, code, expected] of [
    ["dns", "ENOTFOUND", "DNS_NOT_FOUND"], ["dns", "EAI_AGAIN", "DNS_TEMPORARY_FAILURE"],
    ["dns", PRIVATE_ERROR, "DNS_FAILED"], ["tcp", "ECONNREFUSED", "TCP_REFUSED"],
    ["tcp", "ENETUNREACH", "TCP_UNREACHABLE"], ["tcp", "ETIMEDOUT", "TCP_TIMEOUT"],
    ["tcp", PRIVATE_ERROR, "TCP_FAILED"]
  ]) {
    const error = Object.assign(new Error(PRIVATE_ERROR), { code });
    const f = fixture();
    if (stage === "dns") f.options.lookup = (_host, _flags, callback) => callback(error);
    else f.options.connect = () => { setImmediate(() => f.socket.emit("error", error)); return f.socket; };
    const result = await probeDatabaseTransport(PRIVATE_URL, f.options);
    assert.equal(result.code, expected);
    assert.equal(result.stages.at(-1).stage, stage);
    assert.equal(f.calls.tls.length, 0);
    assertPrivate(result);
  }
});

test("certificate and hostname failures stay strict and never expose certificates", async () => {
  for (const [code, expected] of [
    ["CERT_HAS_EXPIRED", "TLS_CERTIFICATE_FAILED"],
    ["DEPTH_ZERO_SELF_SIGNED_CERT", "TLS_CERTIFICATE_FAILED"],
    ["ERR_TLS_CERT_ALTNAME_INVALID", "TLS_IDENTITY_FAILED"],
    [PRIVATE_ERROR, "TLS_HANDSHAKE_FAILED"]
  ]) {
    const f = fixture();
    f.options.startTls = (flags) => {
      f.calls.tls.push(flags);
      setImmediate(() => f.tlsSocket.emit("error", Object.assign(new Error(PRIVATE_ERROR), { code, cert: PRIVATE_ERROR })));
      return f.tlsSocket;
    };
    const result = await probeDatabaseTransport(PRIVATE_URL, f.options);
    assert.equal(result.code, expected);
    assert.equal(f.calls.tls[0].rejectUnauthorized, true);
    assert.ok(f.socket.destroyed && f.tlsSocket.destroyed);
    assertPrivate(result);
  }
  const f = fixture();
  f.tlsSocket.authorized = false;
  f.tlsSocket.authorizationError = PRIVATE_ERROR;
  const result = await probeDatabaseTransport(PRIVATE_URL, f.options);
  assert.equal(result.code, "TLS_VERIFICATION_FAILED");
  assertPrivate(result);
});

test("overall deadline bounds every stalled stage and destroys sockets", async () => {
  for (const stage of ["dns", "tcp", "postgres_ssl_request", "tls"]) {
    const f = fixture({ deadlineMs: 35 });
    if (stage === "dns") f.options.lookup = () => {};
    if (stage === "tcp") f.options.connect = () => f.socket;
    if (stage === "postgres_ssl_request") f.socket.response = undefined;
    if (stage === "tls") f.options.startTls = () => f.tlsSocket;
    const result = await probeDatabaseTransport(PRIVATE_URL, f.options);
    assert.equal(result.status, "failed");
    assert.equal(result.code, "DEADLINE_EXCEEDED");
    assert.equal(result.stages.at(-1).stage, stage);
    assert.ok(result.elapsedMs >= 25 && result.elapsedMs < 500);
    if (stage !== "dns") assert.ok(f.socket.destroyed);
    if (stage === "tls") assert.ok(f.tlsSocket.destroyed);
    assertPrivate(result);
  }
});

test("deadline cannot be disabled or extended beyond fifteen seconds", async () => {
  for (const deadlineMs of [0, -1, 15_001, Infinity, NaN, "15000"]) {
    const f = fixture({ deadlineMs });
    const result = await probeDatabaseTransport(PRIVATE_URL, f.options);
    assert.equal(result.code, "CONFIG_INVALID");
    assert.deepEqual(f.calls, { dns: [], tcp: [], tls: [] });
  }
});

test("late resolver errors cannot alter the completed result or leak details", async () => {
  let callback;
  const f = fixture({ deadlineMs: 20, lookup(_host, _flags, done) { callback = done; } });
  const result = await probeDatabaseTransport(PRIVATE_URL, f.options);
  const saved = JSON.stringify(result);
  callback(Object.assign(new Error(PRIVATE_ERROR), { code: PRIVATE_ERROR }));
  assert.equal(JSON.stringify(result), saved);
  assertPrivate(result);
});

test("standalone CLI sends exactly SSLRequest to a controlled loopback server", async (t) => {
  const received = [];
  const sockets = new Set();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("data", (bytes) => { received.push(Buffer.from(bytes)); socket.write("N"); });
    socket.on("close", () => sockets.delete(socket));
  });
  t.after(() => { for (const socket of sockets) socket.destroy(); return new Promise((resolve) => server.close(resolve)); });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const environment = { ...process.env, SUPABASE_DB_URL: `postgresql://private-user:private-password@localhost:${server.address().port}/private-database?sslmode=require` };
  for (const key of Object.keys(environment)) if (key.startsWith("PG")) delete environment[key];
  const result = await new Promise((resolve) => {
    execFile(process.execPath, [fileURLToPath(new URL("./probe-database-transport.mjs", import.meta.url))], { env: environment, timeout: 3_000 }, (error, stdout, stderr) => resolve({ code: error?.code ?? 0, stdout, stderr }));
  });
  assert.equal(result.code, 2);
  assert.equal(result.stderr, "");
  const report = JSON.parse(result.stdout);
  assert.equal(report.code, "POSTGRES_TLS_UNAVAILABLE");
  assertPrivate(report);
  const bytes = Buffer.concat(received);
  assert.equal(bytes.length, 8);
  assert.equal(bytes.readUInt32BE(0), 8);
  assert.equal(bytes.readUInt32BE(4), 80_877_103);
});
