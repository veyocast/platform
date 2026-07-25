import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";

const adapterSource = await readFile(
  resolve(import.meta.dirname, "..", "platform-adapter.js"),
  "utf8"
);

function createAdapter() {
  const listeners = new Map();
  const documentListeners = new Map();
  const window = {
    addEventListener(type, listener) {
      listeners.set(type, listener);
    },
    document: {
      addEventListener(type, listener) {
        documentListeners.set(type, listener);
      },
      removeEventListener(type) {
        documentListeners.delete(type);
      },
      visibilityState: "visible"
    },
    innerHeight: 1080,
    innerWidth: 1920,
    isFinite,
    navigator: {
      language: "nl-NL",
      onLine: true,
      storage: {
        estimate: async () => ({ quota: 2048, usage: 512 })
      },
      userAgent: "Mozilla/5.0 (Web0S; Linux/SmartTV)"
    },
    Number,
    Object,
    removeEventListener(type) {
      listeners.delete(type);
    },
    screen: {
      height: 1080,
      width: 1920
    }
  };
  window.window = window;
  vm.runInNewContext(adapterSource, { window });
  return window.VeyoCastLgPlatformAdapter;
}

test("normaliseert LG- en standaardremote-input zonder onbekende toetsen", () => {
  const adapter = createAdapter();
  assert.equal(adapter.normalizeRemoteInput({ keyCode: 461 }), "back");
  assert.equal(adapter.normalizeRemoteInput({ key: "Enter" }), "enter");
  assert.equal(adapter.normalizeRemoteInput({ key: "ArrowRight" }), "right");
  assert.equal(adapter.normalizeRemoteInput({ key: "a" }), null);
});

test("rapporteert alleen veilige platforminformatie en geen verzonnen LG-versies", () => {
  const adapter = createAdapter();
  const capabilities = adapter.detectCapabilities();
  assert.equal(capabilities.appId, "nl.veyocast.player.webos");
  assert.equal(capabilities.platformInfo.orientation, "landscape");
  assert.equal(capabilities.platformInfo.webOsDetected, true);
  assert.equal(capabilities.platformInfo.webOsVersion, null);
  assert.equal(capabilities.platformInfo.firmwareVersion, null);
});

test("weigert restart en reboot totdat officiële APIs fysiek zijn gevalideerd", () => {
  const adapter = createAdapter();
  assert.equal(adapter.requestApplicationRestart().supported, false);
  assert.equal(adapter.requestControlledReboot().supported, false);
});
