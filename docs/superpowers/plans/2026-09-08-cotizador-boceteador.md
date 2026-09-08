# Cotizador Boceteador embed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embed the shop Boceteador editor on Cotizador catalog item pages so Personalizar composes a mockup onto `#selectedProductImage` and the image-modal gallery.

**Architecture:** Snapshot-copy the shop editor engine into `shared/js-scripts/boceteador/`. Add Cotizador adapters (`photo-gallery.js` reads the image-modal grids, `gallery-item.js` writes the main image + `#zakekeImagesGrid`, `host.js` boots the button). Do not copy Swiper or cart hosts.

**Tech Stack:** Vanilla ES modules (engine), existing ES5 IIFE for `select-image-modal.js`, Bootstrap 5.3.3, `node:test`, Playwright 1.60.

**Spec:** `docs/superpowers/specs/2026-09-08-cotizador-boceteador-design.md`

## Global Constraints

- Serve from the **repo root**. `v5/` or `v6/` as document root breaks `../shared/` and `ui.js` fetching `modal.html`.
- Engine files are a **snapshot copy** from `Formas shop/modave/js/boceteador/`. The only allowed edit to copied `ui.js` is the `samePhotoUrl` import path.
- Do **not** copy `host.js`, `photo-swiper.js`, `gallery-swiper.js`, `cart-bridge.js`, or their tests from the shop.
- Do **not** wire `editItem-generico*`, `detalle-cotizacion.html`, or `table-select-image-modal.js`.
- Storage key is exactly `formas:boceto:editItem`. Button copy: `Personalizar` / `Editar personalización`.
- `node --test` for adapter unit tests. Playwright verify uses port **8098** in a new file; do not edit `docs/verify-bulk-cantidades.mjs`.
- UI copy is Spanish. Do not translate engine chrome.

## File map

| Path | Responsibility |
|---|---|
| `shared/js-scripts/boceteador/{core,logo-pipeline,payload,print-colors,pantones,store-page,ui,modal.html}` + tests | Copied engine |
| `shared/styles/boceteador.css` | Copied modal CSS |
| `shared/js-scripts/boceteador/photo-gallery.js` | Read stills from the three image grids |
| `shared/js-scripts/boceteador/gallery-item.js` | Write composed PNG to main image + zakeke grid |
| `shared/js-scripts/boceteador/host.js` | Button, `createUi`, save, restore |
| `shared/js-scripts/select-image-modal.js` | Event delegation so new tiles are clickable |
| `v6/editItem.html`, `v5/editItem.html` | Opt-in markup + script tags |
| `docs/verify-boceteador.mjs` | Playwright checks |

Shop source root (copy from, never modify):

`C:\Users\user\Desktop\themeforest-pUJssqZB-modave-multipurpose-ecommerce-html-template\Formas shop\modave\`

---

### Task 1: Copy the engine snapshot

Prove the copy with the shop's existing `node:test` files. Nothing is wired to a page yet.

**Files:**
- Create: `shared/js-scripts/boceteador/` (directory)
- Create (copy): `core.js`, `core.test.mjs`, `logo-pipeline.js`, `payload.js`, `payload.test.mjs`, `print-colors.js`, `pantones.js`, `store-page.js`, `store-page.test.mjs`, `ui.js`, `modal.html`
- Create (copy): `shared/styles/boceteador.css`
- Modify: `package.json` (add `test:boceteador`)

**Interfaces:**
- Produces: engine modules at `shared/js-scripts/boceteador/*.js` with the same exports as the shop (`createUi`, `createSketch`, `validateSketch`, `createPageStore`, …).
- Produces: npm script `test:boceteador` → `node --test shared/js-scripts/boceteador/*.test.mjs`

- [ ] **Step 1: Copy engine files and CSS**

From the Cotizador repo root, in PowerShell:

```powershell
$shop = "C:\Users\user\Desktop\themeforest-pUJssqZB-modave-multipurpose-ecommerce-html-template\Formas shop\modave"
$dst = "shared\js-scripts\boceteador"
New-Item -ItemType Directory -Force -Path $dst | Out-Null
$files = @(
  "core.js","core.test.mjs","logo-pipeline.js",
  "payload.js","payload.test.mjs","print-colors.js","pantones.js",
  "store-page.js","store-page.test.mjs","ui.js","modal.html"
)
foreach ($f in $files) { Copy-Item -Path "$shop\js\boceteador\$f" -Destination "$dst\$f" }
Copy-Item -Path "$shop\css\boceteador.css" -Destination "shared\styles\boceteador.css"
```

Do not copy `host.js`, `photo-swiper.js`, `gallery-swiper.js`, `cart-bridge.js`, or `*.test.mjs` besides `core`, `payload`, and `store-page`.

- [ ] **Step 2: Add the npm script**

In `package.json` `scripts`, add next to `verify:bulk`:

```json
"test:boceteador": "node --test shared/js-scripts/boceteador/*.test.mjs"
```

- [ ] **Step 3: Run engine tests**

Run: `npm run test:boceteador`

Expected: PASS. `core`, `payload`, and `store-page` tests run. They do not import `ui.js`, so the still-shop `photo-swiper.js` import inside `ui.js` is unused and does not fail yet.

- [ ] **Step 4: Commit**

```bash
git add shared/js-scripts/boceteador shared/styles/boceteador.css package.json
git commit -m "chore: snapshot-copy Boceteador engine into Cotizador shared/"
```

---

### Task 2: Photo adapter (`photo-gallery.js`)

**Files:**
- Create: `shared/js-scripts/boceteador/photo-gallery.js`
- Create: `shared/js-scripts/boceteador/photo-gallery.test.mjs`
- Modify: `shared/js-scripts/boceteador/ui.js` (one import line)

**Interfaces:**
- Consumes: nothing from later tasks.
- Produces:
  - `samePhotoUrl(a: string, b: string): boolean`
  - `listPhotos(root = document): Array<{ url: string, thumb: string, alt: string, color: string }>`
  - `getCurrent(root = document): { url: string, thumb: string, alt: string, color: string }`
- `color` is always `""`.
- `ui.js` imports `samePhotoUrl` from `./photo-gallery.js` instead of `./photo-swiper.js`.

- [ ] **Step 1: Write the failing tests**

Create `shared/js-scripts/boceteador/photo-gallery.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test shared/js-scripts/boceteador/photo-gallery.test.mjs`

Expected: FAIL with `Cannot find module` / `ERR_MODULE_NOT_FOUND` for `./photo-gallery.js`.

- [ ] **Step 3: Implement `photo-gallery.js`**

Create `shared/js-scripts/boceteador/photo-gallery.js`:

```js
const GRID_IDS = ["productImagesGrid", "uploadedImagesGrid", "zakekeImagesGrid"];

export function samePhotoUrl(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = String(a).split("?")[0].replace(/^\.\//, "");
  const nb = String(b).split("?")[0].replace(/^\.\//, "");
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

function imgUrl(img) {
  if (!img) return "";
  return img.currentSrc || img.getAttribute("src") || "";
}

function isBoceto(el) {
  return el.getAttribute("data-type") === "boceto" || el.getAttribute("data-boceto") === "1";
}

function stillFromItem(el) {
  if (!el || isBoceto(el)) return null;
  const url = el.getAttribute("data-image") || "";
  if (!url) return null;
  const img = el.querySelector("img");
  return {
    url,
    thumb: imgUrl(img) || url,
    alt: (img && img.getAttribute("alt")) || "",
    color: "",
  };
}

export function listPhotos(root = document) {
  const seen = new Set();
  const out = [];
  GRID_IDS.forEach((id) => {
    const grid = root.querySelector("#" + id);
    if (!grid) return;
    const items = grid.querySelectorAll(".image-item[data-image]");
    for (let i = 0; i < items.length; i++) {
      const still = stillFromItem(items[i]);
      if (!still) continue;
      const key = still.url.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(still);
    }
  });
  return out;
}

export function getCurrent(root = document) {
  const main = root.querySelector("#selectedProductImage");
  const url = (main && (main.currentSrc || main.getAttribute("src"))) || "";
  const photos = listPhotos(root);
  const match = photos.find((p) => samePhotoUrl(p.url, url));
  if (match) return match;
  return photos[0] || { url: "", thumb: "", alt: "", color: "" };
}
```

- [ ] **Step 4: Point `ui.js` at `photo-gallery.js`**

In `shared/js-scripts/boceteador/ui.js`, change only this line:

```js
import { samePhotoUrl } from "./photo-gallery.js";
```

It currently reads `from "./photo-swiper.js"`. No other engine edits.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npm run test:boceteador`

Expected: PASS, including the new `photo-gallery` cases.

- [ ] **Step 6: Commit**

```bash
git add shared/js-scripts/boceteador/photo-gallery.js shared/js-scripts/boceteador/photo-gallery.test.mjs shared/js-scripts/boceteador/ui.js
git commit -m "feat: read Cotizador image-modal stills for Boceteador step 1"
```

---

### Task 3: Gallery writer (`gallery-item.js`)

**Files:**
- Create: `shared/js-scripts/boceteador/gallery-item.js`
- Create: `shared/js-scripts/boceteador/gallery-item.test.mjs`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `applyComposed(composedUrl: string, root = document): void`
  - `removeBocetos(root = document): void`
- Tile markup: `.image-item` with `data-image`, `data-type="boceto"`, `data-boceto="1"`, `data-id="boceto-1"`, inner `<img alt="Boceto personalizado">`.
- `applyComposed` sets `#selectedProductImage.src`, writes `dataset.selectedImageUrls` on `closest("[data-product-images]")` or `parentElement`, removes previous boceto tiles, prepends one new tile into `#zakekeImagesGrid`.

- [ ] **Step 1: Write the failing tests**

Create `shared/js-scripts/boceteador/gallery-item.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test shared/js-scripts/boceteador/gallery-item.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `./gallery-item.js`.

- [ ] **Step 3: Implement `gallery-item.js`**

Create `shared/js-scripts/boceteador/gallery-item.js`:

```js
function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function itemHtml(composedUrl) {
  const src = escapeAttr(composedUrl);
  return (
    '<div class="image-item" data-image="' + src + '" data-type="boceto" data-boceto="1" data-id="boceto-1">' +
    '<img src="' + src + '" alt="Boceto personalizado">' +
    "</div>"
  );
}

export function removeBocetos(root = document) {
  const found = root.querySelectorAll("#zakekeImagesGrid [data-boceto='1']");
  for (let i = found.length - 1; i >= 0; i--) {
    if (found[i] && typeof found[i].remove === "function") found[i].remove();
  }
}

export function applyComposed(composedUrl, root = document) {
  const main = root.querySelector("#selectedProductImage");
  if (main) {
    main.src = composedUrl;
    if (typeof main.setAttribute === "function") main.setAttribute("src", composedUrl);
  }
  const container = main && ((main.closest && main.closest("[data-product-images]")) || main.parentElement);
  if (container && container.dataset) {
    container.dataset.selectedImageUrls = JSON.stringify([composedUrl]);
  }
  removeBocetos(root);
  const grid = root.querySelector("#zakekeImagesGrid");
  if (grid && typeof grid.insertAdjacentHTML === "function") {
    grid.insertAdjacentHTML("afterbegin", itemHtml(composedUrl));
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm run test:boceteador`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add shared/js-scripts/boceteador/gallery-item.js shared/js-scripts/boceteador/gallery-item.test.mjs
git commit -m "feat: write Boceteador composed image into Cotizador gallery"
```

---

### Task 4: Image-modal click delegation

Without this, a prepended boceto tile in `#zakekeImagesGrid` is not selectable.

**Files:**
- Modify: `shared/js-scripts/select-image-modal.js` (the `DOMContentLoaded` click bindings around the `#productImagesGrid` / `#zakekeImagesGrid` `forEach`)

**Interfaces:**
- Consumes: existing `handleImageSelect(imageItem)`.
- Produces: clicks on any `.image-item` inside `#imageModal` select it, including nodes added after boot. `.image-delete-btn` still does not select.

- [ ] **Step 1: Replace the static product/zakeke click bindings**

In `shared/js-scripts/select-image-modal.js`, delete this block:

```js
    // Add click events to all image items for selection (product and zakeke images)
    document.querySelectorAll('#productImagesGrid .image-item, #zakekeImagesGrid .image-item').forEach(item => {
      item.addEventListener('click', (e) => {
        // Only select if not clicking the delete button or badge
        if (!e.target.classList.contains('image-delete-btn') && 
            !e.target.closest('.image-delete-btn') &&
            !e.target.classList.contains('selection-number-badge')) {
          handleImageSelect(item);
        }
      });
    });
```

Put this in its place (keep using the existing `handleImageSelect`; uploaded tiles already have their own listener in `renderUploadedImages`, and `handleImageSelect` is idempotent enough that a second delegated click on an uploaded item still toggles once per click because the uploaded listener and the delegated listener would double-fire).

To avoid double-toggle on uploaded items, ignore clicks that originate inside `#uploadedImagesGrid` in the delegated handler — those stay on the per-item listeners created in `renderUploadedImages`:

```js
    if (imageModal) {
      imageModal.addEventListener('click', (e) => {
        if (e.target.closest('#uploadedImagesGrid')) return;
        if (e.target.classList.contains('image-delete-btn') ||
            e.target.closest('.image-delete-btn') ||
            e.target.classList.contains('selection-number-badge')) {
          return;
        }
        const item = e.target.closest('.image-item');
        if (!item || !imageModal.contains(item)) return;
        handleImageSelect(item);
      });
    }
```

Do not edit `table-select-image-modal.js`.

- [ ] **Step 2: Commit**

```bash
git add shared/js-scripts/select-image-modal.js
git commit -m "fix: select dynamically added Boceteador tiles in the image modal"
```

(Playwright in Task 7 asserts the click does not throw.)

---

### Task 5: Host + v6 wiring

First visible embed. `host.js` no-ops without `#personalizarBtn`.

**Files:**
- Create: `shared/js-scripts/boceteador/host.js`
- Modify: `v6/editItem.html`

**Interfaces:**
- Consumes: `createUi` from `./ui.js`, `listPhotos` / `getCurrent` from `./photo-gallery.js`, `applyComposed` / `removeBocetos` from `./gallery-item.js`, `createPageStore` from `./store-page.js`.
- Produces: `window.FormasBoceto = { open, getSketch, clear, on }`
- Storage key: `formas:boceto:editItem`
- `productId`: `#SKU` trimmed, else `"editItem-product"`
- `variantColor`: `""`
- Events: `saved`, `cleared`

- [ ] **Step 1: Write `host.js`**

Create `shared/js-scripts/boceteador/host.js`:

```js
import { createUi } from "./ui.js";
import { getCurrent, listPhotos } from "./photo-gallery.js";
import { applyComposed, removeBocetos } from "./gallery-item.js";
import { createPageStore } from "./store-page.js";

const STORAGE_KEY = "formas:boceto:editItem";
const listeners = { saved: [], cleared: [] };

function emit(name, detail) {
  (listeners[name] || []).forEach((fn) => fn(detail));
}

function productIdFromPage() {
  const sku = document.getElementById("SKU");
  const v = sku && String(sku.value || "").trim();
  return v || "editItem-product";
}

function setOpenLabel(btn, sketch) {
  if (!btn) return;
  const text = btn.querySelector(".text") || btn;
  text.textContent = sketch ? "Editar personalización" : "Personalizar";
}

async function boot() {
  const openButton = document.getElementById("personalizarBtn");
  let modalRoot = document.getElementById("formas-boceto-modal");
  const jsonInput = document.getElementById("formas-boceto-json");
  if (!openButton || !modalRoot) return;

  const store = createPageStore({
    input: jsonInput,
    storage: window.sessionStorage,
    storageKey: STORAGE_KEY,
  });
  const ui = await createUi(modalRoot);
  modalRoot = ui.root;

  let current = store.load();
  setOpenLabel(openButton, current);
  if (current && current.composedImage) {
    applyComposed(current.composedImage);
  }

  ui.onSave((sketch) => {
    current = sketch;
    store.save(sketch);
    applyComposed(sketch.composedImage);
    setOpenLabel(openButton, sketch);
    emit("saved", sketch);
  });

  function open() {
    const photo = getCurrent();
    const opts = {
      productId: productIdFromPage(),
      variantColor: "",
      photoUrl: (current && current.sourcePhotoUrl) || photo.url,
      photoName: photo.alt,
      photos: listPhotos(),
    };
    if (current && current.placement) {
      opts.placement = current.placement;
      opts.photoUrl = current.sourcePhotoUrl || photo.url;
      opts.technique = current.technique;
      opts.printColors = current.printColors;
    }
    ui.open(opts);
  }

  function clear() {
    current = null;
    store.clear();
    removeBocetos();
    setOpenLabel(openButton, null);
    emit("cleared");
  }

  openButton.addEventListener("click", open);

  window.FormasBoceto = {
    open,
    getSketch: () => current,
    clear,
    on(event, fn) {
      if (listeners[event]) listeners[event].push(fn);
    },
  };
}

boot().catch((err) => {
  console.error("FormasBoceto failed to start", err);
});
```

- [ ] **Step 2: Wire `v6/editItem.html`**

In `<head>`, after `select-image-modal.css`:

```html
  <link href="../shared/styles/boceteador.css" rel="stylesheet">
```

Immediately after `#personalizarBtn` (still inside the `col-md-3` stack):

```html
            <input type="hidden" id="formas-boceto-json" name="boceto" value="">
```

Before `</body>`, after the existing classic scripts:

```html
  <div id="formas-boceto-modal" hidden></div>
<script type="module" src="../shared/js-scripts/boceteador/host.js"></script>
```

- [ ] **Step 3: Smoke the page**

Serve the repo root (any static server) and open `/v6/editItem.html`. Click **Personalizar**. Expected: `#formas-boceto-modal` is visible, product stills appear in `#photoPickRow`, no console error.

- [ ] **Step 4: Commit**

```bash
git add shared/js-scripts/boceteador/host.js v6/editItem.html
git commit -m "feat: embed Boceteador on v6 catalog editItem"
```

---

### Task 6: v5 catalog `editItem.html`

Same opt-in as v6. v5 currently has no Personalizar button.

**Files:**
- Modify: `v5/editItem.html`

**Interfaces:**
- Consumes: the shared `host.js` from Task 5 (no v5-specific JS).
- Produces: v5 catalog item page with the same CTA, mount point, and script tags as v6.

- [ ] **Step 1: Add CSS**

In `v5/editItem.html` `<head>`, after `select-image-modal.css`:

```html
  <link href="../shared/styles/boceteador.css" rel="stylesheet">
```

- [ ] **Step 2: Add the button + hidden input**

Replace:

```html
            <button type="button" class="btn btn-outline-secondary w-100" id="selectImageBtn"><i class="fas fa-image me-1"></i>Seleccionar imagen</button>
```

with the v6 stack (button `mb-2`, Personalizar SVG, hidden input). Copy the Personalizar button markup verbatim from `v6/editItem.html` (the SVG path must match). After the change the column contains: `#selectedProductImage`, `#selectImageBtn` with `mb-2`, `#personalizarBtn`, `#formas-boceto-json`.

- [ ] **Step 3: Add mount + module**

Before `</body>`, after the existing classic scripts:

```html
  <div id="formas-boceto-modal" hidden></div>
<script type="module" src="../shared/js-scripts/boceteador/host.js"></script>
```

- [ ] **Step 4: Smoke v5**

Open `/v5/editItem.html` from the repo root. **Personalizar** opens the editor with the four product stills.

- [ ] **Step 5: Commit**

```bash
git add v5/editItem.html
git commit -m "feat: embed Boceteador on v5 catalog editItem"
```

---

### Task 7: Playwright verification

**Files:**
- Create: `docs/verify-boceteador.mjs`
- Modify: `package.json` (add `verify:boceteador`)
- Modify: `README.md` (one line under Verificación)

**Interfaces:**
- Produces: `npm run verify:boceteador` — HTTP server on port **8098**, Chromium checks from the spec Testing section.
- Tiny PNG (1×1) used as `composedImage`:

`data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==`

SKU on both catalog pages: `ZEC_20037000001D55D55D63`.

- [ ] **Step 1: Write `docs/verify-boceteador.mjs`**

```js
/**
 * Verificación del embed Boceteador en editItem v5/v6.
 * Uso: npm run verify:boceteador  [-- --only=<substring>]
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8098;
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SKU = 'ZEC_20037000001D55D55D63';
const KEY = 'formas:boceto:editItem';

const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const results = [];
let browser;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function check(name, fn) {
  if (only && !name.toLowerCase().includes(only.toLowerCase())) return;
  try {
    await fn();
    results.push({ ok: true, name });
  } catch (e) {
    results.push({ ok: false, name, msg: e.message });
  }
}

async function open(path, viewport = { width: 1440, height: 900 }, withSketch) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', async (d) => {
    errors.push('dialog: ' + d.message());
    await d.dismiss();
  });
  if (withSketch) {
    await page.addInitScript(({ key, sku, png }) => {
      sessionStorage.setItem(key, JSON.stringify({
        productId: sku,
        variantColor: '',
        sourcePhotoUrl: '../shared/IMG/placeholder3SinLogoFrente.jpg',
        composedImage: png,
        logoFiles: [],
        placement: { zone: { x: 0.2, y: 0.2, w: 0.5, h: 0.5 }, logos: [] },
        medidaW: '',
        medidaH: '',
        technique: '',
        printColors: [{ hex: '#FFFFFF', nom: 'Blanco', pant: '' }],
        engraved: false,
        status: 'attached',
      }));
    }, { key: KEY, sku: SKU, png: PNG });
  }
  await page.goto('http://localhost:' + PORT + '/' + path, { waitUntil: 'load' });
  await page.waitForTimeout(400);
  page.errors = errors;
  return page;
}

const server = createServer(async (req, res) => {
  try {
    const p = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '');
    const data = await readFile(join(ROOT, p));
    res.writeHead(200, { 'Content-Type': MIME[extname(p).toLowerCase()] || 'application/octet-stream' });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
});
await new Promise((r) => server.listen(PORT, r));
browser = await chromium.launch();

const ITEM = ['v6/editItem.html', 'v5/editItem.html'];

for (const path of ITEM) {
  await check('loads clean: ' + path, async () => {
    const page = await open(path);
    assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
    await page.close();
  });
}

for (const path of ITEM) {
  await check('Personalizar opens editor with product stills: ' + path, async () => {
    const page = await open(path);
    await page.click('#personalizarBtn');
    await page.waitForTimeout(500);
    const state = await page.evaluate(() => {
      const modal = document.getElementById('formas-boceto-modal');
      const row = document.getElementById('photoPickRow');
      const btns = row ? row.querySelectorAll('.photoPick-btn') : [];
      return {
        hidden: modal ? modal.hidden : true,
        count: btns.length,
      };
    });
    assert(state.hidden === false, 'modal stayed hidden on ' + path);
    assert(state.count >= 4, 'expected >= 4 photo picks, got ' + state.count + ' on ' + path);
    assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
    await page.close();
  });
}

for (const path of ITEM) {
  await check('restores composed image from sessionStorage: ' + path, async () => {
    const page = await open(path, { width: 1440, height: 900 }, true);
    const state = await page.evaluate((png) => {
      const img = document.getElementById('selectedProductImage');
      const tile = document.querySelector('#zakekeImagesGrid [data-boceto="1"]');
      const label = document.querySelector('#personalizarBtn .text');
      return {
        src: img ? img.getAttribute('src') : '',
        hasTile: !!tile,
        label: label ? label.textContent.trim() : '',
      };
    }, PNG);
    assert(state.src === PNG, 'main image was not restored on ' + path);
    assert(state.hasTile, 'missing boceto tile on ' + path);
    assert(state.label === 'Editar personalización', 'label was "' + state.label + '" on ' + path);
    assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
    await page.close();
  });
}

for (const path of ITEM) {
  await check('image modal can click restored boceto tile: ' + path, async () => {
    const page = await open(path, { width: 1440, height: 900 }, true);
    await page.click('#selectImageBtn');
    await page.waitForTimeout(200);
    await page.click('#zakekeImagesGrid [data-boceto="1"]');
    await page.waitForTimeout(100);
    assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
    await page.close();
  });
}

const UNCHANGED = [
  'v6/editItem-generico-costo.html',
  'v6/editItem-generico-pvp.html',
  'v5/editItem-generico.html',
  'v6/detalle-cotizacion.html',
  'v5/detalle-cotizacion.html',
];

for (const path of UNCHANGED) {
  await check('unchanged (no boceto modal): ' + path, async () => {
    const page = await open(path);
    assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
    const has = await page.$('#formas-boceto-modal');
    assert(!has, 'unexpected #formas-boceto-modal on ' + path);
    await page.close();
  });
}

await browser.close();
server.close();

const failed = results.filter((r) => !r.ok);
results.forEach((r) => console.log((r.ok ? 'ok  ' : 'FAIL') + ' ' + r.name + (r.msg ? ' — ' + r.msg : '')));
if (failed.length) {
  console.error('\n' + failed.length + ' failed');
  process.exit(1);
}
console.log('\n' + results.length + ' passed');
```

- [ ] **Step 2: Add npm script and README line**

`package.json` `scripts`:

```json
"verify:boceteador": "node docs/verify-boceteador.mjs"
```

In `README.md` Verificación, add:

```
npm run test:boceteador      # unit tests of the Boceteador adapters
npm run verify:boceteador    # Playwright: Personalizar embed on v5/v6 editItem
```

- [ ] **Step 3: Run unit tests and Playwright**

Run: `npm run test:boceteador`

Expected: PASS.

Run: `npm run verify:boceteador`

Expected: every check `ok`, process exit 0. If Chromium is missing: `npx playwright install chromium` once.

- [ ] **Step 4: Commit**

```bash
git add docs/verify-boceteador.mjs package.json README.md
git commit -m "test: verify Cotizador Boceteador embed on v5 and v6 editItem"
```

---

## Self-review (plan vs spec)

| Spec requirement | Task |
|---|---|
| Snapshot-copy engine + CSS into `shared/` | Task 1 |
| `photo-gallery` reads three grids, skips bocetos | Task 2 |
| `ui.js` import of `samePhotoUrl` only engine edit | Task 2 |
| `applyComposed` main image + zakeke tile, one boceto | Task 3 |
| Image-modal event delegation | Task 4 |
| `host.js` + v6 opt-in | Task 5 |
| v5 button + same opt-in | Task 6 |
| `window.FormasBoceto`, storage key, SKU productId, labels | Task 5 |
| Playwright port 8098, restore, photo picker, unchanged pages | Task 7 |
| No shop host/Swiper/cart copy, no generic pages, no backend | respected as non-goals |

No TBD/TODO placeholders. Function names match across tasks (`listPhotos`, `getCurrent`, `applyComposed`, `removeBocetos`, `STORAGE_KEY`).
