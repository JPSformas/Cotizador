/**
 * Pricing engine — volume pricing with logo cost buildup and tier markup.
 *
 * Ported from the standalone Propuesta-Precios.html prototype into a reusable,
 * event-delegated module that initializes against a [data-pricing-engine]
 * container. Money parsing/formatting delegates to FinancialFormatter
 * (financial-formatting.js) when available.
 *
 * Pricing model (footer of the prototype):
 *   Costo producto = PVP / divisor (default 1,65)   -> editable per row
 *   Costo logo     = costo por ubicacion (por cantidad) x cantidad de ubicaciones
 *   Costo total    = Producto + Logo + Setup
 *   Markup         = tier scale on (costo total x cantidad)   -> editable per row
 *   Precio c/markup = Costo total x Markup
 *   Unitario       = Precio c/markup x (1-d1)(1-d2)... x (1+f1)(1+f2)...
 *   Subtotal       = Unitario x Cantidad
 *
 * Container configuration via data-* attributes:
 *   data-pricing-mode  "costo" | "pvp"      (default "costo")
 *   data-has-logo      "true" | "false"     (default "true"; forced false in pvp)
 *   data-cost-divisor  number, e.g. "1.65"  (default 1.65; costo mode only)
 *   data-setup-mode    "prorated" | "flat"  (default "flat")
 *
 * PVP mode (generic products loaded from selling price):
 *   No logo block, no Costos / Markup columns. Each row has an editable
 *   Precio x Volumen; unitario = that price × discounts × financing.
 *
 * The PVP source, setup source, save button and refresh button live outside the
 * container; mark them with data-pricing-pvp / data-pricing-setup /
 * data-pricing-save / data-pricing-refresh and the engine wires them up.
 *
 * Initial rows can be provided via an inline JSON script inside the container:
 *   <script type="application/json" data-role="pricing-quotes">[ ... ]</script>
 */
(function () {
  'use strict';

  var ICONS = {
    lock: '<i class="fas fa-lock" aria-hidden="true"></i>',
    edit: '<i class="fas fa-edit" aria-hidden="true"></i>',
    undo: '<i class="fas fa-rotate-left" aria-hidden="true"></i>',
    trash: '<i class="far fa-trash-alt" aria-hidden="true"></i>'
  };

  var METODOS = {
    serigrafia: { label: 'Serigrafía', desc: 'Ideal para pocos colores y muchas unidades.' },
    sublimacion: { label: 'Sublimación / DTF', desc: 'Ideal para diseños complejos o degradados.' },
    bordado: { label: 'Bordado', desc: 'Terminación premium.' }
  };

  var MAX_PCT = 3;
  var MAX_FILAS = 5;

  // --- Formatting helpers ---
  // Money DISPLAY is delegated to FinancialFormatter (financial-formatting.js)
  // for project consistency. PARSING uses a locale-specific es-AR parser
  // (strip dot thousands, comma -> decimal) which, unlike the money-oriented
  // FinancialFormatter, also handles 3-decimal markups such as "1,255".
  function ff() {
    return (typeof window !== 'undefined' && window.financialFormatter) ? window.financialFormatter : null;
  }
  function parseMoney(str) {
    if (str === 0) return 0;
    if (!str) return 0;
    var n = parseFloat(String(str).replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }
  var parseNum = parseMoney;
  function money(n) {
    var fmt = ff();
    if (fmt) return '$' + fmt.formatForDisplay(n);
    return '$' + n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function fmtQty(n) {
    return n.toLocaleString('es-AR');
  }
  function fmtMarkup(m) {
    return m.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 3 });
  }
  function fmtPct(p) {
    return (p * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%';
  }
  function fmtPlain(n) {
    return n.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  function signPct(p) {
    var v = p * 100;
    var s = v > 0.05 ? '+' : (v < -0.05 ? '−' : '');
    return s + Math.abs(v).toLocaleString('es-AR', { maximumFractionDigits: 1 }) + '%';
  }
  function inputVal(n) {
    return Number.isInteger(n) ? String(n) : String(n).replace('.', ',');
  }
  function ubiLabel(n) {
    return n + ' ' + (n > 1 ? 'ubicaciones' : 'ubicación');
  }
  function metodoRecomendado(val) {
    return (val === '4' || val === 'full') ? 'sublimacion' : 'serigrafia';
  }
  function margenPorMonto(monto) {
    if (monto < 1000000) return 0.40;
    if (monto < 2000000) return 0.38;
    if (monto < 5000000) return 0.35;
    if (monto < 10000000) return 0.32;
    if (monto < 20000000) return 0.30;
    if (monto < 30000000) return 0.28;
    if (monto < 50000000) return 0.27;
    if (monto < 75000000) return 0.26;
    if (monto < 100000000) return 0.255;
    return 0.25;
  }
  function zeros(n) {
    var a = [];
    while (a.length < n) a.push(0);
    return a;
  }

  function PricingEngine(root) {
    this.root = root;
    this.pricingMode = (root.getAttribute('data-pricing-mode') || 'costo').toLowerCase();
    this.isPvpMode = this.pricingMode === 'pvp';
    this.isBulkMode = this.pricingMode === 'bulk';
    this.bulkView = root.getAttribute('data-pricing-view') || 'table';
    this.showLogoCol = root.getAttribute('data-bulk-logo') !== 'false';
    this.showMarkupCol = root.getAttribute('data-bulk-markup') !== 'false';
    this.hasLogo = !this.isPvpMode && !this.isBulkMode && root.getAttribute('data-has-logo') !== 'false';
    this.divisor = parseFloat(root.getAttribute('data-cost-divisor')) || 1.65;
    // 'prorated' -> setup divided across the row quantity (SETUP Prorrateado)
    // 'flat'     -> setup added per unit as-is
    this.setupMode = root.getAttribute('data-setup-mode') || 'flat';

    this.ubicacionesActual = 1;
    this.quotes = this.loadInitialQuotes();

    // Cascade column counts follow the first quote.
    this.nDesc = Math.min(MAX_PCT, Math.max(1, this.quotes[0].descs.length));
    this.nFin = Math.min(MAX_PCT, Math.max(1, this.quotes[0].fins.length));
    this.quotes.forEach(function (q) {
      while (q.descs.length < this.nDesc) q.descs.push(0);
      while (q.fins.length < this.nFin) q.fins.push(0);
    }, this);

    this.cacheDom();
    this.bindEvents();
    this.buildRows();
  }

  PricingEngine.prototype.loadInitialQuotes = function () {
    var defaults = [
      { cantidad: 1500, logoUnit: 500, descs: [0], fins: [0], customMarkup: null, prodCost: null },
      { cantidad: 4000, logoUnit: null, descs: [0], fins: [0], customMarkup: null, prodCost: null },
      { cantidad: 15000, logoUnit: null, descs: [0], fins: [8], customMarkup: null, prodCost: null },
      { cantidad: 60000, logoUnit: null, descs: [0], fins: [0], customMarkup: null, prodCost: null }
    ];
    var cfg = this.root.querySelector('script[data-role="pricing-quotes"]');
    if (!cfg) return defaults;
    try {
      var parsed = JSON.parse(cfg.textContent);
      if (!Array.isArray(parsed) || !parsed.length) return defaults;
      parsed.forEach(function (q) {
        if (!Array.isArray(q.descs) || !q.descs.length) q.descs = [0];
        if (!Array.isArray(q.fins) || !q.fins.length) q.fins = [0];
        if (q.logoUnit === undefined) q.logoUnit = null;
        if (q.customMarkup === undefined) q.customMarkup = null;
        if (q.prodCost === undefined) q.prodCost = null;
        if (q.precioVolumen === undefined) q.precioVolumen = null;
      });
      return parsed;
    } catch (e) {
      return defaults;
    }
  };

  PricingEngine.prototype.cacheDom = function () {
    var r = this.root;
    this.el = {
      head: r.querySelector('[data-role="pricing-head"]'),
      body: r.querySelector('[data-role="pricing-body"]'),
      cards: r.querySelector('[data-role="pricing-cards"]'),
      grid: r.querySelector('[data-role="logo-grid"]'),
      addBtn: r.querySelector('[data-action="add-row"]'),
      colores: r.querySelector('[data-role="colores"]'),
      metodo: r.querySelector('[data-role="metodo"]'),
      metodoDesc: r.querySelector('[data-role="metodo-desc"]'),
      ubicVal: r.querySelector('[data-role="ubic-val"]'),
      costoHint: r.querySelector('[data-role="costo-producto-hint"]')
    };
    var isBulk = r.getAttribute('data-pricing-mode') === 'bulk';
    this.pvpInput = isBulk ? null : document.querySelector('[data-pricing-pvp]');
    this.setupInput = isBulk ? null : document.querySelector('[data-pricing-setup]');
  };

  PricingEngine.prototype.getPvp = function () {
    return this.pvpInput ? parseMoney(this.pvpInput.value) : 0;
  };
  PricingEngine.prototype.getSetup = function () {
    return this.setupInput ? parseMoney(this.setupInput.value) : 0;
  };
  PricingEngine.prototype.autoProd = function () {
    return this.getPvp() / this.divisor;
  };

  PricingEngine.prototype.bindEvents = function () {
    var self = this;
    var r = this.root;

    // Live recompute for text inputs (cantidad, logo, pct, prod, markup).
    r.addEventListener('input', function (e) {
      var t = e.target;
      if (t.matches('.cantidad, .lp-input, .pct, .prod-input, .markup-input, .pvp-vol-input')) {
        self.refresh();
      }
    });

    // Commit / clamp on blur.
    r.addEventListener('focusout', function (e) {
      var t = e.target;
      if (t.matches('.pct')) {
        self.clampPct(t);
      } else if (t.matches('.prod-input')) {
        self.commitProd(+t.getAttribute('data-i'));
      } else if (t.matches('.markup-input')) {
        if (!self.isBulkMode) self.commitMk(+t.getAttribute('data-i'));
      }
    });

    // Enter/space handling on click-to-edit views; Enter blurs inline inputs.
    r.addEventListener('keydown', function (e) {
      var t = e.target;
      var key = e.keyCode || e.which;
      if (t.matches('.prod-view') && (key === 13 || key === 32)) {
        e.preventDefault();
        self.editProd(+t.getAttribute('data-i'));
      } else if (t.matches('.markup-view') && (key === 13 || key === 32)) {
        e.preventDefault();
        self.editMk(+t.getAttribute('data-i'));
      } else if (t.matches('.prod-input, .markup-input') && key === 13) {
        t.blur();
      }
    });

    // Delegated clicks (buttons + click-to-edit views).
    r.addEventListener('click', function (e) {
      var t = e.target.closest('[data-action]');
      if (!t || !r.contains(t)) return;
      var action = t.getAttribute('data-action');
      var i = t.hasAttribute('data-i') ? +t.getAttribute('data-i') : null;
      switch (action) {
        case 'edit-prod': self.editProd(i); break;
        case 'prod-btn': self.prodBtn(i); break;
        case 'edit-mk': self.editMk(i); break;
        case 'mk-btn': self.mkBtn(i); break;
        case 'remove-row': self.removeRow(i); break;
        case 'edit-card':
          r.dispatchEvent(new CustomEvent('pricing-bulk-edit-row', {
            detail: { index: i },
            bubbles: true
          }));
          break;
        case 'add-row': self.addRow(); break;
        case 'add-col': self.addCol(t.getAttribute('data-field')); break;
        case 'remove-col': self.removeCol(t.getAttribute('data-field')); break;
        case 'ubic-dec': self.changeUbicaciones(-1); break;
        case 'ubic-inc': self.changeUbicaciones(1); break;
        default: break;
      }
    });

    if (this.el.colores) {
      this.el.colores.addEventListener('change', function () {
        if (self.el.metodo) self.el.metodo.value = metodoRecomendado(self.el.colores.value);
        self.updateAll();
      });
    }
    if (this.el.metodo) {
      this.el.metodo.addEventListener('change', function () { self.updateAll(); });
    }

    // PVP reconciliation: recompute when the shared PVP field changes and after
    // the price-update refresh button rewrites it (value set programmatically).
    if (this.pvpInput) {
      this.pvpInput.addEventListener('input', function () { self.updateAll(); });
    }
    if (this.setupInput) {
      this.setupInput.addEventListener('input', function () { self.updateAll(); });
    }
    if (!this.isBulkMode) {
      var refreshBtn = document.querySelector('[data-pricing-refresh]');
      if (refreshBtn) {
        refreshBtn.addEventListener('click', function () {
          setTimeout(function () { self.updateAll(); }, 0);
        });
      }
      var saveBtn = document.querySelector('[data-pricing-save]');
      if (saveBtn) {
        saveBtn.addEventListener('click', function () { self.save(saveBtn); });
      }
    }
  };

  // Read what the user typed in the DOM back into the state array.
  PricingEngine.prototype.syncFromDom = function () {
    if (this.isBulkMode) {
      this.syncBulkFromDom();
      return;
    }
    var self = this;
    this.quotes.forEach(function (q, i) {
      var c = self.root.querySelector('.cantidad[data-i="' + i + '"]');
      var l = self.root.querySelector('.lp-input[data-i="' + i + '"]');
      var m = self.root.querySelector('.markup-input[data-i="' + i + '"]');
      var p = self.root.querySelector('.prod-input[data-i="' + i + '"]');
      if (c) q.cantidad = Math.max(0, parseNum(c.value));
      q.descs = self.readPcts(i, 'desc-input', q.descs);
      q.fins = self.readPcts(i, 'fin-input', q.fins);
      if (l) { var raw = l.value.trim(); q.logoUnit = (raw === '') ? null : parseNum(raw); }
      if (m && (q.mkEditing || q.customMarkup !== null)) {
        var v = parseNum(m.value);
        if (v) q.customMarkup = v;
      }
      if (p && (q.prodEditing || q.prodCost !== null)) {
        var pv = parseMoney(p.value);
        if (pv) q.prodCost = pv;
      }
      var vol = self.root.querySelector('.pvp-vol-input[data-i="' + i + '"]');
      if (vol) q.precioVolumen = parseMoney(vol.value);
    });
  };

  PricingEngine.prototype.refresh = function () {
    this.syncFromDom();
    this.updateAll();
  };

  PricingEngine.prototype.flashInvalid = function (el) {
    if (!el) return;
    el.classList.add('flash-invalid');
    setTimeout(function () { el.classList.remove('flash-invalid'); }, 900);
  };

  PricingEngine.prototype.readPcts = function (i, cls, prev) {
    var els = this.root.querySelectorAll('.' + cls + '[data-i="' + i + '"]');
    if (!els.length) return prev;
    return [].map.call(els, function (el) {
      return Math.min(100, Math.max(0, parseNum(el.value)));
    });
  };

  PricingEngine.prototype.clampPct = function (el) {
    var i = +el.getAttribute('data-i');
    var j = +el.getAttribute('data-j');
    var field = el.classList.contains('desc-input') ? 'descs' : 'fins';
    var raw = parseNum(el.value);
    this.syncFromDom();
    var val = this.quotes[i] ? this.quotes[i][field][j] : null;
    if (val !== null && raw !== val) {
      el.value = val;
      this.flashInvalid(el);
    }
    this.updateAll();
  };

  PricingEngine.prototype.addCol = function (field) {
    this.syncFromDom();
    var n = (field === 'descs') ? this.nDesc : this.nFin;
    if (n >= MAX_PCT) return;
    if (field === 'descs') this.nDesc++; else this.nFin++;
    this.quotes.forEach(function (q) { q[field].push(0); });
    this.buildRows();
  };

  PricingEngine.prototype.removeCol = function (field) {
    this.syncFromDom();
    var n = (field === 'descs') ? this.nDesc : this.nFin;
    if (n <= 1) return;
    if (field === 'descs') this.nDesc--; else this.nFin--;
    this.quotes.forEach(function (q) { q[field].pop(); });
    this.buildRows();
  };

  PricingEngine.prototype.headPctThs = function (field, label, shortLabel, n) {
    var h = '';
    for (var j = 0; j < n; j++) {
      var last = j === n - 1;
      h += '<th class="grp-ajustes"><span class="th-flex">' + (j === 0 ? label : shortLabel + ' ' + (j + 1))
        + (last && n > 1 ? '<button type="button" class="pct-x" data-action="remove-col" data-field="' + field + '" title="Quitar esta columna" aria-label="Quitar columna">×</button>' : '')
        + (last && n < MAX_PCT ? '<button type="button" class="pct-add" data-action="add-col" data-field="' + field + '" title="Agregar columna en cascada para todas las cantidades (máx. ' + MAX_PCT + ')" aria-label="Agregar columna">+</button>' : '')
        + '</span></th>';
    }
    return h;
  };

  PricingEngine.prototype.pctTds = function (i, field, cls, effCls) {
    var arr = this.quotes[i][field];
    return arr.map(function (v, j) {
      var last = j === arr.length - 1 && arr.length > 1;
      return '<td class="grp-ajustes"><input class="pct ' + cls + '" type="text" data-i="' + i + '" data-j="' + j + '" value="' + v + '"> %'
        + (last ? '<div class="pct-eff ' + effCls + '"></div>' : '')
        + '</td>';
    }).join('');
  };

  PricingEngine.prototype.buildRows = function () {
    if (this.isBulkMode) {
      this.buildBulkRows();
      return;
    }
    if (this.isPvpMode) {
      this.buildPvpRows();
      return;
    }

    if (this.el.head) {
      this.el.head.innerHTML = '<tr>'
        + '<th rowspan="2">Cantidad</th>'
        + '<th class="grp-costos" colspan="2">Costos</th>'
        + '<th colspan="2">Markup</th>'
        + '<th class="grp-ajustes" colspan="' + (this.nDesc + this.nFin) + '">Ajustes comerciales</th>'
        + '<th class="grp-result" colspan="2">Resultado</th>'
        + '<th rowspan="2"></th>'
        + '</tr><tr>'
        + '<th class="grp-costos">Detalle</th>'
        + '<th class="grp-costos">Total</th>'
        + '<th>Markup</th>'
        + '<th>Precio c/markup</th>'
        + this.headPctThs('descs', 'Desc. adicional', 'Desc.', this.nDesc)
        + this.headPctThs('fins', 'Financiación', 'Fin.', this.nFin)
        + '<th class="grp-result">Unitario</th>'
        + '<th class="grp-result">Subtotal</th>'
        + '</tr>';
    }

    if (this.el.grid) {
      this.el.grid.innerHTML = this.quotes.map(function (q, i) {
        return '<div class="logo-price-item">'
          + '<div class="lp-qty" data-i="' + i + '">—</div>'
          + '<div class="lp-tag" data-i="' + i + '"></div>'
          + '<label class="lp-field-label">Costo por ubicación</label>'
          + '<div class="lp-input-wrap"><span>$</span>'
          + '<input type="text" class="lp-input" data-i="' + i + '" value="' + (q.logoUnit != null ? inputVal(q.logoUnit) : '') + '"></div>'
          + '<div class="lp-formula">'
          + '<div class="lp-formula-row">'
          + '<span class="lp-formula-op" aria-hidden="true">×</span>'
          + '<span class="lp-zones" data-i="' + i + '"></span>'
          + '</div>'
          + '<div class="lp-formula-total">'
          + '<span class="lp-formula-eq" aria-hidden="true">=</span>'
          + '<span class="lp-total" data-i="' + i + '"></span>'
          + '<span class="lp-total-unit">/ unidad</span>'
          + '</div>'
          + '</div>'
          + '</div>';
      }).join('');
    }

    var logoLine = this.hasLogo
      ? '<div class="cost-line"><span class="lock-ico">' + ICONS.lock + '</span><span class="lbl">Logo</span><span class="val logo-cell">$0,00</span></div>'
      : '';
    var setupLabel = (this.setupMode === 'prorated') ? 'Setup prorr.' : 'Setup';

    this.el.body.innerHTML = this.quotes.map(function (q, i) {
      q.prodEditing = false;
      q.mkEditing = false;
      return '<tr data-i="' + i + '">'
        + '<td><input class="cantidad" type="text" data-i="' + i + '" value="' + q.cantidad + '"></td>'
        + '<td class="grp-costos">'
          + '<div class="cost-line prod-line">'
            + '<button type="button" class="prod-edit" data-action="prod-btn" data-i="' + i + '" title="Editar costo del producto" aria-label="Editar costo del producto">' + ICONS.edit + '</button>'
            + '<span class="lbl">Producto</span>'
            + '<span class="val prod-view" data-action="edit-prod" data-i="' + i + '" tabindex="0" role="button" title="Click para editar">$0,00</span>'
            + '<span class="prod-editwrap" data-i="' + i + '" style="display:none">$<input class="prod-input" type="text" data-i="' + i + '"></span>'
          + '</div>'
          + '<div class="prod-diff" data-i="' + i + '" style="display:none"></div>'
          + logoLine
          + '<div class="cost-line"><span class="lock-ico">' + ICONS.lock + '</span><span class="lbl">' + setupLabel + '</span><span class="val setup-cell">$0,00</span></div>'
        + '</td>'
        + '<td class="grp-costos computed total-cell">$0,00</td>'
        + '<td><div class="markup-cell">'
          + '<span class="markup-view" data-action="edit-mk" data-i="' + i + '" tabindex="0" role="button" title="Click para editar">—</span>'
          + '<input class="markup-input" type="text" data-i="' + i + '" style="display:none">'
          + '<button type="button" class="markup-edit" data-action="mk-btn" data-i="' + i + '" title="Editar markup" aria-label="Editar markup">' + ICONS.edit + '</button>'
        + '</div><div class="markup-hint">sugerido</div></td>'
        + '<td class="computed"><div class="pmargen-cell">$0,00</div><div class="pmargen-hint" style="display:none"></div></td>'
        + this.pctTds(i, 'descs', 'desc-input', 'desc-eff')
        + this.pctTds(i, 'fins', 'fin-input', 'fin-eff')
        + '<td class="result unit-cell">$0,00</td>'
        + '<td class="result sub-cell">$0,00</td>'
        + '<td class="trash"><button type="button" class="trash-btn" data-action="remove-row" data-i="' + i + '" title="Eliminar cantidad" aria-label="Eliminar cantidad"' + (this.quotes.length <= 1 ? ' disabled' : '') + '>' + ICONS.trash + '</button></td>'
        + '</tr>';
    }, this).join('');

    if (this.el.addBtn) this.el.addBtn.disabled = this.quotes.length >= MAX_FILAS;
    this.updateAll();
  };

  PricingEngine.prototype.buildPvpRows = function () {
    if (this.el.head) {
      this.el.head.innerHTML = '<tr>'
        + '<th rowspan="2">Cantidad</th>'
        + '<th class="grp-pvp" rowspan="2">Precio x Volumen</th>'
        + '<th class="grp-ajustes" colspan="' + (this.nDesc + this.nFin) + '">Ajustes comerciales</th>'
        + '<th class="grp-result" colspan="2">Resultado</th>'
        + '<th rowspan="2"></th>'
        + '</tr><tr>'
        + this.headPctThs('descs', 'Desc. adicional', 'Desc.', this.nDesc)
        + this.headPctThs('fins', 'Financiación', 'Fin.', this.nFin)
        + '<th class="grp-result">Unitario</th>'
        + '<th class="grp-result">Subtotal</th>'
        + '</tr>';
    }

    this.el.body.innerHTML = this.quotes.map(function (q, i) {
      var volVal = (q.precioVolumen != null && q.precioVolumen !== '') ? fmtPlain(q.precioVolumen) : '';
      return '<tr data-i="' + i + '">'
        + '<td><input class="cantidad" type="text" data-i="' + i + '" value="' + q.cantidad + '"></td>'
        + '<td class="grp-pvp">'
          + '<div class="pvp-vol-wrap"><span>$</span>'
          + '<input class="pvp-vol-input" type="text" inputmode="numeric" data-i="' + i + '" value="' + volVal + '">'
          + '</div>'
        + '</td>'
        + this.pctTds(i, 'descs', 'desc-input', 'desc-eff')
        + this.pctTds(i, 'fins', 'fin-input', 'fin-eff')
        + '<td class="result unit-cell">$0,00</td>'
        + '<td class="result sub-cell">$0,00</td>'
        + '<td class="trash"><button type="button" class="trash-btn" data-action="remove-row" data-i="' + i + '" title="Eliminar cantidad" aria-label="Eliminar cantidad"' + (this.quotes.length <= 1 ? ' disabled' : '') + '>' + ICONS.trash + '</button></td>'
        + '</tr>';
    }, this).join('');

    if (this.el.addBtn) this.el.addBtn.disabled = this.quotes.length >= MAX_FILAS;
    this.updateAll();
  };

  PricingEngine.prototype.buildBulkRows = function () {
    if (this.bulkView === 'cards') {
      this.buildBulkCards();
      return;
    }
    if (this.el.head) {
      this.el.head.innerHTML = '<tr>'
        + '<th rowspan="2">Cantidad</th>'
        + (this.showLogoCol ? '<th class="grp-costos" rowspan="2">Logo x Ubicación</th>' : '')
        + (this.showMarkupCol ? '<th rowspan="2">Markup</th>' : '')
        + '<th class="grp-ajustes" colspan="' + (this.nDesc + this.nFin) + '">Ajustes comerciales</th>'
        + '<th rowspan="2"></th>'
        + '</tr><tr>'
        + this.headPctThs('descs', 'Desc. adicional', 'Desc.', this.nDesc)
        + this.headPctThs('fins', 'Financiación', 'Fin.', this.nFin)
        + '</tr>';
    }

    this.el.body.innerHTML = this.quotes.map(function (q, i) {
      var logoTd = this.showLogoCol
        ? '<td class="grp-costos">'
          + '<div class="lp-bulk-wrap"><span>$</span>'
          + '<input class="lp-input" type="text" inputmode="numeric" data-i="' + i + '" value="'
          + (q.logoUnit != null ? inputVal(q.logoUnit) : '') + '"></div>'
          + '<div class="lp-bulk-hint" data-i="' + i + '"></div>'
          + '</td>'
        : '';
      var markupTd = this.showMarkupCol
        ? '<td>'
          + '<input class="markup-input markup-bulk" type="text" data-i="' + i + '" value="'
          + (q.customMarkup != null ? fmtMarkup(q.customMarkup) : '') + '">'
          + '<div class="markup-hint">sin cambios</div>'
          + '</td>'
        : '';
      return '<tr data-i="' + i + '">'
        + '<td><input class="cantidad" type="text" data-i="' + i + '" value="' + q.cantidad + '"></td>'
        + logoTd
        + markupTd
        + this.pctTds(i, 'descs', 'desc-input', 'desc-eff')
        + this.pctTds(i, 'fins', 'fin-input', 'fin-eff')
        + '<td class="trash"><button type="button" class="trash-btn" data-action="remove-row" data-i="' + i
        + '" title="Eliminar cantidad" aria-label="Eliminar cantidad"'
        + (this.quotes.length <= 1 ? ' disabled' : '') + '>' + ICONS.trash + '</button></td>'
        + '</tr>';
    }, this).join('');

    if (this.el.addBtn) this.el.addBtn.disabled = this.quotes.length >= MAX_FILAS;
    this.updateAll();
  };

  PricingEngine.prototype.updateBulkRows = function () {
    if (this.bulkView === 'cards') {
      this.updateBulkCards();
      return;
    }
    var self = this;
    var base = (this.quotes[0] && this.quotes[0].logoUnit != null) ? this.quotes[0].logoUnit : null;

    this.quotes.forEach(function (q, i) {
      var tr = self.el.body.querySelector('tr[data-i="' + i + '"]');
      if (!tr) return;

      var descFactor = 1, finFactor = 1;
      q.descs.forEach(function (d) { descFactor *= (1 - d / 100); });
      q.fins.forEach(function (f) { finFactor *= (1 + f / 100); });

      var dEff = tr.querySelector('.desc-eff');
      if (dEff) {
        dEff.textContent = 'efect. ' + fmtPct(1 - descFactor);
        dEff.title = q.descs.map(function (d) { return d + '%'; }).join(' + ') + ' en cascada';
      }
      var fEff = tr.querySelector('.fin-eff');
      if (fEff) {
        fEff.textContent = 'efect. ' + fmtPct(finFactor - 1);
        fEff.title = q.fins.map(function (f) { return f + '%'; }).join(' + ') + ' en cascada';
      }

      var inp = tr.querySelector('.lp-input');
      var hint = tr.querySelector('.lp-bulk-hint');
      if (inp) inp.placeholder = (i > 0 && base != null) ? inputVal(base) : '';
      if (hint) {
        if (i === 0) hint.textContent = 'base';
        else hint.textContent = (q.logoUnit == null && base != null) ? 'heredado' : '';
      }
    });
  };

  PricingEngine.prototype.cascadeText = function (arr, kind) {
    if (!arr.length) return '—';
    var isDesc = kind === 'desc';
    var chain = arr.map(function (v) { return v + '%'; }).join(' + ');
    var factor = 1;
    arr.forEach(function (v) { factor *= isDesc ? (1 - v / 100) : (1 + v / 100); });
    var eff = isDesc ? (1 - factor) : (factor - 1);
    return (arr.length > 1) ? (chain + ' (efect. ' + fmtPct(eff) + ')') : chain;
  };

  PricingEngine.prototype.buildBulkCards = function () {
    if (!this.el.cards) return;

    this.el.cards.innerHTML = this.quotes.map(function (q, i) {
      var logoLine = this.showLogoCol
        ? '<div class="fieldLabel">Logo x Ubicación: <span class="fieldValue" data-role="card-logo"></span></div>'
        : '';
      var markupLine = this.showMarkupCol
        ? '<div class="fieldLabel">Markup: <span class="fieldValue" data-role="card-markup"></span></div>'
        : '';
      return '<div class="quantities-card" data-i="' + i + '">'
        + '<div class="fieldLabel">Cantidad: <span class="fieldValue" data-role="card-cantidad"></span></div>'
        + logoLine
        + markupLine
        + '<div class="fieldLabel">Desc.: <span class="fieldValue" data-role="card-desc"></span></div>'
        + '<div class="fieldLabel">Fin.: <span class="fieldValue" data-role="card-fin"></span></div>'
        + '<div class="action-buttons">'
        + '<button type="button" class="edit-btn-mobile" data-action="edit-card" data-i="' + i + '"><span>Editar</span></button>'
        + '<button type="button" class="delete-btn-mobile" data-action="remove-row" data-i="' + i + '"'
        + (this.quotes.length <= 1 ? ' disabled' : '') + '><span>Eliminar</span></button>'
        + '</div>'
        + '</div>';
    }, this).join('');

    if (this.el.addBtn) this.el.addBtn.disabled = this.quotes.length >= MAX_FILAS;
    var btnAgregarCantidades = document.getElementById('btnAgregarCantidades');
    if (btnAgregarCantidades) btnAgregarCantidades.disabled = this.quotes.length >= MAX_FILAS;
    this.updateBulkCards();
  };

  PricingEngine.prototype.updateBulkCards = function () {
    if (!this.el.cards) return;
    var self = this;
    var base = (this.quotes[0] && this.quotes[0].logoUnit != null) ? this.quotes[0].logoUnit : null;

    this.quotes.forEach(function (q, i) {
      var card = self.el.cards.querySelector('.quantities-card[data-i="' + i + '"]');
      if (!card) return;
      var set = function (role, text) {
        var el = card.querySelector('[data-role="' + role + '"]');
        if (el) el.textContent = text;
      };
      set('card-cantidad', fmtQty(q.cantidad));
      if (self.showLogoCol) {
        var logoEff = (q.logoUnit != null) ? q.logoUnit : base;
        set('card-logo', logoEff == null ? 'sin cambios' : (money(logoEff) + (q.logoUnit == null ? ' (heredado)' : '')));
      }
      if (self.showMarkupCol) {
        set('card-markup', q.customMarkup == null ? 'sin cambios' : fmtMarkup(q.customMarkup));
      }
      set('card-desc', self.cascadeText(q.descs, 'desc'));
      set('card-fin', self.cascadeText(q.fins, 'fin'));
    });
  };

  PricingEngine.prototype.growCascades = function (data) {
    var changed = false;
    if (data.descs && data.descs.length > this.nDesc) {
      this.nDesc = Math.min(MAX_PCT, data.descs.length);
      changed = true;
    }
    if (data.fins && data.fins.length > this.nFin) {
      this.nFin = Math.min(MAX_PCT, data.fins.length);
      changed = true;
    }
    if (!changed) return;
    this.quotes.forEach(function (q) {
      while (q.descs.length < this.nDesc) q.descs.push(0);
      while (q.fins.length < this.nFin) q.fins.push(0);
    }, this);
  };

  PricingEngine.prototype.setBulkQuote = function (i, data) {
    var q = this.quotes[i];
    if (!q) return;
    this.growCascades(data);
    if (data.cantidad != null) q.cantidad = Math.max(0, data.cantidad);
    q.logoUnit = (data.logoUnit == null || data.logoUnit === '') ? null : data.logoUnit;
    q.customMarkup = (data.customMarkup == null || data.customMarkup === '') ? null : data.customMarkup;
    if (data.descs) q.descs = data.descs.slice(0, this.nDesc);
    if (data.fins) q.fins = data.fins.slice(0, this.nFin);
    while (q.descs.length < this.nDesc) q.descs.push(0);
    while (q.fins.length < this.nFin) q.fins.push(0);
    this.buildRows();
  };

  PricingEngine.prototype.addBulkQuote = function (data) {
    if (this.quotes.length >= MAX_FILAS) return;
    this.growCascades(data || {});
    this.quotes.push({
      cantidad: (data && data.cantidad) || 0,
      logoUnit: (data && data.logoUnit != null && data.logoUnit !== '') ? data.logoUnit : null,
      customMarkup: (data && data.customMarkup != null && data.customMarkup !== '') ? data.customMarkup : null,
      descs: (data && data.descs) ? data.descs.slice(0, this.nDesc) : zeros(this.nDesc),
      fins: (data && data.fins) ? data.fins.slice(0, this.nFin) : zeros(this.nFin),
      prodCost: null,
      precioVolumen: null
    });
    var last = this.quotes[this.quotes.length - 1];
    while (last.descs.length < this.nDesc) last.descs.push(0);
    while (last.fins.length < this.nFin) last.fins.push(0);
    this.buildRows();
  };

  PricingEngine.prototype.syncBulkFromDom = function () {
    var self = this;
    this.quotes.forEach(function (q, i) {
      var c = self.root.querySelector('.cantidad[data-i="' + i + '"]');
      if (c) q.cantidad = Math.max(0, parseNum(c.value));
      q.descs = self.readPcts(i, 'desc-input', q.descs);
      q.fins = self.readPcts(i, 'fin-input', q.fins);
      var l = self.root.querySelector('.lp-input[data-i="' + i + '"]');
      if (l) {
        var raw = l.value.trim();
        q.logoUnit = (raw === '') ? null : parseMoney(raw);
      }
      var m = self.root.querySelector('.markup-input[data-i="' + i + '"]');
      if (m) {
        var mraw = m.value.trim();
        q.customMarkup = (mraw === '') ? null : parseNum(mraw);
      }
    });
  };

  PricingEngine.prototype.getBulkPayload = function () {
    this.syncFromDom();
    return this.quotes.map(function (q) {
      return {
        cantidad: q.cantidad,
        logoUnit: (q.logoUnit != null) ? q.logoUnit : null,
        customMarkup: (q.customMarkup != null) ? q.customMarkup : null,
        descs: q.descs.slice(),
        fins: q.fins.slice()
      };
    });
  };

  PricingEngine.prototype.setBulkColumns = function (opts) {
    this.syncFromDom();
    this.showLogoCol = (opts && opts.logo) !== false;
    this.showMarkupCol = (opts && opts.markup) !== false;
    this.buildRows();
  };

  PricingEngine.prototype.resetBulkQuotes = function () {
    this.quotes = this.loadInitialQuotes();
    this.nDesc = Math.min(MAX_PCT, Math.max(1, this.quotes[0].descs.length));
    this.nFin = Math.min(MAX_PCT, Math.max(1, this.quotes[0].fins.length));
    this.quotes.forEach(function (q) {
      while (q.descs.length < this.nDesc) q.descs.push(0);
      while (q.fins.length < this.nFin) q.fins.push(0);
    }, this);
    this.buildRows();
  };

  PricingEngine.prototype.addRow = function () {
    if (this.quotes.length >= MAX_FILAS) return;
    this.syncFromDom();
    this.quotes.push({
      cantidad: 1000,
      logoUnit: null,
      fins: zeros(this.nFin),
      descs: zeros(this.nDesc),
      customMarkup: null,
      prodCost: null,
      precioVolumen: this.isPvpMode
        ? ((this.quotes.length && this.quotes[this.quotes.length - 1].precioVolumen) || this.getPvp() || null)
        : null
    });
    this.buildRows();
  };

  PricingEngine.prototype.removeRow = function (i) {
    if (this.quotes.length <= 1) return;
    this.syncFromDom();
    this.quotes.splice(i, 1);
    this.buildRows();
  };

  PricingEngine.prototype.changeUbicaciones = function (delta) {
    this.ubicacionesActual = Math.min(4, Math.max(1, this.ubicacionesActual + delta));
    if (this.el.ubicVal) this.el.ubicVal.textContent = this.ubicacionesActual;
    this.updateAll();
  };

  // --- Product cost: click the value to edit; leaving accepts it. ---
  PricingEngine.prototype.editProd = function (i) {
    if (this.quotes[i].prodEditing) return;
    this.syncFromDom();
    this.quotes[i].prodEditing = true;
    var inp = this.root.querySelector('.prod-input[data-i="' + i + '"]');
    inp.value = fmtPlain(this.quotes[i].prodCost !== null ? this.quotes[i].prodCost : this.autoProd());
    this.updateAll();
    inp.focus();
    inp.select();
  };
  PricingEngine.prototype.commitProd = function (i) {
    var q = this.quotes[i];
    if (!q) return;
    q.prodEditing = false;
    var inp = this.root.querySelector('.prod-input[data-i="' + i + '"]');
    if (!inp) return;
    var raw = inp.value.trim();
    var v = parseMoney(raw);
    q.prodCost = (v > 0 && Math.abs(v - this.autoProd()) > 0.005) ? v : null;
    this.updateAll();
    if (raw !== '' && v <= 0) this.flashInvalid(this.root.querySelector('.prod-view[data-i="' + i + '"]'));
  };
  PricingEngine.prototype.prodBtn = function (i) {
    if (this.quotes[i].prodEditing || this.quotes[i].prodCost !== null) {
      this.quotes[i].prodEditing = false;
      this.quotes[i].prodCost = null;
      this.updateAll();
    } else {
      this.editProd(i);
    }
  };

  // --- Markup: same pattern. ---
  PricingEngine.prototype.editMk = function (i) {
    if (this.quotes[i].mkEditing) return;
    this.syncFromDom();
    this.quotes[i].mkEditing = true;
    var tr = this.el.body.querySelector('tr[data-i="' + i + '"]');
    var inp = tr.querySelector('.markup-input');
    var sug = parseFloat(tr.dataset.sug) || 1.4;
    inp.value = fmtMarkup(this.quotes[i].customMarkup !== null ? this.quotes[i].customMarkup : sug);
    this.updateAll();
    inp.focus();
    inp.select();
  };
  PricingEngine.prototype.commitMk = function (i) {
    var q = this.quotes[i];
    if (!q) return;
    q.mkEditing = false;
    var tr = this.el.body.querySelector('tr[data-i="' + i + '"]');
    if (!tr) return;
    var raw = tr.querySelector('.markup-input').value.trim();
    var v = parseNum(raw);
    var sug = parseFloat(tr.dataset.sug) || 0;
    q.customMarkup = (v > 0 && Math.abs(v - sug) > 0.0005) ? v : null;
    this.updateAll();
    if (raw !== '' && v <= 0) this.flashInvalid(tr.querySelector('.markup-view'));
  };
  PricingEngine.prototype.mkBtn = function (i) {
    if (this.quotes[i].mkEditing || this.quotes[i].customMarkup !== null) {
      this.quotes[i].mkEditing = false;
      this.quotes[i].customMarkup = null;
      this.updateAll();
    } else {
      this.editMk(i);
    }
  };

  PricingEngine.prototype.updatePvpRows = function () {
    var self = this;
    var fallbackPvp = this.getPvp();

    this.quotes.forEach(function (q, i) {
      var tr = self.el.body.querySelector('tr[data-i="' + i + '"]');
      if (!tr) return;

      var descFactor = 1, finFactor = 1;
      q.descs.forEach(function (d) { descFactor *= (1 - d / 100); });
      q.fins.forEach(function (f) { finFactor *= (1 + f / 100); });

      var precioVol = (q.precioVolumen != null && q.precioVolumen !== '')
        ? q.precioVolumen
        : fallbackPvp;
      var unitario = precioVol * descFactor * finFactor;
      var subtotal = unitario * q.cantidad;

      var dEff = tr.querySelector('.desc-eff');
      if (dEff) {
        dEff.textContent = 'efect. ' + fmtPct(1 - descFactor);
        dEff.title = q.descs.map(function (d) { return d + '%'; }).join(' + ') + ' en cascada';
      }
      var fEff = tr.querySelector('.fin-eff');
      if (fEff) {
        fEff.textContent = 'efect. ' + fmtPct(finFactor - 1);
        fEff.title = q.fins.map(function (f) { return f + '%'; }).join(' + ') + ' en cascada';
      }

      tr.querySelector('.unit-cell').textContent = money(unitario);
      tr.querySelector('.sub-cell').textContent = money(subtotal);
    });
  };

  PricingEngine.prototype.updateAll = function () {
    if (this.isBulkMode) {
      this.updateBulkRows();
      return;
    }
    if (this.isPvpMode) {
      this.updatePvpRows();
      return;
    }

    var self = this;
    var costoProducto = this.autoProd();
    if (this.el.costoHint) {
      var pvp = this.getPvp();
      var showHint = this.divisor !== 1 && pvp > 0;
      this.el.costoHint.hidden = !showHint;
      this.el.costoHint.innerHTML = showHint
        ? ('<span class="lock-ico">' + ICONS.lock + '</span>'
          + '<span class="pe-cost-hint-copy">'
          + '<span class="pe-cost-hint-label">Costo de producto</span>'
          + '<span class="pe-cost-hint-formula">PVP ' + money(pvp) + ' ÷ ' + inputVal(this.divisor) + '</span>'
          + '</span>'
          + '<span class="pe-cost-hint-amount">' + money(costoProducto) + '</span>')
        : '';
    }

    var ubic = this.hasLogo ? this.ubicacionesActual : 0;
    if (this.hasLogo && this.el.metodo && this.el.metodoDesc) {
      var metodo = METODOS[this.el.metodo.value];
      if (metodo) this.el.metodoDesc.textContent = metodo.desc + ' (referencia, no afecta el precio)';
    }

    var setupTotal = this.getSetup();
    var baseLogo = (this.hasLogo && this.quotes[0] && this.quotes[0].logoUnit != null) ? this.quotes[0].logoUnit : 0;

    this.quotes.forEach(function (q, i) {
      var heredado = (i > 0 && q.logoUnit == null);
      var logoUnitEff = self.hasLogo ? ((q.logoUnit != null) ? q.logoUnit : baseLogo) : 0;
      var costoLogo = logoUnitEff * ubic;

      if (self.hasLogo && self.el.grid) {
        var itemEl = self.el.grid.querySelectorAll('.logo-price-item')[i];
        var lblEl = self.el.grid.querySelector('.lp-qty[data-i="' + i + '"]');
        var tagEl = self.el.grid.querySelector('.lp-tag[data-i="' + i + '"]');
        var inpEl = self.el.grid.querySelector('.lp-input[data-i="' + i + '"]');
        var zonesEl = self.el.grid.querySelector('.lp-zones[data-i="' + i + '"]');
        var totalEl = self.el.grid.querySelector('.lp-total[data-i="' + i + '"]');
        if (itemEl) itemEl.classList.toggle('is-inherited', heredado);
        if (lblEl) lblEl.textContent = 'Cantidad ' + fmtQty(q.cantidad) + ' u';
        if (tagEl) {
          if (i === 0) { tagEl.textContent = 'Precio base'; tagEl.className = 'lp-tag base'; }
          else if (heredado) { tagEl.textContent = 'Heredado del base'; tagEl.className = 'lp-tag'; }
          else { tagEl.textContent = 'Personalizado'; tagEl.className = 'lp-tag custom'; }
        }
        if (inpEl) inpEl.placeholder = (i > 0) ? inputVal(baseLogo) : '';
        if (zonesEl) zonesEl.textContent = ubiLabel(ubic);
        if (totalEl) totalEl.textContent = money(costoLogo);
      }

      var tr = self.el.body.querySelector('tr[data-i="' + i + '"]');
      if (!tr) return;

      var cantidad = q.cantidad;
      var descFactor = 1, finFactor = 1;
      q.descs.forEach(function (d) { descFactor *= (1 - d / 100); });
      q.fins.forEach(function (f) { finFactor *= (1 + f / 100); });

      var prodCustom = q.prodCost !== null;
      var prodEditing = !!q.prodEditing;
      var prodEff = prodCustom ? (q.prodCost || costoProducto) : costoProducto;
      var pView = tr.querySelector('.prod-view');
      var pWrap = tr.querySelector('.prod-editwrap');
      var pEdit = tr.querySelector('.prod-edit');
      var pDiff = tr.querySelector('.prod-diff');
      if (prodEditing) {
        pView.style.display = 'none';
        pWrap.style.display = '';
        pEdit.innerHTML = ICONS.undo;
        pEdit.title = 'Volver al costo automático';
      } else {
        pView.style.display = '';
        pWrap.style.display = 'none';
        pView.textContent = money(prodEff);
        pView.className = 'val prod-view' + (prodCustom ? ' custom' : '');
        pEdit.innerHTML = prodCustom ? ICONS.undo : ICONS.edit;
        pEdit.title = prodCustom ? 'Volver al costo automático' : 'Editar costo del producto';
      }
      pEdit.setAttribute('aria-label', pEdit.title);
      if (prodCustom || prodEditing) {
        var diff = costoProducto > 0 ? (prodEff / costoProducto - 1) : 0;
        pDiff.textContent = 'Original ' + money(costoProducto) + ' (' + signPct(diff) + ')';
        pDiff.style.display = '';
      } else {
        pDiff.textContent = '';
        pDiff.style.display = 'none';
      }

      var setupUnit = (self.setupMode === 'prorated')
        ? (cantidad > 0 ? setupTotal / cantidad : 0)
        : setupTotal;
      var costoTotal = prodEff + costoLogo + setupUnit;
      var montoOperacion = costoTotal * cantidad;
      var sugMarkup = 1 + margenPorMonto(montoOperacion);
      tr.dataset.sug = sugMarkup;

      var mkView = tr.querySelector('.markup-view');
      var mkInp = tr.querySelector('.markup-input');
      var mkBtnEl = tr.querySelector('.markup-edit');
      var custom = q.customMarkup !== null;
      var mkEditing = !!q.mkEditing;
      var markup = custom ? (q.customMarkup || sugMarkup) : sugMarkup;
      if (mkEditing) {
        mkView.style.display = 'none';
        mkInp.style.display = '';
        mkBtnEl.innerHTML = ICONS.undo;
        mkBtnEl.title = 'Volver al markup sugerido';
      } else {
        mkView.style.display = '';
        mkInp.style.display = 'none';
        mkView.textContent = fmtMarkup(markup);
        mkView.className = 'markup-view' + (custom ? ' custom' : '');
        mkBtnEl.innerHTML = custom ? ICONS.undo : ICONS.edit;
        mkBtnEl.title = custom ? 'Volver al markup sugerido' : 'Editar markup';
      }
      mkBtnEl.setAttribute('aria-label', mkBtnEl.title);

      var descAuto = custom ? (1 - markup / sugMarkup) : 0;
      var precioConMarkup = costoTotal * markup;
      var unitario = precioConMarkup * descFactor * finFactor;
      var subtotal = unitario * cantidad;

      var dEff = tr.querySelector('.desc-eff');
      if (dEff) {
        dEff.textContent = 'efect. ' + fmtPct(1 - descFactor);
        dEff.title = q.descs.map(function (d) { return d + '%'; }).join(' + ') + ' en cascada';
      }
      var fEff = tr.querySelector('.fin-eff');
      if (fEff) {
        fEff.textContent = 'efect. ' + fmtPct(finFactor - 1);
        fEff.title = q.fins.map(function (f) { return f + '%'; }).join(' + ') + ' en cascada';
      }

      var logoCell = tr.querySelector('.logo-cell');
      if (logoCell) logoCell.textContent = money(costoLogo);
      tr.querySelector('.setup-cell').textContent = money(setupUnit);
      tr.querySelector('.total-cell').textContent = money(costoTotal);
      tr.querySelector('.markup-hint').textContent = (custom || mkEditing) ? ('sugerido ' + fmtMarkup(sugMarkup)) : 'sugerido';

      var pmHint = tr.querySelector('.pmargen-hint');
      if (custom && Math.abs(descAuto) >= 0.0005) {
        if (descAuto > 0) {
          pmHint.textContent = '−' + fmtPct(descAuto);
          pmHint.className = 'pmargen-hint';
          pmHint.title = 'Descuento equivalente frente al markup sugerido (' + fmtMarkup(sugMarkup) + ')';
        } else {
          pmHint.textContent = '+' + fmtPct(-descAuto);
          pmHint.className = 'pmargen-hint recargo';
          pmHint.title = 'Recargo frente al markup sugerido (' + fmtMarkup(sugMarkup) + ')';
        }
        pmHint.style.display = '';
      } else {
        pmHint.textContent = '';
        pmHint.style.display = 'none';
      }

      tr.querySelector('.pmargen-cell').textContent = money(precioConMarkup);
      tr.querySelector('.unit-cell').textContent = money(unitario);
      tr.querySelector('.sub-cell').textContent = money(subtotal);
    });
  };

  // Demo only: brief visual confirmation. Real persistence is the dev team's job.
  PricingEngine.prototype.save = function (btn) {
    if (!btn) return;
    btn.classList.add('pedido-generated-btn');
    setTimeout(function () { btn.classList.remove('pedido-generated-btn'); }, 1600);
  };

  function init() {
    var roots = document.querySelectorAll('[data-pricing-engine]');
    for (var i = 0; i < roots.length; i++) {
      if (roots[i].__pricingEngine) continue;
      roots[i].__pricingEngine = new PricingEngine(roots[i]);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
