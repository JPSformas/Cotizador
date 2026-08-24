// Define the already added products (SKUs)
const alreadyAddedProducts = []

let productsData = []
const selectedProducts = new Set()
let filteredProducts = []
let hasSearched = false

// DOM Elements
const searchInput = document.getElementById("productSearch")
const searchResults = document.getElementById("searchResults")
const searchPlaceholder = document.getElementById("searchPlaceholder")
const noResults = document.getElementById("noResults")
const addButton = document.getElementById("addSelectedProducts")
const clearSearchBtn = document.getElementById("clearSearch")
const selectedProductsPreview = document.getElementById("selectedProductsPreview")
const selectedProductsList = document.getElementById("selectedProductsList")
const selectedCount = document.getElementById("selectedCount")
const clearAllSelectedBtn = document.getElementById("clearAllSelected")

// Initialize
document.addEventListener("DOMContentLoaded", () => {
  // Load products data from JSON file
  fetch("products-data.json")
    .then((response) => response.json())
    .then((data) => {
      productsData = data
      setupEventListeners()
    })
    .catch((error) => {
      console.error("Error loading products data:", error)
    })
})

function setupEventListeners() {
  // Search functionality
  searchInput.addEventListener("input", function () {
    const query = this.value.toLowerCase().trim()

    if (query === "") {
      // If search is cleared, show preview or placeholder based on selection state
      searchResults.style.display = "none"
      noResults.style.display = "none"
      clearSearchBtn.style.display = "none"
      searchInput.style.borderTopRightRadius = "8px"
      searchInput.style.borderBottomRightRadius = "8px"
      hasSearched = false

      // Show preview if items are selected, otherwise show placeholder
      if (selectedProducts.size > 0) {
        selectedProductsPreview.style.display = "block"
        searchPlaceholder.style.display = "none"
      } else {
        selectedProductsPreview.style.display = "none"
        searchPlaceholder.style.display = "block"
      }
    } else {
      // Filter products based on search query
      filteredProducts = productsData.filter(
        (product) =>
          product.Nombre.toLowerCase().includes(query) ||
          product.SKU.toLowerCase().includes(query) ||
          product.Descripcion.toLowerCase().includes(query) ||
          (product.Categorias && product.Categorias.toLowerCase().includes(query)),
      )

      clearSearchBtn.style.display = "block"
      searchInput.style.borderTopRightRadius = "0px"
      searchInput.style.borderBottomRightRadius = "0px"
      hasSearched = true

      // Hide both placeholder and preview when searching
      searchPlaceholder.style.display = "none"
      selectedProductsPreview.style.display = "none"

      renderProducts(filteredProducts)
    }
  })

  // Clear search button
  clearSearchBtn.addEventListener("click", () => {
    searchInput.value = ""
    searchInput.dispatchEvent(new Event("input"))
    searchInput.focus()
  })

  // Add selected products button
  addButton.addEventListener("click", () => {
    if (selectedProducts.size > 0) {
      // Here you would typically add the selected products to your main table
      const selectedProductsData = productsData.filter((product) => selectedProducts.has(product.SKU))

      console.log("Adding selected products:", selectedProductsData)

      // Show success message (you can customize this)
      alert(`Se agregaron ${selectedProducts.size} producto(s) a la cotización.`)

      // Reset and close modal
      resetModal()
      const modalElement = document.getElementById("modalProductoImportado")
      const modalInstance = bootstrap.Modal.getInstance(modalElement)
      if (modalInstance) {
        modalInstance.hide()
      }
    }
  })

  // Clear all selected products
  clearAllSelectedBtn.addEventListener("click", () => {
    if (confirm("¿Estás seguro de que quieres limpiar todos los productos seleccionados?")) {
      clearAllSelected()
    }
  })

  // Reset modal when closed
  document.getElementById("modalProductoImportado").addEventListener("hidden.bs.modal", () => {
    resetModal()
  })
}

function formatProductAttributesLine(product) {
  const parts = []
  const attr1 = product["Atributo 1"]
  const val1 = product["Valor atributo 1"]
  const attr2 = product["Atributo 2"]
  const val2 = product["Valor atributo 2"]

  const hasVal = (v) => v != null && String(v).trim() !== ""
  if (attr1 && hasVal(val1)) parts.push(`${attr1}: ${val1}`)
  if (attr2 && hasVal(val2)) parts.push(`${attr2}: ${val2}`)

  return parts.length
    ? `<div class="product-attributes">${parts.join(" · ")}</div>`
    : ""
}

function renderProducts(products) {
  if (products.length === 0 && hasSearched) {
    searchPlaceholder.style.display = "none"
    searchResults.style.display = "none"
    noResults.style.display = "block"
    return
  }

  searchPlaceholder.style.display = "none"
  searchResults.style.display = "block"
  noResults.style.display = "none"

  searchResults.innerHTML = products
    .map((product) => {
      const isAlreadyAdded = alreadyAddedProducts.includes(product.SKU)
      const isSelected = selectedProducts.has(product.SKU)

      return `
            <div class="product-search-item ${isAlreadyAdded ? "already-added" : ""}" 
                    data-product-id="${product.SKU}">
                ${isAlreadyAdded ? '<span class="already-added-badge">Ya agregado</span>' : ""}
                <div class="d-flex align-items-center">
                    ${
                      !isAlreadyAdded
                        ? `
                        <div class="form-check me-0 me-md-3">
                            <input class="form-check-input" type="checkbox" 
                                    id="product-${product.SKU}" 
                                    ${isSelected ? "checked" : ""}
                                    ${isAlreadyAdded ? "disabled" : ""}
                                    onchange="toggleProduct('${product.SKU}')">
                        </div>
                    `
                        : ""
                    }
                    <div class="me-3">
                        <img src="${product.Imagen}" alt="${product.Nombre}" class="product-image-small">
                    </div>
                    <div class="flex-grow-1">
                        <div class="product-name">${product.Nombre}</div>
                        <div class="product-sku">SKU: ${product.SKU}</div>
                        ${formatProductAttributesLine(product)}
                        <div class="mt-1">
                            <div class="product-stock">Stock disponible: ${product.Stock}</div>
                        </div>
                    </div>
                </div>
            </div>
        `
    })
    .join("")

  // Add click handlers to product items
  document.querySelectorAll(".product-search-item:not(.already-added)").forEach((item) => {
    item.addEventListener("click", function (e) {
      // Don't trigger if clicking on checkbox
      if (e.target.type === "checkbox") return

      const productId = this.dataset.productId
      const checkbox = this.querySelector('input[type="checkbox"]')

      // Only toggle if not already added
      if (!alreadyAddedProducts.includes(productId)) {
        checkbox.checked = !checkbox.checked
        toggleProduct(productId)
      }
    })
  })
}

function toggleProduct(productId) {
  // Don't allow toggling already added products
  if (alreadyAddedProducts.includes(productId)) return

  const checkbox = document.getElementById(`product-${productId}`)

  if (checkbox.checked) {
    selectedProducts.add(productId)
  } else {
    selectedProducts.delete(productId)
  }

  updateSelectedCount()
  updateSelectedPreview()
}

function updateSelectedCount() {
  const count = selectedProducts.size

  if (count > 0) {
    addButton.disabled = false
    addButton.textContent = `Agregar ${count} producto${count > 1 ? "s" : ""} seleccionado${count > 1 ? "s" : ""}`
  } else {
    addButton.disabled = true
    addButton.textContent = "Agregar productos seleccionados"
  }
}

function updateSelectedPreview() {
  const count = selectedProducts.size

  if (count === 0) {
    selectedProductsPreview.style.display = "none"
    // Show placeholder only if search is empty
    if (searchInput.value.trim() === "") {
      searchPlaceholder.style.display = "block"
    }
    return
  }

  // Only show preview if search is empty
  if (searchInput.value.trim() === "") {
    selectedProductsPreview.style.display = "block"
    searchPlaceholder.style.display = "none"
  } else {
    selectedProductsPreview.style.display = "none"
  }

  selectedCount.textContent = count

  // Get selected products data
  const selectedProductsData = productsData.filter((product) => selectedProducts.has(product.SKU))

  selectedProductsList.innerHTML = selectedProductsData
    .map(
      (product) => `
        <div class="selected-product-item" data-product-id="${product.SKU}">
            <img src="${product.Imagen}" alt="${product.Nombre}" class="product-image-mini">
            <div class="selected-product-info">
                <div class="selected-product-name">${product.Nombre}</div>
                <div class="selected-product-sku">SKU: ${product.SKU}</div>
            </div>
            <button type="button" class="remove-selected-btn" onclick="removeFromSelected('${product.SKU}')" title="Quitar de seleccionados">
                <i class="fas fa-times"></i>
            </button>
        </div>
    `,
    )
    .join("")
}

function removeFromSelected(productId) {
  const item = document.querySelector(`.selected-product-item[data-product-id="${productId}"]`)

  // Add removing animation
  item.classList.add("removing")

  setTimeout(() => {
    selectedProducts.delete(productId)

    // Update checkbox in search results if visible
    const checkbox = document.getElementById(`product-${productId}`)
    if (checkbox) {
      checkbox.checked = false
    }

    updateSelectedCount()
    updateSelectedPreview()
  }, 200)
}

function clearAllSelected() {
  // Add removing animation to all items
  const items = document.querySelectorAll(".selected-product-item")
  items.forEach((item) => item.classList.add("removing"))

  setTimeout(() => {
    selectedProducts.clear()

    // Update all checkboxes in search results
    document.querySelectorAll('.product-search-item input[type="checkbox"]').forEach((checkbox) => {
      checkbox.checked = false
    })

    updateSelectedCount()
    updateSelectedPreview()
  }, 200)
}

function resetModal() {
  selectedProducts.clear()
  searchInput.value = ""
  filteredProducts = []
  hasSearched = false
  searchResults.style.display = "none"
  noResults.style.display = "none"
  clearSearchBtn.style.display = "none"
  selectedProductsPreview.style.display = "none"
  searchPlaceholder.style.display = "block"
  updateSelectedCount()
}
