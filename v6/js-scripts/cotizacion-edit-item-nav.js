(function () {
  var DEFAULT_CHAIN = [
    { page: 'editItem.html' },
    { page: 'editItem.html' },
    { page: 'editItem-generico.html' }
  ];

  function loadChainFromStorage() {
    try {
      var raw = localStorage.getItem('cotizacionEditNavChain');
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed) || parsed.length === 0) return null;
      var ok = parsed.every(function (entry) {
        return entry && typeof entry.page === 'string' && /^editItem(-generico)?\.html$/.test(entry.page);
      });
      return ok ? parsed : null;
    } catch (e) {
      return null;
    }
  }

  var CHAIN = loadChainFromStorage() || DEFAULT_CHAIN;

  function hrefForIndex(i) {
    if (i < 0 || i >= CHAIN.length) return null;
    return CHAIN[i].page + '?orden=' + (i + 1);
  }

  var prevBtn = document.getElementById('save&prevItemCotization');
  var nextBtn = document.getElementById('save&nextItemCotization');
  if (!prevBtn || !nextBtn) return;

  var params = new URLSearchParams(window.location.search);
  var orden = parseInt(params.get('orden'), 10);
  if (!orden || orden < 1) orden = 1;
  if (orden > CHAIN.length) orden = CHAIN.length;

  function refreshNavState() {
    var idx = orden - 1;
    prevBtn.disabled = idx <= 0;
    nextBtn.disabled = idx >= CHAIN.length - 1;
  }

  prevBtn.addEventListener('click', function () {
    if (prevBtn.disabled) return;
    var target = hrefForIndex(orden - 2);
    if (target) window.location.href = target;
  });

  nextBtn.addEventListener('click', function () {
    if (nextBtn.disabled) return;
    var target = hrefForIndex(orden);
    if (target) window.location.href = target;
  });

  refreshNavState();
})();
