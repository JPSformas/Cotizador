/**
 * Cargar cantidades en bloque (v6).
 *
 * Resuelve a qué ítems apunta el modal / offcanvas, adapta las columnas del
 * motor de precios a lo que esos ítems soportan, escribe el contexto y aplica
 * el resultado. El motor no sabe nada de modales: sólo expone getBulkPayload().
 *
 * Los ítems genéricos con precio de venta (generico-pvp) no tienen logo ni
 * markup, así que esas dos columnas se ocultan cuando todos los destinos son
 * de ese tipo y se avisa cuando la selección es mixta.
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

  // Un ítem "sin costos" es el genérico cargado por PVP: no tiene logo ni markup.
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
      note.textContent = ' Logo y Markup no aplican a ' + skipped
        + (skipped === 1 ? ' ítem sin costos.' : ' ítems sin costos.');
    } else if (note) {
      note.remove();
    }
  }

  function applyColumns(engine) {
    if (!engine) return;
    var withCosts = state.targets.filter(function (row) { return !isPvpItem(row); }).length;
    var show = state.targets.length === 0 || withCosts > 0;
    engine.setBulkColumns({ logo: show, markup: show });
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

  document.addEventListener('DOMContentLoaded', function () {
    var modal = document.getElementById('modalMasElementos');

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
  });

  window.bulkCantidades = {
    getLastPayload: function () { return lastPayload; },
    getTargets: function () { return state.targets; }
  };
})();
