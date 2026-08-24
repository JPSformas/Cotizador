// Handle conversion modal flow with confirmation step and PDV report
document.addEventListener('DOMContentLoaded', function() {
    const conversionModal = document.getElementById('modalConvertirCotizacionAPedido');
    const reportModal = document.getElementById('modalPedidoGenerado');
    const formStep = document.getElementById('modalFormStep');
    const confirmationStep = document.getElementById('modalConfirmationStep');
    const convertBtn = document.getElementById('modalConvertBtn');
    const confirmBtn = document.getElementById('modalConfirmBtn');
    const backBtn = document.getElementById('modalBackBtn');
    const cancelBtn = document.getElementById('modalCancelBtn');
    const confirmationTableBody = document.getElementById('confirmationProductsTableBody');
    const reportTableBody = document.getElementById('reportProductsTableBody');
    
    // Debug: Check if all required elements are found
    if (!conversionModal) console.warn('Conversion modal not found');
    if (!formStep) console.warn('Form step not found');
    if (!confirmationStep) console.warn('Confirmation step not found');
    if (!convertBtn) console.warn('Convert button not found');
    if (!confirmBtn) console.warn('Confirm button not found');
    
    // Shared utility functions
    function formatCurrency(value) {
        return '$' + value.toLocaleString('es-AR', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        });
    }
    
    function parseCurrency(value) {
        const cleaned = value.replace(/[$\s\.]/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    }
    
    // Get form data as an object
    function getFormData() {
        const modalFecha = document.getElementById('modalFecha');
        const modalRazonSocial = document.getElementById('modalRazonSocial');
        // Get selected value from autocomplete
        const razonSocialValue = window.getRazonSocialValue && window.getRazonSocialValue('modalRazonSocial');
        const modalVendedor = document.getElementById('modalVendedor');
        const modalFormaPago = document.getElementById('modalFormaPago');
        const modalNumeroPDV = document.getElementById('modalNumeroPDV');
        const modalOC = document.getElementById('modalOC');
        const modalDireccionEntrega = document.getElementById('modalDireccionEntrega');
        const modalFechaEntrega = document.getElementById('modalFechaEntrega');
        const modalEsEvento = document.querySelector('input[name="modalEsEvento"]:checked');
        const modalDescripcion = document.getElementById('modalDescripcion');
        
        return {
            fecha: modalFecha?.value || '-',
            numeroPDV: modalNumeroPDV?.value || '-',
            razonSocial: razonSocialValue?.nombre || modalRazonSocial?.value || '-',
            vendedor: modalVendedor?.selectedOptions[0]?.textContent || '-',
            formaPago: modalFormaPago?.selectedOptions[0]?.textContent || '-',
            oc: modalOC?.value || '-',
            direccionEntrega: modalDireccionEntrega?.value || '-',
            fechaEntrega: modalFechaEntrega?.value || '-',
            esEvento: modalEsEvento?.value === 'si' ? 'Sí' : 'No',
            descripcion: modalDescripcion?.value || '-'
        };
    }
    
    // Get products data from modal table
    function getProductsData() {
        const modalProductsBody = document.getElementById('modalProductsTableBody');
        if (!modalProductsBody) return { products: [], total: 0 };
        
        const rows = modalProductsBody.querySelectorAll('tr');
        const products = [];
        let total = 0;
        
        rows.forEach(row => {
            const checkbox = row.querySelector('.product-checkbox');
            if (checkbox && checkbox.checked) {
                const productName = row.cells[1]?.textContent.trim() || '';
                // Get description HTML content, handling description-wrapper-modal
                const descriptionCell = row.cells[2];
                const descriptionWrapper = descriptionCell?.querySelector('.description-wrapper-modal');
                const productDescription = descriptionWrapper ? descriptionWrapper.innerHTML.trim() : 
                                         (descriptionCell?.textContent.trim() || '');
                const quantitySelect = row.querySelector('.quantity-select');
                const quantity = quantitySelect?.selectedOptions[0]?.textContent || '';
                const priceCell = row.querySelector('.price-cell');
                const price = priceCell?.textContent.trim() || '$0,00';
                const subtotalCell = row.querySelector('.subtotal-cell');
                const subtotal = subtotalCell?.textContent.trim() || '$0,00';
                
                products.push({
                    name: productName,
                    description: productDescription,
                    quantity: quantity,
                    price: price,
                    subtotal: subtotal
                });
                
                total += parseCurrency(subtotal);
            }
        });
        
        return { products, total };
    }
    
    // Populate read-only fields from form data
    function populateReadOnlyFields(prefix, data) {
        // Map field names to actual HTML IDs
        const fieldMap = {
            fecha: 'Fecha',
            numeroPDV: 'NumeroPDV',
            razonSocial: 'RazonSocial',
            formaPago: 'FormaPago',
            vendedor: 'Vendedor',
            oc: 'OC',
            direccionEntrega: 'DireccionEntrega',
            fechaEntrega: 'FechaEntrega',
            esEvento: 'EsEvento',
            descripcion: 'Descripcion'
        };
        
        Object.keys(fieldMap).forEach(key => {
            const elementId = `${prefix}${fieldMap[key]}`;
            const element = document.getElementById(elementId);
            if (element) {
                // Special handling for PDV field to show loading state (only in report modal)
                if (key === 'numeroPDV' && prefix === 'report') {
                    const loadingElement = document.getElementById('reportNumeroPDVLoading');
                    const valueElement = element;
                    
                    // Show loading state if PDV is not available (empty, "-", or null)
                    const pdvValue = String(data[key] || '').trim();
                    if (!pdvValue || pdvValue === '-') {
                        if (loadingElement) loadingElement.style.display = 'inline-flex';
                        if (valueElement) valueElement.style.display = 'none';
                    } else {
                        if (loadingElement) loadingElement.style.display = 'none';
                        if (valueElement) {
                            valueElement.style.display = 'inline-block';
                            valueElement.textContent = pdvValue;
                        }
                    }
                } else {
                    element.textContent = data[key];
                }
            }
        });
    }
    
    // Populate products table
    function populateProductsTable(tableBody, products, totalElementId, total) {
        if (!tableBody) return;
        
        tableBody.innerHTML = '';
        
        products.forEach(product => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${product.name}</td>
                <td><div class="description-wrapper-modal">${product.description}</div></td>
                <td class="quantity-cell">${product.quantity}</td>
                <td class="price-cell">${product.price}</td>
                <td class="subtotal-cell">${product.subtotal}</td>
            `;
            tableBody.appendChild(row);
        });
        
        // Update total
        const totalElement = document.getElementById(totalElementId);
        if (totalElement) {
            totalElement.textContent = formatCurrency(total);
        }

        if (window.TableEmptyState) {
            window.TableEmptyState.refresh(tableBody.closest("[data-table-empty]"));
        }
    }
    
    // Populate confirmation step with form data
    function populateConfirmation() {
        const formData = getFormData();
        const { products, total } = getProductsData();
        
        populateReadOnlyFields('confirmation', formData);
        populateProductsTable(confirmationTableBody, products, 'confirmationTotalAmount', total);
    }
    
    // Populate report modal with form data
    function populatePDVReport() {
        const formData = getFormData();
        const { products, total } = getProductsData();
        
        populateReadOnlyFields('report', formData);
        populateProductsTable(reportTableBody, products, 'reportTotalAmount', total);
    }
    
    // Show form step
    function showFormStep() {
        if (formStep) formStep.style.display = 'block';
        if (confirmationStep) confirmationStep.style.display = 'none';
        if (convertBtn) convertBtn.style.display = 'inline-block';
        if (confirmBtn) confirmBtn.style.display = 'none';
        if (backBtn) backBtn.style.display = 'none';
        if (cancelBtn) cancelBtn.style.display = 'inline-block';
    }
    
    // Show confirmation step
    function showConfirmationStep() {
        console.log('Showing confirmation step');
        populateConfirmation();
        if (formStep) {
            formStep.style.display = 'none';
            console.log('Form step hidden');
        }
        if (confirmationStep) {
            confirmationStep.style.display = 'block';
            console.log('Confirmation step shown');
        }
        if (convertBtn) convertBtn.style.display = 'none';
        if (confirmBtn) confirmBtn.style.display = 'inline-block';
        if (backBtn) backBtn.style.display = 'inline-block';
        if (cancelBtn) cancelBtn.style.display = 'none';
    }
    
    // Handle Convert button click
    if (convertBtn) {
        convertBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Convert button clicked');
            // Validate form if needed
            // For now, just show confirmation
            showConfirmationStep();
        });
    } else {
        console.error('Convert button not found!');
    }
    
    // Handle Back button click
    if (backBtn) {
        backBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showFormStep();
        });
    }
    
    // Handle Confirm button click
    if (confirmBtn) {
        confirmBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            console.log('Confirm button clicked');
            
            // Here you would make the API call to create the PDV
            // For now, we'll simulate success and show the PDV generated button
            
            // Show the "Pedido Generado" button
            const pedidoGeneratedBtn = document.getElementById('pedidoGeneratedBtn');
            if (pedidoGeneratedBtn) {
                pedidoGeneratedBtn.style.display = 'inline-flex';
                console.log('Pedido Generado button shown');
            } else {
                console.warn('Pedido Generado button not found');
            }
            
            // Hide the "Convertir a Pedido" button
            const convertirBtn = document.querySelector('button[data-bs-target="#modalConvertirCotizacionAPedido"]');
            if (convertirBtn) {
                convertirBtn.style.display = 'none';
                console.log('Convertir a Pedido button hidden');
            }
            
            // Close the modal
            const bsModal = bootstrap.Modal.getInstance(conversionModal);
            if (bsModal) {
                bsModal.hide();
            }
            
            // Reset modal to form step for next time
            showFormStep();
        });
    } else {
        console.error('Confirm button not found!');
    }
    
    // Reset to form step when conversion modal is opened
    if (conversionModal) {
        conversionModal.addEventListener('show.bs.modal', function() {
            showFormStep();
        });
        
        // Also reset when modal is hidden
        conversionModal.addEventListener('hidden.bs.modal', function() {
            showFormStep();
        });
    }
    
    // Populate report when report modal is shown
    if (reportModal) {
        reportModal.addEventListener('show.bs.modal', function() {
            populatePDVReport();
            
            // Check and show loading state for PDV if needed
            const pdvElement = document.getElementById('reportNumeroPDV');
            const pdvLoadingElement = document.getElementById('reportNumeroPDVLoading');
            if (pdvElement && pdvLoadingElement) {
                const pdvValue = pdvElement.textContent.trim();
                if (!pdvValue || pdvValue === '-') {
                    pdvLoadingElement.style.display = 'inline-flex';
                    pdvElement.style.display = 'none';
                } else {
                    pdvLoadingElement.style.display = 'none';
                    pdvElement.style.display = 'inline-block';
                }
            }
        });
    }
});
