import { test } from "node:test";
import assert from "node:assert/strict";
import {
  createEditorState,
  setZone,
  addLogo,
  snapshotPlacement,
  restorePlacement,
  measuresOk,
} from "./core.js";

test("createEditorState defaults", () => {
  const s = createEditorState();
  assert.equal(s.zone, null);
  assert.deepEqual(s.logos, []);
  assert.equal(s.sel, -1);
  assert.equal(s.mode, "logo");
  assert.equal(s.unit, "cm");
});

test("setZone clamps to 0-1", () => {
  const s = createEditorState();
  setZone(s, { x: -0.2, y: 0.1, w: 2, h: 0.3 });
  assert.ok(s.zone.x >= 0);
  assert.ok(s.zone.y >= 0);
  assert.ok(s.zone.w <= 1);
  assert.ok(s.zone.x + s.zone.w <= 1 + 1e-9);
});

test("snapshotPlacement strips DOM nodes", () => {
  const s = createEditorState();
  setZone(s, { x: 0.1, y: 0.1, w: 0.4, h: 0.4 });
  addLogo(s, { src: "data:x", name: "a.png", x: 0.1, y: 0.1, w: 0.2, h: 0.2, el: {}, img: {} });
  const snap = snapshotPlacement(s);
  assert.equal(snap.logos[0].el, undefined);
  assert.equal(snap.logos[0].img, undefined);
  assert.equal(snap.logos[0].src, "data:x");
});

test("snapshotPlacement keeps crop metadata and strips DOM", () => {
  const s = createEditorState();
  addLogo(s, {
    src: "data:x",
    name: "a.png",
    crop: { x: 1, y: 2, w: 10, h: 8, trimmed: true },
    whiteRemoved: true,
    el: {},
    img: {},
  });
  const snap = snapshotPlacement(s);
  assert.equal(snap.logos[0].el, undefined);
  assert.deepEqual(snap.logos[0].crop, { x: 1, y: 2, w: 10, h: 8, trimmed: true });
  assert.equal(snap.logos[0].whiteRemoved, true);
});

test("measuresOk requires cm in logo mode", () => {
  const s = createEditorState();
  addLogo(s, { src: "data:x", cmW: 0, cmH: 0 });
  assert.equal(measuresOk(s), false);
  s.logos[0].cmW = 4;
  s.logos[0].cmH = 2;
  assert.equal(measuresOk(s), true);
});

test("restorePlacement roundtrip", () => {
  const s = createEditorState();
  setZone(s, { x: 0.2, y: 0.2, w: 0.5, h: 0.5 });
  addLogo(s, { src: "data:y", name: "b.png", x: 0.25, y: 0.25, w: 0.1, h: 0.1 });
  const snap = snapshotPlacement(s);
  const s2 = restorePlacement(createEditorState(), snap);
  assert.deepEqual(s2.zone, s.zone);
  assert.equal(s2.logos.length, 1);
  assert.equal(s2.logos[0].src, "data:y");
});
