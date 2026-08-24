import { chromium } from 'playwright';
import { mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { readFile } from 'fs/promises';
import { extname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const V4_DIR = join(__dirname, '..', 'Cotizacion v4');
const V5_DIR = __dirname;
const OUT = join(__dirname, 'comparison-screenshots');

const MIME = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.zip': 'application/zip',
};

function startServer(baseDir, port) {
  return new Promise((resolve) => {
    const server = createServer(async (req, res) => {
      try {
        const urlPath = decodeURIComponent(req.url.split('?')[0]).replace(/^\//, '') || 'detalle-cotizacion.html';
        const filePath = join(baseDir, urlPath);
        const data = await readFile(filePath);
        const ext = extname(filePath).toLowerCase();
        res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
        res.end(data);
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    });
    server.listen(port, () => resolve(server));
  });
}

async function shot(page, name, selector, opts = {}) {
  const file = join(OUT, `${name}.png`);
  if (selector) {
    const el = page.locator(selector).first();
    await el.waitFor({ state: 'visible', timeout: 10000 });
    await el.screenshot({ path: file, ...opts });
  } else {
    await page.screenshot({ path: file, fullPage: false, ...opts });
  }
  console.log('Saved', file);
}

/** Lock toggle date is position:absolute below the control — include it in the clip. */
async function shotLockControl(page, name, { includeDate = false } = {}) {
  const file = join(OUT, `${name}.png`);
  const control = page.locator('.precios-actualizados-control').first();
  await control.waitFor({ state: 'visible', timeout: 10000 });

  const controlBox = await control.boundingBox();
  if (!controlBox) throw new Error(`No bounding box for lock control (${name})`);

  const pad = 6;
  let clip = {
    x: controlBox.x - pad,
    y: controlBox.y - pad,
    width: controlBox.width + pad * 2,
    height: controlBox.height + pad * 2,
  };

  if (includeDate) {
    const dateEl = page.locator('#preciosLockedDate');
    await dateEl.waitFor({ state: 'attached', timeout: 5000 });
    const dateBox = await dateEl.boundingBox();
    if (dateBox) {
      const x1 = Math.min(clip.x, dateBox.x - pad);
      const y1 = Math.min(clip.y, dateBox.y - pad);
      const x2 = Math.max(clip.x + clip.width, dateBox.x + dateBox.width + pad);
      const y2 = Math.max(clip.y + clip.height, dateBox.y + dateBox.height + pad);
      clip = { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
    }
  }

  await page.screenshot({ path: file, clip });
  console.log('Saved', file);
}

async function selectFirstRow(page) {
  const cb = page.locator('.item-row-checkbox').first();
  if (!(await cb.isChecked())) await cb.check();
  await page.waitForTimeout(350);
}

async function captureV4(page) {
  await page.goto('http://127.0.0.1:8764/detalle-cotizacion.html', { waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 1400, height: 900 });

  await shot(page, 'v4-01-form-right-column', '.card-section > .row.mb-5');
  await shot(page, 'v4-02-table-toolbar', '.d-flex.align-items-center.justify-content-between.mb-3.flex-wrap');

  await selectFirstRow(page);
  await shot(page, 'v4-03-row-selected-delete-btn', '.table-responsive');

  await page.locator('label[for="actualizarPreciosToggle"]').click();
  await page.waitForTimeout(400);
  await shot(page, 'v4-04-precios-actualizados-toggle', '.d-flex.align-items-center.justify-content-between.mb-3.flex-wrap');

  await page.locator('button[data-bs-target="#modalMasElementos"]').first().click();
  await page.waitForTimeout(700);
  if (await page.locator('#modalMasElementos.show').isVisible()) {
    await shot(page, 'v4-05-cantidades-modal', '#modalMasElementos .modal-content');
    await page.keyboard.press('Escape');
  }
}

async function captureV5(page) {
  await page.goto('http://127.0.0.1:8765/detalle-cotizacion.html', { waitUntil: 'networkidle' });
  await page.setViewportSize({ width: 1400, height: 900 });

  await shot(page, 'v5-01-atajos-globales', '.col-md-6.col-lg-4');
  await shot(page, 'v5-02-default-toolbar', '#tableToolbarDefault');

  await selectFirstRow(page);
  await shot(page, 'v5-03-selection-toolbar', '#tableToolbarSelection');
  await shot(page, 'v5-04-row-selected-highlight', '.table-responsive');

  await page.locator('#btnDescuentoSeleccion').click();
  await page.waitForTimeout(300);
  await shot(page, 'v5-05-descuento-dropdown', '#btnDescuentoSeleccion + .dropdown-menu');

  await page.keyboard.press('Escape');
  await selectFirstRow(page);
  await page.locator('#btnSetupSeleccion').click();
  await page.waitForTimeout(300);
  await shot(page, 'v5-06-setup-dropdown', '#btnSetupSeleccion + .dropdown-menu');

  await page.keyboard.press('Escape');
  await selectFirstRow(page);
  await page.locator('#btnEnvioSeleccion').click();
  await page.waitForTimeout(300);
  await shot(page, 'v5-07-envio-dropdown', '#btnEnvioSeleccion + .dropdown-menu');

  await page.keyboard.press('Escape');
  await page.locator('#btnCotizarRapido').click();
  await page.waitForTimeout(700);
  if (await page.locator('#modalMasElementos.show').isVisible()) {
    await shot(page, 'v5-08-cotizar-rapido-modal', '#modalMasElementos .modal-content');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  await selectFirstRow(page);
  await page.locator('#btnCargarCantidadesSeleccion').click();
  await page.waitForTimeout(700);
  if (await page.locator('#modalMasElementos.show').isVisible()) {
    await shot(page, 'v5-09-cantidades-selection-modal', '#modalMasElementos .modal-content');
    await page.keyboard.press('Escape');
  }

  await page.locator('label[for="preciosActualizadosOn"]').click();
  await page.waitForTimeout(400);
  await shotLockControl(page, 'v5-10-precios-unlocked');

  await page.locator('label[for="preciosActualizadosOff"]').click();
  await page.waitForTimeout(400);
  await shotLockControl(page, 'v5-11-precios-locked-date', { includeDate: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: 'networkidle' });
  await selectFirstRow(page);
  await shot(page, 'v5-12-mobile-selection-toolbar', '#tableToolbarSelection');
}

async function main() {
  await mkdir(OUT, { recursive: true });

  const serverV4 = await startServer(V4_DIR, 8764);
  const serverV5 = await startServer(V5_DIR, 8765);

  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    await captureV4(page);
    await captureV5(page);
  } finally {
    await browser.close();
    serverV4.close();
    serverV5.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
