document.addEventListener("DOMContentLoaded", () => {
    const selectAllCheckboxes = [
        document.getElementById("selectAllCotizacionItems"),
        document.getElementById("selectAllCotizacionItemsMobile")
    ].filter(Boolean);
    const tbody = document.querySelector("table.table tbody");

    if (selectAllCheckboxes.length === 0 || !tbody || !tbody.querySelector("tr.item-container")) return;

    function getRowCheckboxes() {
        return Array.from(tbody.querySelectorAll("tr.item-container .item-row-checkbox"));
    }

    function notifySelectionChanged() {
        const boxes = getRowCheckboxes();
        const count = boxes.filter((cb) => cb.checked).length;
        document.dispatchEvent(
            new CustomEvent("cotizacion-selection-changed", {
                detail: { count, total: boxes.length }
            })
        );
    }

    function syncSelectAllState() {
        const boxes = getRowCheckboxes();
        if (boxes.length === 0) {
            selectAllCheckboxes.forEach((cb) => {
                cb.checked = false;
                cb.indeterminate = false;
            });
            notifySelectionChanged();
            return;
        }
        const checkedCount = boxes.filter((cb) => cb.checked).length;
        const allChecked = checkedCount === boxes.length;
        const isIndeterminate = checkedCount > 0 && checkedCount < boxes.length;
        selectAllCheckboxes.forEach((cb) => {
            cb.checked = allChecked;
            cb.indeterminate = isIndeterminate;
        });
        notifySelectionChanged();
    }

    // API compartida para otros scripts (toolbar de selección)
    window.cotizacionSelection = {
        getSelectedRows() {
            return Array.from(tbody.querySelectorAll("tr.item-container")).filter((row) => {
                const cb = row.querySelector(".item-row-checkbox");
                return cb && cb.checked;
            });
        },
        clearSelection() {
            getRowCheckboxes().forEach((cb) => {
                cb.checked = false;
            });
            syncSelectAllState();
        },
        refresh() {
            syncSelectAllState();
        }
    };

    selectAllCheckboxes.forEach((selectAll) => {
        selectAll.addEventListener("change", () => {
            const checked = selectAll.checked;
            getRowCheckboxes().forEach((cb) => {
                cb.checked = checked;
            });
            syncSelectAllState();
        });
    });

    tbody.addEventListener("change", (e) => {
        const target = e.target;
        if (target && target.classList && target.classList.contains("item-row-checkbox")) {
            syncSelectAllState();
        }
    });

    syncSelectAllState();
});
