import { test } from "node:test";
import assert from "node:assert/strict";
import { createSketch, validateSketch } from "./payload.js";

test("createSketch fills required keys", () => {
  const s = createSketch({ productId: "botella", variantColor: "rojo" });
  assert.equal(s.productId, "botella");
  assert.equal(s.variantColor, "rojo");
  assert.equal(s.status, "attached");
  assert.equal(s.composedImage, "");
  assert.deepEqual(s.logoFiles, []);
  assert.equal(s.engraved, false);
});

test("validateSketch rejects missing productId", () => {
  const r = validateSketch(createSketch({}));
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes("productId"));
});

test("validateSketch accepts a full sketch", () => {
  const r = validateSketch(createSketch({
    productId: "botella",
    variantColor: "rojo",
    sourcePhotoUrl: "images/products/botella-detail-1.jpg",
    composedImage: "data:image/png;base64,AAA",
    placement: { zone: { x: 0, y: 0, w: 1, h: 1 }, logos: [] },
  }));
  assert.equal(r.ok, true);
});

test("validateSketch rejects invalid print color hex", () => {
  const r = validateSketch(createSketch({
    productId: "botella",
    printColors: [{ hex: "red", nom: "Rojo", pant: "" }],
  }));
  assert.equal(r.ok, false);
  assert.ok(r.errors.includes("printColors.hex"));
});
