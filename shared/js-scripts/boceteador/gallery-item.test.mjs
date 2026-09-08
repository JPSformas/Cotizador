import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { applyComposed, removeBocetos } from "./gallery-item.js";

function page() {
  const wrapper = { dataset: {} };
  const main = {
    src: "old.jpg",
    parentElement: wrapper,
    closest(sel) {
      return sel === "[data-product-images]" ? null : null;
    },
    setAttribute(k, v) {
      if (k === "src") this.src = v;
    },
  };
  const children = [];
  const grid = {
    children,
    insertAdjacentHTML(pos, html) {
      if (pos !== "afterbegin") throw new Error("expected afterbegin");
      children.unshift({
        html,
        getAttribute(k) {
          if (k === "data-boceto" && html.includes('data-boceto="1"')) return "1";
          return null;
        },
        remove() {
          const i = children.indexOf(this);
          if (i >= 0) children.splice(i, 1);
        },
      });
    },
    querySelectorAll(sel) {
      if (sel.includes("data-boceto")) return children.filter((c) => c.getAttribute("data-boceto") === "1");
      return [];
    },
  };
  const root = {
    main,
    grid,
    wrapper,
    querySelector(sel) {
      if (sel === "#selectedProductImage") return main;
      if (sel === "#zakekeImagesGrid") return grid;
      return null;
    },
    querySelectorAll(sel) {
      if (sel.includes("data-boceto")) return grid.querySelectorAll(sel);
      return [];
    },
  };
  return root;
}

describe("gallery-item applyComposed", () => {
  it("replaces the main image, records slot 1, and prepends a boceto tile", () => {
    const root = page();
    applyComposed("data:image/png;base64,xx", root);
    assert.equal(root.main.src, "data:image/png;base64,xx");
    assert.equal(root.wrapper.dataset.selectedImageUrls, JSON.stringify(["data:image/png;base64,xx"]));
    assert.equal(root.grid.children.length, 1);
    assert.match(root.grid.children[0].html, /data-boceto="1"/);
    assert.match(root.grid.children[0].html, /data-type="boceto"/);
    assert.match(root.grid.children[0].html, /Boceto personalizado/);
  });

  it("replace is idempotent: a second apply leaves a single boceto tile", () => {
    const root = page();
    applyComposed("data:image/png;base64,aa", root);
    applyComposed("data:image/png;base64,bb", root);
    assert.equal(root.grid.children.length, 1);
    assert.match(root.grid.children[0].html, /data:image\/png;base64,bb/);
    assert.equal(root.main.src, "data:image/png;base64,bb");
  });

  it("removeBocetos drops injected tiles", () => {
    const root = page();
    applyComposed("data:image/png;base64,aa", root);
    removeBocetos(root);
    assert.equal(root.grid.children.length, 0);
  });
});
