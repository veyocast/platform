import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { readSupabaseAdminSecret } from "@veyocast/config/server";
import { resolveBlogConfig } from "./config";

export class BlogHttpError extends Error {
  constructor(readonly status: number, readonly code: string, message: string, readonly retryAfter?: number) { super(message); }
}
const messages: Record<string, string> = {
  INVALID_REQUEST: "Het verzoek is ongeldig. Controleer de artikelvelden en probeer opnieuw.",
  INVALID_CREDENTIAL: "De verbinding is niet geldig. Verbind de website opnieuw met een geldige credential.",
  PERMISSION_DENIED: "Deze actie is niet toegestaan. Controleer je rechten en de websiteverbinding.",
  NOT_FOUND: "Dit artikel of bestand is niet beschikbaar. Vernieuw het overzicht en probeer opnieuw.",
  SLUG_CONFLICT: "Deze URL is al gereserveerd voor een ander artikel. Kies een andere slug.",
  IDEMPOTENCY_CONFLICT: "Deze opdrachtcode hoort bij andere inhoud. Gebruik de oorspronkelijke opdracht of start een nieuwe.",
  REVISION_CONFLICT: "Het concept is inmiddels gewijzigd. Laad de actuele revisie en keur de inhoud opnieuw goed.",
  REVISION_REQUIRED: "De verwachte revisie ontbreekt. Laad het concept en stuur de revisie mee.",
  INVALID_MEDIA: "Deze afbeelding kon niet worden gecontroleerd. Kies een geldige JPEG, PNG of WebP binnen de limieten.",
  MEDIA_NOT_READY: "Het bestand is nog niet volledig verwerkt. Hervat dezelfde upload en probeer opnieuw.",
  RATE_LIMITED: "Er zijn tijdelijk te veel verzoeken. Wacht even en probeer dezelfde opdracht opnieuw.",
  TEMPORARILY_UNAVAILABLE: "De website is tijdelijk niet beschikbaar. Hervat dezelfde opdracht zodra de verbinding is hersteld."
};

export function blogError(code: string, status = 400, retryAfter?: number): BlogHttpError {
  return new BlogHttpError(status, code, messages[code] ?? messages.INVALID_REQUEST!, retryAfter);
}
export function sha256(value: string | Uint8Array) { return createHash("sha256").update(value).digest("hex"); }

function backendConfig(admin: boolean) {
  const origin = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key = admin ? readSupabaseAdminSecret() : process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (!origin || !key) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && process.env.VEYOCAST_ENVIRONMENT !== "production")) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
  return { origin: url.origin, key };
}
export function hasBlogPublicBackend() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY); }

async function backendFetch(path: string, init: RequestInit = {}, admin = false, accessToken?: string) {
  const { origin, key } = backendConfig(admin);
  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, { ...init, cache: "no-store", redirect: "error", signal: AbortSignal.timeout(20_000), headers: {
      apikey: key, Authorization: `Bearer ${accessToken ?? key}`, ...init.headers
    } });
  } catch { throw blogError("TEMPORARILY_UNAVAILABLE", 503); }
  if (!response.ok) {
    const failure = await response.json().catch(() => null) as { code?: string; message?: string } | null;
    const code = failure?.message === "INVALID_ASSET" ? "INVALID_MEDIA" : Object.keys(messages).find((candidate) => failure?.message === candidate) ?? "TEMPORARILY_UNAVAILABLE";
    const status = code === "INVALID_CREDENTIAL" ? 401 : code === "PERMISSION_DENIED" ? 403 : code === "NOT_FOUND" ? 404 : code === "RATE_LIMITED" ? 429 : ["SLUG_CONFLICT", "IDEMPOTENCY_CONFLICT", "REVISION_CONFLICT", "MEDIA_NOT_READY"].includes(code) ? 409 : code === "REVISION_REQUIRED" ? 428 : code === "TEMPORARILY_UNAVAILABLE" ? 503 : 400;
    throw blogError(code, status, code === "RATE_LIMITED" ? 60 : undefined);
  }
  return response;
}

export async function blogRpc<T = Record<string, unknown>>(name: string, payload: Record<string, unknown>, options: { admin?: boolean; accessToken?: string } = {}): Promise<T> {
  const response = await backendFetch(`/rest/v1/rpc/${name}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) }, options.admin, options.accessToken);
  return response.json() as Promise<T>;
}
export async function publicBlogRows<T>(table: "platform_blog_publications" | "platform_blog_routes" | "platform_blog_assets", parameters: URLSearchParams): Promise<T[]> {
  const response = await backendFetch(`/rest/v1/${table}?${parameters}`);
  return response.json() as Promise<T[]>;
}
export type BlogCommandResult = { httpStatus: number; body: Record<string, unknown> };
export async function blogCommand(operation: string, options: { externalId?: string; payload?: unknown; expectedRevision?: number | null; idempotencyKey?: string; tokenHash?: string; accessToken?: string } = {}) {
  const config = resolveBlogConfig();
  if (options.accessToken && operation !== "capabilities") {
    const destination = await blogRpc<BlogCommandResult>("blog_command", {
      p_site_id: config.siteId, p_environment: config.environment, p_operation: "capabilities",
      p_external_id: "", p_payload: {}, p_expected_revision: null, p_idempotency_key: "", p_token_hash: null
    }, { accessToken: options.accessToken });
    if (destination.body.publicOrigin !== config.publicOrigin) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
  }
  return blogRpc<BlogCommandResult>("blog_command", {
    p_site_id: config.siteId, p_environment: config.environment, p_operation: operation,
    p_external_id: options.externalId ?? "", p_payload: options.payload ?? {}, p_expected_revision: options.expectedRevision ?? null,
    p_idempotency_key: options.idempotencyKey ?? "", p_token_hash: options.tokenHash ?? null
  }, { admin: Boolean(options.tokenHash), accessToken: options.accessToken });
}
export async function authorizeBlogToken(request: Request, scope: string) {
  const token = /^Bearer ([A-Za-z0-9_-]{32,256})$/u.exec(request.headers.get("authorization") ?? "")?.[1];
  if (!token) throw blogError("INVALID_CREDENTIAL", 401);
  const hash = sha256(token); const config = resolveBlogConfig();
  const credential = await blogRpc<{ allowed: boolean; id: string; scopes: string[]; publicOrigin: string; code?: string; retryAfter?: number }>("blog_authorize_token", {
    p_token_hash: hash, p_site_id: config.siteId, p_environment: config.environment, p_scope: scope
  }, { admin: true });
  if (credential.allowed === false && credential.code === "RATE_LIMITED") throw blogError("RATE_LIMITED", 429, credential.retryAfter ?? 60);
  if (credential.allowed !== true || !Array.isArray(credential.scopes) || credential.publicOrigin !== config.publicOrigin) throw blogError("TEMPORARILY_UNAVAILABLE", 503);
  return { hash, scopes: credential.scopes };
}

export const blogMediaLimit = 8 * 1024 * 1024;
export function requestKey(request: Request) {
  const key = request.headers.get("idempotency-key");
  if (!key || !/^[A-Za-z0-9_.:/-]{8,200}$/u.test(key)) throw blogError("INVALID_REQUEST");
  return key;
}
export async function boundedRequestBytes(request: Request, limit: number): Promise<Uint8Array> {
  const length = request.headers.get("content-length");
  if (length && (!/^\d+$/u.test(length) || Number(length) > limit)) throw blogError("INVALID_MEDIA", 413);
  if (!request.body) throw blogError("INVALID_REQUEST");
  const reader = request.body.getReader(); const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > limit) { await reader.cancel(); throw blogError(limit > 1_000_000 ? "INVALID_MEDIA" : "INVALID_REQUEST", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const result = new Uint8Array(size); let position = 0;
  for (const chunk of chunks) { result.set(chunk, position); position += chunk.byteLength; }
  return result;
}
export async function readBlogJson(request: Request): Promise<Record<string, unknown>> {
  if (request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") throw blogError("INVALID_REQUEST", 415);
  try {
    const bytes = await boundedRequestBytes(request, 300_000);
    const body = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) throw blogError("INVALID_REQUEST");
    return body;
  } catch (error) { if (error instanceof BlogHttpError) throw error; throw blogError("INVALID_REQUEST"); }
}
export function blogJson(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff", ...extra } });
}
export function blogFailure(error: unknown) {
  const failure = error instanceof BlogHttpError ? error : error instanceof Error && error.name === "BlogValidationError" ? blogError("INVALID_REQUEST") : blogError("TEMPORARILY_UNAVAILABLE", 503);
  return blogJson({ error: { code: failure.code, message: failure.message }, requestId: randomUUID() }, failure.status, failure.retryAfter ? { "Retry-After": String(failure.retryAfter) } : {});
}

export async function uploadBlogStorage(path: string, bytes: Uint8Array, type: string, accessToken?: string) {
  return backendFetch(`/storage/v1/object/platform_blog_media/${path.split("/").map(encodeURIComponent).join("/")}`, { method: "POST", headers: { "Content-Type": type, "x-upsert": "false" }, body: bytes as BodyInit }, !accessToken, accessToken);
}
export async function downloadBlogStorage(path: string, accessToken?: string): Promise<Uint8Array> {
  const response = await backendFetch(`/storage/v1/object/authenticated/platform_blog_media/${path.split("/").map(encodeURIComponent).join("/")}`, {}, !accessToken, accessToken);
  return new Uint8Array(await response.arrayBuffer());
}
