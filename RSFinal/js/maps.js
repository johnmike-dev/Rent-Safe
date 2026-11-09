/* Maps: one small wrapper used by the address picker, the GPS page and the renter profile.
   - With a Google Maps API key (Settings -> Maps) it uses the Google Maps JavaScript API.
   - Without a key it uses OpenStreetMap (Leaflet, bundled in js/vendor) + Nominatim search, so it still works. */
const Maps = (() => {
  const BASE = document.currentScript.src.replace(/maps\.js.*$/, '');
  const key = () => { try { return localStorage.getItem('rs_gkey') || ''; } catch (e) { return ''; } };
  const COLORS = { active: '#2563eb', soon: '#d97706', expired: '#dc2626', available: '#1f8a4c', scheduled: '#64748b' };
  const HOUSE = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 3l9 8v10H3z"/><path d="M9 21v-6h6v6"/></svg>';
  const PIN = '<svg viewBox="0 0 24 32" width="30" height="38"><path d="M12 0C5.4 0 0 5.2 0 11.7 0 20 12 32 12 32s12-12 12-20.3C24 5.2 18.6 0 12 0z" fill="#dc2626" stroke="#fff" stroke-width="2"/><circle cx="12" cy="11.5" r="4.5" fill="#fff"/></svg>';
  const tag = (t, attrs) => Object.assign(document.createElement(t), attrs);
  let loading = null;

  /* ---------- OpenStreetMap / Leaflet ---------- */
  const osm = {
    load: () => loading || (loading = new Promise((ok, no) => {
      if (window.L) return ok();
      document.head.append(tag('link', { rel: 'stylesheet', href: BASE + 'vendor/leaflet.css' }));
      document.head.append(tag('script', { src: BASE + 'vendor/leaflet.js', onload: ok, onerror: () => no(new Error('Map library failed to load.')) }));
    })),
    create(el, o) {
      const m = L.map(el).setView(o.center, o.zoom || 15);
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '&copy; OpenStreetMap contributors' }).addTo(m);
      return {
        setView: (a, b, z) => m.setView([a, b], z || m.getZoom()),
        onClick: f => m.on('click', e => f(e.latlng.lat, e.latlng.lng)),
        invalidate: () => m.invalidateSize(), destroy: () => m.remove(),
        marker(o2) {
          const ic = o2.kind === 'pick' ? L.divIcon({ className: '', html: `<div class="mk mk-p">${PIN}</div>`, iconSize: [30, 38], iconAnchor: [15, 38], popupAnchor: [0, -34] })
            : L.divIcon({ className: '', html: o2.kind === 'home' ? `<div class="mk mk-h">${HOUSE}</div>` : `<div class="mk mk-d" style="background:${COLORS[o2.cls] || '#2563eb'}">${o2.label || ''}</div>`, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -14] });
          const k = L.marker([o2.lat, o2.lng], { icon: ic, draggable: !!o2.draggable }).addTo(m);
          if (o2.html) k.bindPopup(o2.html, { maxWidth: 260 });
          if (o2.onDrag) k.on('dragend', () => { const p = k.getLatLng(); o2.onDrag(p.lat, p.lng); });
          return { setPos: (a, b) => k.setLatLng([a, b]), setHtml: h => k.setPopupContent(h), open: () => k.openPopup(), remove: () => k.remove() };
        }
      };
    },
    async search(q) {
      const r = await fetch('https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=6&q=' + encodeURIComponent(q));
      return (await r.json()).map(x => ({ label: x.display_name, lat: +x.lat, lng: +x.lon, parts: oparts(x.address) }));
    },
    async reverse(a, b) {
      const r = await (await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&addressdetails=1&lat=${a}&lon=${b}`)).json();
      return { label: r.display_name || '', parts: oparts(r.address) };
    }
  };
  const oparts = ad => { ad = ad || {}; return { house: ad.house_number || '', street: ad.road || '', barangay: ad.suburb || ad.neighbourhood || ad.quarter || ad.village || '',
    city: ad.city || ad.town || ad.municipality || ad.county || '', province: ad.state || ad.region || '' }; };

  /* ---------- Google Maps JavaScript API ---------- */
  const goo = {
    load: () => loading || (loading = new Promise((ok, no) => {
      if (window.google && google.maps) return ok();
      window.gm_authFailure = () => { const e = new Error('Google Maps rejected the API key. Check the key and enable the Maps JavaScript API and Geocoding API.'); document.querySelectorAll('.mapframe,.pmap').forEach(x => x.innerHTML = '<p class="maperr">' + e.message + '</p>'); no(e); };
      window.__gmReady = ok;
      document.head.append(tag('script', { src: `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key())}&callback=__gmReady`, async: true, onerror: () => no(new Error('Google Maps could not load. Check your internet connection.')) }));
    })),
    create(el, o) {
      const m = new google.maps.Map(el, { center: { lat: o.center[0], lng: o.center[1] }, zoom: o.zoom || 15, mapTypeControl: false, streetViewControl: false, fullscreenControl: false });
      const iw = new google.maps.InfoWindow();
      return {
        setView: (a, b, z) => { m.setCenter({ lat: a, lng: b }); if (z) m.setZoom(z); },
        onClick: f => m.addListener('click', e => f(e.latLng.lat(), e.latLng.lng())),
        invalidate: () => google.maps.event.trigger(m, 'resize'), destroy: () => {},
        marker(o2) {
          const icon = o2.kind === 'pick' ? undefined : o2.kind === 'home'
            ? { path: 'M0,-13 L13,-2 L9,-2 L9,11 L-9,11 L-9,-2 L-13,-2 Z', fillColor: '#1f8a4c', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2, scale: 1.1 }
            : { path: google.maps.SymbolPath.CIRCLE, scale: 14, fillColor: COLORS[o2.cls] || '#2563eb', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 };
          const k = new google.maps.Marker({ map: m, position: { lat: o2.lat, lng: o2.lng }, icon, draggable: !!o2.draggable,
            label: o2.kind === 'device' ? { text: String(o2.label || ''), color: '#fff', fontSize: '11px', fontWeight: '600' } : undefined });
          let html = o2.html; const open = () => { if (html) { iw.setContent(html); iw.open({ map: m, anchor: k }); } };
          k.addListener('click', open);
          if (o2.onDrag) k.addListener('dragend', e => o2.onDrag(e.latLng.lat(), e.latLng.lng()));
          return { setPos: (a, b) => k.setPosition({ lat: a, lng: b }), setHtml: h => { html = h; }, open, remove: () => k.setMap(null) };
        }
      };
    },
    async search(q) {
      const res = await new Promise((ok, no) => new google.maps.Geocoder().geocode({ address: q }, (r, s) => s === 'OK' ? ok(r) : s === 'ZERO_RESULTS' ? ok([]) : no(new Error('Search failed: ' + s))));
      return res.slice(0, 6).map(x => ({ label: x.formatted_address, lat: x.geometry.location.lat(), lng: x.geometry.location.lng(), parts: gparts(x.address_components) }));
    },
    async reverse(a, b) {
      const res = await new Promise(ok => new google.maps.Geocoder().geocode({ location: { lat: a, lng: b } }, r => ok(r || [])));
      return res[0] ? { label: res[0].formatted_address, parts: gparts(res[0].address_components) } : { label: '', parts: {} };
    }
  };
  const gparts = c => { const g = t => { const x = (c || []).find(y => y.types.includes(t)); return x ? x.long_name : ''; };
    return { house: g('street_number'), street: g('route'), barangay: g('sublocality_level_1') || g('sublocality') || g('neighborhood'), city: g('locality') || g('administrative_area_level_2'), province: g('administrative_area_level_1') }; };

  const P = () => key() ? goo : osm;
  const api = {
    key, provider: () => key() ? 'Google Maps' : 'OpenStreetMap',
    DEFAULT: [14.676, 121.0437],
    load: () => P().load(),
    create: (el, o) => P().create(el, o),
    search: q => P().search(q), reverse: (a, b) => P().reverse(a, b),
    err: (el, e) => { el.innerHTML = `<p class="maperr">${e && e.message ? e.message : 'The map could not load. Check your internet connection.'}</p>`; },
    dirUrl: (a, b) => `https://www.google.com/maps/dir/?api=1&destination=${a},${b}`,
    viewUrl: (a, b) => `https://www.google.com/maps?q=${a},${b}`,

    /* Address picker dialog: search, click or drag the marker, then Confirm. */
    async pick({ lat, lng, query, onConfirm }) {
      let d = document.getElementById('mapdlg');
      if (!d) {
        d = tag('dialog', { id: 'mapdlg', ariaLabel: 'Select location on map' });
        d.innerHTML = `<div class="mi"><header class="mh"><h3>Select location on map<small id="mp-prov"></small></h3><button type="button" class="mxb" data-mp="x" aria-label="Close">&times;</button></header>
          <div class="mp-s"><input id="mp-q" type="search" placeholder="Search an address, barangay or landmark" autocomplete="off"><button type="button" class="btn sm" data-mp="go">Search</button></div>
          <ul class="mp-r" id="mp-r" hidden></ul><div class="pmap" id="mp-map"></div>
          <p class="mp-i" id="mp-i">Click the map or drag the marker to set the exact location.</p>
          <div class="acts"><button type="button" class="btn ghost" data-mp="x">Cancel</button><button type="button" class="btn" data-mp="ok" disabled>Use this location</button></div></div>`;
        document.body.append(d);
      }
      const $ = s => d.querySelector(s), box = $('#mp-map'), res = $('#mp-r'), info = $('#mp-i'), ok = $('[data-mp=ok]');
      let map = null, mk = null, sel = null;
      $('#mp-prov').textContent = 'Using ' + api.provider(); $('#mp-q').value = query || ''; res.hidden = true; ok.disabled = true; box.innerHTML = '';
      info.textContent = 'Click the map or drag the marker to set the exact location.';
      d.showModal();
      try { await api.load(); } catch (e) { api.err(box, e); return; }
      map = api.create(box, { center: lat != null ? [lat, lng] : api.DEFAULT, zoom: lat != null ? 17 : 13 });
      setTimeout(() => map.invalidate(), 60);
      const place = async (a, b, label, parts) => {
        sel = { lat: a, lng: b, label: label || '', parts: parts || {} };
        if (mk) mk.setPos(a, b); else mk = map.marker({ kind: 'pick', lat: a, lng: b, draggable: true, onDrag: (x, y) => place(x, y) });
        ok.disabled = false; info.textContent = `Pinned: ${a.toFixed(6)}, ${b.toFixed(6)}${sel.label ? ' · ' + sel.label : ''}`;
        if (!label) { try { const r = await api.reverse(a, b); if (sel && sel.lat === a && sel.lng === b) { sel.label = r.label; sel.parts = r.parts; info.textContent = `Pinned: ${a.toFixed(6)}, ${b.toFixed(6)} · ${r.label}`; } } catch (e) {} }
      };
      map.onClick((a, b) => place(a, b));
      if (lat != null) place(lat, lng, '');
      const search = async () => {
        const q = $('#mp-q').value.trim(); if (!q) return; res.hidden = false; res.innerHTML = '<li class="mp-n">Searching…</li>';
        try { const r = await api.search(q); res.innerHTML = r.length ? r.map((x, i) => `<li><button type="button" data-i="${i}">${x.label.replace(/</g, '&lt;')}</button></li>`).join('') : '<li class="mp-n">No results. Try a nearby street, barangay or landmark.</li>'; res._r = r; }
        catch (e) { res.innerHTML = '<li class="mp-n">Search failed. Check your internet connection.</li>'; }
      };
      d.onclick = e => {
        const t = e.target.closest('[data-mp],[data-i]'); if (e.target === d) return d.close(); if (!t) return;
        if (t.dataset.i !== undefined) { const x = res._r[+t.dataset.i]; res.hidden = true; map.setView(x.lat, x.lng, 17); place(x.lat, x.lng, x.label, x.parts); }
        else if (t.dataset.mp === 'go') search();
        else if (t.dataset.mp === 'x') d.close();
        else if (t.dataset.mp === 'ok' && sel) { d.close(); onConfirm(sel); }
      };
      $('#mp-q').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); search(); } };
      d.addEventListener('close', () => { try { map && map.destroy(); } catch (e) {} box.innerHTML = ''; }, { once: true });
      if (query && lat == null) search();
    }
  };
  return api;
})();
