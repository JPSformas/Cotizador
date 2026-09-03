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
