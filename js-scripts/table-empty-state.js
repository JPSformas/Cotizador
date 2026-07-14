/**
 * Table Empty State — muestra placeholders cuando no hay filas en tablas o listas mobile.
 * Demo para eliminar filas/cards — handlers de prototipo que quitan filas/cards y refrescan el estado vacío.
 * DeleteDemo es opcional: podés quitarlo cuando quieras; EmptyState sigue funcionando si codigo que agrega/elimina filas/cards actualiza el DOM y llama a TableEmptyState.refresh().
 */
(function () {
    const $ = (sel, root = document) => root.querySelector(sel);
    const isDesktopTable = () => window.matchMedia("(min-width: 769px)").matches;

    // -------------------------------------------------------------------------
    // Empty State
    // -------------------------------------------------------------------------

    const EmptyState = (function () {
        const DEFAULTS = {
            products: {
                title: "No hay productos en la cotización",
                hint: "Agregá productos desde el buscador para comenzar.",
                icon: "fa-box-open",
                rowSelector: "tr.item-container",
            },
            quantities: {
                title: "No hay cantidades configuradas",
                hint: "Usá «Agregar cantidad» para definir precios por volumen.",
                icon: "fa-layer-group",
                rowSelector: "tbody > tr",
            },
            "modal-products": {
                title: "No hay productos para mostrar",
                hint: "Los productos de la cotización aparecerán aquí.",
                icon: "fa-list",
                rowSelector: "tbody > tr",
            },
        };

        const cfg = (el) => {
            const d = DEFAULTS[el.dataset.emptyType || "quantities"] || DEFAULTS.quantities;
            return {
                title: el.dataset.emptyTitle || d.title,
                hint: el.dataset.emptyHint || d.hint,
                icon: el.dataset.emptyIcon || d.icon,
                rowSelector: el.dataset.rowSelector || d.rowSelector,
            };
        };

        const rows = (el, sel) => [...(el.querySelector("tbody")?.querySelectorAll(sel) || [])];
        const cards = (el) => [...el.querySelectorAll(":scope > .quantities-card")];

        const applyLayout = (state, el) => {
            const standalone = el.dataset.emptyType === "modal-products" || !isDesktopTable();
            state.classList.toggle("table-empty-state--standalone", standalone);
            state.classList.toggle("table-empty-state--attached", !standalone);
        };

        const setVisible = (el, empty) => {
            const state = el.querySelector(":scope > .table-empty-state");
            state?.classList.toggle("table-empty-state--visible", empty);
            if (el.hasAttribute("data-table-empty") && state) applyLayout(state, el);
        };

        const isEmpty = (el) => {
            if (el.hasAttribute("data-table-empty")) return rows(el, cfg(el).rowSelector).length === 0;
            if (el.hasAttribute("data-table-empty-mobile")) return cards(el).length === 0;
            return false;
        };

        const update = (el) => setVisible(el, isEmpty(el));

        const updateGroup = (id) => {
            if (!id) return;
            document.querySelectorAll(`[data-empty-group="${id}"]`).forEach(update);
        };

        const ensure = (el) => {
            if (el.querySelector(":scope > .table-empty-state")) return;

            const c = cfg(el);
            const state = document.createElement("div");
            state.className = "table-empty-state";
            state.role = "status";
            state.innerHTML = `<div class="table-empty-state__content"><i class="fas ${c.icon} table-empty-state__icon" aria-hidden="true"></i><p class="table-empty-state__title">${c.title}</p><p class="table-empty-state__hint">${c.hint}</p></div>`;

            if (el.hasAttribute("data-table-empty")) {
                applyLayout(state, el);
                el.appendChild(state);
            } else {
                state.classList.add("table-empty-state--standalone");
                el.insertBefore(state, el.firstChild);
            }
        };

        const mountAll = () => {
            document.querySelectorAll("[data-table-empty], [data-table-empty-mobile]").forEach((el) => {
                ensure(el);
                update(el);
            });
        };

        const bindLayoutListener = () => {
            window.matchMedia("(min-width: 769px)").addEventListener("change", () => {
                document.querySelectorAll("[data-table-empty]").forEach(update);
            });
        };

        const refresh = (el) => {
            const target = el?.hasAttribute?.("data-table-empty") ? el : el?.closest?.("[data-table-empty]");
            if (target) update(target);
            else document.querySelectorAll("[data-table-empty]").forEach(update);
        };

        const init = () => {
            mountAll();
            bindLayoutListener();
        };

        return { init, refresh, update, updateGroup, cfg, rows, cards };
    })();

    // -------------------------------------------------------------------------
    // Demo para eliminar filas/cards — quita filas/cards desde botones delete (solo prototipo)
    // -------------------------------------------------------------------------

    const DeleteDemo = (function () {
        const REMOVE_MS = 200;

        const animateRemove = (el, done) => {
            el.classList.add("table-empty-state-removing");
            setTimeout(() => {
                el.remove();
                done?.();
            }, REMOVE_MS);
        };

        const refreshProducts = () => {
            window.cotizacionSelection?.refresh();
            EmptyState.update($('[data-table-empty][data-empty-type="products"]'));
        };

        const syncGroup = (group, index, from) => {
            if (!group || index < 0) return false;

            const table = $(`[data-table-empty][data-empty-group="${group}"]`);
            const mobile = $(`[data-table-empty-mobile][data-empty-group="${group}"]`);

            if (from !== "table" && table) {
                EmptyState.rows(table, EmptyState.cfg(table).rowSelector)[index]?.remove();
            }
            if (from !== "mobile" && mobile) {
                EmptyState.cards(mobile)[index]?.remove();
            }

            EmptyState.updateGroup(group);
            return true;
        };

        const removeRow = (row) => {
            const table = row.closest("[data-table-empty]");
            const group = table?.dataset.emptyGroup;
            const index = table ? EmptyState.rows(table, EmptyState.cfg(table).rowSelector).indexOf(row) : -1;

            animateRemove(row, () => {
                if (row.classList.contains("item-container")) refreshProducts();
                else if (!syncGroup(group, index, "table") && table) EmptyState.update(table);
            });
        };

        const removeCard = (card) => {
            const list = card.closest("[data-table-empty-mobile]");
            const index = EmptyState.cards(list).indexOf(card);

            animateRemove(card, () => {
                if (!syncGroup(list.dataset.emptyGroup, index, "mobile")) EmptyState.update(list);
            });
        };

        const bindDeleteButtons = () => {
            document.addEventListener("click", (e) => {
                const btn = e.target.closest(".delete-btn, .delete-btn-mobile");
                if (!btn) return;

                const row = btn.closest("tr");
                if (row?.classList.contains("item-container") || (btn.classList.contains("delete-btn") && row?.closest("[data-table-empty]"))) {
                    e.preventDefault();
                    removeRow(row);
                    return;
                }

                const card = btn.closest(".quantities-card");
                if (card?.closest("[data-table-empty-mobile]")) {
                    e.preventDefault();
                    removeCard(card);
                }
            });
        };

        const bindBulkDelete = () => {
            $("#btnEliminarItemsSeleccionados")?.addEventListener("click", () => {
                const selected = window.cotizacionSelection?.getSelectedRows() || [];
                if (!selected.length) return;
                selected.forEach((row) => row.remove());
                refreshProducts();
            });
        };

        const init = () => {
            bindDeleteButtons();
            bindBulkDelete();
        };

        return { init };
    })();

    // -------------------------------------------------------------------------
    // Inicialización
    // -------------------------------------------------------------------------

    const init = () => {
        EmptyState.init();
        DeleteDemo.init();
    };

    window.TableEmptyState = { refresh: EmptyState.refresh };

    document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", init) : init();
})();
