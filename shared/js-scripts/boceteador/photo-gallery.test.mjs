import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { listPhotos, getCurrent, samePhotoUrl } from "./photo-gallery.js";

function item(opts) {
  const img = {
    currentSrc: opts.thumb || opts.url,
    getAttribute(k) {
      if (k === "src") return opts.thumb || opts.url;
      if (k === "alt") return opts.alt || "";
      return null;
    },
  };
  return {
    getAttribute(k) {
      if (k === "data-image") return opts.url;
      if (k === "data-type") return opts.type || "product";
      if (k === "data-boceto") return opts.boceto || null;
      return null;
    },
    querySelector(sel) {
      return sel === "img" ? img : null;
    },
  };
}

function grid(items) {
  return {
    querySelectorAll(sel) {
      if (sel === ".image-item[data-image]") return items;
      return [];
    },
  };
}

function page(parts) {
  const selected = {
    currentSrc: parts.main || "",
    getAttribute(k) {
      return k === "src" ? parts.main || "" : null;
    },
  };
  return {
    querySelector(sel) {
      if (sel === "#productImagesGrid") return parts.product || null;
      if (sel === "#uploadedImagesGrid") return parts.uploaded || null;
      if (sel === "#zakekeImagesGrid") return parts.zakeke || null;
      if (sel === "#selectedProductImage") return selected;
      return null;
    },
  };
}

describe("photo-gallery listPhotos", () => {
  it("walks product, uploaded, zakeke and skips bocetos and duplicates", () => {
    const root = page({
      product: grid([
        item({ url: "../shared/IMG/frente.jpg", alt: "Frente" }),
        item({ url: "../shared/IMG/frente.jpg", alt: "dup" }),
      ]),
      uploaded: grid([
        item({ url: "data:image/png;base64,aa", type: "uploaded", alt: "Subida" }),
      ]),
      zakeke: grid([
        item({ url: "../shared/IMG/placeholder3.jpg", type: "zakeke", alt: "Zakeke" }),
        item({ url: "data:image/png;base64,bb", type: "boceto", boceto: "1", alt: "Boceto" }),
      ]),
    });
    const photos = listPhotos(root);
    assert.deepEqual(photos.map((p) => p.url), [
      "../shared/IMG/frente.jpg",
      "data:image/png;base64,aa",
      "../shared/IMG/placeholder3.jpg",
    ]);
    assert.equal(photos[0].alt, "Frente");
    assert.equal(photos[0].color, "");
  });

  it("getCurrent matches the main image, else the first still", () => {
    const root = page({
      main: "../shared/IMG/dorso.jpg",
      product: grid([
        item({ url: "../shared/IMG/frente.jpg", alt: "Frente" }),
        item({ url: "../shared/IMG/dorso.jpg", alt: "Dorso" }),
      ]),
    });
    const cur = getCurrent(root);
    assert.equal(cur.url, "../shared/IMG/dorso.jpg");
    assert.equal(cur.alt, "Dorso");
  });

  it("getCurrent falls back to first still when main is a boceto", () => {
    const root = page({
      main: "data:image/png;base64,bb",
      product: grid([item({ url: "../shared/IMG/frente.jpg", alt: "Frente" })]),
      zakeke: grid([
        item({ url: "data:image/png;base64,bb", type: "boceto", boceto: "1" }),
      ]),
    });
    const cur = getCurrent(root);
    assert.equal(cur.url, "../shared/IMG/frente.jpg");
  });

  it("samePhotoUrl matches relative vs filename", () => {
    assert.equal(samePhotoUrl("../shared/IMG/x.jpg", "../shared/IMG/x.jpg"), true);
    assert.equal(samePhotoUrl("/app/shared/IMG/x.jpg", "../shared/IMG/x.jpg"), true);
    assert.equal(samePhotoUrl("a.jpg", "b.jpg"), false);
  });
});
