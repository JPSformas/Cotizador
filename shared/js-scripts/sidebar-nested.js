document.addEventListener('DOMContentLoaded', function() {
    const btnAgregarCantidades = document.getElementById('btnAgregarCantidades');
    const nestedSidebar = document.getElementById('nestedSidebar');
    const btnBackNestedSidebar = document.getElementById('btnBackNestedSidebar');
    const mainSidebar = document.getElementById('sidebarMasElementos');
    const offcanvasFooter = document.querySelector('.offcanvas-footer');

    if (btnAgregarCantidades && nestedSidebar && btnBackNestedSidebar) {
        btnAgregarCantidades.addEventListener('click', function() {
            nestedSidebar.classList.add('show');
            // Hide the footer when nested sidebar opens
            if (offcanvasFooter) {
                offcanvasFooter.style.display = 'none';
            }
        });

        btnBackNestedSidebar.addEventListener('click', function() {
            nestedSidebar.classList.remove('show');
            // Show the footer when nested sidebar closes
            if (offcanvasFooter) {
                offcanvasFooter.style.display = 'block';
            }
        });
    }

    if (mainSidebar && nestedSidebar) {
        mainSidebar.addEventListener('hidden.bs.offcanvas', () => {
            nestedSidebar.classList.remove('show');
            // Ensure footer is visible when main sidebar closes
            if (offcanvasFooter) {
                offcanvasFooter.style.display = 'block';
            }
        });
    }

});