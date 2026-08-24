# Cotizador Layout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move version-specific files into `v5/` and `v6/`, put shared assets under `shared/`, put comparison material in `docs/`, then rename the local folder and GitHub repo to `Cotizador`.

**Architecture:** One git repo. Shared CSS/JS/Fonts/IMG live in `shared/`. Each version folder holds only its HTML plus files unique to that version. HTML in `v5/` and `v6/` uses `../shared/...` for shared assets and local `styles/` / `js-scripts/` for version-only files. A static server must use the repo root as document root.

**Tech Stack:** Git, static HTML/CSS/JS, Playwright capture script, GitHub `gh repo rename`.

## Global Constraints

- No product/UI changes beyond path and link updates required by the move.
- Do not merge v6 pricing into v5.
- Do not rewrite historical file paths inside `COTIZACION-V4-VS-V5.md`.
- Use `git mv` for tracked files. Delete duplicated copies under `v6/` of Fonts, IMG, and shared CSS/JS.
- GitHub rename: `JPSformas/Cotizador-V5` → `JPSformas/Cotizador`.
- Local folder: `.../Cotizacion/Cotizacion v5` → `.../Cotizacion/Cotizador`.
- User asked to implement on the current branch (`main`); do not create a worktree (the local folder rename is this checkout).

---

### Task 1: Create folders and git-mv shared + v5 + docs

**Files:**
- Move: `Fonts/` → `shared/Fonts/`
- Move: `IMG/` → `shared/IMG/`
- Move shared CSS into `shared/styles/`: `nuevo-header.css`, `complementos.css`, `sidebar.css`, `select-image-modal.css`, `editItem.css`, `table-empty-state.css`
- Move shared JS into `shared/js-scripts/`: `table-empty-state.js`, `select-image-modal.js`, `financial-formatting.js`, `price-update-indicator.js`, `cotizacion-edit-item-nav.js`
- Move v5-only CSS into `v5/styles/`: `detalle-cotizacion.css`, `product-search-preview.css`
- Move remaining `js-scripts/*.js` into `v5/js-scripts/`
- Move: `detalle-cotizacion.html`, `editItem.html`, `editItem-generico.html`, `products-data.json` → `v5/`
- Move: `COTIZACION-V4-VS-V5.md`, `comparison-screenshots/`, `capture-comparison.mjs` → `docs/`

**Interfaces:**
- Consumes: current repo layout
- Produces: target tree with files still using old relative paths (broken until Task 3)

- [ ] **Step 1: Create destination directories**

```powershell
New-Item -ItemType Directory -Force -Path @(
  "shared/styles",
  "shared/js-scripts",
  "v5/styles",
  "v5/js-scripts"
) | Out-Null
```

- [ ] **Step 2: git mv shared assets, v5 files, and docs**

Use `git mv` (not Copy-Item). Move Fonts and IMG as whole directories. After this step, empty `styles/` and `js-scripts/` at repo root should be removed if they remain.

- [ ] **Step 3: Verify git status shows renames, not untracked copies**

Run: `git status --short`

Expected: `R` (rename) entries into `shared/`, `v5/`, `docs/`. No leftover HTML at repo root except `README.md`.

---

### Task 2: Slim v6 to version-only files

**Files:**
- Keep: `v6/editItem.html`, `v6/editItem-generico.html`, `v6/Propuesta-Precios.html`, `v6/styles/pricing-table.css`, `v6/js-scripts/pricing-engine.js`
- Delete duplicated: `v6/Fonts/`, `v6/IMG/`, and copied shared CSS/JS under `v6/styles/` and `v6/js-scripts/`

**Interfaces:**
- Consumes: Task 1 `shared/` tree
- Produces: v6 folder with only unique files (paths still old until Task 3)

- [ ] **Step 1: git rm duplicated v6 copies of shared assets**

- [ ] **Step 2: Confirm v6 contains only the five unique files plus HTML**

Run: `git ls-files v6`

Expected: the three HTML files, `styles/pricing-table.css`, `js-scripts/pricing-engine.js` only.

---

### Task 3: Update HTML and capture-script paths

**Files:**
- Modify: `v5/detalle-cotizacion.html`, `v5/editItem.html`, `v5/editItem-generico.html`
- Modify: `v6/editItem.html`, `v6/editItem-generico.html`
- Modify: `docs/capture-comparison.mjs`
- Modify: `package.json` (`name` → `cotizador`)
- Modify: `README.md`

**Path map from pages in `v5/` or `v6/`:**

| Old | New |
|-----|-----|
| `Fonts/...` | `../shared/Fonts/...` |
| `IMG/...` | `../shared/IMG/...` |
| shared CSS listed in spec | `../shared/styles/<file>` |
| shared JS listed in spec | `../shared/js-scripts/<file>` |
| v5-only CSS/JS | `styles/<file>` / `js-scripts/<file>` (unchanged, files moved with the page) |
| v6 `pricing-table.css` / `pricing-engine.js` | `styles/...` / `js-scripts/...` (unchanged) |
| v6 back link `detalle-cotizacion.html` | `../v5/detalle-cotizacion.html` |

Also update `data-image="IMG/..."` to `data-image="../shared/IMG/..."`.

`docs/capture-comparison.mjs`:

```javascript
const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const V4_DIR = join(REPO_ROOT, '..', 'Cotizacion v4');
const V5_DIR = REPO_ROOT;
const OUT = join(__dirname, 'comparison-screenshots');
```

Change v5 `page.goto` to `http://127.0.0.1:8765/v5/detalle-cotizacion.html`. Leave v4 URL as `/detalle-cotizacion.html`.

README: Cotizador is a multi-version prototype; open `v5/detalle-cotizacion.html` or `v6/editItem.html`; serve from repo root so `../shared` resolves.

- [ ] **Step 1: Rewrite asset href/src/data-image in the five HTML pages**
- [ ] **Step 2: Point v6 back links at `../v5/detalle-cotizacion.html`**
- [ ] **Step 3: Update capture script, package.json name, README**
- [ ] **Step 4: Grep for leftover `href="Fonts/`, `href="styles/`, `src="IMG/`, `src="js-scripts/` at repo root HTML (should be none). Inside v5/v6, shared refs must use `../shared/`.**

---

### Task 4: Verify pages resolve shared assets

**Files:** Test only.

- [ ] **Step 1: Start a static server at repo root** (Python or npx serve). Document root must be Cotizador root, not `v5/`.
- [ ] **Step 2: Fetch `/v5/detalle-cotizacion.html`, `/v5/editItem.html`, `/v6/editItem.html` and one shared CSS + one shared font/image; confirm HTTP 200.**
- [ ] **Step 3: Confirm `/v6/styles/pricing-table.css` and `/v6/js-scripts/pricing-engine.js` are 200, and deleted v6 Fonts paths are 404.**

---

### Task 5: Rename GitHub repo and local folder

**Files:** filesystem + `origin` remote.

- [ ] **Step 1: `gh repo rename Cotizador`** from this repo. Expected: remote URL becomes `https://github.com/JPSformas/Cotizador.git`.
- [ ] **Step 2: `git remote -v` confirms the new URL.**
- [ ] **Step 3: Rename local folder `Cotizacion v5` → `Cotizador`.** Cursor may need to reopen that path (no `move_agent_to_root` MCP in this session).

Do not force-push. Do not change git config.

---

## Spec coverage

| Spec section | Task |
|--------------|------|
| Target tree | 1, 2 |
| Shared vs version-only split | 1, 2 |
| Path rules + in-app links | 3 |
| capture-comparison.mjs | 3 |
| README | 3 |
| Local + GitHub rename | 5 |
| Verification | 4 |
