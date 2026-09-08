const HEX = /^#[0-9a-fA-F]{6}$/;
const PDFJS_URL = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
const PDFJS_WORKER = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";

export const MSG_EPS = "Los archivos EPS no se pueden abrir en el navegador.\nConvertilo a PDF, SVG o PNG (desde Illustrator: Archivo → Guardar como → PDF) y volvé a cargarlo.";
export const MSG_VEC_ERR = "No se pudo procesar el archivo.\nSi es un .ai viejo (guardado sin compatibilidad PDF), convertilo a PDF o PNG. También verificá la conexión a internet: el conversor se descarga la primera vez.";

export function isHex(value) {
  return HEX.test(value || "");
}

export function esEps(file) {
  const n = (file.name || "").toLowerCase();
  return n.endsWith(".eps") || file.type === "application/postscript";
}

export function esVector(file) {
  const n = (file.name || "").toLowerCase();
  return file.type === "application/pdf" || n.endsWith(".pdf") || n.endsWith(".ai");
}

export function esSvg(file) {
  const n = (file.name || "").toLowerCase();
  return file.type === "image/svg+xml" || n.endsWith(".svg");
}

let pdfjsPromise = null;
function ensurePdfJs() {
  if (typeof window !== "undefined" && window.pdfjsLib) return Promise.resolve();
  if (!pdfjsPromise) {
    pdfjsPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = PDFJS_URL;
      s.onload = () => {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
        resolve();
      };
      s.onerror = () => {
        pdfjsPromise = null;
        reject(new Error("cdn"));
      };
      document.head.appendChild(s);
    });
  }
  return pdfjsPromise;
}

export async function rasterizeVectorFile(file) {
  await ensurePdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  const page = await pdf.getPage(1);
  let vp = page.getViewport({ scale: 1 });
  const k = Math.max(1, Math.min(4, 1600 / Math.max(vp.width, vp.height)));
  vp = page.getViewport({ scale: k });
  const c = document.createElement("canvas");
  c.width = Math.ceil(vp.width);
  c.height = Math.ceil(vp.height);
  await page.render({ canvasContext: c.getContext("2d"), viewport: vp }).promise;
  return c.toDataURL("image/png");
}

function imageToPng(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth || 1;
      c.height = img.naturalHeight || 1;
      c.getContext("2d").drawImage(img, 0, 0);
      resolve({ png: c.toDataURL("image/png"), width: c.width, height: c.height });
    };
    img.onerror = () => reject(new Error("No pude abrir la imagen."));
    img.src = src;
  });
}

async function normalizeSvgThenRaster(file) {
  const text = await file.text();
  const doc = new DOMParser().parseFromString(text, "image/svg+xml");
  const svg = doc.documentElement;
  if (!svg || svg.nodeName.toLowerCase() !== "svg" || doc.querySelector("parsererror")) {
    throw new Error("svg");
  }
  let w = parseFloat(svg.getAttribute("width"));
  let h = parseFloat(svg.getAttribute("height"));
  const vb = (svg.getAttribute("viewBox") || "").trim().split(/[\s,]+/).map(Number);
  if (!(w > 0) || !(h > 0)) {
    if (vb.length === 4 && vb[2] > 0 && vb[3] > 0) {
      w = vb[2];
      h = vb[3];
    } else {
      w = 1000;
      h = 1000;
    }
  }
  if (vb.length !== 4) svg.setAttribute("viewBox", "0 0 " + w + " " + h);
  const k = Math.max(1, Math.min(6, 1600 / Math.max(w, h)));
  svg.setAttribute("width", String(Math.round(w * k)));
  svg.setAttribute("height", String(Math.round(h * k)));
  const data = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg));
  return imageToPng(data);
}

export async function rasterizeFile(file) {
  if (esEps(file)) return Promise.reject(new Error(MSG_EPS));
  if (esVector(file)) {
    const png = await rasterizeVectorFile(file);
    const sized = await imageToPng(png);
    return { png: sized.png, width: sized.width, height: sized.height, name: file.name || "logo.png" };
  }
  if (esSvg(file)) {
    try {
      const sized = await normalizeSvgThenRaster(file);
      return { png: sized.png, width: sized.width, height: sized.height, name: file.name || "logo.svg" };
    } catch (e) {
      const raw = await fileToDataUrl(file);
      const sized = await imageToPng(raw);
      return { png: sized.png, width: sized.width, height: sized.height, name: file.name || "logo.svg" };
    }
  }
  const src = await fileToDataUrl(file);
  const sized = await imageToPng(src);
  return { png: sized.png, width: sized.width, height: sized.height, name: file.name || "logo.png" };
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("No pude leer el archivo."));
    reader.onload = () => resolve(reader.result);
    reader.readAsDataURL(file);
  });
}

export function padNarrowPhoto(img) {
  const MAXR = 1.5;
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  if (Math.max(W / H, H / W) <= MAXR) return null;
  const c = document.createElement("canvas");
  if (H > W) {
    c.width = Math.round(H / MAXR);
    c.height = H;
  } else {
    c.width = W;
    c.height = Math.round(W / MAXR);
  }
  const ctx = c.getContext("2d");
  ctx.fillStyle = "#FFFFFF";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(img, Math.round((c.width - W) / 2), Math.round((c.height - H) / 2));
  return c.toDataURL("image/png");
}

export function computeTrim(img) {
  const W = img.naturalWidth;
  const H = img.naturalHeight;
  const full = { x: 0, y: 0, w: W, h: H, trimmed: false };
  try {
    const c = document.createElement("canvas");
    c.width = W;
    c.height = H;
    const ctx = c.getContext("2d");
    ctx.drawImage(img, 0, 0);
    const d = ctx.getImageData(0, 0, W, H).data;
    const esTinta = (i) => d[i + 3] > 12 && !(d[i] > 244 && d[i + 1] > 244 && d[i + 2] > 244);
    let minX = W;
    let minY = H;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < H; y++) {
      const row = y * W * 4;
      for (let x = 0; x < W; x++) {
        if (esTinta(row + x * 4)) {
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }
    if (maxX < 0) return full;
    const pad = 1;
    minX = Math.max(0, minX - pad);
    minY = Math.max(0, minY - pad);
    maxX = Math.min(W - 1, maxX + pad);
    maxY = Math.min(H - 1, maxY + pad);
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    const trimmed = (W - w) / W > 0.02 || (H - h) / H > 0.02;
    return { x: minX, y: minY, w, h, trimmed };
  } catch (e) {
    return full;
  }
}

function engraveEffect(c) {
  const w = c.width;
  const h = c.height;
  const sil = (color) => {
    const s = document.createElement("canvas");
    s.width = w;
    s.height = h;
    const sc = s.getContext("2d");
    sc.drawImage(c, 0, 0);
    sc.globalCompositeOperation = "source-in";
    sc.fillStyle = color;
    sc.fillRect(0, 0, w, h);
    return s;
  };
  const off = Math.max(1, Math.round(Math.min(w, h) / 140));
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const octx = out.getContext("2d");
  octx.globalAlpha = 0.8;
  octx.drawImage(sil("#FFFFFF"), off, off);
  octx.globalAlpha = 0.55;
  octx.drawImage(sil("#000000"), -off, -off);
  const body = sil("#84858F");
  const bc = body.getContext("2d");
  bc.globalCompositeOperation = "source-atop";
  const g = bc.createLinearGradient(0, 0, w, h);
  g.addColorStop(0, "#B9BAC3");
  g.addColorStop(0.4, "#7B7C86");
  g.addColorStop(0.55, "#9C9DA8");
  g.addColorStop(0.75, "#666770");
  g.addColorStop(1, "#8A8B96");
  bc.fillStyle = g;
  bc.fillRect(0, 0, w, h);
  octx.globalAlpha = 1;
  octx.drawImage(body, 0, 0);
  return out;
}

export function rebuildLogoSrc(logo) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const crop = logo.useTrim !== false && logo.crop
        ? logo.crop
        : { x: 0, y: 0, w: img.naturalWidth, h: img.naturalHeight };
      let c = document.createElement("canvas");
      c.width = crop.w;
      c.height = crop.h;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
      if (logo.whiteRemoved) {
        const d = ctx.getImageData(0, 0, c.width, c.height);
        const p = d.data;
        for (let i = 0; i < p.length; i += 4) {
          if (p[i] > 238 && p[i + 1] > 238 && p[i + 2] > 238) p[i + 3] = 0;
        }
        ctx.putImageData(d, 0, 0);
      }
      if (logo.tint === "engrave") {
        c = engraveEffect(c);
      } else if (logo.tint && logo.tint !== "original") {
        ctx.globalCompositeOperation = "source-in";
        ctx.fillStyle = logo.tint === "white" ? "#FFFFFF" : "#0B0B23";
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.globalCompositeOperation = "source-over";
      }
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("No pude procesar el logo."));
    img.src = logo.src;
  });
}

export function removeWhite(dataUrl, threshold = 245) {
  return mapPixels(dataUrl, (r, g, b, a) => {
    if (r >= threshold && g >= threshold && b >= threshold) return [r, g, b, 0];
    return [r, g, b, a];
  });
}

export function applyTint(dataUrl, tint) {
  if (!tint || tint === "original") return Promise.resolve(dataUrl);
  return mapPixels(dataUrl, (r, g, b, a) => {
    if (a < 8) return [r, g, b, a];
    if (tint === "white") return [255, 255, 255, a];
    if (tint === "black") return [11, 11, 35, a];
    if (tint === "engrave") {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const v = Math.min(255, l * 0.55 + 90);
      return [v, v * 0.95, v * 0.7, a];
    }
    return [r, g, b, a];
  });
}

function mapPixels(dataUrl, fn) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const ctx = c.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const image = ctx.getImageData(0, 0, c.width, c.height);
      const d = image.data;
      for (let i = 0; i < d.length; i += 4) {
        const [r, g, b, a] = fn(d[i], d[i + 1], d[i + 2], d[i + 3]);
        d[i] = r;
        d[i + 1] = g;
        d[i + 2] = b;
        d[i + 3] = a;
      }
      ctx.putImageData(image, 0, 0);
      resolve(c.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("No pude procesar el logo."));
    img.src = dataUrl;
  });
}
