export const SKETCH_STATUS = { ATTACHED: "attached", DRAFT: "draft" };

const HEX = /^#[0-9a-fA-F]{6}$/;

export function createSketch(partial = {}) {
  return {
    productId: "",
    variantColor: "",
    sourcePhotoUrl: "",
    composedImage: "",
    logoFiles: [],
    placement: null,
    medidaW: "",
    medidaH: "",
    technique: "",
    printColors: [],
    engraved: false,
    status: SKETCH_STATUS.ATTACHED,
    ...partial,
  };
}

export function validateSketch(value) {
  const errors = [];
  if (!value || typeof value !== "object") {
    return { ok: false, errors: ["sketch"] };
  }
  if (!String(value.productId || "").trim()) errors.push("productId");
  const colors = Array.isArray(value.printColors) ? value.printColors : [];
  for (const c of colors) {
    if (c && c.hex && !HEX.test(c.hex)) {
      errors.push("printColors.hex");
      break;
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}
