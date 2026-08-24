document.addEventListener("DOMContentLoaded", () => {
    const tbody = document.querySelector("table.table tbody");
    if (!tbody || !tbody.querySelector("tr.item-container")) return;

    function getItemRows() {
        return [...tbody.querySelectorAll("tr.item-container")];
    }

    function refreshPositionLabels() {
        const n = getItemRows().length;
        getItemRows().forEach((row, i) => {
            const btn = row.querySelector(".item-position-display");
            const input = row.querySelector(".item-position-input");
            if (btn) btn.textContent = String(i + 1);
            if (input) {
                input.min = "1";
                input.max = String(Math.max(1, n));
            }
        });
    }

    function cancelAllPositionEditors() {
        tbody.querySelectorAll(".item-position-wrap.is-editing").forEach((wrap) => {
            wrap.classList.remove("is-editing");
            const btn = wrap.querySelector(".item-position-display");
            const input = wrap.querySelector(".item-position-input");
            if (input) {
                input.hidden = true;
                input.value = "";
            }
            if (btn) btn.hidden = false;
        });
    }

    function openPositionEditor(wrap) {
        cancelAllPositionEditors();
        const btn = wrap.querySelector(".item-position-display");
        const input = wrap.querySelector(".item-position-input");
        if (!btn || !input) return;
        wrap.classList.add("is-editing");
        btn.hidden = true;
        input.hidden = false;
        input.value = btn.textContent.trim();
        const n = getItemRows().length;
        input.max = String(Math.max(1, n));
        input.focus();
        input.select();
    }

    function moveRowToOneBasedPosition(row, oneBased) {
        const rows = getItemRows();
        const n = rows.length;
        const from = rows.indexOf(row);
        if (from === -1 || n === 0) return false;

        let target = Math.floor(Number(oneBased));
        if (!Number.isFinite(target)) target = from + 1;
        target = Math.min(Math.max(target, 1), n);
        const targetIndex = target - 1;

        if (from === targetIndex) return false;

        row.remove();
        const afterRemove = [...tbody.querySelectorAll("tr.item-container")];
        const ref = afterRemove[targetIndex] ?? null;
        tbody.insertBefore(row, ref);
        return true;
    }

    function commitPositionEdit(wrap) {
        const row = wrap.closest("tr.item-container");
        const input = wrap.querySelector(".item-position-input");
        if (!row || !input || !wrap.classList.contains("is-editing")) return;

        const moved = moveRowToOneBasedPosition(row, input.value);
        wrap.classList.remove("is-editing");
        input.hidden = true;
        const btn = wrap.querySelector(".item-position-display");
        if (btn) btn.hidden = false;

        if (moved && typeof window.syncCotizacionItemOrderAfterReorder === "function") {
            window.syncCotizacionItemOrderAfterReorder();
        } else {
            refreshPositionLabels();
        }
    }

    document.addEventListener("cotizacion-items-reordered", refreshPositionLabels);

    tbody.addEventListener("click", (e) => {
        const btn = e.target.closest(".item-position-display");
        if (!btn || !tbody.contains(btn)) return;
        e.preventDefault();
        const wrap = btn.closest(".item-position-wrap");
        if (wrap) openPositionEditor(wrap);
    });

    tbody.addEventListener("keydown", (e) => {
        if (!e.target.classList.contains("item-position-input")) return;
        const wrap = e.target.closest(".item-position-wrap");
        if (!wrap) return;
        if (e.key === "Enter") {
            e.preventDefault();
            commitPositionEdit(wrap);
        } else if (e.key === "Escape") {
            e.preventDefault();
            cancelAllPositionEditors();
            refreshPositionLabels();
        }
    });

    tbody.addEventListener(
        "focusout",
        (e) => {
            if (!e.target.classList.contains("item-position-input")) return;
            const wrap = e.target.closest(".item-position-wrap");
            if (!wrap || !wrap.classList.contains("is-editing")) return;
            if (wrap.contains(e.relatedTarget)) return;
            window.setTimeout(() => {
                if (document.activeElement === e.target) return;
                if (!wrap.classList.contains("is-editing")) return;
                commitPositionEdit(wrap);
            }, 0);
        },
        true
    );

    refreshPositionLabels();
});
