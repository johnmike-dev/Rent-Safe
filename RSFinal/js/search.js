/* Navbar search: dropdown results + live filtering of the records shown on the current page */
(function () {
  const inp = document.getElementById('sx'); if (!inp) return;
  const box = inp.closest('.sx'), drop = box.querySelector('.sx__d'), clr = box.querySelector('.sx__c'), page = document.getElementById('page');
  const role = document.body.dataset.role, here = location.pathname.split('/').pop();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toks = q => q.toLowerCase().split(/\s+/).filter(Boolean);
  // Highlight matched words (escape first-class: split on raw text, then escape each piece)
  const mark = (s, t) => { if (!t.length) return esc(s);
    const re = new RegExp('(' + t.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|') + ')', 'ig');
    return s.split(re).map((p, i) => i % 2 ? '<mark>' + esc(p) + '</mark>' : esc(p)).join(''); };
  let items = [], active = -1;

  // 1) Dropdown results (data search)
  function results(q) {
    const t = toks(q); if (!t.length) return [];
    const pages = NAV[role].filter(n => n[0] !== 'logout' && t.every(w => n[1].toLowerCase().includes(w))).map(n => ({ g: 'Pages', title: n[1], sub: 'Go to this page', href: n[0], q: '' }));
    return App.index().filter(x => t.every(w => x.hay.includes(w))).concat(pages);
  }
  function show(q) {
    const t = toks(q); items = results(q); active = -1;
    if (!t.length) { drop.hidden = true; return; }
    const groups = {}; items.forEach(x => (groups[x.g] = groups[x.g] || []).push(x));
    let html = '', i = 0, shown = [];
    Object.keys(groups).forEach(g => { html += `<div class="sx__g">${g}</div>`;
      groups[g].slice(0, 4).forEach(x => { shown.push(x); html += `<a class="sx__r" role="option" href="#" data-i="${i++}"><b>${mark(x.title, t)}</b><small>${mark(x.sub, t)}</small></a>`; }); });
    items = shown;
    drop.innerHTML = items.length ? html + `<div class="sx__f">${items.length} result${items.length > 1 ? 's' : ''} · ↑ ↓ to move · Enter to open · Esc to clear</div>`
      : `<div class="sx__e">No results for “${esc(q)}”.<br><small>Try a renter name, device name or rental ID.</small></div>`;
    drop.hidden = false;
  }
  function open(x) {                                 // go to a result (or just filter if already on that page)
    drop.hidden = true;
    if (x.href.split('#')[0] === here || (!x.q && x.href === here)) { if (x.q) { inp.value = x.q; sync(); } return; }
    location.href = x.href + (x.q ? '?q=' + encodeURIComponent(x.q) : '');
  }

  // 2) Filter the records already displayed on this page
  function filter(q) {
    const old = page.querySelector('.sx-note'); if (old) old.remove();
    const els = [...page.querySelectorAll('tbody tr, .rc, .note')].filter(e => !e.querySelector('td.empty'));
    els.forEach(e => e.classList.remove('sx-hide'));
    const t = toks(q); if (!t.length || !els.length) return;
    let n = 0;
    els.forEach(e => { const ok = t.every(w => e.textContent.toLowerCase().includes(w)); e.classList.toggle('sx-hide', !ok); if (ok) n++; });
    page.insertAdjacentHTML('afterbegin', `<div class="sx-note ${n ? '' : 'none'}"><span>${n ? `Showing <b>${n}</b> of ${els.length} records matching “${esc(q)}”` : `No records match “${esc(q)}” on this page`}</span><button type="button" data-sxclr>Clear</button></div>`);
  }
  function sync() { box.classList.toggle('has', !!inp.value); clr.hidden = !inp.value; filter(inp.value); }
  function clear() { inp.value = ''; drop.hidden = true; sync(); }

  inp.addEventListener('input', () => { sync(); show(inp.value); });
  inp.addEventListener('focus', () => { if (inp.value) show(inp.value); });
  clr.addEventListener('click', () => { clear(); inp.focus(); });
  page.addEventListener('click', e => { if (e.target.closest('[data-sxclr]')) clear(); });
  drop.addEventListener('mousedown', e => e.preventDefault());
  drop.addEventListener('click', e => { const a = e.target.closest('.sx__r'); if (a) { e.preventDefault(); open(items[+a.dataset.i]); } });
  inp.addEventListener('keydown', e => {
    const rows = [...drop.querySelectorAll('.sx__r')];
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); if (!rows.length) return;
      active = (active + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      rows.forEach((r, i) => r.classList.toggle('on', i === active)); rows[active].scrollIntoView({ block: 'nearest' }); }
    else if (e.key === 'Enter') { e.preventDefault(); if (items.length) open(items[Math.max(active, 0)]); else drop.hidden = true; }
    else if (e.key === 'Escape') { if (!drop.hidden) drop.hidden = true; else clear(); }
  });
  document.addEventListener('click', e => { if (!e.target.closest('.sx')) drop.hidden = true; });
  document.addEventListener('keydown', e => {          // "/" or Ctrl/Cmd+K focuses the search
    const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(document.activeElement.tagName);
    if ((e.key === '/' && !typing) || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k')) { e.preventDefault(); inp.focus(); inp.select(); }
  });
  window.addEventListener('rs:render', () => filter(inp.value));   // page re-rendered (timer status changed): re-apply filter

  const q = new URLSearchParams(location.search).get('q');      // arrived from a search result
  if (q) { inp.value = q; sync(); }
})();
