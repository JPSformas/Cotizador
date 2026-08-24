/**
 * Client Creation Modal Handler
 * 
 * Handles the creation of new clients through a modal form.
 * 
 * PRODUCTION INTEGRATION:
 * 1. Replace the form submission handler with actual API call
 * 2. Update success handler to refresh client list and select new client
 * 3. Add proper error handling
 */

(function() {
    'use strict';

    /**
     * Initialize the client creation modal
     */
    function initCrearClienteModal() {
        const modal = document.getElementById('modalCrearCliente');
        const form = document.getElementById('formCrearCliente');
        const saveBtn = document.getElementById('btnGuardarCliente');
        const razonSocialInput = document.getElementById('razonSocial');
        const razonSocialIdInput = document.getElementById('razonSocialId');

        if (!modal || !form || !saveBtn) return;

        // Handle form submission
        saveBtn.addEventListener('click', function(e) {
            e.preventDefault();
            handleFormSubmit();
        });

        // Handle form enter key submission
        form.addEventListener('submit', function(e) {
            e.preventDefault();
            handleFormSubmit();
        });

        // Reset form when modal is closed
        modal.addEventListener('hidden.bs.modal', function() {
            form.reset();
            // Remove any validation classes
            const inputs = form.querySelectorAll('.form-control, .form-select');
            inputs.forEach(input => {
                input.classList.remove('is-invalid', 'is-valid');
            });
        });

        // Pre-fill Razón Social if there's a value in the main input or modal input
        modal.addEventListener('show.bs.modal', function() {
            const razonSocialField = document.getElementById('clienteRazonSocial');
            if (!razonSocialField) return;
            
            // Check main form input
            if (razonSocialInput && razonSocialInput.value.trim() && !razonSocialField.value) {
                razonSocialField.value = razonSocialInput.value.trim();
            }
            
            // Check modal form input
            const modalRazonSocialInput = document.getElementById('modalRazonSocial');
            if (modalRazonSocialInput && modalRazonSocialInput.value.trim() && !razonSocialField.value) {
                razonSocialField.value = modalRazonSocialInput.value.trim();
            }
        });
    }

    /**
     * Handle form submission
     */
    function handleFormSubmit() {
        const form = document.getElementById('formCrearCliente');
        if (!form) return;

        // Validate form
        if (!form.checkValidity()) {
            form.classList.add('was-validated');
            return;
        }

        // Get form data
        const formData = {
            nombre: document.getElementById('clienteNombre').value.trim(),
            razonSocial: document.getElementById('clienteRazonSocial').value.trim(),
            categoriaFiscal: document.getElementById('clienteCategoriaFiscal').value,
            identificacionTributaria: document.getElementById('clienteIdentificacionTributaria').value,
            valorIdentificacion: document.getElementById('clienteValorIdentificacion').value.trim()
        };

        // Show loading state
        const saveBtn = document.getElementById('btnGuardarCliente');
        const originalText = saveBtn.innerHTML;
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Guardando...';

        // TODO: Replace with actual API call
        // Example API call:
        // fetch('/api/clients', {
        //     method: 'POST',
        //     headers: {
        //         'Content-Type': 'application/json',
        //     },
        //     body: JSON.stringify(formData)
        // })
        //     .then(response => response.json())
        //     .then(data => {
        //         handleSuccess(data);
        //     })
        //     .catch(error => {
        //         handleError(error);
        //     })
        //     .finally(() => {
        //         saveBtn.disabled = false;
        //         saveBtn.innerHTML = originalText;
        //     });

        // Simulate API call (remove when using real API)
        setTimeout(() => {
            // Simulate successful creation
            const mockResponse = {
                codigo: 'NEW' + Date.now(),
                nombre: formData.razonSocial,
                ...formData
            };
            
            handleSuccess(mockResponse);
            
            saveBtn.disabled = false;
            saveBtn.innerHTML = originalText;
        }, 1000);
    }

    /**
     * Handle successful client creation
     */
    function handleSuccess(clientData) {
        // Close modal
        const modal = bootstrap.Modal.getInstance(document.getElementById('modalCrearCliente'));
        if (modal) {
            modal.hide();
        }

        // Determine which field to update based on which modal is open
        const conversionModal = document.getElementById('modalConvertirCotizacionAPedido');
        const isConversionModalOpen = conversionModal && conversionModal.classList.contains('show');
        
        if (isConversionModalOpen) {
            // Update modal razon social input
            const modalRazonSocialInput = document.getElementById('modalRazonSocial');
            const modalRazonSocialIdInput = document.getElementById('modalRazonSocialId');
            
            if (modalRazonSocialInput) {
                modalRazonSocialInput.value = clientData.razonSocial || clientData.nombre;
                modalRazonSocialInput.dataset.selectedId = clientData.codigo;
                modalRazonSocialInput.dataset.selectedValue = clientData.razonSocial || clientData.nombre;
                
                // Trigger change event
                modalRazonSocialInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            if (modalRazonSocialIdInput) {
                modalRazonSocialIdInput.value = clientData.codigo;
            }
        } else {
            // Update the main razon social input
            const razonSocialInput = document.getElementById('razonSocial');
            const razonSocialIdInput = document.getElementById('razonSocialId');
            
            if (razonSocialInput) {
                razonSocialInput.value = clientData.razonSocial || clientData.nombre;
                razonSocialInput.dataset.selectedId = clientData.codigo;
                razonSocialInput.dataset.selectedValue = clientData.razonSocial || clientData.nombre;
                
                // Trigger change event
                razonSocialInput.dispatchEvent(new Event('change', { bubbles: true }));
            }
            
            if (razonSocialIdInput) {
                razonSocialIdInput.value = clientData.codigo;
            }
        }

        // TODO: Refresh client list in autocomplete
        // This would require calling the autocomplete's refresh function
        // or reloading the client data

        // Show success message (optional)
        console.log('Cliente creado exitosamente:', clientData);
        
        // Optional: Show toast notification
        // showToast('Cliente creado exitosamente', 'success');
    }

    /**
     * Handle error during client creation
     */
    function handleError(error) {
        console.error('Error al crear cliente:', error);
        
        // Show error message
        const form = document.getElementById('formCrearCliente');
        if (form) {
            // Add error alert
            let errorAlert = form.querySelector('.alert-danger');
            if (!errorAlert) {
                errorAlert = document.createElement('div');
                errorAlert.className = 'alert alert-danger alert-dismissible fade show';
                errorAlert.innerHTML = `
                    <i class="fas fa-exclamation-circle me-2"></i>
                    <span>Error al crear el cliente. Por favor, intente nuevamente.</span>
                    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                `;
                form.insertBefore(errorAlert, form.firstChild);
            }
        }
        
        // Optional: Show toast notification
        // showToast('Error al crear el cliente', 'error');
    }

    /**
     * Initialize on page load
     */
    document.addEventListener('DOMContentLoaded', function() {
        initCrearClienteModal();
    });

})();

