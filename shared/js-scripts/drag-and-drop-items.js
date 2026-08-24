document.addEventListener("DOMContentLoaded", () => {
    const tableBody = document.querySelector("table.table tbody");
    if (!tableBody || !tableBody.querySelector("tr.item-container")) return;

    function updateItemIds() {
        const rows = tableBody.querySelectorAll(".item-container");
        rows.forEach((row, i) => (row.id = `item-${i + 1}`));
    }

    function editPageForRow(row) {
        return row.classList.contains("generico") ? "editItem-generico.html" : "editItem.html";
    }

    /** `orden` = 1-based index aligned with `id="item-{orden}"` after updateItemIds. */
    function syncCotizacionItemEditNavFromTable() {
        const rows = tableBody.querySelectorAll(".item-container");
        const chain = [];
        rows.forEach((row, i) => {
            const orden = i + 1;
            const page = editPageForRow(row);
            chain.push({ page });
            const href = `${page}?orden=${orden}`;
            row.querySelectorAll("a.edit-btn, a.edit-btn-mobile").forEach((a) => {
                a.setAttribute("href", href);
            });
        });
        try {
            localStorage.setItem("cotizacionEditNavChain", JSON.stringify(chain));
        } catch (e) {
            /* ignore quota / private mode */
        }
    }

    function saveNewOrder() {
        const rows = tableBody.querySelectorAll(".item-container");
        const order = Array.from(rows).map((row, i) => ({
            id: row.getAttribute("data-id"),
            position: i + 1,
            productName: row.querySelector(".productName").textContent.trim()
        }));
        localStorage.setItem("itemOrder", JSON.stringify(order));
    }

    function syncAfterReorder(opts) {
        const options = opts && typeof opts === "object" ? opts : {};
        updateItemIds();
        saveNewOrder();
        syncCotizacionItemEditNavFromTable();
        document.dispatchEvent(
            new CustomEvent("cotizacion-items-reordered", {
                detail: { source: options.source === "dropdown" ? "dropdown" : "user" }
            })
        );
    }

    window.syncCotizacionItemOrderAfterReorder = function (opts) {
        syncAfterReorder(opts);
    };

    window.syncCotizacionItemEditNavFromTable = syncCotizacionItemEditNavFromTable;

    updateItemIds();
    syncCotizacionItemEditNavFromTable();

    Sortable.create(tableBody, {
        animation: 200,
        handle: ".drag-handle",
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        dragClass: "sortable-drag",
        onStart: () => (document.body.style.cursor = "grabbing"),
        onEnd: () => {
            document.body.style.cursor = "";
            syncAfterReorder();
        }
    });

    const dragHandles = document.querySelectorAll(".dragItem .drag-handle");
    dragHandles.forEach((handle) => {
        handle.addEventListener("mouseenter", () => (handle.style.transform = "scale(1.1)"));
        handle.addEventListener("mouseleave", () => (handle.style.transform = "scale(1)"));
    });
});
