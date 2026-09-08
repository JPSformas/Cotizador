import { validateSketch } from "./payload.js";

export const DEFAULT_STORAGE_KEY = "formas:boceto:pdp";

export function createPageStore({ input, storage, storageKey = DEFAULT_STORAGE_KEY }) {
  function save(sketch) {
    const json = JSON.stringify(sketch);
    if (input) input.value = json;
    try {
      storage.setItem(storageKey, json);
    } catch (e) { /* quota */ }
  }

  function load() {
    let raw = "";
    try {
      raw = (storage && storage.getItem(storageKey)) || (input && input.value) || "";
    } catch (e) {
      raw = (input && input.value) || "";
    }
    if (!raw) return null;
    try {
      const data = JSON.parse(raw);
      const check = validateSketch(data);
      return check.ok ? data : null;
    } catch (e) {
      return null;
    }
  }

  function clear() {
    if (input) input.value = "";
    try {
      storage.removeItem(storageKey);
    } catch (e) { /* ignore */ }
  }

  return { save, load, clear };
}
