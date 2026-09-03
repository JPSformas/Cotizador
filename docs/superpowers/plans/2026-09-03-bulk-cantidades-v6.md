# v6 Bulk "Cargar cantidades" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the outdated v5-shaped quantity form in `#modalMasElementos` / `#sidebarMasElementos` on `v6/detalle-cotizacion.html` with a bulk editor rendered by the v6 pricing engine.

**Architecture:** `v6/js-scripts/pricing-engine.js` gains a third mode, `data-pricing-mode="bulk"`, that renders inputs only (`Cantidad | Logo x Ubicación | Markup | Ajustes comerciales | 🗑`) in either a table view or a card view, reusing the existing cascading-column machinery. A new `v6/js-scripts/bulk-cantidades.js` owns everything surface-specific: which items are targeted, which columns apply to them, the context banner, the mobile nested panel, and applying the payload. Two shared scripts get a `data-bulk-managed` guard so v5 keeps its current behaviour.

**Tech Stack:** Vanilla ES5-style JS (the engine is written without arrow functions or `const` — match it), Bootstrap 5.3.3, Font Awesome 7.0.1, Playwright 1.60 for verification.

**Spec:** `docs/superpowers/specs/2026-09-03-bulk-cantidades-v6-design.md`

## Global Constraints

- Serve from the **repo root**. `v5/` or `v6/` as document root breaks every `../shared/` path.
- `v5/` is frozen. No behaviour change to any v5 page is acceptable.
- `shared/js-scripts/*` is loaded by both versions. v6-only behaviour goes in `v6/js-scripts/`, and shared scripts may only gain a bail-out guard.
- Match `pricing-engine.js` style in all **browser** scripts (`v6/js-scripts/`, `shared/js-scripts/`): IIFE, `var`, `function`, string concatenation for markup, no arrow functions, no template literals. This does not bind `docs/verify-bulk-cantidades.mjs`, which is Node-only and uses modern syntax throughout.
- Row cap is `MAX_FILAS = 5`; cascade cap is `MAX_PCT = 3`. Never fork these numbers.
- The ladder can never be empty: the trash button is disabled at one row.
- UI copy is Spanish. Exact strings: `Cargar cantidades`, `Logo x Ubicación`, `Markup`, `Ajustes comerciales`, `Desc. adicional`, `Financiación`, `Cantidad`, `sin cambios`, `base`, `heredado`, `+ Agregar cantidad (máx. 5)`, `+ Agregar descuento en cascada`, `+ Agregar financiación en cascada`, `Se agrega para todas las cantidades`, `Editar cantidad`, `Agregar cantidades`.
- Money parsing is es-AR: `parseMoney` strips dot thousands and treats comma as decimal. Never use `parseFloat` directly on a user-facing money string.
- Playwright browsers must be present: `npx playwright install chromium` (one-time).

---

### Task 1: Verification harness + engine multi-instance support

The engine currently constructs exactly one instance via `document.querySelector` and reaches out to `[data-pricing-pvp]` / `[data-pricing-setup]` / `[data-pricing-save]` / `[data-pricing-refresh]` anywhere in the document. `detalle-cotizacion.html` will host two engines, so both have to be fixed before anything else. This task changes no visible behaviour — the harness exists to prove that.

**Files:**
- Create: `docs/verify-bulk-cantidades.mjs`
- Modify: `package.json` (add the `verify:bulk` script)
- Modify: `v6/js-scripts/pricing-engine.js` (`cacheDom`, `bindEvents`, `init`)

**Interfaces:**
- Produces: `root.__pricingEngine` — the `PricingEngine` instance, published on each `[data-pricing-engine]` element. Every later task reaches the engine through this.
- Produces: `docs/verify-bulk-cantidades.mjs` exporting nothing; run via `npm run verify:bulk`. Later tasks append `check(...)` blocks to it.

- [ ] **Step 1: Write the failing test**

Create `docs/verify-bulk-cantidades.mjs`:

```js
/**
 * Verificación end-to-end de las pantallas de cantidades (v6) y de no-regresión de v5.
 * Uso: npm run verify:bulk  [-- --only=<substring>]
 */
import { chromium } from 'playwright';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { join, extname, dirname } from 'path';
import { fileURLToPath } from 'url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 8099;
const MIME = {
  '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml', '.ttf': 'font/ttf',
  '.woff': 'font/woff', '.woff2': 'font/woff2',
};

const only = (process.argv.find((a) => a.startsWith('--only=')) || '').split('=')[1];
const results = [];
let browser;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function check(name, fn) {
  if (only && !name.includes(only)) return;
  try {
    await fn();
    results.push({ ok: true, name });
  } catch (e) {
    results.push({ ok: false, name, msg: e.message });
  }
}

async function open(path, viewport = { width: 1440, height: 900 }) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('dialog', async (d) => {
    errors.push('dialog: ' + d.message());
    await d.dismiss();
  });
  await page.goto('http://localhost:' + PORT + '/' + path, { waitUntil: 'load' });
  await page.waitForTimeout(300);
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

// --- Task 1: no regressions, engine reachable ------------------------------

const ITEM_PAGES = ['v6/editItem.html', 'v6/editItem-generico-costo.html', 'v6/editItem-generico-pvp.html'];

for (const path of ITEM_PAGES) {
  await check('engine still renders 4 rows on ' + path, async () => {
    const page = await open(path);
    assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
    const rows = await page.$$eval('[data-role="pricing-body"] tr', (r) => r.length);
    assert(rows === 4, 'expected 4 rows, got ' + rows);
    const published = await page.evaluate(
      () => !!document.querySelector('[data-pricing-engine]').__pricingEngine
    );
    assert(published, 'root.__pricingEngine is not published');
    await page.close();
  });
}

for (const path of ['v5/editItem.html', 'v5/editItem-generico.html', 'v5/detalle-cotizacion.html', 'v6/detalle-cotizacion.html']) {
  await check('loads clean: ' + path, async () => {
    const page = await open(path);
    assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
    await page.close();
  });
}

// --- report ----------------------------------------------------------------

await browser.close();
server.close();

let failed = 0;
for (const r of results) {
  console.log((r.ok ? 'PASS  ' : 'FAIL  ') + r.name + (r.ok ? '' : '\n        ' + r.msg));
  if (!r.ok) failed++;
}
console.log('\n' + (results.length - failed) + '/' + results.length + ' checks passed');
process.exit(failed ? 1 : 0);
```

Add the script to `package.json`:

```json
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1",
    "verify:bulk": "node docs/verify-bulk-cantidades.mjs"
  },
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run verify:bulk`
Expected: the three `engine still renders 4 rows on ...` checks FAIL with `root.__pricingEngine is not published`. The `loads clean:` checks pass.

- [ ] **Step 3: Publish the instance and construct one engine per root**

In `v6/js-scripts/pricing-engine.js`, replace the `init` function at the bottom of the IIFE:

```js
  function init() {
    var roots = document.querySelectorAll('[data-pricing-engine]');
    for (var i = 0; i < roots.length; i++) {
      if (roots[i].__pricingEngine) continue;
      roots[i].__pricingEngine = new PricingEngine(roots[i]);
    }
  }
```

- [ ] **Step 4: Scope the external field lookups**

Still in `pricing-engine.js`, in `cacheDom`, replace the two trailing `document.querySelector` lines:

```js
    var scopeSel = r.getAttribute('data-pricing-scope');
    this.scope = scopeSel ? (document.querySelector(scopeSel) || document) : document;
    this.pvpInput = this.scope.querySelector('[data-pricing-pvp]');
    this.setupInput = this.scope.querySelector('[data-pricing-setup]');
```

In `bindEvents`, replace the two trailing `document.querySelector` lookups so they respect the same scope:

```js
    var refreshBtn = this.scope.querySelector('[data-pricing-refresh]');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', function () {
        setTimeout(function () { self.updateAll(); }, 0);
      });
    }
    var saveBtn = this.scope.querySelector('[data-pricing-save]');
    if (saveBtn) {
      saveBtn.addEventListener('click', function () { self.save(saveBtn); });
    }
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run verify:bulk`
Expected: `7/7 checks passed`.

- [ ] **Step 6: Commit**

```bash
git add docs/verify-bulk-cantidades.mjs package.json v6/js-scripts/pricing-engine.js
git commit -m "feat(v6): multi-instance pricing engine + verification harness"
```

---

### Task 2: Bulk table mode in the engine

**Files:**
- Modify: `v6/js-scripts/pricing-engine.js` (constructor, `buildRows`, `syncFromDom`, `updateAll`, new bulk methods)
- Modify: `docs/verify-bulk-cantidades.mjs` (append checks)
- Create: `docs/fixtures/bulk-table.html` (harness-only fixture so the mode is testable before the modal exists)

**Interfaces:**
- Consumes: `root.__pricingEngine` from Task 1.
- Produces:
  - `data-pricing-mode="bulk"` on a `[data-pricing-engine]` root.
  - `engine.getBulkPayload()` → `[{ cantidad: number, logoUnit: number|null, customMarkup: number|null, descs: number[], fins: number[] }]`
  - `engine.setBulkColumns({ logo: boolean, markup: boolean })` → void, rebuilds.
  - `engine.resetBulkQuotes()` → void, restores the ladder from the inline JSON and rebuilds.

- [ ] **Step 1: Write the failing test**

Create `docs/fixtures/bulk-table.html`:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Fixture — bulk table</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="../../shared/styles/complementos.css" rel="stylesheet">
  <link href="../../v6/styles/pricing-table.css" rel="stylesheet">
</head>
<body>
  <div class="pricing-engine" data-pricing-engine data-pricing-mode="bulk">
    <script type="application/json" data-role="pricing-quotes">
    [
      { "cantidad": 50,  "descs": [0], "fins": [0] },
      { "cantidad": 100, "descs": [0], "fins": [0] },
      { "cantidad": 200, "descs": [0], "fins": [0] }
    ]
    </script>
    <div class="table-wrap">
      <table class="pe-table">
        <thead data-role="pricing-head"></thead>
        <tbody data-role="pricing-body"></tbody>
      </table>
    </div>
    <button type="button" class="add-row" data-action="add-row">+ Agregar cantidad (máx. 5)</button>
  </div>
  <script src="../../shared/js-scripts/financial-formatting.js"></script>
  <script src="../../v6/js-scripts/pricing-engine.js"></script>
</body>
</html>
```

Append to `docs/verify-bulk-cantidades.mjs`, immediately before the `// --- report ---` divider:

```js
// --- Task 2: bulk table mode -----------------------------------------------

const BULK_FIXTURE = 'docs/fixtures/bulk-table.html';

await check('bulk table renders the v6 column set', async () => {
  const page = await open(BULK_FIXTURE);
  assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
  const heads = await page.$$eval('[data-role="pricing-head"] th', (th) =>
    th.map((e) => e.textContent.trim())
  );
  for (const label of ['Cantidad', 'Logo x Ubicación', 'Markup', 'Ajustes comerciales']) {
    assert(heads.some((h) => h.startsWith(label)), 'missing header ' + label + ' in ' + JSON.stringify(heads));
  }
  assert(!heads.some((h) => h.includes('Costo extra')), 'Costo extra must not exist in v6');
  assert(!heads.some((h) => h.includes('Subtotal')), 'bulk mode must not show results');
  const rows = await page.$$eval('[data-role="pricing-body"] tr', (r) => r.length);
  assert(rows === 3, 'expected 3 rows, got ' + rows);
  await page.close();
});

await check('bulk table caps rows at 5 and never empties', async () => {
  const page = await open(BULK_FIXTURE);
  for (let i = 0; i < 4; i++) await page.click('[data-action="add-row"]').catch(() => {});
  let rows = await page.$$eval('[data-role="pricing-body"] tr', (r) => r.length);
  assert(rows === 5, 'expected cap of 5 rows, got ' + rows);
  const disabled = await page.$eval('[data-action="add-row"]', (b) => b.disabled);
  assert(disabled, 'add button should be disabled at 5 rows');
  for (let i = 0; i < 6; i++) {
    const btn = await page.$('[data-action="remove-row"]:not([disabled])');
    if (btn) await btn.click();
  }
  rows = await page.$$eval('[data-role="pricing-body"] tr', (r) => r.length);
  assert(rows === 1, 'expected 1 remaining row, got ' + rows);
  await page.close();
});

await check('bulk table cascades discount columns', async () => {
  const page = await open(BULK_FIXTURE);
  await page.click('.pct-add[data-field="descs"]');
  const descInputs = await page.$$eval('.desc-input[data-i="0"]', (i) => i.length);
  assert(descInputs === 2, 'expected 2 desc inputs after +, got ' + descInputs);
  await page.fill('.desc-input[data-i="0"][data-j="0"]', '10');
  await page.fill('.desc-input[data-i="0"][data-j="1"]', '5');
  await page.waitForTimeout(150);
  const eff = await page.$eval('tr[data-i="0"] .desc-eff', (e) => e.textContent);
  assert(eff.indexOf('14,5%') !== -1, 'expected cascade efect. 14,5%, got ' + eff);
  await page.close();
});

await check('getBulkPayload reports empty logo and markup as null', async () => {
  const page = await open(BULK_FIXTURE);
  await page.fill('.lp-input[data-i="0"]', '500');
  await page.fill('.markup-input[data-i="1"]', '1,35');
  await page.waitForTimeout(150);
  const payload = await page.evaluate(() =>
    document.querySelector('[data-pricing-engine]').__pricingEngine.getBulkPayload()
  );
  assert(payload.length === 3, 'expected 3 entries, got ' + payload.length);
  assert(payload[0].logoUnit === 500, 'row 0 logoUnit should be 500, got ' + payload[0].logoUnit);
  assert(payload[0].customMarkup === null, 'row 0 markup should be null');
  assert(payload[1].customMarkup === 1.35, 'row 1 markup should be 1.35, got ' + payload[1].customMarkup);
  assert(payload[1].logoUnit === null, 'row 1 logoUnit should be null');
  await page.close();
});

await check('setBulkColumns hides logo and markup', async () => {
  const page = await open(BULK_FIXTURE);
  await page.evaluate(() =>
    document.querySelector('[data-pricing-engine]').__pricingEngine.setBulkColumns({ logo: false, markup: false })
  );
  const heads = await page.$$eval('[data-role="pricing-head"] th', (th) => th.map((e) => e.textContent.trim()));
  assert(!heads.some((h) => h.startsWith('Logo')), 'logo column should be hidden');
  assert(!heads.some((h) => h.startsWith('Markup')), 'markup column should be hidden');
  assert(heads.some((h) => h.startsWith('Cantidad')), 'cantidad must survive');
  await page.close();
});

await check('resetBulkQuotes restores the default ladder', async () => {
  const page = await open(BULK_FIXTURE);
  await page.click('[data-action="add-row"]');
  await page.evaluate(() =>
    document.querySelector('[data-pricing-engine]').__pricingEngine.resetBulkQuotes()
  );
  const rows = await page.$$eval('[data-role="pricing-body"] tr', (r) => r.length);
  assert(rows === 3, 'expected the 3-row default back, got ' + rows);
  await page.close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run verify:bulk -- --only=bulk`
Expected: all six new checks FAIL — the first with a missing `Logo x Ubicación` header, since `buildRows` currently falls through to the costo renderer.

- [ ] **Step 3: Add bulk flags to the constructor**

In `PricingEngine`, right after the `this.isPvpMode` assignment:

```js
    this.isBulkMode = this.pricingMode === 'bulk';
    this.bulkView = root.getAttribute('data-pricing-view') || 'table';
    this.showLogoCol = root.getAttribute('data-bulk-logo') !== 'false';
    this.showMarkupCol = root.getAttribute('data-bulk-markup') !== 'false';
```

and make `hasLogo` false in bulk mode, so the logo grid updater never runs:

```js
    this.hasLogo = !this.isPvpMode && !this.isBulkMode && root.getAttribute('data-has-logo') !== 'false';
```

- [ ] **Step 4: Dispatch the three renderers**

At the top of `buildRows`, replace the existing pvp guard:

```js
  PricingEngine.prototype.buildRows = function () {
    if (this.isBulkMode) {
      this.buildBulkRows();
      return;
    }
    if (this.isPvpMode) {
      this.buildPvpRows();
      return;
    }
```

At the top of `updateAll`, likewise:

```js
  PricingEngine.prototype.updateAll = function () {
    if (this.isBulkMode) {
      this.updateBulkRows();
      return;
    }
    if (this.isPvpMode) {
      this.updatePvpRows();
      return;
    }
```

At the top of `syncFromDom`:

```js
  PricingEngine.prototype.syncFromDom = function () {
    if (this.isBulkMode) {
      this.syncBulkFromDom();
      return;
    }
```

- [ ] **Step 5: Write the bulk table renderer**

Add these methods after `buildPvpRows`:

```js
  PricingEngine.prototype.buildBulkRows = function () {
    if (this.el.head) {
      this.el.head.innerHTML = '<tr>'
        + '<th rowspan="2">Cantidad</th>'
        + (this.showLogoCol ? '<th class="grp-costos" rowspan="2">Logo x Ubicación</th>' : '')
        + (this.showMarkupCol ? '<th rowspan="2">Markup</th>' : '')
        + '<th class="grp-ajustes" colspan="' + (this.nDesc + this.nFin) + '">Ajustes comerciales</th>'
        + '<th rowspan="2"></th>'
        + '</tr><tr>'
        + this.headPctThs('descs', 'Desc. adicional', 'Desc.', this.nDesc)
        + this.headPctThs('fins', 'Financiación', 'Fin.', this.nFin)
        + '</tr>';
    }

    this.el.body.innerHTML = this.quotes.map(function (q, i) {
      var logoTd = this.showLogoCol
        ? '<td class="grp-costos">'
          + '<div class="lp-bulk-wrap"><span>$</span>'
          + '<input class="lp-input" type="text" inputmode="numeric" data-i="' + i + '" value="'
          + (q.logoUnit != null ? inputVal(q.logoUnit) : '') + '"></div>'
          + '<div class="lp-bulk-hint" data-i="' + i + '"></div>'
          + '</td>'
        : '';
      var markupTd = this.showMarkupCol
        ? '<td>'
          + '<input class="markup-input markup-bulk" type="text" data-i="' + i + '" value="'
          + (q.customMarkup != null ? fmtMarkup(q.customMarkup) : '') + '">'
          + '<div class="markup-hint">sin cambios</div>'
          + '</td>'
        : '';
      return '<tr data-i="' + i + '">'
        + '<td><input class="cantidad" type="text" data-i="' + i + '" value="' + q.cantidad + '"></td>'
        + logoTd
        + markupTd
        + this.pctTds(i, 'descs', 'desc-input', 'desc-eff')
        + this.pctTds(i, 'fins', 'fin-input', 'fin-eff')
        + '<td class="trash"><button type="button" class="trash-btn" data-action="remove-row" data-i="' + i
        + '" title="Eliminar cantidad" aria-label="Eliminar cantidad"'
        + (this.quotes.length <= 1 ? ' disabled' : '') + '>' + ICONS.trash + '</button></td>'
        + '</tr>';
    }, this).join('');

    if (this.el.addBtn) this.el.addBtn.disabled = this.quotes.length >= MAX_FILAS;
    this.updateAll();
  };

  PricingEngine.prototype.updateBulkRows = function () {
    var self = this;
    var base = (this.quotes[0] && this.quotes[0].logoUnit != null) ? this.quotes[0].logoUnit : null;

    this.quotes.forEach(function (q, i) {
      var tr = self.el.body.querySelector('tr[data-i="' + i + '"]');
      if (!tr) return;

      var descFactor = 1, finFactor = 1;
      q.descs.forEach(function (d) { descFactor *= (1 - d / 100); });
      q.fins.forEach(function (f) { finFactor *= (1 + f / 100); });

      var dEff = tr.querySelector('.desc-eff');
      if (dEff) {
        dEff.textContent = 'efect. ' + fmtPct(1 - descFactor);
        dEff.title = q.descs.map(function (d) { return d + '%'; }).join(' + ') + ' en cascada';
      }
      var fEff = tr.querySelector('.fin-eff');
      if (fEff) {
        fEff.textContent = 'efect. ' + fmtPct(finFactor - 1);
        fEff.title = q.fins.map(function (f) { return f + '%'; }).join(' + ') + ' en cascada';
      }

      var inp = tr.querySelector('.lp-input');
      var hint = tr.querySelector('.lp-bulk-hint');
      if (inp) inp.placeholder = (i > 0 && base != null) ? inputVal(base) : '';
      if (hint) {
        if (i === 0) hint.textContent = 'base';
        else hint.textContent = (q.logoUnit == null && base != null) ? 'heredado' : '';
      }
    });
  };

  PricingEngine.prototype.syncBulkFromDom = function () {
    var self = this;
    this.quotes.forEach(function (q, i) {
      var c = self.root.querySelector('.cantidad[data-i="' + i + '"]');
      if (c) q.cantidad = Math.max(0, parseNum(c.value));
      q.descs = self.readPcts(i, 'desc-input', q.descs);
      q.fins = self.readPcts(i, 'fin-input', q.fins);
      var l = self.root.querySelector('.lp-input[data-i="' + i + '"]');
      if (l) {
        var raw = l.value.trim();
        q.logoUnit = (raw === '') ? null : parseMoney(raw);
      }
      var m = self.root.querySelector('.markup-input[data-i="' + i + '"]');
      if (m) {
        var mraw = m.value.trim();
        q.customMarkup = (mraw === '') ? null : parseNum(mraw);
      }
    });
  };

  PricingEngine.prototype.getBulkPayload = function () {
    this.syncFromDom();
    return this.quotes.map(function (q) {
      return {
        cantidad: q.cantidad,
        logoUnit: (q.logoUnit != null) ? q.logoUnit : null,
        customMarkup: (q.customMarkup != null) ? q.customMarkup : null,
        descs: q.descs.slice(),
        fins: q.fins.slice()
      };
    });
  };

  PricingEngine.prototype.setBulkColumns = function (opts) {
    this.syncFromDom();
    this.showLogoCol = (opts && opts.logo) !== false;
    this.showMarkupCol = (opts && opts.markup) !== false;
    this.buildRows();
  };

  PricingEngine.prototype.resetBulkQuotes = function () {
    this.quotes = this.loadInitialQuotes();
    this.nDesc = Math.min(MAX_PCT, Math.max(1, this.quotes[0].descs.length));
    this.nFin = Math.min(MAX_PCT, Math.max(1, this.quotes[0].fins.length));
    this.quotes.forEach(function (q) {
      while (q.descs.length < this.nDesc) q.descs.push(0);
      while (q.fins.length < this.nFin) q.fins.push(0);
    }, this);
    this.buildRows();
  };
```

- [ ] **Step 6: Fix the add-button selector**

`cacheDom` looks up `[data-role="add-row"]`, but every add button in the project is written
`<button class="add-row" data-action="add-row">`. The lookup has therefore always returned `null`,
which is why the 5-row cap never disables the button on the item pages either. Correct it:

```js
      addBtn: r.querySelector('[data-action="add-row"]'),
```

This also fixes the cap on `v6/editItem*.html`, which is a behaviour change on those pages — an
intended one, since `MAX_FILAS` was already enforced in `addRow`; only the disabled state was
missing.

- [ ] **Step 7: Let the markup input trigger a refresh**

The `input` delegation in `bindEvents` already lists `.markup-input`, so no change is needed there. But `focusout` calls `commitMk` for `.markup-input`, which assumes the costo-mode view/edit pair. Guard it:

```js
      } else if (t.matches('.markup-input')) {
        if (!self.isBulkMode) self.commitMk(+t.getAttribute('data-i'));
      }
```

No guard is needed on the `.prod-input` branch — bulk mode renders no `.prod-input`.

- [ ] **Step 8: Run to verify it passes**

Run: `npm run verify:bulk`
Expected: `13/13 checks passed`.

- [ ] **Step 9: Commit**

```bash
git add v6/js-scripts/pricing-engine.js docs/fixtures/bulk-table.html docs/verify-bulk-cantidades.mjs
git commit -m "feat(v6): bulk table mode in the pricing engine"
```

---

### Task 3: Bulk card view for mobile

**Files:**
- Modify: `v6/js-scripts/pricing-engine.js` (`cacheDom`, bulk renderers, click delegation, quote mutators)
- Create: `docs/fixtures/bulk-cards.html`
- Modify: `docs/verify-bulk-cantidades.mjs` (append checks)

**Interfaces:**
- Consumes: `getBulkPayload`, `setBulkColumns`, `resetBulkQuotes` from Task 2.
- Produces:
  - `data-pricing-view="cards"` renders into `[data-role="pricing-cards"]`.
  - `engine.setBulkQuote(i, { cantidad, logoUnit, customMarkup, descs, fins })` → void.
  - `engine.addBulkQuote({ ... })` → void, no-op past `MAX_FILAS`.
  - `pricing-bulk-edit-row` CustomEvent on the root, `detail = { index: number }`, bubbles.

- [ ] **Step 1: Write the failing test**

Create `docs/fixtures/bulk-cards.html` — identical to `bulk-table.html` except the engine root and body:

```html
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Fixture — bulk cards</title>
  <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet">
  <link href="../../shared/styles/complementos.css" rel="stylesheet">
  <link href="../../shared/styles/sidebar.css" rel="stylesheet">
  <link href="../../v6/styles/pricing-table.css" rel="stylesheet">
  <style>.saved-quantities { display: flex !important; }</style>
</head>
<body>
  <div class="pricing-engine" data-pricing-engine data-pricing-mode="bulk" data-pricing-view="cards">
    <script type="application/json" data-role="pricing-quotes">
    [
      { "cantidad": 50,  "descs": [0], "fins": [0] },
      { "cantidad": 100, "descs": [0], "fins": [0] },
      { "cantidad": 200, "descs": [0], "fins": [0] }
    ]
    </script>
    <div class="saved-quantities" data-role="pricing-cards"></div>
    <button type="button" class="add-row" data-action="add-row">+ Agregar cantidad (máx. 5)</button>
  </div>
  <script src="../../shared/js-scripts/financial-formatting.js"></script>
  <script src="../../v6/js-scripts/pricing-engine.js"></script>
</body>
</html>
```

Append to `docs/verify-bulk-cantidades.mjs` before the report divider:

```js
// --- Task 3: bulk card view ------------------------------------------------

const CARDS_FIXTURE = 'docs/fixtures/bulk-cards.html';

await check('bulk cards render one card per quantity', async () => {
  const page = await open(CARDS_FIXTURE, { width: 390, height: 844 });
  assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
  const cards = await page.$$eval('.quantities-card', (c) => c.length);
  assert(cards === 3, 'expected 3 cards, got ' + cards);
  const first = await page.$eval('.quantities-card', (c) => c.textContent);
  for (const label of ['Cantidad', 'Logo x Ubicación', 'Markup', 'Desc.', 'Fin.']) {
    assert(first.indexOf(label) !== -1, 'card missing ' + label);
  }
  assert(first.indexOf('Costo extra') === -1, 'Costo extra must not exist in v6');
  await page.close();
});

await check('bulk cards show the cascade chain and effective value', async () => {
  const page = await open(CARDS_FIXTURE, { width: 390, height: 844 });
  await page.evaluate(() => {
    const e = document.querySelector('[data-pricing-engine]').__pricingEngine;
    e.setBulkQuote(0, { cantidad: 50, descs: [10, 5], fins: [0], logoUnit: null, customMarkup: null });
  });
  const text = await page.$eval('.quantities-card', (c) => c.textContent);
  assert(text.indexOf('10% + 5%') !== -1, 'expected the cascade chain, got ' + text);
  assert(text.indexOf('14,5%') !== -1, 'expected the effective value, got ' + text);
  await page.close();
});

await check('card Editar emits pricing-bulk-edit-row', async () => {
  const page = await open(CARDS_FIXTURE, { width: 390, height: 844 });
  await page.evaluate(() => {
    window.__edited = null;
    document.querySelector('[data-pricing-engine]')
      .addEventListener('pricing-bulk-edit-row', (e) => { window.__edited = e.detail.index; });
  });
  await page.click('.quantities-card[data-i="1"] .edit-btn-mobile');
  const index = await page.evaluate(() => window.__edited);
  assert(index === 1, 'expected index 1, got ' + index);
  await page.close();
});

await check('addBulkQuote respects the 5-row cap', async () => {
  const page = await open(CARDS_FIXTURE, { width: 390, height: 844 });
  await page.evaluate(() => {
    const e = document.querySelector('[data-pricing-engine]').__pricingEngine;
    for (let i = 0; i < 5; i++) e.addBulkQuote({ cantidad: 1000 + i, descs: [0], fins: [0] });
  });
  const cards = await page.$$eval('.quantities-card', (c) => c.length);
  assert(cards === 5, 'expected the cap of 5 cards, got ' + cards);
  await page.close();
});

await check('card Eliminar removes a quantity but never the last', async () => {
  const page = await open(CARDS_FIXTURE, { width: 390, height: 844 });
  await page.click('.quantities-card[data-i="0"] .delete-btn-mobile');
  await page.waitForTimeout(100);
  let cards = await page.$$eval('.quantities-card', (c) => c.length);
  assert(cards === 2, 'expected 2 cards, got ' + cards);
  for (let i = 0; i < 4; i++) {
    const btn = await page.$('.quantities-card .delete-btn-mobile:not([disabled])');
    if (btn) { await btn.click(); await page.waitForTimeout(80); }
  }
  cards = await page.$$eval('.quantities-card', (c) => c.length);
  assert(cards === 1, 'expected 1 card remaining, got ' + cards);
  await page.close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run verify:bulk -- --only=card`
Expected: all five FAIL — the first with `expected 3 cards, got 0`, since nothing renders into `[data-role="pricing-cards"]`.

- [ ] **Step 3: Cache the cards container**

In `cacheDom`, add to the `this.el` object literal:

```js
      cards: r.querySelector('[data-role="pricing-cards"]'),
```

- [ ] **Step 4: Branch the bulk renderers on the view**

At the top of `buildBulkRows`:

```js
  PricingEngine.prototype.buildBulkRows = function () {
    if (this.bulkView === 'cards') {
      this.buildBulkCards();
      return;
    }
```

At the top of `updateBulkRows`:

```js
  PricingEngine.prototype.updateBulkRows = function () {
    if (this.bulkView === 'cards') {
      this.updateBulkCards();
      return;
    }
```

- [ ] **Step 5: Write the card renderer and the quote mutators**

Add after `updateBulkRows`:

```js
  PricingEngine.prototype.cascadeText = function (arr, kind) {
    if (!arr.length) return '—';
    var isDesc = kind === 'desc';
    var chain = arr.map(function (v) { return v + '%'; }).join(' + ');
    var factor = 1;
    arr.forEach(function (v) { factor *= isDesc ? (1 - v / 100) : (1 + v / 100); });
    var eff = isDesc ? (1 - factor) : (factor - 1);
    return (arr.length > 1) ? (chain + ' (efect. ' + fmtPct(eff) + ')') : chain;
  };

  PricingEngine.prototype.buildBulkCards = function () {
    if (!this.el.cards) return;

    this.el.cards.innerHTML = this.quotes.map(function (q, i) {
      var logoLine = this.showLogoCol
        ? '<div class="fieldLabel">Logo x Ubicación: <span class="fieldValue" data-role="card-logo"></span></div>'
        : '';
      var markupLine = this.showMarkupCol
        ? '<div class="fieldLabel">Markup: <span class="fieldValue" data-role="card-markup"></span></div>'
        : '';
      return '<div class="quantities-card" data-i="' + i + '">'
        + '<div class="fieldLabel">Cantidad: <span class="fieldValue" data-role="card-cantidad"></span></div>'
        + logoLine
        + markupLine
        + '<div class="fieldLabel">Desc.: <span class="fieldValue" data-role="card-desc"></span></div>'
        + '<div class="fieldLabel">Fin.: <span class="fieldValue" data-role="card-fin"></span></div>'
        + '<div class="action-buttons">'
        + '<button type="button" class="edit-btn-mobile" data-action="edit-card" data-i="' + i + '"><span>Editar</span></button>'
        + '<button type="button" class="delete-btn-mobile" data-action="remove-row" data-i="' + i + '"'
        + (this.quotes.length <= 1 ? ' disabled' : '') + '><span>Eliminar</span></button>'
        + '</div>'
        + '</div>';
    }, this).join('');

    if (this.el.addBtn) this.el.addBtn.disabled = this.quotes.length >= MAX_FILAS;
    this.updateBulkCards();
  };

  PricingEngine.prototype.updateBulkCards = function () {
    if (!this.el.cards) return;
    var self = this;
    var base = (this.quotes[0] && this.quotes[0].logoUnit != null) ? this.quotes[0].logoUnit : null;

    this.quotes.forEach(function (q, i) {
      var card = self.el.cards.querySelector('.quantities-card[data-i="' + i + '"]');
      if (!card) return;
      var set = function (role, text) {
        var el = card.querySelector('[data-role="' + role + '"]');
        if (el) el.textContent = text;
      };
      set('card-cantidad', fmtQty(q.cantidad));
      if (self.showLogoCol) {
        var logoEff = (q.logoUnit != null) ? q.logoUnit : base;
        set('card-logo', logoEff == null ? 'sin cambios' : (money(logoEff) + (q.logoUnit == null ? ' (heredado)' : '')));
      }
      if (self.showMarkupCol) {
        set('card-markup', q.customMarkup == null ? 'sin cambios' : fmtMarkup(q.customMarkup));
      }
      set('card-desc', self.cascadeText(q.descs, 'desc'));
      set('card-fin', self.cascadeText(q.fins, 'fin'));
    });
  };

  PricingEngine.prototype.growCascades = function (data) {
    var changed = false;
    if (data.descs && data.descs.length > this.nDesc) {
      this.nDesc = Math.min(MAX_PCT, data.descs.length);
      changed = true;
    }
    if (data.fins && data.fins.length > this.nFin) {
      this.nFin = Math.min(MAX_PCT, data.fins.length);
      changed = true;
    }
    if (!changed) return;
    this.quotes.forEach(function (q) {
      while (q.descs.length < this.nDesc) q.descs.push(0);
      while (q.fins.length < this.nFin) q.fins.push(0);
    }, this);
  };

  PricingEngine.prototype.setBulkQuote = function (i, data) {
    var q = this.quotes[i];
    if (!q) return;
    this.growCascades(data);
    if (data.cantidad != null) q.cantidad = Math.max(0, data.cantidad);
    q.logoUnit = (data.logoUnit == null || data.logoUnit === '') ? null : data.logoUnit;
    q.customMarkup = (data.customMarkup == null || data.customMarkup === '') ? null : data.customMarkup;
    if (data.descs) q.descs = data.descs.slice(0, this.nDesc);
    if (data.fins) q.fins = data.fins.slice(0, this.nFin);
    while (q.descs.length < this.nDesc) q.descs.push(0);
    while (q.fins.length < this.nFin) q.fins.push(0);
    this.buildRows();
  };

  PricingEngine.prototype.addBulkQuote = function (data) {
    if (this.quotes.length >= MAX_FILAS) return;
    this.growCascades(data || {});
    this.quotes.push({
      cantidad: (data && data.cantidad) || 0,
      logoUnit: (data && data.logoUnit != null && data.logoUnit !== '') ? data.logoUnit : null,
      customMarkup: (data && data.customMarkup != null && data.customMarkup !== '') ? data.customMarkup : null,
      descs: (data && data.descs) ? data.descs.slice(0, this.nDesc) : zeros(this.nDesc),
      fins: (data && data.fins) ? data.fins.slice(0, this.nFin) : zeros(this.nFin),
      prodCost: null,
      precioVolumen: null
    });
    var last = this.quotes[this.quotes.length - 1];
    while (last.descs.length < this.nDesc) last.descs.push(0);
    while (last.fins.length < this.nFin) last.fins.push(0);
    this.buildRows();
  };
```

- [ ] **Step 6: Handle the card Editar action**

In the delegated click handler in `bindEvents`, add a case to the switch:

```js
        case 'edit-card':
          r.dispatchEvent(new CustomEvent('pricing-bulk-edit-row', {
            detail: { index: i },
            bubbles: true
          }));
          break;
```

- [ ] **Step 7: Run to verify it passes**

Run: `npm run verify:bulk`
Expected: `18/18 checks passed`.

- [ ] **Step 8: Commit**

```bash
git add v6/js-scripts/pricing-engine.js docs/fixtures/bulk-cards.html docs/verify-bulk-cantidades.mjs
git commit -m "feat(v6): bulk card view for the mobile quantity list"
```

---

### Task 4: Styles for the bulk-only cells

**Files:**
- Modify: `v6/styles/pricing-table.css` (append a bulk section before the `@media` block at the end)
- Modify: `v6/styles/detalle-cotizacion.css` (append the applied-row highlight)

**Interfaces:**
- Consumes: the class names emitted in Tasks 2 and 3 — `.lp-bulk-wrap`, `.lp-bulk-hint`, `.markup-bulk`.
- Produces: `.row-bulk-applied` for use in Task 6.

- [ ] **Step 1: Write the failing test**

Append to `docs/verify-bulk-cantidades.mjs` before the report divider:

```js
// --- Task 4: bulk cell styling ---------------------------------------------

await check('bulk logo and markup inputs are styled as plain overrides', async () => {
  const page = await open(BULK_FIXTURE);
  const logo = await page.$eval('.lp-input[data-i="0"]', (el) => {
    const s = getComputedStyle(el);
    return { align: s.textAlign, width: parseInt(s.width, 10) };
  });
  assert(logo.align === 'right', 'logo input should be right-aligned, got ' + logo.align);
  assert(logo.width > 60, 'logo input looks unstyled, width ' + logo.width);
  const markup = await page.$eval('.markup-input[data-i="0"]', (el) => {
    const s = getComputedStyle(el);
    return { shadow: s.boxShadow, align: s.textAlign };
  });
  assert(markup.shadow === 'none', 'bulk markup must not use the green editing glow');
  assert(markup.align === 'right', 'bulk markup should be right-aligned, got ' + markup.align);
  const hint = await page.$eval('tr[data-i="0"] .lp-bulk-hint', (el) => el.textContent.trim());
  assert(hint === 'base', 'first row should be captioned base, got ' + hint);
  await page.close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run verify:bulk -- --only=styled`
Expected: FAIL with `logo input should be right-aligned, got start` — the cells render but carry no bulk styling yet.

- [ ] **Step 3: Append the bulk cell styles**

Insert into `v6/styles/pricing-table.css` immediately **before** the closing `@media (max-width: 768px)` block:

```css
/* --- Bulk mode (modal / offcanvas "Cargar cantidades") --- */
.pricing-engine .lp-bulk-wrap {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.pricing-engine .lp-bulk-wrap > span {
  font-size: 13px;
  color: var(--pe-muted);
}
.pricing-engine .lp-bulk-wrap input {
  width: 92px;
  padding: 6px 8px;
  border: 1px solid #d8d8d5;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  text-align: right;
  background: #ffffff;
  color: #1a1a1a;
}
.pricing-engine .lp-bulk-hint {
  font-size: 11px;
  color: var(--pe-muted);
  margin-top: 4px;
  min-height: 14px;
}
/* The bulk markup field is a plain override: no suggested value, no revert. */
.pricing-engine .markup-input.markup-bulk {
  border-color: #d8d8d5;
  box-shadow: none;
  color: #1a1a1a;
  font-weight: 500;
  width: 72px;
  text-align: right;
}
.pricing-engine .markup-input.markup-bulk:focus {
  border-color: var(--pe-green-border);
  box-shadow: 0 0 0 2px rgba(51, 153, 51, 0.12);
  outline: none;
}
```

The nested-panel cascade controls do **not** go here: `pricing-table.css` states in its header that
everything is scoped under `.pricing-engine` to avoid clashing with Bootstrap globals, and the
nested panel lives outside the engine root. They go in `v6/styles/detalle-cotizacion.css` in the
next step instead.

Then, inside the existing `@media (max-width: 768px)` block at the very end, add:

```css
  .pricing-engine .lp-bulk-wrap input { width: 76px; }
  .pricing-engine .markup-input.markup-bulk { width: 62px; }
```

- [ ] **Step 4: Append the applied-row highlight and the nested cascade controls**

At the end of `v6/styles/detalle-cotizacion.css`:

```css
/* Confirmación visual tras aplicar cantidades en bloque */
.item-container.row-bulk-applied > td {
  animation: bulk-applied-flash 1.2s ease-out;
}

@keyframes bulk-applied-flash {
  0% { background-color: #d1e7dd; }
  100% { background-color: transparent; }
}

/* Controles de cascada del panel anidado (mobile) */
.nested-sidebar-body .pct-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.nested-sidebar-body .pct-row .pct-remove {
  border: 1px solid #cc9999;
  background: #ffffff;
  color: #a33;
  border-radius: 4px;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  line-height: 1;
}

.nested-sidebar-body .pct-group-add {
  border: 1px dashed #339933;
  background: #f4fbf0;
  color: #339933;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 13px;
  font-weight: 600;
  width: 100%;
}

.nested-sidebar-body .pct-group-hint {
  font-size: 11px;
  color: #6c757d;
  margin-top: 4px;
}
```

- [ ] **Step 5: Run to verify it passes**

Run: `npm run verify:bulk`
Expected: `19/19 checks passed`.

- [ ] **Step 6: Commit**

```bash
git add v6/styles/pricing-table.css v6/styles/detalle-cotizacion.css
git commit -m "style(v6): bulk cantidades cells and applied-row highlight"
```

---

### Task 5: Desktop modal markup

**Files:**
- Modify: `v6/detalle-cotizacion.html:20` area (add `pricing-table.css`), `806-931` (modal body), `1753` area (add scripts)
- Modify: `docs/verify-bulk-cantidades.mjs` (append checks)

**Interfaces:**
- Consumes: bulk table mode from Task 2, styles from Task 4.
- Produces: `#modalMasElementos .pricing-engine[data-pricing-engine]` with `data-bulk-managed` on the modal, and `#bulkGuardarDesktop` as the save button id.

- [ ] **Step 1: Write the failing test**

Append to `docs/verify-bulk-cantidades.mjs` before the report divider:

```js
// --- Task 5: desktop modal -------------------------------------------------

await check('desktop modal hosts the bulk engine', async () => {
  const page = await open('v6/detalle-cotizacion.html');
  assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
  await page.click('#btnCotizarRapido');
  await page.waitForSelector('#modalMasElementos.show', { timeout: 3000 });
  const heads = await page.$$eval('#modalMasElementos [data-role="pricing-head"] th', (th) =>
    th.map((e) => e.textContent.trim())
  );
  for (const label of ['Cantidad', 'Logo x Ubicación', 'Markup', 'Ajustes comerciales']) {
    assert(heads.some((h) => h.startsWith(label)), 'missing header ' + label + ' in ' + JSON.stringify(heads));
  }
  const stale = await page.$$eval('#modalMasElementos', (m) => m[0].textContent);
  assert(stale.indexOf('Costo extra') === -1, 'Costo extra still present');
  assert(stale.indexOf('Margen') === -1, 'Margen still present');
  await page.close();
});

await check('desktop modal is xl and drops the empty-state hooks', async () => {
  const page = await open('v6/detalle-cotizacion.html');
  const xl = await page.$eval('#modalMasElementos .modal-dialog', (d) => d.classList.contains('modal-xl'));
  assert(xl, 'dialog should be modal-xl');
  const hooks = await page.$$eval('#modalMasElementos [data-table-empty], #modalMasElementos [data-table-empty-mobile]', (e) => e.length);
  assert(hooks === 0, 'empty-state hooks must be removed, found ' + hooks);
  await page.close();
});

await check('v6 items table keeps its own empty state', async () => {
  const page = await open('v6/detalle-cotizacion.html');
  const hook = await page.$$eval('[data-empty-type="products"]', (e) => e.length);
  assert(hook === 1, 'the products table must keep data-table-empty');
  await page.close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run verify:bulk -- --only=desktop`
Expected: FAIL with `missing header Logo x Ubicación` and `dialog should be modal-xl`.

- [ ] **Step 3: Add the stylesheet**

In `v6/detalle-cotizacion.html`, after the existing `table-empty-state.css` link (line ~21):

```html
    <link href="styles/pricing-table.css" rel="stylesheet">
```

- [ ] **Step 4: Replace the modal body**

Replace the entire `<div class="modal-body"> … </div>` of `#modalMasElementos` — everything from `<div class="modal-body">` through the closing `</div>` before `<div class="modal-footer">`, i.e. the current lines 813–924 — with:

```html
                <div class="modal-body">
                    <!-- Contexto de selección -->
                    <div class="selection-context mb-3" id="modalMasElementosContext">
                        <i class="fas fa-check-square me-2"></i>
                        <span class="selection-context-text">Se aplicará a <strong>0 ítems seleccionados</strong></span>
                    </div>

                    <div class="pricing-engine" data-pricing-engine data-pricing-mode="bulk">
                        <script type="application/json" data-role="pricing-quotes">
                        [
                          { "cantidad": 50,  "descs": [0], "fins": [0] },
                          { "cantidad": 100, "descs": [0], "fins": [0] },
                          { "cantidad": 200, "descs": [0], "fins": [0] }
                        ]
                        </script>
                        <div class="table-wrap">
                            <table class="pe-table">
                                <thead data-role="pricing-head"></thead>
                                <tbody data-role="pricing-body"></tbody>
                            </table>
                        </div>
                        <button type="button" class="add-row" data-action="add-row">+ Agregar cantidad (máx. 5)</button>
                    </div>

                    <!-- Mensaje de atención -->
                    <div class="alert alert-warning mt-3 mb-0" role="alert">
                        <i class="fas fa-exclamation-triangle me-2"></i>
                        <strong>Atención:</strong> Al guardar se reemplazan las cantidades de los ítems alcanzados. Los costos propios de cada ítem que dejes vacíos acá se conservan.
                    </div>
                </div>
```

- [ ] **Step 5: Widen the dialog and mark it managed**

Change the modal's opening tags:

```html
    <div class="modal fade" id="modalMasElementos" tabindex="-1" aria-labelledby="modalMasElementosLabel" aria-hidden="true" data-bulk-managed>
        <div class="modal-dialog modal-dialog-centered modal-xl">
```

Rename the footer save button so it no longer collides with the shared toolbar script's `guardarCantidadesDesktop` handler:

```html
                    <button type="button" class="btn btn-primary" id="bulkGuardarDesktop">Guardar cambios</button>
```

- [ ] **Step 6: Load the engine**

In the script block at the bottom of `v6/detalle-cotizacion.html`, after `table-select-image-modal.js`:

```html
    <script src="js-scripts/pricing-engine.js"></script>
```

- [ ] **Step 7: Run to verify it passes**

Run: `npm run verify:bulk`
Expected: `22/22 checks passed`.

- [ ] **Step 8: Commit**

```bash
git add v6/detalle-cotizacion.html docs/verify-bulk-cantidades.mjs
git commit -m "feat(v6): desktop Cargar cantidades modal hosts the bulk engine"
```

---

### Task 6: `bulk-cantidades.js` — targeting, adaptation and apply

**Files:**
- Create: `v6/js-scripts/bulk-cantidades.js`
- Modify: `v6/detalle-cotizacion.html` (load the script)
- Modify: `shared/js-scripts/cotizacion-selection-toolbar.js` (bail out on `data-bulk-managed`)
- Modify: `docs/verify-bulk-cantidades.mjs` (append checks)

**Interfaces:**
- Consumes: `root.__pricingEngine`, `getBulkPayload`, `setBulkColumns`, `resetBulkQuotes`, `pricing-bulk-edit-row`.
- Produces: `window.bulkCantidades = { getLastPayload: function () {...}, getTargets: function () {...} }` — read by the harness and by Task 7.

**Note on the spec's save semantics.** The spec's seven merge rules (replace the ladder, match by
`cantidad`, preserve `prodCost` and any override whose cell was left empty, drop absent quantities,
PVP targets ignore logo and markup) describe what the backend must do. This prototype stores
nothing, so `apply()` deliberately implements none of them: it records the payload for inspection,
closes the surface and flashes the targets. Do not invent a persistence layer to satisfy them.

- [ ] **Step 1: Write the failing test**

Append to `docs/verify-bulk-cantidades.mjs` before the report divider:

```js
// --- Task 6: targeting and adaptation --------------------------------------

async function openDetalleAndSelect(indexes) {
  const page = await open('v6/detalle-cotizacion.html');
  for (const i of indexes) {
    await page.click('#item-' + i + ' .item-row-checkbox');
  }
  await page.waitForTimeout(150);
  return page;
}

await check('Cotizar rápido targets every item with the global banner', async () => {
  const page = await open('v6/detalle-cotizacion.html');
  await page.click('#btnCotizarRapido');
  await page.waitForSelector('#modalMasElementos.show');
  const banner = await page.$eval('#modalMasElementosContext', (e) => ({
    global: e.classList.contains('context-global'),
    text: e.textContent.trim(),
  }));
  assert(banner.global, 'banner should use the context-global variant');
  assert(banner.text.indexOf('todos los productos') !== -1, 'unexpected banner: ' + banner.text);
  const count = await page.evaluate(() => window.bulkCantidades.getTargets().length);
  assert(count === 4, 'expected all 4 items targeted, got ' + count);
  await page.close();
});

await check('selection of two catalogo items shows both columns', async () => {
  const page = await openDetalleAndSelect([1, 2]);
  await page.click('#btnCargarCantidadesSeleccion');
  await page.waitForSelector('#modalMasElementos.show');
  const banner = await page.$eval('#modalMasElementosContext', (e) => e.textContent.trim());
  assert(banner.indexOf('2 ítems seleccionados') !== -1, 'unexpected banner: ' + banner);
  assert(banner.indexOf('no aplican') === -1, 'should not warn when no PVP item is targeted');
  const heads = await page.$$eval('#modalMasElementos [data-role="pricing-head"] th', (th) => th.map((e) => e.textContent.trim()));
  assert(heads.some((h) => h.startsWith('Logo')), 'logo column expected');
  assert(heads.some((h) => h.startsWith('Markup')), 'markup column expected');
  await page.close();
});

await check('mixed selection keeps the columns and warns', async () => {
  const page = await openDetalleAndSelect([1, 4]);
  await page.click('#btnCargarCantidadesSeleccion');
  await page.waitForSelector('#modalMasElementos.show');
  const banner = await page.$eval('#modalMasElementosContext', (e) => e.textContent.trim());
  assert(banner.indexOf('no aplican a 1') !== -1, 'expected the skip note, got ' + banner);
  const heads = await page.$$eval('#modalMasElementos [data-role="pricing-head"] th', (th) => th.map((e) => e.textContent.trim()));
  assert(heads.some((h) => h.startsWith('Logo')), 'logo column expected in a mixed target');
  await page.close();
});

await check('PVP-only selection hides logo and markup', async () => {
  const page = await openDetalleAndSelect([4]);
  await page.click('#btnCargarCantidadesSeleccion');
  await page.waitForSelector('#modalMasElementos.show');
  const heads = await page.$$eval('#modalMasElementos [data-role="pricing-head"] th', (th) => th.map((e) => e.textContent.trim()));
  assert(!heads.some((h) => h.startsWith('Logo')), 'logo column should be hidden');
  assert(!heads.some((h) => h.startsWith('Markup')), 'markup column should be hidden');
  assert(heads.some((h) => h.startsWith('Cantidad')), 'cantidad must survive');
  await page.close();
});

await check('reopening resets the ladder', async () => {
  const page = await open('v6/detalle-cotizacion.html');
  await page.click('#btnCotizarRapido');
  await page.waitForSelector('#modalMasElementos.show');
  await page.click('#modalMasElementos [data-action="add-row"]');
  await page.click('#modalMasElementos [data-bs-dismiss="modal"].btn-secondary');
  await page.waitForTimeout(500);
  await page.click('#btnCotizarRapido');
  await page.waitForSelector('#modalMasElementos.show');
  const rows = await page.$$eval('#modalMasElementos [data-role="pricing-body"] tr', (r) => r.length);
  assert(rows === 3, 'expected the ladder reset to 3 rows, got ' + rows);
  await page.close();
});

await check('saving applies the payload and flashes the targets', async () => {
  const page = await openDetalleAndSelect([1, 2]);
  await page.click('#btnCargarCantidadesSeleccion');
  await page.waitForSelector('#modalMasElementos.show');
  await page.fill('#modalMasElementos .cantidad[data-i="0"]', '250');
  await page.fill('#modalMasElementos .lp-input[data-i="0"]', '500');
  await page.click('#bulkGuardarDesktop');
  await page.waitForTimeout(300);
  const payload = await page.evaluate(() => window.bulkCantidades.getLastPayload());
  assert(payload.rows[0].cantidad === 250, 'expected cantidad 250, got ' + payload.rows[0].cantidad);
  assert(payload.rows[0].logoUnit === 500, 'expected logoUnit 500, got ' + payload.rows[0].logoUnit);
  assert(payload.rows[1].logoUnit === null, 'row 1 logo should stay null');
  assert(payload.targets.length === 2, 'expected 2 targets, got ' + payload.targets.length);
  const open2 = await page.$eval('#modalMasElementos', (m) => m.classList.contains('show'));
  assert(!open2, 'modal should close after saving');
  await page.close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run verify:bulk`
Expected: the six new checks FAIL, the first with `window.bulkCantidades is undefined`; the previous 22 still pass.

- [ ] **Step 3: Create the script**

Create `v6/js-scripts/bulk-cantidades.js`:

```js
/**
 * Cargar cantidades en bloque (v6).
 *
 * Resuelve a qué ítems apunta el modal / offcanvas, adapta las columnas del
 * motor de precios a lo que esos ítems soportan, escribe el contexto y aplica
 * el resultado. El motor no sabe nada de modales: sólo expone getBulkPayload().
 *
 * Los ítems genéricos con precio de venta (generico-pvp) no tienen logo ni
 * markup, así que esas dos columnas se ocultan cuando todos los destinos son
 * de ese tipo y se avisa cuando la selección es mixta.
 */
(function () {
  'use strict';

  var lastPayload = null;

  function engineIn(container) {
    if (!container) return null;
    var root = container.querySelector('[data-pricing-engine]');
    return root ? root.__pricingEngine : null;
  }

  function allItems() {
    return [].slice.call(document.querySelectorAll('tr.item-container'));
  }

  function selectedItems() {
    if (window.cotizacionSelection) return window.cotizacionSelection.getSelectedRows();
    return allItems().filter(function (row) {
      var cb = row.querySelector('.item-row-checkbox');
      return cb && cb.checked;
    });
  }

  // Un ítem "sin costos" es el genérico cargado por PVP: no tiene logo ni markup.
  function isPvpItem(row) {
    return row.classList.contains('generico-pvp');
  }

  var state = { targets: [], global: false };

  function isGlobalTrigger(trigger) {
    return Boolean(trigger && (trigger.id === 'btnCotizarRapido' || trigger.id === 'btnCotizarRapidoMobile'));
  }

  function resolveTargets(trigger) {
    state.global = isGlobalTrigger(trigger);
    state.targets = state.global ? allItems() : selectedItems();
    return state.targets;
  }

  function writeContext(containerId) {
    var box = document.getElementById(containerId);
    if (!box) return;
    box.classList.toggle('context-global', state.global);
    var strong = box.querySelector('strong');
    if (!strong) return;

    if (state.global) {
      strong.textContent = 'todos los productos de la cotización';
    } else {
      var n = state.targets.length;
      strong.textContent = (n === 1) ? '1 ítem seleccionado' : (n + ' ítems seleccionados');
    }

    var note = box.querySelector('.selection-context-note');
    var skipped = state.targets.filter(isPvpItem).length;
    var mixed = skipped > 0 && skipped < state.targets.length;
    if (mixed) {
      if (!note) {
        note = document.createElement('span');
        note.className = 'selection-context-note ms-2';
        box.querySelector('.selection-context-text').appendChild(note);
      }
      note.textContent = ' Logo y Markup no aplican a ' + skipped
        + (skipped === 1 ? ' ítem sin costos.' : ' ítems sin costos.');
    } else if (note) {
      note.remove();
    }
  }

  function applyColumns(engine) {
    if (!engine) return;
    var withCosts = state.targets.filter(function (row) { return !isPvpItem(row); }).length;
    var show = state.targets.length === 0 || withCosts > 0;
    engine.setBulkColumns({ logo: show, markup: show });
  }

  function prepare(container, contextId, trigger) {
    resolveTargets(trigger);
    var engine = engineIn(container);
    if (engine) {
      engine.resetBulkQuotes();
      applyColumns(engine);
    }
    writeContext(contextId);
  }

  function flashTargets() {
    state.targets.forEach(function (row) {
      row.classList.remove('row-bulk-applied');
      // Reflow para poder reiniciar la animación en aplicaciones consecutivas.
      void row.offsetWidth;
      row.classList.add('row-bulk-applied');
      setTimeout(function () { row.classList.remove('row-bulk-applied'); }, 1300);
    });
  }

  function apply(container, hide) {
    var engine = engineIn(container);
    if (!engine) return;
    lastPayload = { rows: engine.getBulkPayload(), targets: state.targets.map(function (r) { return r.id; }) };
    hide();
    flashTargets();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var modal = document.getElementById('modalMasElementos');

    if (modal) {
      modal.addEventListener('show.bs.modal', function (e) {
        prepare(modal, 'modalMasElementosContext', e.relatedTarget);
      });
      var saveDesktop = document.getElementById('bulkGuardarDesktop');
      if (saveDesktop) {
        saveDesktop.addEventListener('click', function () {
          apply(modal, function () {
            if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(modal).hide();
          });
        });
      }
    }
  });

  window.bulkCantidades = {
    getLastPayload: function () { return lastPayload; },
    getTargets: function () { return state.targets; }
  };
})();
```

- [ ] **Step 4: Load it after the engine**

In `v6/detalle-cotizacion.html`, after the `pricing-engine.js` line added in Task 5:

```html
    <script src="js-scripts/bulk-cantidades.js"></script>
```

- [ ] **Step 5: Guard the shared toolbar script**

In `shared/js-scripts/cotizacion-selection-toolbar.js`, replace the modal and offcanvas context blocks (lines 72–90) so v6 opts out:

```js
    const modalCantidades = document.getElementById("modalMasElementos");
    if (modalCantidades && !modalCantidades.hasAttribute("data-bulk-managed")) {
        modalCantidades.addEventListener("show.bs.modal", (e) => {
            updateSelectionContext(
                "modalMasElementosContext",
                isCotizarRapidoTrigger(e.relatedTarget)
            );
        });
    }

    const sidebarCantidades = document.getElementById("sidebarMasElementos");
    if (sidebarCantidades && !sidebarCantidades.hasAttribute("data-bulk-managed")) {
        sidebarCantidades.addEventListener("show.bs.offcanvas", (e) => {
            updateSelectionContext(
                "sidebarMasElementosContext",
                isCotizarRapidoTrigger(e.relatedTarget)
            );
        });
    }
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run verify:bulk`
Expected: `28/28 checks passed`.

- [ ] **Step 7: Commit**

```bash
git add v6/js-scripts/bulk-cantidades.js v6/detalle-cotizacion.html shared/js-scripts/cotizacion-selection-toolbar.js docs/verify-bulk-cantidades.mjs
git commit -m "feat(v6): target resolution and column adaptation for bulk cantidades"
```

---

### Task 7: Mobile offcanvas and nested panel

**Files:**
- Modify: `v6/detalle-cotizacion.html:934-1049` (offcanvas body and footer)
- Modify: `v6/js-scripts/bulk-cantidades.js` (offcanvas wiring, nested panel)
- Modify: `shared/js-scripts/sidebar-nested.js` (bail out on `data-bulk-managed`)
- Modify: `docs/verify-bulk-cantidades.mjs` (append checks)

**Interfaces:**
- Consumes: card view from Task 3, `setBulkQuote` / `addBulkQuote`, `pricing-bulk-edit-row`, and the helpers in `bulk-cantidades.js` from Task 6.
- Produces: `#bulkGuardarMobile` as the mobile save button id.

- [ ] **Step 1: Write the failing test**

Append to `docs/verify-bulk-cantidades.mjs` before the report divider:

```js
// --- Task 7: mobile offcanvas ----------------------------------------------

const MOBILE = { width: 390, height: 844 };

await check('mobile offcanvas lists engine-rendered cards', async () => {
  const page = await open('v6/detalle-cotizacion.html', MOBILE);
  assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
  await page.click('#btnCotizarRapidoMobile');
  await page.waitForSelector('#sidebarMasElementos.show');
  const cards = await page.$$eval('#sidebarMasElementos .quantities-card', (c) => c.length);
  assert(cards === 3, 'expected 3 cards, got ' + cards);
  const text = await page.$eval('#sidebarMasElementos .quantities-card', (c) => c.textContent);
  assert(text.indexOf('Logo x Ubicación') !== -1, 'card should list Logo x Ubicación');
  assert(text.indexOf('Costo extra') === -1, 'Costo extra must not exist in v6');
  await page.close();
});

await check('mobile nested panel adds a quantity', async () => {
  const page = await open('v6/detalle-cotizacion.html', MOBILE);
  await page.click('#btnCotizarRapidoMobile');
  await page.waitForSelector('#sidebarMasElementos.show');
  await page.click('#btnAgregarCantidades');
  await page.waitForSelector('#nestedSidebar.show');
  await page.fill('#nestedCantidad', '750');
  await page.click('#btnAgregarCantidadNested');
  await page.waitForTimeout(200);
  const cards = await page.$$eval('#sidebarMasElementos .quantities-card', (c) => c.length);
  assert(cards === 4, 'expected 4 cards after adding, got ' + cards);
  const last = await page.$eval('#sidebarMasElementos .quantities-card[data-i="3"]', (c) => c.textContent);
  assert(last.indexOf('750') !== -1, 'new card should show 750, got ' + last);
  await page.close();
});

await check('mobile nested panel edits an existing quantity', async () => {
  const page = await open('v6/detalle-cotizacion.html', MOBILE);
  await page.click('#btnCotizarRapidoMobile');
  await page.waitForSelector('#sidebarMasElementos.show');
  await page.click('.quantities-card[data-i="1"] .edit-btn-mobile');
  await page.waitForSelector('#nestedSidebar.show');
  const title = await page.$eval('#nestedSidebarTitle', (t) => t.textContent.trim());
  assert(title === 'Editar cantidad', 'expected the edit title, got ' + title);
  const prefill = await page.$eval('#nestedCantidad', (i) => i.value);
  assert(prefill === '100', 'expected prefill 100, got ' + prefill);
  await page.fill('#nestedCantidad', '150');
  await page.click('#btnAgregarCantidadNested');
  await page.waitForTimeout(200);
  const card = await page.$eval('.quantities-card[data-i="1"]', (c) => c.textContent);
  assert(card.indexOf('150') !== -1, 'card should show 150, got ' + card);
  const cards = await page.$$eval('.quantities-card', (c) => c.length);
  assert(cards === 3, 'editing must not add a card, got ' + cards);
  await page.close();
});

await check('mobile cascade button adds a column for every quantity', async () => {
  const page = await open('v6/detalle-cotizacion.html', MOBILE);
  await page.click('#btnCotizarRapidoMobile');
  await page.waitForSelector('#sidebarMasElementos.show');
  await page.click('.quantities-card[data-i="0"] .edit-btn-mobile');
  await page.waitForSelector('#nestedSidebar.show');
  await page.click('#nestedAddDesc');
  const fields = await page.$$eval('#nestedDescGroup .pct-row', (r) => r.length);
  assert(fields === 2, 'expected 2 desc fields, got ' + fields);
  const hint = await page.$eval('#nestedDescGroup .pct-group-hint', (h) => h.textContent.trim());
  assert(hint === 'Se agrega para todas las cantidades', 'missing the global-cascade caption, got ' + hint);
  await page.fill('#nestedDescGroup .pct-row:nth-child(1) input', '10');
  await page.fill('#nestedDescGroup .pct-row:nth-child(2) input', '5');
  await page.click('#btnAgregarCantidadNested');
  await page.waitForTimeout(200);
  const card = await page.$eval('.quantities-card[data-i="0"]', (c) => c.textContent);
  assert(card.indexOf('10% + 5%') !== -1, 'expected the cascade chain, got ' + card);
  await page.close();
});

// Este es el chequeo clave de "quién es dueño del borrado": en la página real
// table-empty-state.js sí está cargado, y sin el guard borraría la card por su
// cuenta además del motor.
await check('mobile card deletion removes exactly one card', async () => {
  const page = await open('v6/detalle-cotizacion.html', MOBILE);
  await page.click('#btnCotizarRapidoMobile');
  await page.waitForSelector('#sidebarMasElementos.show');
  await page.click('.quantities-card[data-i="1"] .delete-btn-mobile');
  await page.waitForTimeout(300);
  const cards = await page.$$eval('#sidebarMasElementos .quantities-card', (c) => c.length);
  assert(cards === 2, 'expected exactly one card removed (3 -> 2), got ' + cards);
  const cantidades = await page.$$eval('#sidebarMasElementos [data-role="card-cantidad"]', (e) =>
    e.map((n) => n.textContent.trim())
  );
  assert(cantidades.join(',') === '50,200', 'wrong card removed: ' + cantidades.join(','));
  await page.close();
});

await check('mobile save applies and closes', async () => {
  const page = await open('v6/detalle-cotizacion.html', MOBILE);
  await page.click('#btnCotizarRapidoMobile');
  await page.waitForSelector('#sidebarMasElementos.show');
  await page.click('#bulkGuardarMobile');
  await page.waitForTimeout(500);
  const payload = await page.evaluate(() => window.bulkCantidades.getLastPayload());
  assert(payload && payload.rows.length === 3, 'expected a 3-row payload');
  assert(payload.targets.length === 4, 'Cotizar rápido should target all 4 items');
  const shown = await page.$eval('#sidebarMasElementos', (o) => o.classList.contains('show'));
  assert(!shown, 'offcanvas should close after saving');
  await page.close();
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npm run verify:bulk -- --only=mobile`
Expected: all six FAIL. The first fails on `card should list Logo x Ubicación` rather than on the card count, because the three hardcoded v5-shaped cards are still in the markup and still list `Costo extra`.

- [ ] **Step 3: Replace the offcanvas body**

In `v6/detalle-cotizacion.html`, mark the offcanvas managed and replace its body and footer — the whole `<div class="offcanvas-body p-0"> … </div>` plus the trailing `<div class="offcanvas-footer"> … </div>`, i.e. the current lines 934–1049:

```html
    <div class="offcanvas offcanvas-end" tabindex="-1" id="sidebarMasElementos" aria-labelledby="sidebarMasElementosLabel" data-bulk-managed>
        <div class="offcanvas-header">
            <h5 class="offcanvas-title" id="sidebarMasElementosLabel">Cargar cantidades</h5>
            <button type="button" class="btn-close text-reset" data-bs-dismiss="offcanvas" aria-label="Close"></button>
        </div>
        <div class="offcanvas-body p-0">
            <div class="sidebar-content">
                <div class="selection-context mb-3" id="sidebarMasElementosContext">
                    <i class="fas fa-check-square me-2"></i>
                    <span class="selection-context-text">Se aplicará a <strong>0 ítems seleccionados</strong></span>
                </div>
                <div class="pricing-engine" data-pricing-engine data-pricing-mode="bulk" data-pricing-view="cards">
                    <script type="application/json" data-role="pricing-quotes">
                    [
                      { "cantidad": 50,  "descs": [0], "fins": [0] },
                      { "cantidad": 100, "descs": [0], "fins": [0] },
                      { "cantidad": 200, "descs": [0], "fins": [0] }
                    ]
                    </script>
                    <button class="btn btn-outline-secondary mb-2 w-100" type="button" id="btnAgregarCantidades">
                        Agregar cantidades
                    </button>
                    <div class="saved-quantities mb-3" data-role="pricing-cards"></div>
                </div>
            </div>

            <!-- Sidebar anidado: agrega y edita una cantidad -->
            <div class="nested-sidebar" id="nestedSidebar">
                <div class="nested-sidebar-header">
                    <button type="button" class="btn-back" id="btnBackNestedSidebar">
                        <i class="fas fa-chevron-left"></i>
                        <h5 id="nestedSidebarTitle">Agregar cantidades</h5>
                    </button>
                </div>
                <div class="nested-sidebar-body">
                    <label class="form-label d-block w-100">
                        <span>Cantidad</span>
                        <input type="number" class="form-control mt-2" id="nestedCantidad" min="1">
                    </label>
                    <label class="form-label d-block w-100" id="nestedLogoField">
                        <span>Logo x Ubicación</span>
                        <div class="input-group mt-2">
                            <span class="input-group-text">$</span>
                            <input type="text" inputmode="numeric" class="form-control" id="nestedLogo">
                        </div>
                    </label>
                    <label class="form-label d-block w-100" id="nestedMarkupField">
                        <span>Markup</span>
                        <input type="text" inputmode="numeric" class="form-control mt-2" id="nestedMarkup" placeholder="sin cambios">
                    </label>
                    <div class="mb-3" id="nestedDescGroup" data-field="descs">
                        <span class="form-label d-block">Desc. adicional</span>
                        <div class="pct-rows"></div>
                        <button type="button" class="pct-group-add mt-2" id="nestedAddDesc">+ Agregar descuento en cascada</button>
                        <div class="pct-group-hint">Se agrega para todas las cantidades</div>
                    </div>
                    <div class="mb-3" id="nestedFinGroup" data-field="fins">
                        <span class="form-label d-block">Financiación</span>
                        <div class="pct-rows"></div>
                        <button type="button" class="pct-group-add mt-2" id="nestedAddFin">+ Agregar financiación en cascada</button>
                        <div class="pct-group-hint">Se agrega para todas las cantidades</div>
                    </div>
                </div>
                <div class="nested-sidebar-footer">
                    <button type="button" class="btn btn-outline-secondary w-100" id="btnAgregarCantidadNested">Agregar</button>
                </div>
            </div>
        </div>

        <div class="offcanvas-footer">
            <div class="alert alert-warning mb-3" role="alert">
                <i class="fas fa-exclamation-triangle me-2"></i>
                <strong>Atención:</strong> Al guardar se reemplazan las cantidades de los ítems alcanzados. Los costos propios de cada ítem que dejes vacíos acá se conservan.
            </div>
            <div class="d-grid gap-2">
                <button type="button" class="btn btn-primary" id="bulkGuardarMobile">Guardar cambios</button>
                <button type="button" class="btn btn-secondary" data-bs-dismiss="offcanvas">Cerrar</button>
            </div>
        </div>
    </div>
```

- [ ] **Step 4: Guard the shared nested-sidebar script**

In `shared/js-scripts/sidebar-nested.js`, add an early return after the `mainSidebar` lookup:

```js
    const mainSidebar = document.getElementById('sidebarMasElementos');
    if (mainSidebar && mainSidebar.hasAttribute('data-bulk-managed')) return;
```

- [ ] **Step 5: Wire the offcanvas in `bulk-cantidades.js`**

Append inside the IIFE of `v6/js-scripts/bulk-cantidades.js`, replacing its `DOMContentLoaded` block with this fuller version:

```js
  // --- Panel anidado (mobile): agrega y edita una cantidad -------------------

  var nested = { index: null, engine: null };

  function pctRows(groupId) {
    var group = document.getElementById(groupId);
    return group ? [].slice.call(group.querySelectorAll('.pct-row input')) : [];
  }

  function renderPctRows(groupId, values) {
    var group = document.getElementById(groupId);
    if (!group) return;
    var host = group.querySelector('.pct-rows');
    host.innerHTML = values.map(function (v, j) {
      return '<div class="pct-row mt-2">'
        + '<input type="number" class="form-control" inputmode="numeric" value="' + v + '">'
        + '<span class="input-group-text">%</span>'
        + (j > 0 ? '<button type="button" class="pct-remove" data-j="' + j + '" aria-label="Quitar">×</button>' : '')
        + '</div>';
    }).join('');
    host.querySelectorAll('.pct-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var vals = pctRows(groupId).map(function (i) { return Number(i.value) || 0; });
        vals.splice(Number(btn.getAttribute('data-j')), 1);
        renderPctRows(groupId, vals);
      });
    });
  }

  function readPct(groupId) {
    var vals = pctRows(groupId).map(function (i) {
      return Math.min(100, Math.max(0, Number(i.value) || 0));
    });
    return vals.length ? vals : [0];
  }

  function parseField(value) {
    var raw = String(value || '').trim();
    if (raw === '') return null;
    var n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? null : n;
  }

  function openNested(engine, index) {
    if (!engine) return;
    nested.engine = engine;
    nested.index = index;

    var quotes = engine.getBulkPayload();
    var q = (index == null) ? null : quotes[index];

    document.getElementById('nestedSidebarTitle').textContent = (index == null) ? 'Agregar cantidades' : 'Editar cantidad';
    document.getElementById('btnAgregarCantidadNested').textContent = (index == null) ? 'Agregar' : 'Guardar';
    document.getElementById('nestedCantidad').value = q ? q.cantidad : '';
    document.getElementById('nestedLogo').value = (q && q.logoUnit != null) ? q.logoUnit : '';
    document.getElementById('nestedMarkup').value = (q && q.customMarkup != null) ? q.customMarkup : '';
    renderPctRows('nestedDescGroup', q ? q.descs : [0]);
    renderPctRows('nestedFinGroup', q ? q.fins : [0]);

    document.getElementById('nestedLogoField').hidden = !engine.showLogoCol;
    document.getElementById('nestedMarkupField').hidden = !engine.showMarkupCol;

    document.getElementById('nestedSidebar').classList.add('show');
    var footer = document.querySelector('#sidebarMasElementos .offcanvas-footer');
    if (footer) footer.style.display = 'none';
  }

  function closeNested() {
    document.getElementById('nestedSidebar').classList.remove('show');
    var footer = document.querySelector('#sidebarMasElementos .offcanvas-footer');
    if (footer) footer.style.display = '';
  }

  function commitNested() {
    if (!nested.engine) return;
    var data = {
      cantidad: Number(document.getElementById('nestedCantidad').value) || 0,
      logoUnit: parseField(document.getElementById('nestedLogo').value),
      customMarkup: parseField(document.getElementById('nestedMarkup').value),
      descs: readPct('nestedDescGroup'),
      fins: readPct('nestedFinGroup')
    };
    if (nested.index == null) nested.engine.addBulkQuote(data);
    else nested.engine.setBulkQuote(nested.index, data);
    closeNested();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var modal = document.getElementById('modalMasElementos');
    var sidebar = document.getElementById('sidebarMasElementos');

    if (modal) {
      modal.addEventListener('show.bs.modal', function (e) {
        prepare(modal, 'modalMasElementosContext', e.relatedTarget);
      });
      var saveDesktop = document.getElementById('bulkGuardarDesktop');
      if (saveDesktop) {
        saveDesktop.addEventListener('click', function () {
          apply(modal, function () {
            if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(modal).hide();
          });
        });
      }
    }

    if (sidebar) {
      sidebar.addEventListener('show.bs.offcanvas', function (e) {
        prepare(sidebar, 'sidebarMasElementosContext', e.relatedTarget);
      });
      sidebar.addEventListener('hidden.bs.offcanvas', closeNested);
      sidebar.addEventListener('pricing-bulk-edit-row', function (e) {
        openNested(engineIn(sidebar), e.detail.index);
      });

      var btnAgregar = document.getElementById('btnAgregarCantidades');
      if (btnAgregar) {
        btnAgregar.addEventListener('click', function () { openNested(engineIn(sidebar), null); });
      }
      var btnBack = document.getElementById('btnBackNestedSidebar');
      if (btnBack) btnBack.addEventListener('click', closeNested);
      var btnCommit = document.getElementById('btnAgregarCantidadNested');
      if (btnCommit) btnCommit.addEventListener('click', commitNested);

      ['nestedAddDesc', 'nestedAddFin'].forEach(function (id) {
        var btn = document.getElementById(id);
        if (!btn) return;
        var groupId = (id === 'nestedAddDesc') ? 'nestedDescGroup' : 'nestedFinGroup';
        btn.addEventListener('click', function () {
          var vals = pctRows(groupId).map(function (i) { return Number(i.value) || 0; });
          if (vals.length >= 3) return;
          vals.push(0);
          renderPctRows(groupId, vals);
        });
      });

      var saveMobile = document.getElementById('bulkGuardarMobile');
      if (saveMobile) {
        saveMobile.addEventListener('click', function () {
          apply(sidebar, function () {
            if (window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(sidebar).hide();
          });
        });
      }
    }
  });
```

- [ ] **Step 6: Run to verify it passes**

Run: `npm run verify:bulk`
Expected: `34/34 checks passed`.

- [ ] **Step 7: Commit**

```bash
git add v6/detalle-cotizacion.html v6/js-scripts/bulk-cantidades.js shared/js-scripts/sidebar-nested.js docs/verify-bulk-cantidades.mjs
git commit -m "feat(v6): mobile Cargar cantidades offcanvas with engine-rendered cards"
```

---

### Task 8: v5 non-regression and documentation

**Files:**
- Modify: `docs/verify-bulk-cantidades.mjs` (append v5 checks)
- Modify: `README.md` (document the verification command)

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Write the failing test**

Append to `docs/verify-bulk-cantidades.mjs` before the report divider:

```js
// --- Task 8: v5 must be untouched ------------------------------------------

await check('v5 keeps its own cantidades modal', async () => {
  const page = await open('v5/detalle-cotizacion.html');
  assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
  const managed = await page.$$eval('[data-bulk-managed]', (e) => e.length);
  assert(managed === 0, 'v5 must not be bulk-managed');
  await page.click('#btnCotizarRapido');
  await page.waitForSelector('#modalMasElementos.show');
  const text = await page.$eval('#modalMasElementos', (m) => m.textContent);
  assert(text.indexOf('Costo extra') !== -1, 'v5 should still show its Costo extra column');
  const banner = await page.$eval('#modalMasElementosContext', (e) => e.classList.contains('context-global'));
  assert(banner, 'v5 banner should still switch to the global variant');
  await page.close();
});

await check('v5 mobile nested sidebar still opens', async () => {
  const page = await open('v5/detalle-cotizacion.html', { width: 390, height: 844 });
  await page.click('#btnCotizarRapidoMobile');
  await page.waitForSelector('#sidebarMasElementos.show');
  await page.click('#btnAgregarCantidades');
  await page.waitForTimeout(200);
  const shown = await page.$eval('#nestedSidebar', (n) => n.classList.contains('show'));
  assert(shown, 'v5 nested sidebar should still open via the shared script');
  await page.close();
});

await check('v5 item pages keep working', async () => {
  for (const path of ['v5/editItem.html', 'v5/editItem-generico.html']) {
    const page = await open(path);
    assert(page.errors.length === 0, path + ' errors: ' + page.errors.join(' | '));
    const rows = await page.$$eval('table tbody tr', (r) => r.length);
    assert(rows >= 2, path + ' should still render its static quantity rows');
    await page.close();
  }
});
```

- [ ] **Step 2: Run the full suite**

Run: `npm run verify:bulk`
Expected: `37/37 checks passed`. If the v5 checks fail, a shared-script guard is wrong — fix the guard, never the v5 markup.

- [ ] **Step 3: Document the command**

In `README.md`, after the `## Estructura` section:

```markdown
## Verificación

```bash
npm run verify:bulk            # todas las comprobaciones
npm run verify:bulk -- --only=mobile
```

Levanta un servidor estático en el puerto 8099 y recorre v6 y v5 con Playwright.
Requiere `npx playwright install chromium` la primera vez.
```

- [ ] **Step 4: Commit**

```bash
git add docs/verify-bulk-cantidades.mjs README.md
git commit -m "test(v6): v5 non-regression checks + document the verify command"
```

---

## Manual QA after Task 8

Serve the repo root and walk through the spec's verification list by hand — automated checks do not cover visual weight:

1. `v6/detalle-cotizacion.html` → Cotizar rápido: yellow banner, full column set, the table reads like the item page.
2. Select two catálogo items → Cargar cantidades: blue banner with the count.
3. Select one catálogo item and item 4 (genérico-PVP): both columns stay, banner adds the "no aplican" note.
4. Select only item 4: Logo and Markup columns are gone.
5. `+` adds a Desc. column for every row up to three, `×` removes it, `efect.` tracks.
6. Agregar cantidad stops at five rows; the trash is disabled at one.
7. At ≤768px: cards match the desktop columns, the nested panel adds and edits, the footer hides while nested is open.
8. `v5/detalle-cotizacion.html` and both v5 item pages behave exactly as before.
