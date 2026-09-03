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
  if (only && !name.toLowerCase().includes(only.toLowerCase())) return;
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

    // El motor resuelve campos que viven fuera de su raíz. Si esa búsqueda se
    // rompe, la tabla igual renderiza y no hay error: hay que afirmarlo.
    const wired = await page.evaluate(() => {
      const e = document.querySelector('[data-pricing-engine]').__pricingEngine;
      return {
        pvpInDom: !!document.querySelector('[data-pricing-pvp]'),
        setupInDom: !!document.querySelector('[data-pricing-setup]'),
        pvpResolved: !!e.pvpInput,
        setupResolved: !!e.setupInput,
      };
    });
    assert(wired.pvpInDom === wired.pvpResolved, 'pvpInput resolution disagrees with the DOM on ' + path);
    assert(wired.setupInDom === wired.setupResolved, 'setupInput resolution disagrees with the DOM on ' + path);
    await page.close();
  });
}

// Se usa la página genérico-costo: es la única donde el campo externo
// [data-pricing-pvp] alimenta el cálculo. En editItem.html el campo está
// disabled, y en genérico-pvp cada fila trae su propio precioVolumen, que
// pisa al PVP externo: allí la fila no se movería aunque el cableado ande.
await check('editing the PVP field moves the totals', async () => {
  const page = await open('v6/editItem-generico-costo.html');
  const before = await page.$eval('[data-role="pricing-body"] tr', (r) => r.textContent);
  await page.fill('[data-pricing-pvp]', '9999');
  await page.waitForTimeout(200);
  const after = await page.$eval('[data-role="pricing-body"] tr', (r) => r.textContent);
  assert(before !== after, 'the row did not react to the PVP field; the external wiring is broken');
  await page.close();
});

for (const path of ['v5/editItem.html', 'v5/editItem-generico.html', 'v5/detalle-cotizacion.html', 'v6/detalle-cotizacion.html']) {
  await check('loads clean: ' + path, async () => {
    const page = await open(path);
    assert(page.errors.length === 0, 'page errors: ' + page.errors.join(' | '));
    await page.close();
  });
}

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

await check('bulk engines wire no fields outside their root', async () => {
  const page = await open(BULK_FIXTURE);
  const wiring = await page.evaluate(() => {
    const e = document.querySelector('[data-pricing-engine]').__pricingEngine;
    return { pvp: e.pvpInput, setup: e.setupInput };
  });
  assert(wiring.pvp === null, 'a bulk engine must not claim [data-pricing-pvp]');
  assert(wiring.setup === null, 'a bulk engine must not claim [data-pricing-setup]');
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
  await page.waitForSelector('#modalMasElementos', { state: 'hidden' });
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
  await page.waitForSelector('#modalMasElementos', { state: 'hidden' });
  const payload = await page.evaluate(() => window.bulkCantidades.getLastPayload());
  assert(payload.rows[0].cantidad === 250, 'expected cantidad 250, got ' + payload.rows[0].cantidad);
  assert(payload.rows[0].logoUnit === 500, 'expected logoUnit 500, got ' + payload.rows[0].logoUnit);
  assert(payload.rows[1].logoUnit === null, 'row 1 logo should stay null');
  assert(payload.targets.length === 2, 'expected 2 targets, got ' + payload.targets.length);
  await page.close();
});

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
  await page.waitForSelector('#sidebarMasElementos', { state: 'hidden' });
  const payload = await page.evaluate(() => window.bulkCantidades.getLastPayload());
  assert(payload && payload.rows.length === 3, 'expected a 3-row payload');
  assert(payload.targets.length === 4, 'Cotizar rápido should target all 4 items');
  await page.close();
});

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

await check('mobile Agregar cantidades disables at 5 cards', async () => {
  const page = await open('v6/detalle-cotizacion.html', MOBILE);
  await page.click('#btnCotizarRapidoMobile');
  await page.waitForSelector('#sidebarMasElementos.show');
  for (let i = 0; i < 2; i++) {
    await page.click('#btnAgregarCantidades');
    await page.waitForSelector('#nestedSidebar.show');
    await page.fill('#nestedCantidad', String(300 + i));
    await page.click('#btnAgregarCantidadNested');
    await page.waitForTimeout(200);
  }
  const cards = await page.$$eval('#sidebarMasElementos .quantities-card', (c) => c.length);
  assert(cards === 5, 'expected 5 cards, got ' + cards);
  const disabled = await page.$eval('#btnAgregarCantidades', (b) => b.disabled);
  assert(disabled, 'Agregar cantidades should be disabled at 5 cards');
  await page.click('#btnAgregarCantidades', { force: true });
  await page.waitForTimeout(200);
  const nestedOpen = await page.$eval('#nestedSidebar', (n) => n.classList.contains('show'));
  assert(!nestedOpen, 'nested sidebar must not open at the 5-card cap');
  await page.close();
});

await check('mobile nested cascade remove shrinks the column globally', async () => {
  const page = await open('v6/detalle-cotizacion.html', MOBILE);
  await page.click('#btnCotizarRapidoMobile');
  await page.waitForSelector('#sidebarMasElementos.show');
  await page.click('.quantities-card[data-i="0"] .edit-btn-mobile');
  await page.waitForSelector('#nestedSidebar.show');
  await page.click('#nestedAddDesc');
  await page.fill('#nestedDescGroup .pct-row:nth-child(1) input', '10');
  await page.fill('#nestedDescGroup .pct-row:nth-child(2) input', '5');
  await page.click('#btnAgregarCantidadNested');
  await page.waitForTimeout(200);
  await page.click('.quantities-card[data-i="0"] .edit-btn-mobile');
  await page.waitForSelector('#nestedSidebar.show');
  await page.click('#nestedDescGroup .pct-remove');
  await page.click('#btnAgregarCantidadNested');
  await page.waitForTimeout(200);
  const card = await page.$eval('.quantities-card[data-i="0"]', (c) => c.textContent);
  assert(card.indexOf('10% +') === -1, 'cascade column should be gone, got ' + card);
  assert(card.indexOf('10%') !== -1, 'remaining desc should be 10%, got ' + card);
  await page.close();
});

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
