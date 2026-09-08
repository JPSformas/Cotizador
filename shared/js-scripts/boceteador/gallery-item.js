function escapeAttr(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

function itemHtml(composedUrl) {
  const src = escapeAttr(composedUrl);
  return (
    '<div class="image-item" data-image="' + src + '" data-type="boceto" data-boceto="1" data-id="boceto-1">' +
    '<img src="' + src + '" alt="Boceto personalizado">' +
    "</div>"
  );
}

export function removeBocetos(root = document) {
  const found = root.querySelectorAll("#zakekeImagesGrid [data-boceto='1']");
  for (let i = found.length - 1; i >= 0; i--) {
    if (found[i] && typeof found[i].remove === "function") found[i].remove();
  }
}

export function applyComposed(composedUrl, root = document) {
  const main = root.querySelector("#selectedProductImage");
  if (main) {
    main.src = composedUrl;
    if (typeof main.setAttribute === "function") main.setAttribute("src", composedUrl);
  }
  const container = main && ((main.closest && main.closest("[data-product-images]")) || main.parentElement);
  if (container && container.dataset) {
    container.dataset.selectedImageUrls = JSON.stringify([composedUrl]);
  }
  removeBocetos(root);
  const grid = root.querySelector("#zakekeImagesGrid");
  if (grid && typeof grid.insertAdjacentHTML === "function") {
    grid.insertAdjacentHTML("afterbegin", itemHtml(composedUrl));
  }
}
