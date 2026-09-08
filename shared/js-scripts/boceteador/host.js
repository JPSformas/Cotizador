import { createUi } from "./ui.js";
import { getCurrent, listPhotos } from "./photo-gallery.js";
import { applyComposed, removeBocetos } from "./gallery-item.js";
import { createPageStore } from "./store-page.js";

const STORAGE_KEY = "formas:boceto:editItem";
const listeners = { saved: [], cleared: [] };

function emit(name, detail) {
  (listeners[name] || []).forEach((fn) => fn(detail));
}

function productIdFromPage() {
  const sku = document.getElementById("SKU");
  const v = sku && String(sku.value || "").trim();
  return v || "editItem-product";
}

function setOpenLabel(btn, sketch) {
  if (!btn) return;
  const text = btn.querySelector(".text") || btn;
  text.textContent = sketch ? "Editar personalización" : "Personalizar";
}

async function boot() {
  const openButton = document.getElementById("personalizarBtn");
  let modalRoot = document.getElementById("formas-boceto-modal");
  const jsonInput = document.getElementById("formas-boceto-json");
  if (!openButton || !modalRoot) return;

  const store = createPageStore({
    input: jsonInput,
    storage: window.sessionStorage,
    storageKey: STORAGE_KEY,
  });
  const ui = await createUi(modalRoot);
  modalRoot = ui.root;

  let current = store.load();
  setOpenLabel(openButton, current);
  if (current && current.composedImage) {
    applyComposed(current.composedImage);
  }

  ui.onSave((sketch) => {
    current = sketch;
    store.save(sketch);
    applyComposed(sketch.composedImage);
    setOpenLabel(openButton, sketch);
    emit("saved", sketch);
  });

  function open() {
    const photo = getCurrent();
    const opts = {
      productId: productIdFromPage(),
      variantColor: "",
      photoUrl: (current && current.sourcePhotoUrl) || photo.url,
      photoName: photo.alt,
      photos: listPhotos(),
    };
    if (current && current.placement) {
      opts.placement = current.placement;
      opts.photoUrl = current.sourcePhotoUrl || photo.url;
      opts.technique = current.technique;
      opts.printColors = current.printColors;
    }
    ui.open(opts);
  }

  function clear() {
    current = null;
    store.clear();
    removeBocetos();
    setOpenLabel(openButton, null);
    emit("cleared");
  }

  openButton.addEventListener("click", open);

  window.FormasBoceto = {
    open,
    getSketch: () => current,
    clear,
    on(event, fn) {
      if (listeners[event]) listeners[event].push(fn);
    },
  };
}

boot().catch((err) => {
  console.error("FormasBoceto failed to start", err);
});
