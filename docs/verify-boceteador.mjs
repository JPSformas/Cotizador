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
