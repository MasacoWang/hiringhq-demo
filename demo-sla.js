(() => {
  'use strict';
  const table = document.querySelector('#req #tbody')?.closest('table');
  if (!table) throw new Error('The demo SLA requisition table is missing');
  table.id = 'reqSlaTable';
  const headers = Array.from(table.querySelectorAll('thead th'));
  const state = {col:-1, dir:1};
  const numeric = new Set([0,1,3,4,5,6,7,8,9,10]);
  const priorityRank = {high:3,medium:2,low:1,clear:0};
  function getKey(row, index) {
    const text = (row.cells[index]?.textContent || '').trim();
    if (index === 0) return priorityRank[text.toLowerCase()] ?? -1;
    // Demo requisitions use a synthetic prefix; the source's parseInt would make every ID zero.
    if (index === 1) return Number((row.dataset.reqid || text).match(/\d+$/)?.[0] || 0);
    if (index === 3) return Number(text.match(/(\d+)\s*d/i)?.[1] ?? -1);
    if (numeric.has(index)) return parseInt(text,10) || 0;
    return text.toLowerCase();
  }
  function renderHeader(header, index) {
    const active = state.col === index;
    const arrow = document.createElement('span');
    arrow.className = 'sort-arrow' + (active ? ' active' : '');
    arrow.textContent = active ? (state.dir === 1 ? '\u25b2' : '\u25bc') : '\u21c5';
    arrow.setAttribute('aria-hidden','true');
    header.innerHTML = header.dataset.baseHtml;
    header.append(' ',arrow);
    header.setAttribute('aria-sort',active ? (state.dir === 1 ? 'ascending' : 'descending') : 'none');
  }
  function sort(index) {
    if (state.col === index) state.dir *= -1;
    else { state.col = index; state.dir = numeric.has(index) ? -1 : 1; }
    headers.forEach(renderHeader);
    const tbody = table.tBodies[0];
    const rows = Array.from(tbody.rows);
    rows.sort((a,b) => {
      const left = getKey(a,index), right = getKey(b,index);
      return (left < right ? -1 : left > right ? 1 : 0) * state.dir;
    });
    // Move existing rows so tile filters and synthetic link handlers are retained.
    rows.forEach(row => tbody.appendChild(row));
  }
  headers.forEach((header,index) => {
    header.classList.add('sortable');
    header.title = 'Click to sort';
    header.dataset.baseHtml = header.innerHTML;
    header.tabIndex = 0;
    renderHeader(header,index);
    header.addEventListener('click',() => sort(index));
    header.addEventListener('keydown',event => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        sort(index);
      }
    });
  });
})();
