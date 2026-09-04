/**
 * Cargar cantidades en bloque (v6).
 *
 * Resuelve a qué ítems apunta el modal / offcanvas, adapta las columnas del
 * motor de precios a lo que esos ítems soportan, escribe el contexto y aplica
 * el resultado. El motor no sabe nada de modales: sólo expone getBulkPayload().
 *
 * Los ítems genéricos con precio de venta (generico-pvp) no tienen logo,
 * así que esa columna se oculta cuando todos los destinos son de ese tipo
 * y se avisa cuando la selección es mixta.
 */
(function () {
  'use strict';

  var lastPayload = null;

  function engineIn(container) {
    if (!container) return null;
    var root = container.querySelector('[data-pricing-engine]');
    return root ? root.__pricingEngine : null;
  }

  function allItems() {
    return [].slice.call(document.querySelectorAll('tr.item-container'));
  }

  function selectedItems() {
    if (window.cotizacionSelection) return window.cotizacionSelection.getSelectedRows();
    return allItems().filter(function (row) {
      var cb = row.querySelector('.item-row-checkbox');
      return cb && cb.checked;
    });
  }

  // Un ítem "sin costos" es el genérico cargado por PVP: no tiene logo.
  function isPvpItem(row) {
    return row.classList.contains('generico-pvp');
  }

  var state = { targets: [], global: false };

  function isGlobalTrigger(trigger) {
    return Boolean(trigger && (trigger.id === 'btnCotizarRapido' || trigger.id === 'btnCotizarRapidoMobile'));
  }

  function resolveTargets(trigger) {
    state.global = isGlobalTrigger(trigger);
    state.targets = state.global ? allItems() : selectedItems();
    return state.targets;
  }

  function writeContext(containerId) {
    var box = document.getElementById(containerId);
    if (!box) return;
    box.classList.toggle('context-global', state.global);
    var strong = box.querySelector('strong');
    if (!strong) return;

    if (state.global) {
      strong.textContent = 'todos los productos de la cotización';
    } else {
      var n = state.targets.length;
      strong.textContent = (n === 1) ? '1 ítem seleccionado' : (n + ' ítems seleccionados');
    }

    var note = box.querySelector('.selection-context-note');
    var skipped = state.targets.filter(isPvpItem).length;
    var mixed = skipped > 0 && skipped < state.targets.length;
    if (mixed) {
      if (!note) {
        note = document.createElement('span');
        note.className = 'selection-context-note ms-2';
        box.querySelector('.selection-context-text').appendChild(note);
      }
      note.textContent = ' Logo no aplica a ' + skipped
        + (skipped === 1 ? ' ítem sin costos.' : ' ítems sin costos.');
    } else if (note) {
      note.remove();
    }
  }

  function applyColumns(engine) {
    if (!engine) return;
    var withCosts = state.targets.filter(function (row) { return !isPvpItem(row); }).length;
    var show = state.targets.length === 0 || withCosts > 0;
    engine.setBulkColumns({ logo: show });
  }

  function prepare(container, contextId, trigger) {
    resolveTargets(trigger);
    var engine = engineIn(container);
    if (engine) {
      engine.resetBulkQuotes();
      applyColumns(engine);
    }
    writeContext(contextId);
  }

  function flashTargets() {
    state.targets.forEach(function (row) {
      row.classList.remove('row-bulk-applied');
      // Reflow para poder reiniciar la animación en aplicaciones consecutivas.
      void row.offsetWidth;
      row.classList.add('row-bulk-applied');
      setTimeout(function () { row.classList.remove('row-bulk-applied'); }, 1300);
    });
  }

  function apply(container, hide) {
    var engine = engineIn(container);
    if (!engine) return;
    lastPayload = { rows: engine.getBulkPayload(), targets: state.targets.map(function (r) { return r.id; }) };
    hide();
    flashTargets();
  }

  // --- Panel anidado (mobile): agrega y edita una cantidad -------------------

  var nested = { index: null, engine: null };

  function pctRows(groupId) {
    var group = document.getElementById(groupId);
    return group ? [].slice.call(group.querySelectorAll('.pct-row input')) : [];
  }

  function renderPctRows(groupId, values) {
    var group = document.getElementById(groupId);
    if (!group) return;
    var host = group.querySelector('.pct-rows');
    host.innerHTML = values.map(function (v, j) {
      return '<div class="pct-row mt-2">'
        + '<input type="number" class="form-control" inputmode="numeric" value="' + v + '">'
        + '<span class="input-group-text">%</span>'
        + (j > 0 ? '<button type="button" class="pct-remove" data-j="' + j + '" aria-label="Quitar">×</button>' : '')
        + '</div>';
    }).join('');
    host.querySelectorAll('.pct-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var vals = pctRows(groupId).map(function (i) { return Number(i.value) || 0; });
        var group = document.getElementById(groupId);
        var field = group ? group.getAttribute('data-field') : null;
        var n = 0;
        if (nested.engine && field) n = (field === 'descs') ? nested.engine.nDesc : nested.engine.nFin;
        if (nested.engine && field && vals.length <= n && vals.length > 1) {
          if (nested.index != null) {
            nested.engine.setBulkQuote(nested.index, {
              cantidad: Number(document.getElementById('nestedCantidad').value) || 0,
              logoUnit: parseField(document.getElementById('nestedLogo').value),
              descs: readPct('nestedDescGroup'),
              fins: readPct('nestedFinGroup')
            });
          }
          nested.engine.removeCol(field);
          var payload = nested.engine.getBulkPayload();
          var q = (nested.index != null) ? payload[nested.index] : payload[0];
          renderPctRows('nestedDescGroup', q.descs);
          renderPctRows('nestedFinGroup', q.fins);
          return;
        }
        vals.splice(Number(btn.getAttribute('data-j')), 1);
        renderPctRows(groupId, vals);
      });
    });
  }

  function readPct(groupId) {
    var vals = pctRows(groupId).map(function (i) {
      return Math.min(100, Math.max(0, Number(i.value) || 0));
    });
    return vals.length ? vals : [0];
  }

  function parseField(value) {
    var raw = String(value || '').trim();
    if (raw === '') return 0;
    var n = parseFloat(raw.replace(/\./g, '').replace(',', '.'));
    return isNaN(n) ? 0 : n;
  }

  function openNested(engine, index) {
    if (!engine) return;
    if (index == null && engine.getBulkPayload().length >= 5) return;
    nested.engine = engine;
    nested.index = index;

    var quotes = engine.getBulkPayload();
    var q = (index == null) ? null : quotes[index];

    document.getElementById('nestedSidebarTitle').textContent = (index == null) ? 'Agregar cantidades' : 'Editar cantidad';
    document.getElementById('btnAgregarCantidadNested').textContent = (index == null) ? 'Agregar' : 'Guardar';
    document.getElementById('nestedCantidad').value = q ? q.cantidad : '';
    document.getElementById('nestedLogo').value = (q && q.logoUnit) ? q.logoUnit : '';
    renderPctRows('nestedDescGroup', q ? q.descs : [0]);
    renderPctRows('nestedFinGroup', q ? q.fins : [0]);

    document.getElementById('nestedLogoField').hidden = !engine.showLogoCol;

    document.getElementById('nestedSidebar').classList.add('show');
    var footer = document.querySelector('#sidebarMasElementos .offcanvas-footer');
    if (footer) footer.style.display = 'none';
  }

  function closeNested() {
    document.getElementById('nestedSidebar').classList.remove('show');
    var footer = document.querySelector('#sidebarMasElementos .offcanvas-footer');
    if (footer) footer.style.display = '';
  }

  function commitNested() {
    if (!nested.engine) return;
    var data = {
      cantidad: Number(document.getElementById('nestedCantidad').value) || 0,
      logoUnit: parseField(document.getElementById('nestedLogo').value),
      descs: readPct('nestedDescGroup'),
      fins: readPct('nestedFinGroup')
    };
    if (nested.index == null) {
      if (nested.engine.getBulkPayload().length >= 5) return;
      nested.engine.addBulkQuote(data);
    } else {
      nested.engine.setBulkQuote(nested.index, data);
    }
    closeNested();
  }

  document.addEventListener('DOMContentLoaded', function () {
    var modal = document.getElementById('modalMasElementos');
    var sidebar = document.getElementById('sidebarMasElementos');

    if (modal) {
      modal.addEventListener('show.bs.modal', function (e) {
        prepare(modal, 'modalMasElementosContext', e.relatedTarget);
      });
      var saveDesktop = document.getElementById('bulkGuardarDesktop');
      if (saveDesktop) {
        saveDesktop.addEventListener('click', function () {
          apply(modal, function () {
            if (window.bootstrap) bootstrap.Modal.getOrCreateInstance(modal).hide();
          });
        });
      }
    }

    if (sidebar) {
      sidebar.addEventListener('show.bs.offcanvas', function (e) {
        prepare(sidebar, 'sidebarMasElementosContext', e.relatedTarget);
      });
      sidebar.addEventListener('hidden.bs.offcanvas', closeNested);
      sidebar.addEventListener('pricing-bulk-edit-row', function (e) {
        openNested(engineIn(sidebar), e.detail.index);
      });

      var btnAgregar = document.getElementById('btnAgregarCantidades');
      if (btnAgregar) {
        btnAgregar.addEventListener('click', function () { openNested(engineIn(sidebar), null); });
      }
      var btnBack = document.getElementById('btnBackNestedSidebar');
      if (btnBack) btnBack.addEventListener('click', closeNested);
      var btnCommit = document.getElementById('btnAgregarCantidadNested');
      if (btnCommit) btnCommit.addEventListener('click', commitNested);

      ['nestedAddDesc', 'nestedAddFin'].forEach(function (id) {
        var btn = document.getElementById(id);
        if (!btn) return;
        var groupId = (id === 'nestedAddDesc') ? 'nestedDescGroup' : 'nestedFinGroup';
        btn.addEventListener('click', function () {
          var vals = pctRows(groupId).map(function (i) { return Number(i.value) || 0; });
          if (vals.length >= 3) return;
          vals.push(0);
          renderPctRows(groupId, vals);
        });
      });

      var saveMobile = document.getElementById('bulkGuardarMobile');
      if (saveMobile) {
        saveMobile.addEventListener('click', function () {
          apply(sidebar, function () {
            if (window.bootstrap) bootstrap.Offcanvas.getOrCreateInstance(sidebar).hide();
          });
        });
      }
    }
  });

  window.bulkCantidades = {
    getLastPayload: function () { return lastPayload; },
    getTargets: function () { return state.targets; }
  };
})();
