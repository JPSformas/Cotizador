// Orden de ítems: menú "Ordenar por" (Personalizado / nombre / PVP). El orden manual solo se guarda en snapshot cuando el usuario arrastra o edita posición (detail.source !== "dropdown").
document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.querySelector("table.table tbody");
    const menu = document.getElementById("dropdownOrdenarItems")?.closest(".dropdown");
    if (!tbody || !tbody.querySelector("tr.item-container") || !menu) return;

    const items = () => [...tbody.querySelectorAll("tr.item-container")];

    function rowKey(row) {
        const dataId = row.getAttribute("data-id");
        if (dataId && dataId !== "#") return `id:${dataId}`;
        const name = row.querySelector(".product-name-main")?.textContent.trim() || "";
        return `name:${name}`;
    }

    let customOrderKeys = items().map(rowKey);

    document.addEventListener("cotizacion-items-reordered", (e) => {
        if (e.detail && e.detail.source === "dropdown") return;
        customOrderKeys = items().map(rowKey);
    });

    function getPvpNumeric(row) {
        const el = row.querySelector(".product-pvp");
        if (!el) return 0;
        const v = parseFloat(el.getAttribute("data-current-price"), 10);
        return Number.isFinite(v) ? v : 0;
    }

    function getNameLower(row) {
        return (row.querySelector(".product-name-main")?.textContent.trim() || "").toLowerCase();
    }

    function reorderRows(sortedRows) {
        sortedRows.forEach((r) => tbody.appendChild(r));
    }

    function applyPersonalizado() {
        const map = new Map(items().map((r) => [rowKey(r), r]));
        const out = [];
        for (const key of customOrderKeys) {
            const r = map.get(key);
            if (r && !out.includes(r)) out.push(r);
        }
        for (const r of items()) {
            if (!out.includes(r)) out.push(r);
        }
        reorderRows(out);
    }

    function applySort(mode) {
        const rows = items();
        if (rows.length === 0) return;

        switch (mode) {
            case "personalizado":
                applyPersonalizado();
                break;
            case "nombre-asc":
                reorderRows([...rows].sort((a, b) => getNameLower(a).localeCompare(getNameLower(b), "es")));
                break;
            case "nombre-desc":
                reorderRows([...rows].sort((a, b) => getNameLower(b).localeCompare(getNameLower(a), "es")));
                break;
            case "pvp-asc":
                reorderRows([...rows].sort((a, b) => getPvpNumeric(a) - getPvpNumeric(b)));
                break;
            case "pvp-desc":
                reorderRows([...rows].sort((a, b) => getPvpNumeric(b) - getPvpNumeric(a)));
                break;
            default:
                return;
        }

        if (typeof window.syncCotizacionItemOrderAfterReorder === "function") {
            window.syncCotizacionItemOrderAfterReorder({ source: "dropdown" });
        }
    }

    const dropdownItems = menu.querySelectorAll("[data-orden]");

    function setActiveItem(mode) {
        dropdownItems.forEach((el) => {
            el.classList.toggle("active", el.getAttribute("data-orden") === mode);
        });
    }

    menu.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-orden]");
        if (!btn || !menu.contains(btn)) return;
        e.preventDefault();
        const mode = btn.getAttribute("data-orden");
        if (!mode) return;
        setActiveItem(mode);
        applySort(mode);
    });
});
