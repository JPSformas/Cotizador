# Cotizador layout — design

Date: 2026-08-24

Reorganize the current `Cotizacion v5` git repo so versions live in sibling folders, shared assets live once under `shared/`, and both the local folder and the GitHub remote are named `Cotizador`.

## Goals

- Version-specific pages and files sit in `v5/` and `v6/`.
- Fonts, images, and CSS/JS used by more than one version live in `shared/` (no copies inside `v6/`).
- Comparison markdown, screenshots, and the Playwright capture script live in `docs/`.
- Local folder `Cotizacion v5` is renamed to `Cotizador`.
- GitHub remote `JPSformas/Cotizador-V5` is renamed to `JPSformas/Cotizador`.

## Non-goals

- No product/UI changes beyond path and link updates required by the move.
- No merge of v6 pricing into v5.
- No rewrite of the v4 comparison document’s historical file paths (those describe old commits).

## Target tree

```
Cotizador/
  README.md
  package.json
  package-lock.json
  .gitignore
  node_modules/          # unchanged, gitignored
  shared/
    Fonts/               # fonts.css, font-icons.css, Tipografia Formas
    IMG/                 # full image set (not the v6 subset)
    styles/              # CSS used by more than one version
    js-scripts/          # JS used by more than one version
  v5/
    detalle-cotizacion.html
    editItem.html
    editItem-generico.html
    products-data.json
    styles/              # v5-only CSS
    js-scripts/          # v5-only JS
  v6/
    editItem.html
    editItem-generico.html
    Propuesta-Precios.html
    styles/pricing-table.css
    js-scripts/pricing-engine.js
  docs/
    COTIZACION-V4-VS-V5.md
    comparison-screenshots/
    capture-comparison.mjs
    superpowers/         # this spec (and later the plan)
```

## Shared vs version-only files

### `shared/styles/`

- `nuevo-header.css`
- `complementos.css`
- `sidebar.css`
- `select-image-modal.css`
- `editItem.css`
- `table-empty-state.css`

### `shared/js-scripts/`

- `table-empty-state.js`
- `select-image-modal.js`
- `financial-formatting.js`
- `price-update-indicator.js`
- `cotizacion-edit-item-nav.js`

### `v5/styles/`

- `detalle-cotizacion.css`
- `product-search-preview.css`

### `v5/js-scripts/`

Every current `js-scripts/` file not listed under shared (detalle-cotizacion scripts).

### `v6/`

- `styles/pricing-table.css`
- `js-scripts/pricing-engine.js`
- HTML listed above
- Delete duplicated Fonts, IMG, and copied shared CSS/JS currently inside `v6/`

## Path rules

From a page in `v5/` or `v6/`:

- Shared: `../shared/Fonts/...`, `../shared/IMG/...`, `../shared/styles/...`, `../shared/js-scripts/...`
- Version-only: `styles/...`, `js-scripts/...`

`Fonts/fonts.css` keeps relative `url('./Tipografia Formas/...')` because the Fonts folder moves as a unit.

## In-app links

- v5 `editItem*.html` → `detalle-cotizacion.html` (same folder, unchanged).
- v5 `detalle-cotizacion.html` → `editItem.html` / `editItem-generico.html` (same folder, unchanged).
- v6 `editItem*.html` back link → `../v5/detalle-cotizacion.html` (v6 has no detalle page).
- `cotizacion-edit-item-nav.js` keeps same-folder page names (`editItem.html`); no change.

## Tooling

`docs/capture-comparison.mjs` today serves the repo root as v5 and writes screenshots next to itself.

After the move:

- Serve the **Cotizador repo root** (parent of `v5/` and `shared/`) so `../shared/...` in HTML resolves.
- Open `/v5/detalle-cotizacion.html` instead of `/detalle-cotizacion.html`.
- `V4_DIR` stays the sibling `../Cotizacion v4` relative to the repo root (parent folder `Cotizacion`).
- Screenshot output stays `docs/comparison-screenshots/`.

`package.json` stays at the repo root (`name`: `cotizador`). Playwright still runs from root; the script path becomes `docs/capture-comparison.mjs`.

## Rename

| What | From | To |
|------|------|-----|
| Local folder | `.../Cotizacion/Cotizacion v5` | `.../Cotizacion/Cotizador` |
| GitHub repo | `JPSformas/Cotizador-V5` | `JPSformas/Cotizador` |

Git history stays in this repo (`git mv` for tracked files). After the local rename, the Cursor workspace must open `Cotizador`.

## README

Root README describes Cotizador as a multi-version prototype: how to open v5 vs v6, and that shared assets live in `shared/`.

## Risks

- Opening HTML via `file://` still works if relative `../shared` paths are correct.
- A static server whose document root is `v5/` or `v6/` (not the repo root) will 404 shared assets. Document that the server root must be `Cotizador/`.
- `gh repo rename` needs GitHub auth and updates `origin`. Existing local clones and bookmarks to `Cotizador-V5` break until they follow the redirect (GitHub leaves a redirect from the old name).
