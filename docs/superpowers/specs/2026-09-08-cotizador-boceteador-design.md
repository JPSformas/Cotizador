# Cotizador Boceteador embed — design

Date: 2026-09-08

Embed the shop Boceteador editor into Cotizador item pages, so a quote can carry a composed product mockup. Same architecture as the shop PDP embed: copy the editor engine, write Cotizador-only host adapters.

## Context

The shop already extracted the generator's `#bocetoModal` into ES modules under `Formas shop/modave/js/boceteador/`. That split is:

| Layer | Files | Role |
|---|---|---|
| **Engine** | `ui.js`, `modal.html`, `core.js`, `logo-pipeline.js`, `payload.js`, `print-colors.js`, `pantones.js`, `store-page.js`, `css/boceteador.css` | Editor UI, compose, JSON sketch |
| **Shop host** | `host.js`, `photo-swiper.js`, `gallery-swiper.js`, `cart-bridge.js` | Swiper gallery, color picker, add-to-cart |

`ui.open({ photos, photoUrl, photoName, productId, placement, technique, printColors })` already accepts a photo list. `onSave` already returns a sketch with `composedImage` (PNG data URL) plus placement JSON.

Cotizador `v6/editItem.html` already has the CTA (`#personalizarBtn`) and the image modal (`#imageModal`) with three grids: uploaded, product, personalizadas (`#zakekeImagesGrid`). `v5/editItem.html` has the same modal and main image, but no Personalizar button yet. Generic item pages share the image modal markup and are **in scope** (same opt-in as catalog). `detalle-cotizacion.html` is **out of this plan**.

## Goals

- `#personalizarBtn` opens the same Boceteador editor the shop uses.
- Step 1 photos come from the Cotizador image modal grids (product, uploaded, existing personalizadas).
- On save, the composed PNG replaces `#selectedProductImage` and appears as a new tile in `#zakekeImagesGrid`.
- The sketch JSON sits on the page (`#formas-boceto-json`) and in `sessionStorage`, same payload shape as the shop (`createSketch` / `validateSketch`).
- Engine files live in `shared/` so v5, v6, and later versions can mount the same editor by adding the button + three tags.
- v5 catalog `editItem.html` gets the same button and wiring as v6.

## Non-goals

- Do not iframe the shop or the Netlify generator.
- Do not copy shop host files (`photo-swiper.js`, `gallery-swiper.js`, `cart-bridge.js`, shop `host.js`).
- Do not extract a shared npm package or symlink back to the shop repo. This is a snapshot copy. Shop engine fixes are not auto-synced.
- Do not wire the quote-table image modal on `detalle-cotizacion.html`.
- Do not add cart gating, color-variant invalidation, ficha A4, Corel PDF, Drive, or IA photo enhance.
- Do not persist to a backend. Prototype only: DOM + hidden input + `sessionStorage`.
- Do not rewrite `select-image-modal.js` beyond the event-delegation change required so dynamically added boceto tiles are selectable.

## Approach: engine copy + Cotizador host

Copy the engine into `shared/js-scripts/boceteador/` and the CSS into `shared/styles/boceteador.css`. Write three new modules next to the engine:

```
shared/js-scripts/boceteador/
  core.js, logo-pipeline.js, payload.js, print-colors.js, pantones.js
  ui.js, modal.html, store-page.js          ← engine (copy)
  photo-gallery.js                         ← NEW: read #imageModal grids
  gallery-item.js                          ← NEW: write main image + zakeke grid
  host.js                                  ← NEW: boot, button, save, restore
```

A page opts in with:

1. `<link rel="stylesheet" href="../shared/styles/boceteador.css">`
2. `#personalizarBtn`, empty `#formas-boceto-modal`, hidden `#formas-boceto-json`
3. `<script type="module" src="../shared/js-scripts/boceteador/host.js"></script>`

`host.js` no-ops if `#personalizarBtn` is missing, so a future page can add the script before the button without throwing.

## Architecture

```
#personalizarBtn click
        │
        ▼
host.js ── listPhotos() / getCurrent() ── image modal grids
        │
        ▼
ui.open({ photos, photoUrl, productId, placement? })
        │
        ▼  user saves
onSave(sketch)
        │
        ├─ store.save(sketch)          hidden input + sessionStorage
        ├─ applyComposed(png)          #selectedProductImage + #zakekeImagesGrid
        └─ setOpenLabel("Editar…")
```

Units:

- **Engine (`createUi`)** — one purpose: run the 4-step editor. Does not know Cotizador DOM. The only allowed edit to the copied `ui.js` is the `samePhotoUrl` import (shop points at `photo-swiper.js`; Cotizador points at `photo-gallery.js`).
- **`photo-gallery.js`** — read stills from the three grids. No writes. No Swiper.
- **`gallery-item.js`** — write the composed PNG into the item page. No reads of step-1 sources.
- **`host.js`** — glue. Product id, storage key, button label, restore on load.
- **`store-page.js`** — unchanged. Persistence for the prototype.

## Photo sources (step 1)

`listPhotos(root)` walks, in this order:

1. `#productImagesGrid .image-item[data-image]`
2. `#uploadedImagesGrid .image-item[data-image]`
3. `#zakekeImagesGrid .image-item[data-image]`

Rules:

- Skip `data-type="boceto"` and `data-boceto="1"` (outputs, not sources). Existing Zakeke mockups (`data-type="zakeke"`) stay pickable.
- Dedupe with `samePhotoUrl` (same helper as the shop: ignore query strings and match by path suffix).
- Each still is `{ url, thumb, alt, color: "" }`. `color` is always `""` — Cotizador has no PDP color picker.
- `getCurrent(root)` returns the still whose `url` matches `#selectedProductImage`, else the first still. If the main image is the composed boceto (not in the source list), `getCurrent` returns the first product still; the host still prefers `current.sourcePhotoUrl` when reopening an existing sketch.

The editor's `#photoPick` row is driven by `opts.photos`. Do not re-enable the free “upload a product photo” tile; the shop already hides it when gallery photos exist (`#photoInput` disabled, `.upload-tile` hidden). Cotizador keeps that.

## Save outputs

On `onSave(sketch)`:

1. `store.save(sketch)` with storage key `formas:boceto:editItem`.
2. `applyComposed(sketch.composedImage)`:
   - `#selectedProductImage.src = composedImage`
   - closest `[data-product-images]` or the image wrapper gets `dataset.selectedImageUrls = JSON.stringify([composedImage])` so the select-image modal treats it as slot 1
   - remove previous `#zakekeImagesGrid [data-boceto="1"]`
   - prepend one `.image-item` with `data-type="boceto"`, `data-boceto="1"`, `data-id="boceto-1"`, `data-image` and `<img alt="Boceto personalizado">`
3. Button `.text` becomes `Editar personalización`. Idle copy stays `Personalizar`.

One current boceto at a time (same as the shop replacing Swiper slides). A later save replaces the previous tile. Boceto tiles have no trash button.

`productId` is `#SKU` trimmed, or `"editItem-product"` if empty. `variantColor` is `""`.

On load, if `store.load()` returns a valid sketch, apply composed image + tile + button label, matching shop restore.

## Image modal: event delegation

`shared/js-scripts/select-image-modal.js` binds click handlers on product/zakeke items once at `DOMContentLoaded`. A prepended boceto tile would not be selectable.

Change that binding to delegation on `#imageModal`: a click on `.image-item` (except `.image-delete-btn`) calls the existing `handleImageSelect`. Uploaded-item delete buttons stay as they are (bound in `renderUploadedImages`). Do not change `table-select-image-modal.js`.

## Page wiring

### v6/editItem.html (already has the button)

Add CSS link, hidden JSON input next to the button, empty `#formas-boceto-modal` before `</body>`, module script after the existing classic scripts.

### v5/editItem.html and genérico pages

Same opt-in as v6: Personalizar button, CSS, hidden JSON, empty `#formas-boceto-modal`, module script. Generic pages have fewer product stills (often one); the editor still opens with whatever `listPhotos()` returns.

### Host contract (`window.FormasBoceto`)

Same shape as the shop, minus cart:

```
{ open, getSketch, clear, on(event, fn) }
```

Events: `saved`, `cleared`. `clear()` drops storage, removes boceto tiles, restores the button label. No UI control calls `clear` in v1; it exists for tests and a future reset.

## Error handling

- Missing `#personalizarBtn` or `#formas-boceto-modal`: host returns without throwing (console error only if `createUi` fails after both exist).
- Photo URL fails to load: keep the engine's `alert` (`No pude cargar la foto del producto.`).
- Invalid stored JSON: `store.load()` already returns `null`; boot as if no sketch.
- `sessionStorage` quota: `store-page.js` already swallows; the hidden input still holds the JSON for the session.
- Empty photo list: still open the editor; engine shows its empty state. Catalog pages in this repo always have product stills.

## CSS

Copy `boceteador.css` as-is. It is scoped to `#formas-boceto-modal` (`z-index: 11000`), above the image modal (`z-index: 1050`) and Bootstrap. Poppins is already loaded via `shared/Fonts/fonts.css`. The shop-specific comment about neutralizing `styles.css` button pills is harmless; the same resets prevent Bootstrap `.btn` rules from leaking if any unscoped `button` styles exist.

Serve from the **repo root**. `ui.js` fetches `./modal.html` via `import.meta.url`; `file://` will fail.

## Testing

- Copy the shop engine tests (`core.test.mjs`, `payload.test.mjs`, `store-page.test.mjs`) and run them with `node --test` so the snapshot copy is proven.
- New `photo-gallery.test.mjs` and `gallery-item.test.mjs` (fake DOM, same style as shop adapter tests).
- Playwright `docs/verify-boceteador.mjs` (port **8098**, do not reuse or edit `verify-bulk-cantidades.mjs`):
  - v6 and v5 `editItem.html` load with no `pageerror`
  - `#personalizarBtn` opens `#formas-boceto-modal` and `#photoPickRow` has at least the four product stills
  - Restore: `addInitScript` writes a valid sketch (tiny PNG `composedImage`, `productId` = the page SKU) to `sessionStorage` key `formas:boceto:editItem` before load. After load, `#selectedProductImage` src is that PNG, `#zakekeImagesGrid [data-boceto="1"]` exists, button text is `Editar personalización`
  - With that restored tile, open `#imageModal` and click the boceto item: no `pageerror` (delegation)
  - Generic pages open the same editor (at least one still). `detalle-cotizacion` loads clean and has no `#formas-boceto-modal`

## Open decisions (locked here)

| Topic | Choice |
|---|---|
| Source of engine | Snapshot copy into `shared/`, not a live link to the shop |
| First pages | All catalog and genérico `editItem` pages in v5 and v6 |
| Gallery destination | `#zakekeImagesGrid` (“Imágenes personalizadas”), one replaceable boceto tile |
| Main image | Always replaced by the composed PNG on save |
| Multi-select of 3 images | Slot 1 becomes the boceto only; previous extra slots are not preserved |
| Clear / color change | No automatic invalidation; `clear()` exists on the API only |
| `ui.js` edits | One import line for `samePhotoUrl` |
