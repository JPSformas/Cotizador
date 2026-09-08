const GRID_IDS = ["productImagesGrid", "uploadedImagesGrid", "zakekeImagesGrid"];

export function samePhotoUrl(a, b) {
  if (!a || !b) return false;
  if (a === b) return true;
  const na = String(a).split("?")[0].replace(/^(\.\.\/|\.\/)+/, "");
  const nb = String(b).split("?")[0].replace(/^(\.\.\/|\.\/)+/, "");
  return na === nb || na.endsWith(nb) || nb.endsWith(na);
}

function imgUrl(img) {
  if (!img) return "";
  return img.currentSrc || img.getAttribute("src") || "";
}

function isBoceto(el) {
  return el.getAttribute("data-type") === "boceto" || el.getAttribute("data-boceto") === "1";
}

function stillFromItem(el) {
  if (!el || isBoceto(el)) return null;
  const url = el.getAttribute("data-image") || "";
  if (!url) return null;
  const img = el.querySelector("img");
  return {
    url,
    thumb: imgUrl(img) || url,
    alt: (img && img.getAttribute("alt")) || "",
    color: "",
  };
}

export function listPhotos(root = document) {
  const seen = new Set();
  const out = [];
  GRID_IDS.forEach((id) => {
    const grid = root.querySelector("#" + id);
    if (!grid) return;
    const items = grid.querySelectorAll(".image-item[data-image]");
    for (let i = 0; i < items.length; i++) {
      const still = stillFromItem(items[i]);
      if (!still) continue;
      const key = still.url.split("?")[0];
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(still);
    }
  });
  return out;
}

export function getCurrent(root = document) {
  const main = root.querySelector("#selectedProductImage");
  const url = (main && (main.currentSrc || main.getAttribute("src"))) || "";
  const photos = listPhotos(root);
  const match = photos.find((p) => samePhotoUrl(p.url, url));
  if (match) return match;
  return photos[0] || { url: "", thumb: "", alt: "", color: "" };
}
