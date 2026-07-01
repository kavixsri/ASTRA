window.SolarFlareApp = window.SolarFlareApp || {};

(function () {
  'use strict';

  // ── State ──────────────────────────────────────────────────────────
  let allFlares = [];
  let sortColumn = 'peakTime';
  let sortAscending = false;

  // DOM refs — populated inside init()
  let searchInput, filterSelect, countSpan, tbody;

  // Column index → property name (matches <th> order in HTML)
  const COLUMN_PROPS = [
    'id',           // 0 – ID
    'peakTime',     // 1 – Date/Time
    'goesClass',    // 2 – GOES Class
    'peakSxrFlux',  // 3 – Peak SXR
    'peakHxrFlux',  // 4 – Peak HXR
    'duration',     // 5 – Duration
    'riseTime',     // 6 – Rise
    'decayTime',    // 7 – Decay
    'sxrHxrRatio',  // 8 – SXR/HXR Ratio
    'instrument'    // 9 – Source
  ];

  // ── Helpers ────────────────────────────────────────────────────────
  function formatDateTime(ms) {
    const d = new Date(ms);
    return d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC';
  }

  function goesClassOrder(cls) {
    return { B: 0, C: 1, M: 2, X: 3 }[cls] ?? -1;
  }

  function compare(a, b, prop) {
    let va = a[prop];
    let vb = b[prop];
    if (prop === 'goesClass') {
      va = goesClassOrder(va);
      vb = goesClassOrder(vb);
    }
    if (typeof va === 'string' && typeof vb === 'string') return va.localeCompare(vb);
    return (va ?? 0) - (vb ?? 0);
  }

  // ── Render ─────────────────────────────────────────────────────────
  function renderRows(list) {
    if (!tbody) return;
    tbody.innerHTML = '';
    list.forEach(f => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${f.id}</td>
        <td>${formatDateTime(f.peakTime)}</td>
        <td><span class="flare-badge flare-${f.goesClass}">${f.goesClass}${f.goesSubclass}</span></td>
        <td>${f.peakSxrFlux.toExponential(2)}</td>
        <td>${f.peakHxrFlux.toFixed(1)}</td>
        <td>${(f.duration / 60).toFixed(1)}</td>
        <td>${(f.riseTime / 60).toFixed(1)}</td>
        <td>${(f.decayTime / 60).toFixed(1)}</td>
        <td>${f.sxrHxrRatio.toExponential(2)}</td>
        <td>${f.instrument}</td>`;
      tbody.appendChild(tr);
    });
  }

  // ── Filter + Sort ──────────────────────────────────────────────────
  function applyFilter() {
    if (!searchInput || !filterSelect || !countSpan) return;

    const query = searchInput.value.trim().toLowerCase();
    const cls = filterSelect.value; // 'all' (lowercase!) or 'B','C','M','X'

    let filtered = allFlares;

    // BUG FIX: check for lowercase 'all' to match the HTML <option value="all">
    if (cls !== 'all') {
      filtered = filtered.filter(f => f.goesClass === cls);
    }

    if (query) {
      filtered = filtered.filter(f => {
        const haystack = [
          f.id,
          f.goesClass,
          f.instrument,
          formatDateTime(f.peakTime)
        ].join(' ').toLowerCase();
        return haystack.includes(query);
      });
    }

    // Sort
    filtered = filtered.slice().sort((a, b) => {
      const cmp = compare(a, b, sortColumn);
      return sortAscending ? cmp : -cmp;
    });

    renderRows(filtered);
    countSpan.textContent = `Total: ${filtered.length} flares`;
  }

  // ── Header click sorting ───────────────────────────────────────────
  function attachSortHandlers() {
    const table = document.getElementById('catalog-table');
    if (!table) return;
    const headers = table.querySelectorAll('thead th');
    headers.forEach((th, idx) => {
      if (idx >= COLUMN_PROPS.length) return;
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const prop = COLUMN_PROPS[idx];
        if (sortColumn === prop) {
          sortAscending = !sortAscending;
        } else {
          sortColumn = prop;
          sortAscending = true;
        }
        // Update visual indicator
        headers.forEach(h => { h.textContent = h.textContent.replace(/ [▲▼]$/, ''); });
        th.textContent += sortAscending ? ' ▲' : ' ▼';
        applyFilter();
      });
    });
  }

  // ── Public API ─────────────────────────────────────────────────────
  function init() {
    searchInput = document.getElementById('catalog-search');
    filterSelect = document.getElementById('catalog-filter');
    countSpan = document.getElementById('catalog-count');
    tbody = document.getElementById('catalog-tbody');

    if (searchInput) searchInput.addEventListener('input', applyFilter);
    if (filterSelect) filterSelect.addEventListener('change', applyFilter);

    attachSortHandlers();
  }

  function update(flareEvents) {
    allFlares = flareEvents || [];
    applyFilter();
  }

  // ── Export ─────────────────────────────────────────────────────────
  window.SolarFlareApp.Catalog = { init, update };
})();
