# Bulk "Cargar cantidades" for v6 — design

Date: 2026-09-03

Adapt the shortcut menus `#modalMasElementos` (desktop) and `#sidebarMasElementos` (mobile) in
`v6/detalle-cotizacion.html` to the v6 item table. Both currently mirror the v5 item table and are
outdated: they offer `Costo extra` and `Margen %`, neither of which exists in v6.

## Context

The two surfaces are one form rendered twice, reachable from two entry points:

- **Cotizar rápido** (`#btnCotizarRapido` / `#btnCotizarRapidoMobile`, in Atajos globales) — targets
  every item in the quotation. Shows the yellow `.selection-context.context-global` banner.
- **Cargar cantidades** (`#btnCargarCantidadesSeleccion` / `...Mobile`, in the selection toolbar) —
  targets the checked rows. Shows the blue `.selection-context` banner.

`shared/js-scripts/cotizacion-selection-toolbar.js` decides between the two by inspecting
`e.relatedTarget` on `show.bs.modal` / `show.bs.offcanvas`, and only swaps the banner text. Nothing
is applied to any item — the menus are visual mockups.

### Why they are outdated

The v5 item table had `Cantidad | Precio x Volumen | SETUP Prorrateado | Costo extra | Margen |
Descuento | Financiación | Precio Unitario | Subtotal`, which the menus mirror in reduced form.

v6 replaced that table with the pricing engine (`v6/js-scripts/pricing-engine.js`), which renders
one of two shapes:

- **costo mode** (`v6/editItem.html` catálogo, `v6/editItem-generico-costo.html`):
  `Cantidad | Costos (Producto override + Logo + Setup prorrateado → Total) | Markup (multiplier
  auto-suggested from the volume-tier scale, overridable) | Ajustes comerciales (1–3 cascading Desc.
  columns, 1–3 cascading Fin. columns) | Unitario | Subtotal`, plus a logo block above the table
  (colores, ubicaciones, método, and a per-quantity `lp-input` "costo por ubicación" card grid).
  Max 5 rows.
- **pvp mode** (`v6/editItem-generico-pvp.html`): no logo, no costos, no markup —
  `Cantidad | Precio x Volumen | Desc. | Fin. | Unitario | Subtotal`.

So `Costo extra` no longer exists anywhere in v6, `Margen %` became a markup multiplier with a
suggested value, the single Desc./Fin. inputs do not represent cascading columns, and there is no
way to set the per-quantity logo cost.

## Goals

- The menus edit a quantity ladder whose columns match the v6 item table.
- What the menus render stays in sync with the item table by construction, not by duplication.
- The form adapts to the target: genérico-PVP items support neither logo nor markup.
- v5 keeps working unchanged.

## Non-goals

- No persistence. This repo is a prototype; saving does not recompute item rows.
- No bulk editing of per-item settings: costo de producto override, and the logo block's colores,
  ubicaciones and método stay on the item page.
- No changes to v5's copy of these menus.
- No state sync between the desktop modal and the mobile offcanvas.

## Approach: a `bulk` mode in the pricing engine

`pricing-engine.js` gains a third mode alongside `costo` and `pvp`, selected with
`data-pricing-mode="bulk"`. It renders inputs only — no money math, no cost basis, no logo block:

```
Cantidad | Logo x Ubicación | Markup | Ajustes comerciales (Desc. ×n · Fin. ×n) | 🗑
```

Logo precedes Markup so the row reads in buildup order — cost, then markup, then commercial
adjustments — matching the item table's left-to-right logic.

`buildBulkRows()` mirrors `buildPvpRows()` in structure and reuses `headPctThs()` and `pctTds()`
verbatim, so the cascading `+` / `×` column controls, the 0–100 clamping, the `flash-invalid`
feedback and the `MAX_FILAS = 5` cap come along unchanged. `updateBulkRows()` only refreshes the
`efect. X%` cascade labels under the last Desc. and Fin. columns; there is nothing else to compute.
The initial ladder still comes from the inline `<script type="application/json"
data-role="pricing-quotes">`, using only `cantidad`, `descs`, `fins`, `logoUnit` and `customMarkup`.

### Column semantics

**Logo x Ubicación** maps 1:1 to each quantity's `lp-input` (`quote.logoUnit`). It is the cost *per
ubicación*; the ×1–4 ubicaciones multiplier stays a per-item setting, which is what makes the column
safe to apply across items. It reuses the engine's existing inheritance rule: the first row is the
`Precio base`, and rows whose value is empty inherit it — surfaced here as the base value in their
placeholder, the table equivalent of the logo grid's `Heredado del base` tag.

**Markup** is a plain optional override, not the click-to-edit `markup-view` / `markup-input` pair
used on item pages: in bulk there is no cost basis, so there is no suggested value to display or
revert to. Its caption reads `sin cambios` while empty.

For both columns, **empty means "don't touch"** — see [Save semantics](#save-semantics).

**Desc. / Fin.** always replace. The cascade count is structural and an empty percent field reads as
zero, not as "leave alone".

### Engine changes required

- `init()` switches from `querySelector` to `querySelectorAll`, constructing one `PricingEngine` per
  root, so `detalle-cotizacion.html` can host two instances (modal and offcanvas).
- External-field wiring (`[data-pricing-pvp]`, `[data-pricing-setup]`, `[data-pricing-save]`,
  `[data-pricing-refresh]`) is skipped entirely in bulk mode, and elsewhere is looked up within an
  optional `data-pricing-scope` container instead of the whole document. Today these are bare
  `document.querySelector` calls, which would cross-wire once a second engine exists on the page.
- New public methods:
  - `getBulkPayload()` → `[{ cantidad, logoUnit, customMarkup, descs, fins }]`
  - `setBulkColumns({ logo, markup })` → toggles column visibility and rebuilds.
  - `resetBulkQuotes()` → restores the ladder from the inline JSON.
- Saving in bulk mode dispatches a `pricing-bulk-apply` CustomEvent carrying the payload. The engine
  stays free of any knowledge of modals or offcanvases.

### New file: `v6/js-scripts/bulk-cantidades.js`

Owns everything surface-specific: resolving the target items, calling `setBulkColumns` and
`resetBulkQuotes` before each open, writing the context banner, driving the mobile nested panel, and
handling `pricing-bulk-apply`.

`v6/detalle-cotizacion.html` additionally loads `styles/pricing-table.css` and
`js-scripts/pricing-engine.js`, which it does not currently include.

## Desktop modal

`#modalMasElementos` keeps its shell: title `Cargar cantidades`, the `.selection-context` banner
with its `context-global` variant, and the footer with Cerrar / Guardar cambios. The body's
`<table class="table table-modal">` and its three hardcoded rows are deleted and replaced by a
`.pricing-engine` root in bulk mode.

Because every pricing style is scoped under `.pricing-engine`, that wrapper brings the whole visual
language with essentially no new CSS: the `pe-table` borders and rounded `.table-wrap`, the grey
`grp-ajustes` column band, the dashed-green `.add-row` button, the `pct-add` / `pct-x` column chips,
and the `pct-eff` cascade labels. The header is the two-row `thead` the engine already builds for
PVP mode, with `Cantidad`, `Logo x Ubicación` and `Markup` spanning both rows and `Ajustes
comerciales` spanning the Desc./Fin. columns.

Two cells need markup that does not exist yet:

- **Logo x Ubicación** reuses the `$`-prefixed input pattern of `.pvp-vol-wrap`, with a small `base`
  caption under the first row and the base value as placeholder on later rows.
- **Markup** is a single input with a `sin cambios` caption.

Two smaller adjustments:

- The dialog goes from `modal-lg` to `modal-xl`. At maximum cascade the row is ten columns wide, and
  `.table-wrap` would otherwise scroll horizontally in the common case too.
- The `data-table-empty` / `data-empty-type="quantities"` /
  `data-empty-group="cantidades-cotizacion"` hooks come off. The engine disables the trash button at
  one row (`removeRow` returns early when `quotes.length <= 1`), so the ladder can never be empty
  and that empty state is unreachable.

## Mobile offcanvas

`#sidebarMasElementos` keeps its two-level structure: `.sidebar-content` holds the context banner,
the `Agregar cantidades` button and the `.saved-quantities` card list; `#nestedSidebar` slides in
over it as the editor; the fixed `.offcanvas-footer` carries the warning and Guardar / Cerrar,
hidden while the nested panel is open.

**The card list is rendered by the engine.** Bulk mode gets a second renderer selected with
`data-pricing-view="cards"`, emitting `.quantities-card` elements instead of a `pe-table`. Same
state shape, same 5-row cap (which disables `#btnAgregarCantidades` at five), same payload on save.
Card styling needs no new CSS: `.quantities-card` and `.action-buttons` come from
`shared/styles/sidebar.css`, already loaded here, and `v6/styles/detalle-cotizacion.css` forces
`.saved-quantities { display: flex !important }` on this page.
Each card summarizes one quantity as `Cantidad`, `Logo x Ubicación`, `Markup`, `Desc.`, `Fin.`,
replacing today's `Costo extra` / `Margen` lines. Cascades render as their chain plus the effective
figure — `10% + 5% (efect. 14,5%)` — the card equivalent of the desktop `pct-eff` label.

**The nested panel edits one quantity, for both adding and editing.** A card's `Editar` button opens
it prefilled and retitled `Editar cantidad`, rather than introducing a second editing surface. Its
fields are Cantidad, Logo x Ubicación, Markup, then the Desc. and Fin. groups.

Those groups carry the mobile translation of the `+` / `×` column chips: a dashed
`+ Agregar descuento en cascada` button under the last field of the group, and an `×` on every field
past the first. Because the column count is global, adding Desc. 2 while editing one quantity adds
it to all of them; desktop says this in a tooltip, mobile needs a caption under the button —
`Se agrega para todas las cantidades`.

The card list also drops its `data-table-empty-mobile` / `data-empty-group="cantidades-cotizacion"`
hooks, for the same reason the desktop table does. This matters beyond the empty state:
`table-empty-state.js` currently owns card deletion — it intercepts `.delete-btn-mobile` clicks,
animates the card out, and mirrors the removal into the table sharing the same `data-empty-group`.
With both surfaces engine-rendered, deletion belongs to the engine, and leaving the attributes in
place would delete each row twice.

`shared/js-scripts/sidebar-nested.js` is shared with v5 and cannot grow v6-only behaviour. The v6
offcanvas is marked `data-bulk-managed` and the shared script bails out when it sees that attribute,
leaving nested-panel control to `bulk-cantidades.js`. The same guard applies to
`updateSelectionContext` in `shared/js-scripts/cotizacion-selection-toolbar.js`.

## Targeting and adaptation

Target resolution follows the entry point: Cotizar rápido targets every `tr.item-container` and
shows the yellow banner; the selection toolbar's Cargar cantidades targets the checked rows and
shows the blue one.

Item capabilities are read from classes already present on the rows — `item-container importado`,
`item-container generico generico-costo`, `item-container generico generico-pvp`. Catálogo and
genérico-costo both run with `data-has-logo="true"` and a markup column; genérico-PVP has neither.
No new data attributes are needed.

| Target composition | Logo x Ubicación | Markup | Banner |
| --- | --- | --- | --- |
| No PVP items | shown | shown | standard text |
| Only PVP items | hidden | hidden | standard text |
| Mixed | shown | shown | adds `Logo y Markup no aplican a N ítems sin costos` |

On mobile the same rule hides those fields in the nested panel and their lines in the cards.

`bulk-cantidades.js` applies this via `setBulkColumns` before each open, since the target can differ
between openings. For the same reason the ladder resets to the inline `pricing-quotes` default on
every open rather than carrying over the previous session's edits.

## Save semantics

Payload: one entry per row — `cantidad`, `logoUnit`, `customMarkup`, `descs[]`, `fins[]`.

For each target item:

1. The ladder is replaced by the payload's quantities.
2. A quantity that already existed on that item (matched by `cantidad`) keeps the per-item overrides
   the form did not touch: always its `prodCost`, plus its `logoUnit` or `customMarkup` when the
   corresponding cell was left empty.
3. A quantity new to that item starts with everything on auto: base-inherited logo, tier-suggested
   markup, `PVP ÷ divisor` product cost.
4. Quantities the item had that are absent from the payload are dropped, along with their overrides.
5. A filled Logo or Markup cell overwrites that quantity on every target item.
6. `descs` and `fins` always replace.
7. PVP targets ignore `logoUnit` and `customMarkup`.

The footer warning changes from the current blanket line to reflect rule 2:

> Al guardar se reemplazan las cantidades de los ítems alcanzados. Los costos propios de cada ítem
> que dejes vacíos acá se conservan.

Since nothing persists in this prototype, saving dispatches the payload, closes the surface, and
briefly adds a transient `row-bulk-applied` class to each target `tr.item-container` — a short
highlight that confirms the reach of the action. Faking recalculated numbers in the Cantidad /
Precio Unitario / Subtotal cells is out of scope: it would require a full engine run per item.

## Files touched

| File | Change |
| --- | --- |
| `v6/js-scripts/pricing-engine.js` | bulk mode, card renderer, multi-instance `init`, scoped external wiring, public bulk API |
| `v6/js-scripts/bulk-cantidades.js` | new — targeting, adaptation, banner, nested panel, apply |
| `v6/detalle-cotizacion.html` | modal body replaced, offcanvas body replaced, `modal-xl`, `data-bulk-managed`, new CSS/JS includes |
| `v6/styles/pricing-table.css` | bulk-only cells: logo input with `base` caption, plain markup input, mobile cascade controls |
| `v6/styles/detalle-cotizacion.css` | `row-bulk-applied` highlight |
| `shared/js-scripts/sidebar-nested.js` | bail out on `data-bulk-managed` |
| `shared/js-scripts/cotizacion-selection-toolbar.js` | bail out of `updateSelectionContext` on `data-bulk-managed` |

## Verification

Manual, in the browser, served from the repo root:

- v6 detalle — Cotizar rápido opens the modal with the yellow banner and the full column set.
- v6 detalle — select two catálogo items, Cargar cantidades shows the blue banner with the count.
- v6 detalle — select one catálogo item and the genérico-PVP item; both columns stay and the banner
  shows the "no aplican" note.
- v6 detalle — select only the genérico-PVP item; Logo and Markup columns are gone.
- Cascade: `+` adds a Desc. column for every row up to 3, `×` removes it, `efect.` updates.
- Ladder: `Agregar cantidad` stops at 5 rows; trash is disabled at 1 row.
- Mobile (≤768px): cards list matches the desktop columns, nested panel adds and edits a quantity,
  cascade buttons work, footer hides while nested is open.
- Reopening the modal resets the ladder to the default.
- v5 detalle — Cotizar rápido and Cargar cantidades behave exactly as before.
- v6 editItem pages — the pricing table is unaffected by the multi-instance and scoping changes.
