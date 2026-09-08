import { test } from "node:test";
import assert from "node:assert/strict";
import { createPageStore } from "./store-page.js";
import { createSketch } from "./payload.js";

function memoryStorage() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, String(v)); },
    removeItem: (k) => { map.delete(k); },
  };
}

test("save writes JSON to input and storage", () => {
  const input = { value: "" };
  const storage = memoryStorage();
  const store = createPageStore({ input, storage, storageKey: "k" });
  const sketch = createSketch({ productId: "botella", variantColor: "rojo" });
  store.save(sketch);
  assert.ok(input.value.includes("botella"));
  assert.ok(storage.getItem("k").includes("botella"));
});

test("load roundtrip", () => {
  const input = { value: "" };
  const storage = memoryStorage();
  const store = createPageStore({ input, storage, storageKey: "k" });
  store.save(createSketch({ productId: "botella", variantColor: "rojo" }));
  const loaded = store.load();
  assert.equal(loaded.productId, "botella");
  assert.equal(loaded.variantColor, "rojo");
});

test("clear empties both", () => {
  const input = { value: "x" };
  const storage = memoryStorage();
  const store = createPageStore({ input, storage, storageKey: "k" });
  store.save(createSketch({ productId: "botella" }));
  store.clear();
  assert.equal(input.value, "");
  assert.equal(storage.getItem("k"), null);
});

test("invalid JSON returns null", () => {
  const input = { value: "{not-json" };
  const storage = memoryStorage();
  storage.setItem("k", "{not-json");
  const store = createPageStore({ input, storage, storageKey: "k" });
  assert.equal(store.load(), null);
});
