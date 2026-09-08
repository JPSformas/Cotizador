function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function nextLogoId(state) {
  const n = state.logos.reduce((m, l) => Math.max(m, Number(l.id) || 0), 0);
  return n + 1;
}

export function createEditorState() {
  return {
    zone: null,
    logos: [],
    sel: -1,
    mode: "logo",
    unit: "cm",
    lockAspect: false,
    ruler: null,
    rulerVisible: false,
    rulerCm: "",
    drawMode: false,
    zoom: 1,
    pan: { x: 0, y: 0 },
  };
}

export function setZone(state, zone) {
  let x = clamp(Number(zone.x) || 0, 0, 1);
  let y = clamp(Number(zone.y) || 0, 0, 1);
  let w = clamp(Number(zone.w) || 0, 0, 1);
  let h = clamp(Number(zone.h) || 0, 0, 1);
  if (x + w > 1) w = 1 - x;
  if (y + h > 1) h = 1 - y;
  state.zone = { x, y, w, h };
  return state.zone;
}

export function addLogo(state, logo) {
  const item = {
    id: logo.id || nextLogoId(state),
    src: logo.src || "",
    name: logo.name || "",
    x: clamp(Number(logo.x) || 0, 0, 1),
    y: clamp(Number(logo.y) || 0, 0, 1),
    w: clamp(Number(logo.w) || 0.2, 0.01, 1),
    h: clamp(Number(logo.h) || 0.2, 0.01, 1),
    rot: Number(logo.rot) || 0,
    opacity: logo.opacity == null ? 1 : Number(logo.opacity),
    tint: logo.tint || "original",
    cmW: Number(logo.cmW) || 0,
    cmH: Number(logo.cmH) || 0,
    isJpg: !!logo.isJpg,
    aspect: Number(logo.aspect) || 1,
    crop: logo.crop ? { ...logo.crop } : null,
    useTrim: logo.useTrim !== false,
    fullW: Number(logo.fullW) || 0,
    fullH: Number(logo.fullH) || 0,
    whiteRemoved: !!logo.whiteRemoved,
  };
  state.logos.push(item);
  state.sel = state.logos.length - 1;
  return item;
}

export function snapshotPlacement(state) {
  return {
    zone: state.zone ? { ...state.zone } : null,
    logos: state.logos.map((l) => ({
      id: l.id,
      src: l.src,
      name: l.name,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
      rot: l.rot,
      opacity: l.opacity,
      tint: l.tint,
      cmW: l.cmW,
      cmH: l.cmH,
      isJpg: !!l.isJpg,
      aspect: l.aspect,
      crop: l.crop ? { ...l.crop } : null,
      useTrim: l.useTrim !== false,
      fullW: l.fullW,
      fullH: l.fullH,
      whiteRemoved: !!l.whiteRemoved,
    })),
    mode: state.mode,
    unit: state.unit,
    lockAspect: state.lockAspect,
    ruler: state.ruler ? { ...state.ruler } : null,
    rulerVisible: !!state.rulerVisible,
    rulerCm: state.rulerCm || "",
    sel: state.sel,
  };
}

export function restorePlacement(state, placement) {
  if (!placement) return state;
  state.zone = placement.zone ? { ...placement.zone } : null;
  state.mode = placement.mode || "logo";
  state.unit = placement.unit || "cm";
  state.lockAspect = !!placement.lockAspect;
  state.ruler = placement.ruler ? { ...placement.ruler } : null;
  state.rulerVisible = !!placement.rulerVisible;
  state.rulerCm = placement.rulerCm || "";
  state.logos = [];
  const logos = Array.isArray(placement.logos) ? placement.logos : [];
  logos.forEach((l) => addLogo(state, l));
  state.sel = Number.isInteger(placement.sel) ? placement.sel : state.logos.length - 1;
  return state;
}

export function medidaFromLogo(state, logo, scale) {
  if (!logo) return null;
  const unitK = state.unit === "mm" ? 10 : 1;
  if (state.mode === "logo") {
    if (logo.cmW > 0 && logo.cmH > 0) return { w: logo.cmW * unitK, h: logo.cmH * unitK };
    return null;
  }
  if (!scale || !(scale.cmPerPx > 0)) return null;
  const fw = scale.frameW || 1;
  const fh = scale.frameH || 1;
  return { w: logo.w * fw * scale.cmPerPx * unitK, h: logo.h * fh * scale.cmPerPx * unitK };
}

export function measuresOk(state, cmPerPxVal) {
  if (!state.logos.length) return false;
  if (state.mode === "logo") return state.logos.every((l) => l.cmW > 0 && l.cmH > 0);
  return !!cmPerPxVal;
}

export { clamp };

export function composeFoto(photoEl, frameEl, logos) {
  if (!photoEl || !frameEl) return "";
  const NW = photoEl.naturalWidth;
  const NH = photoEl.naturalHeight;
  if (!NW || !NH) return "";
  const FW = frameEl.clientWidth || NW;
  const FH = frameEl.clientHeight || NH;
  const K = NW / FW;
  const c = document.createElement("canvas");
  c.width = NW;
  c.height = NH;
  const ctx = c.getContext("2d");
  ctx.drawImage(photoEl, 0, 0, NW, NH);
  (logos || []).forEach((l) => {
    if (!l.img) return;
    ctx.save();
    ctx.globalAlpha = l.opacity == null ? 1 : l.opacity;
    const cx = (l.x + l.w / 2) * FW * K;
    const cy = (l.y + l.h / 2) * FH * K;
    ctx.translate(cx, cy);
    ctx.rotate(((l.rot || 0) * Math.PI) / 180);
    ctx.drawImage(l.img, (-l.w * FW * K) / 2, (-l.h * FH * K) / 2, l.w * FW * K, l.h * FH * K);
    ctx.restore();
  });
  return c.toDataURL("image/png");
}
