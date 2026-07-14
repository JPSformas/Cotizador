// Handle modal products table functionality
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('modalConvertirCotizacionAPedido');
    const tableBody = document.getElementById('modalProductsTableBody');
    const selectAllCheckbox = document.getElementById('modalSelectAll');
    const totalAmountCell = document.getElementById('modalTotalAmount');
    
    if (!modal || !tableBody) {
        return;
    }
    
    // Parse currency to number
    function parseCurrency(value) {
        const cleaned = value.replace(/[$\s\.]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    }
    
    // Format number to currency
    function formatCurrency(value) {
        return '$' + value.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
    
    // Extract product data from main table
    function extractProductsFromMainTable() {
        const mainTableRows = document.querySelectorAll('.table tbody tr.item-container');
        const products = [];
        
        mainTableRows.forEach((row, index) => {
            const productName = row.querySelector('.product-name-main')?.textContent.trim() || '';
            // Get description HTML content, handling nested p tags
            const descriptionElement = row.querySelector('.productDescription .description-wrapper');
            const productDescription = descriptionElement ? descriptionElement.innerHTML.trim() : 
                                      (row.querySelector('.productDescription p')?.textContent.trim() || '');
            
            // Extract quantities and prices
            const quantities = [];
            const prices = [];
            const subtotals = [];
            
            // Only select desktop quantities (exclude mini-table for mobile)
            const quantityTags = row.querySelectorAll('.productQuantities > .quantities-tag');
            const priceTags = row.querySelectorAll('.productPrecioUnitario .precio-tag');
            const subtotalTags = row.querySelectorAll('.productSubtotal .subtotal-tag');
            
            quantityTags.forEach((tag, idx) => {
                const qtyText = tag.textContent.trim(); // e.g., "x50"
                const qtyValue = parseInt(qtyText.replace('x', '')) || 0;
                quantities.push({ text: qtyText, value: qtyValue });
                
                if (priceTags[idx]) {
                    const priceText = priceTags[idx].textContent.trim();
                    prices.push(parseCurrency(priceText));
                }
                
                if (subtotalTags[idx]) {
                    const subtotalText = subtotalTags[idx].textContent.trim();
                    subtotals.push(parseCurrency(subtotalText));
                }
            });
            
            products.push({
                id: row.id || `item-${index + 1}`,
                name: productName,
                description: productDescription,
                quantities: quantities,
                prices: prices,
                subtotals: subtotals
            });
        });
        
        return products;
    }
    
    // Populate modal table
    function populateModalTable() {
        const products = extractProductsFromMainTable();
        tableBody.innerHTML = '';
        
        products.forEach((product, index) => {
            const row = document.createElement('tr');
            row.dataset.productId = product.id;
            row.dataset.productIndex = index;
            
            // Store product data in row for easy access
            row.dataset.productData = JSON.stringify({
                prices: product.prices,
                subtotals: product.subtotals,
                quantities: product.quantities
            });
            
            // Default to first quantity if available
            const defaultQtyIndex = 0;
            const defaultQty = product.quantities[defaultQtyIndex];
            const defaultPrice = product.prices[defaultQtyIndex] || 0;
            const defaultSubtotal = product.subtotals[defaultQtyIndex] || 0;
            
            row.innerHTML = `
                <td>
                    <input type="checkbox" class="form-check-input product-checkbox" data-product-index="${index}" checked>
                </td>
                <td>${product.name}</td>
                <td><div class="description-wrapper-modal">${product.description}</div></td>
                <td class="quantity-cell">
                    <select class="form-select quantity-select" data-product-index="${index}">
                        ${product.quantities.map((qty, qtyIdx) => 
                            `<option value="${qtyIdx}" ${qtyIdx === defaultQtyIndex ? 'selected' : ''}>${qty.text}</option>`
                        ).join('')}
                    </select>
                </td>
                <td class="price-cell editable-price" 
                    contenteditable="true" 
                    data-product-index="${index}"
                    data-original-price="${defaultPrice}">${formatCurrency(defaultPrice)}</td>
                <td class="subtotal-cell" data-product-index="${index}">${formatCurrency(defaultSubtotal)}</td>
            `;
            
            tableBody.appendChild(row);
        });
        
        setupPriceCellEditors();
        updateTotal();
        updateSelectAllCheckbox();

        if (window.TableEmptyState) {
            window.TableEmptyState.refresh(tableBody.closest("[data-table-empty]"));
        }
    }
    
    // Update select all checkbox state based on individual checkboxes
    function updateSelectAllCheckbox() {
        if (!selectAllCheckbox) return;
        
        const checkboxes = tableBody.querySelectorAll('.product-checkbox');
        if (checkboxes.length === 0) {
            selectAllCheckbox.checked = false;
            selectAllCheckbox.indeterminate = false;
            return;
        }
        
        const allChecked = Array.from(checkboxes).every(cb => cb.checked);
        const someChecked = Array.from(checkboxes).some(cb => cb.checked);
        
        selectAllCheckbox.checked = allChecked;
        selectAllCheckbox.indeterminate = someChecked && !allChecked;
    }
    
    // Update price and subtotal when quantity changes (resets to default)
    function updateProductPrice(productIndex, quantityIndex) {
        const row = tableBody.querySelector(`tr[data-product-index="${productIndex}"]`);
        if (!row) return;
        
        const productData = JSON.parse(row.dataset.productData);
        const price = productData.prices[quantityIndex] || 0;
        const quantity = productData.quantities[quantityIndex].value;
        
        // Update price cell and reset to default
        const priceCell = row.querySelector(`.price-cell[data-product-index="${productIndex}"]`);
        if (priceCell) {
            priceCell.textContent = formatCurrency(price);
            priceCell.dataset.originalPrice = price;
        }
        
        // Calculate and update subtotal
        const subtotal = price * quantity;
        const subtotalCell = row.querySelector(`.subtotal-cell[data-product-index="${productIndex}"]`);
        if (subtotalCell) {
            subtotalCell.textContent = formatCurrency(subtotal);
        }
        
        updateTotal();
    }
    
    // Calculate subtotal from price and quantity
    function calculateSubtotal(productIndex) {
        const row = tableBody.querySelector(`tr[data-product-index="${productIndex}"]`);
        if (!row) return;
        
        const quantitySelect = row.querySelector('.quantity-select');
        const productData = JSON.parse(row.dataset.productData);
        const quantityIndex = parseInt(quantitySelect.value);
        const quantity = productData.quantities[quantityIndex].value;
        
        const priceCell = row.querySelector(`.price-cell[data-product-index="${productIndex}"]`);
        const priceText = priceCell.textContent.trim();
        const price = parseCurrency(priceText);
        
        const subtotal = price * quantity;
        const subtotalCell = row.querySelector(`.subtotal-cell[data-product-index="${productIndex}"]`);
        if (subtotalCell) {
            subtotalCell.textContent = formatCurrency(subtotal);
        }
        
        updateTotal();
    }
    
    // Setup editable price cells
    function setupPriceCellEditors() {
        const priceCells = tableBody.querySelectorAll('.editable-price');
        
        priceCells.forEach(cell => {
            // Handle focus - show numeric value for editing
            cell.addEventListener('focus', function() {
                const priceText = this.textContent.trim();
                const price = parseCurrency(priceText);
                this.textContent = price.toString();
                this.classList.add('editing');
            });
            
            // Handle blur - format as currency and update subtotal
            cell.addEventListener('blur', function() {
                const priceText = this.textContent.trim();
                let price = parseFloat(priceText) || 0;
                
                // Ensure price is not negative
                if (price < 0) {
                    price = 0;
                }
                
                this.textContent = formatCurrency(price);
                this.classList.remove('editing');
                
                // Update subtotal
                const productIndex = parseInt(this.dataset.productIndex);
                calculateSubtotal(productIndex);
            });
            
            // Handle Enter key to blur
            cell.addEventListener('keydown', function(e) {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    this.blur();
                }
            });
            
            // Prevent line breaks
            cell.addEventListener('paste', function(e) {
                e.preventDefault();
                const text = (e.clipboardData || window.clipboardData).getData('text');
                const numericText = text.replace(/[^0-9.,]/g, '').replace(',', '.');
                this.textContent = numericText;
            });
        });
    }
    
    // Update total amount
    function updateTotal() {
        let total = 0;
        
        tableBody.querySelectorAll('tr').forEach(row => {
            const checkbox = row.querySelector('.product-checkbox');
            if (checkbox && checkbox.checked) {
                const subtotalCell = row.querySelector('.subtotal-cell');
                if (subtotalCell) {
                    const subtotalText = subtotalCell.textContent.trim();
                    total += parseCurrency(subtotalText);
                }
            }
        });
        
        if (totalAmountCell) {
            totalAmountCell.textContent = formatCurrency(total);
        }
    }
    
    // Event listeners
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', function() {
            const checkboxes = tableBody.querySelectorAll('.product-checkbox');
            checkboxes.forEach(checkbox => {
                checkbox.checked = this.checked;
            });
            updateTotal();
        });
    }
    
    // Quantity change handler
    tableBody.addEventListener('change', function(e) {
        if (e.target.classList.contains('quantity-select')) {
            const productIndex = parseInt(e.target.dataset.productIndex);
            const quantityIndex = parseInt(e.target.value);
            updateProductPrice(productIndex, quantityIndex);
        }
    });
    
    // Checkbox change handler
    tableBody.addEventListener('change', function(e) {
        if (e.target.classList.contains('product-checkbox')) {
            updateTotal();
            updateSelectAllCheckbox();
        }
    });
    
    // Populate table when modal is shown
    if (modal) {
        modal.addEventListener('show.bs.modal', function() {
            populateModalTable();
        });
    }
});

