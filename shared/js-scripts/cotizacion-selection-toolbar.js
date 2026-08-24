/**
 * Toolbar contextual para la tabla de ítems de cotización (mockup).
 * - Al marcar checkboxes, la toolbar normal se reemplaza por la de selección.
 * - Las acciones de la toolbar y los modales de cantidades son solo visuales.
 */
document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.querySelector("table.table tbody");
    const toolbarDefault = document.getElementById("tableToolbarDefault");
    const toolbarSelection = document.getElementById("tableToolbarSelection");
    const selectionCount = document.getElementById("selectionCount");

    if (!tbody || !toolbarDefault || !toolbarSelection) return;

    function getSelectedRows() {
        if (window.cotizacionSelection) return window.cotizacionSelection.getSelectedRows();
        return Array.from(tbody.querySelectorAll("tr.item-container")).filter((row) => {
            const cb = row.querySelector(".item-row-checkbox");
            return cb && cb.checked;
        });
    }

    function clearSelection() {
        if (window.cotizacionSelection) {
            window.cotizacionSelection.clearSelection();
        }
    }

    function syncToolbarState(count) {
        const hasSelection = count > 0;
        toolbarDefault.classList.toggle("d-none", hasSelection);
        toolbarSelection.classList.toggle("d-none", !hasSelection);
        if (selectionCount) {
            selectionCount.textContent = count === 1 ? "1 seleccionado" : `${count} seleccionados`;
        }
        tbody.querySelectorAll("tr.item-container").forEach((row) => {
            const cb = row.querySelector(".item-row-checkbox");
            row.classList.toggle("row-selected", Boolean(cb && cb.checked));
        });
    }

    document.addEventListener("cotizacion-selection-changed", (e) => {
        syncToolbarState(e.detail ? e.detail.count : getSelectedRows().length);
    });

    const btnClear = document.getElementById("btnClearSelection");
    if (btnClear) btnClear.addEventListener("click", clearSelection);

    /* ---------- Contexto visual en modal / offcanvas de cantidades ---------- */

    function updateSelectionContext(containerId, isGlobal) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.classList.toggle("context-global", isGlobal);
        const strong = container.querySelector("strong");
        if (!strong) return;
        if (isGlobal) {
            strong.textContent = "todos los productos de la cotización";
        } else {
            const count = getSelectedRows().length;
            strong.textContent =
                count === 1 ? "1 ítem seleccionado" : `${count} ítems seleccionados`;
        }
    }

    function isCotizarRapidoTrigger(trigger) {
        return Boolean(
            trigger &&
                (trigger.id === "btnCotizarRapido" || trigger.id === "btnCotizarRapidoMobile")
        );
    }

    const modalCantidades = document.getElementById("modalMasElementos");
    if (modalCantidades) {
        modalCantidades.addEventListener("show.bs.modal", (e) => {
            updateSelectionContext(
                "modalMasElementosContext",
                isCotizarRapidoTrigger(e.relatedTarget)
            );
        });
    }

    const sidebarCantidades = document.getElementById("sidebarMasElementos");
    if (sidebarCantidades) {
        sidebarCantidades.addEventListener("show.bs.offcanvas", (e) => {
            updateSelectionContext(
                "sidebarMasElementosContext",
                isCotizarRapidoTrigger(e.relatedTarget)
            );
        });
    }

    /* ---------- Cerrar modal / offcanvas al guardar (sin aplicar cambios) ---------- */

    const btnGuardarDesktop = document.getElementById("guardarCantidadesDesktop");
    if (btnGuardarDesktop && modalCantidades && window.bootstrap) {
        btnGuardarDesktop.addEventListener("click", () => {
            bootstrap.Modal.getOrCreateInstance(modalCantidades).hide();
        });
    }

    const btnGuardarMobile = document.getElementById("guardarCantidadesMobile");
    if (btnGuardarMobile && sidebarCantidades && window.bootstrap) {
        btnGuardarMobile.addEventListener("click", () => {
            bootstrap.Offcanvas.getOrCreateInstance(sidebarCantidades).hide();
        });
    }

    syncToolbarState(getSelectedRows().length);
});
