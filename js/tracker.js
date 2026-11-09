/* Rental data, countdowns, security features (lock, GPS, wipe, logs) and page rendering */
const App = (() => {
  const KEY = 'rs_data2', M = 6e4, C = Clock, $ = s => document.querySelector(s);
  const DEF = { lat: 14.676, lng: 121.0437, r: 0.8 };            // default depot + safe-zone radius (km); editable in Settings
  const BASE = { get lat() { return D.depot.lat; }, get lng() { return D.depot.lng; } };
  // Sample home addresses (demo). A renter's home address/location is stored in D.renters[i].address/.home,
  // completely separate from a device's live GPS (D.units[i].gps).
  const ADDR = { 'Juan Dela Cruz': ['12', 'Mabini St.', 'Batasan Hills', 'Quezon City', 'Metro Manila', 14.683, 121.087], 'Maria Santos': ['45', 'Tandang Sora Ave.', 'Culiat', 'Quezon City', 'Metro Manila', 14.67, 121.028],
    'Pedro Reyes': ['8', 'Luzon Ave.', 'Holy Spirit', 'Quezon City', 'Metro Manila', 14.679, 121.075], 'Ana Lopez': ['101', 'Commonwealth Ave.', 'Fairview', 'Quezon City', 'Metro Manila', 14.693, 121.062],
    'Carlo Mendoza': ['27', 'Visayas Ave.', 'Vasra', 'Quezon City', 'Metro Manila', 14.69, 121.035] };
  const addrText = a => a ? [a.house, a.street, a.barangay && (/^(brgy|barangay)/i.test(a.barangay) ? a.barangay : 'Brgy. ' + a.barangay), a.city, a.province].filter(Boolean).join(', ') : '';
  const sampleAddr = n => { const s = ADDR[n]; return s ? { address: { house: s[0], street: s[1], barangay: s[2], city: s[3], province: s[4] }, home: { lat: s[5], lng: s[6] } } : { address: null, home: null }; };
  let D; try { D = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  if (!D) { // first run: sample data. Start times are relative to "now" so timers are live
    const n = Date.now(), R = (renter, ago, dur) => ({ renter, start: n - ago * M, dur, f: [] });
    const off = [[.001, -.0008], [-.0012, .0015], [0, 0], [.002, .001], [.0035, .006]];
    D = { soon: 15, autoLock: true, wipeReturn: true, wipeOver: 60,
      renters: [['Juan Dela Cruz', 'renter', '0917 555 0101'], ['Maria Santos', 'maria', '0917 555 0102'], ['Pedro Reyes', 'pedro', '0917 555 0103'], ['Ana Lopez', 'ana', '0917 555 0104'], ['Carlo Mendoza', 'carlo', '0917 555 0105']].map(([name, username, phone]) => ({ name, username, phone, email: '', ...sampleAddr(name) })),
      units: [['Juan Dela Cruz', 75, 120], ['Maria Santos', 45, 60], null, ['Pedro Reyes', 10, 180], ['Ana Lopez', 70, 60]].map((x, i) => ({ id: 'Unit 0' + (i + 1), name: 'Device 0' + (i + 1), r: x && R(...x), lock: 'unlocked', wipe: null, gf: false, gps: { lat: DEF.lat + off[i][0], lng: DEF.lng + off[i][1] } })),
      history: [['Carlo Mendoza', 'Device 03', 300, 120], ['Maria Santos', 'Device 01', 500, 60], ['Pedro Reyes', 'Device 02', 700, 90]].map(([renter, unit, ago, dur]) => ({ renter, unit, start: n - ago * M, end: n - (ago - dur) * M, dur })),
      logs: [{ t: n - 240 * M, unit: 'Device 02', type: 'damage', text: 'Cracked screen: found on return', by: 'Administrator' }, { t: n - 200 * M, unit: 'Device 03', type: 'wipe', text: 'Data privacy wipe after rental', by: 'System' }] };
  }
  D.depot = D.depot || { ...DEF };
  D.renters.forEach(p => { if (p.address === undefined) Object.assign(p, sampleAddr(p.name)); if (p.email === undefined) p.email = ''; });
  const save = () => localStorage.setItem(KEY, JSON.stringify(D));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const rem = r => r.start + r.dur * M - Date.now();
  const left = r => r.start > Date.now() ? r.start - Date.now() : rem(r);          // time until start (scheduled) or until end
  const end = r => r.start + r.dur * M;
  const stat = u => !u.r ? 'available' : u.r.start > Date.now() ? 'scheduled' : rem(u.r) <= 0 ? 'expired' : rem(u.r) <= (u.soon != null ? u.soon : D.soon) * M ? 'soon' : 'active';
  const wstate = u => !u.wipe ? 'none' : Date.now() - u.wipe.t < 8000 ? 'wiping' : 'wiped';
  const unit = id => D.units.find(x => x.id === id);
  const B = { available: ['Available', 'green'], scheduled: ['Scheduled', 'gray'], active: ['Active', 'blue'], soon: ['Ending Soon', 'amber'], expired: ['Expired', 'red'] };
  const badge = s => `<span class="badge ${B[s][1]}">${B[s][0]}</span>`;
  const lockBadge = u => `<span class="badge ${u.lock === 'locked' ? 'red' : 'green'}">${u.lock === 'locked' ? 'Locked' : 'Unlocked'}</span>`;
  const cd = u => `<b class="cd" data-cd="${u.id}">${C.hms(left(u.r))}</b>`;
  const exp = u => stat(u) === 'scheduled' ? `<small class="exp sch">STARTS ${C.t(u.r.start)}, ${C.d(u.r.start)}</small>` : stat(u) === 'expired' ? `<small class="exp">TIME EXPIRED</small><small class="od">Overdue +<span data-od="${u.id}">${C.hms(-rem(u.r))}</span></small>` : '';
  const kv = a => `<div class="kv">${a.map(([l, v]) => `<div><small>${l}</small><span>${v}</span></div>`).join('')}</div>`;
  const table = (h, rows, ra) => `<div class="panel tw"><table><thead><tr>${h.map(x => `<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.length ? rows.map((r, i) => `<tr${ra ? ' ' + ra[i] + ' tabindex="0" title="Click for details"' : ''}>${r.map((c, i) => `<td data-label="${h[i]}">${c}</td>`).join('')}</tr>`).join('') : `<tr><td colspan="${h.length}" class="empty">Nothing to show yet.</td></tr>`}</tbody></table></div>`;
  const clockBox = () => '<div class="clockbox"><div><small>CURRENT TIME</small><div class="big" data-clock="time"></div><div data-clock="date"></div></div></div>';
  const mine = () => { const u = Auth.user(); return D.units.find(x => x.r && x.r.renter === u.name); };
  const none = () => '<div class="panel empty">You have no active rental right now.</div>';
  const sn = u => ({ unit: u.id, device: u.name, renter: u.r ? u.r.renter : null, start: u.r ? u.r.start : null, end: u.r ? end(u.r) : null });
  const NP = (to, title, text, who, u) => Notify.push(to, title, text, who, u ? sn(u) : undefined);
  const log = (type, unit, text, by = 'System') => { D.logs.unshift({ t: Date.now(), type, unit, text, by }); if (D.logs.length > 200) D.logs.length = 200; };

  // ---- GPS helpers (simulated feed) ----
  const km = g => { const dx = (g.lng - BASE.lng) * 111.32 * Math.cos(BASE.lat * Math.PI / 180), dy = (g.lat - BASE.lat) * 110.57; return { dx, dy, d: Math.hypot(dx, dy) }; };
  const pos = g => { const k = km(g), cl = v => Math.min(96, Math.max(4, v)); return `left:${cl(50 + k.dx / 2.2 * 100)}%;top:${cl(50 - k.dy / 2.2 * 100)}%`; };
  const paintGps = () => D.units.forEach(u => {
    const g = u.gps, q = a => document.querySelectorAll(`[${a}="${u.id}"]`);
    q('data-pin').forEach(e => e.style.cssText = pos(g));
    q('data-gps').forEach(e => e.textContent = g.lat.toFixed(5) + ', ' + g.lng.toFixed(5));
    q('data-dist').forEach(e => e.textContent = km(g).d.toFixed(2) + ' km');
    q('data-gl').forEach(e => e.href = `https://www.google.com/maps?q=${g.lat},${g.lng}`);
  });

  // ---- security actions ----
  const lockU = (u, why, by) => { if (u.lock === 'locked') return; u.lock = 'locked'; log('lock', u.name, why, by); save();
    NP('admin', 'Device Locked', `${u.name}: ${why}`, null, u); if (u.r) NP('renter', 'Your device has been locked.', `${u.name}: ${why}`, u.r.renter, u); };
  const unlockU = (u, why, by) => { if (u.lock !== 'locked') return; u.lock = 'unlocked'; log('unlock', u.name, why, by); save();
    NP('admin', 'Device Unlocked', `${u.name}: ${why}`, null, u); if (u.r) NP('renter', 'Your device has been unlocked.', u.name, u.r.renter, u); };
  const wipeU = (u, why, by) => { u.wipe = { t: Date.now() }; log('wipe', u.name, why, by); save(); NP('admin', 'Data Wipe Started', `${u.name}: ${why}`, null, u); };
  const start = (id, renter, dur) => {
    const u = unit(id); u.r = { renter, start: Date.now(), dur, f: [] }; u.wipe = null; save(); unlockU(u, 'New rental started', 'System');
    NP('admin', 'Rental Started', `${renter} started renting ${u.name}.`, null, u);
    NP('renter', 'Your rental has started.', `${u.name} for ${C.dur(dur)}.`, renter, u);
  };
  const finish = id => {
    const u = unit(id), r = u.r, S = sn(u);
    if (r.start > Date.now()) { u.r = null; save(); Notify.push('admin', 'Schedule Cancelled', `${r.renter}'s scheduled rental for ${u.name} was cancelled.`, null, S); Notify.push('renter', 'Your scheduled rental was cancelled.', u.name, r.renter, S); return; }
    D.history.unshift({ renter: r.renter, unit: u.name, start: r.start, end: Date.now(), dur: r.dur });
    u.r = null; u.gf = false; u.gps = { lat: BASE.lat, lng: BASE.lng };
    if (D.wipeReturn) wipeU(u, 'Data privacy wipe after rental', 'System');
    u.lock = 'unlocked'; save();
    Notify.push('admin', 'Rental Completed', `${r.renter}'s rental for ${u.name} is completed.`, null, S);
    Notify.push('admin', 'Unit Available', `${u.name} is now available.`, null, S);
  };
  const schedule = (id, renter, dur, at) => {
    const u = unit(id); u.r = { renter, start: at, dur, f: [], sch: true }; u.wipe = null; save();
    NP('admin', 'Rental Scheduled', `${renter} is scheduled to rent ${u.name} from ${C.t(at)}, ${C.d(at)}.`, null, u);
    NP('renter', 'Your rental has been scheduled.', `${u.name} starts ${C.t(at)}, ${C.d(at)} for ${C.dur(dur)}.`, renter, u);
  };
  // Register a renter: profile + login account + (optional) device and schedule
  const addRenter = f => {
    D.renters.push({ name: f.name, username: f.username, phone: f.phone, email: f.email, address: f.address, home: f.home }); save();
    Auth.addAccount({ username: f.username, password: f.password, name: f.name });
    Notify.push('admin', 'Renter Added', `${f.name} (${f.username}) was registered${f.dev ? ' with ' + unit(f.dev).name : ''}.`);
    if (f.dev) { if (f.at > Date.now() + 30000) schedule(f.dev, f.name, f.dur, f.at); else start(f.dev, f.name, f.dur); }
  };
  // Runs every second: one-time alerts (15 min, 5 min, expired), auto-lock, overdue warnings, auto-wipe
  const check = u => {
    const r = u.r; if (!r || r.start > Date.now()) return; const m = rem(r), f = r.f, N = (to, title, text, who) => NP(to, title, text, who, u), over = -m;
    if (r.sch && !f.includes('st')) { f.push('st'); save(); N('admin', 'Rental Started', `${r.renter}'s scheduled rental of ${u.name} has started.`); N('renter', 'Your rental has started.', `${u.name} for ${C.dur(r.dur)}.`, r.renter); }
    if (m <= 0 && !f.includes('x')) { f.push('x', '5', '15'); save();
      N('admin', 'Rental Time Expired', `${r.renter}'s rental for ${u.name} has expired.`); N('renter', 'Your rental time has expired.', u.name, r.renter);
      if (D.autoLock) lockU(u, 'Auto-locked: rental time expired', 'System'); }
    else if (m > 0 && m <= 5 * M && !f.includes('5')) { f.push('5', '15'); save();
      N('admin', 'Rental Ending Soon', `${r.renter}'s rental for ${u.name} will end in ${Math.ceil(m / M)} minutes.`); N('renter', 'Your rental will end in 5 minutes.', u.name, r.renter); }
    else if (m > 5 * M && m <= 15 * M && !f.includes('15')) { f.push('15'); save();
      N('admin', 'Rental Ending Soon', `${r.renter}'s rental for ${u.name} will end in ${Math.ceil(m / M)} minutes.`); N('renter', 'Your rental will end in 15 minutes.', u.name, r.renter); }
    if (over >= 10 * M && !f.includes('o10')) { f.push('o10'); save(); log('overdue', u.name, `Overdue warning sent to ${r.renter} (${Math.floor(over / M)} min)`);
      N('admin', 'Overdue Warning', `${r.renter} has not returned ${u.name} (overdue ${Math.floor(over / M)} min).`); N('renter', 'Warning: please return the device.', `${u.name} is overdue. Return it immediately.`, r.renter); }
    if (over >= 30 * M && !f.includes('o30')) { f.push('o30'); save(); log('overdue', u.name, `Critical overdue: final warning sent to ${r.renter}`);
      N('admin', 'Critical Overdue', `${u.name} is ${Math.floor(over / M)} min overdue (${r.renter}).`); N('renter', 'Final warning: device overdue.', `${u.name} must be returned now.`, r.renter); }
    const wo = u.wipeOver != null ? u.wipeOver : D.wipeOver;
    if (wo > 0 && over >= wo * M && !u.wipe) wipeU(u, `Auto-wipe: overdue more than ${wo} min`, 'System');
  };
  // Simulated GPS movement + geofence check (admin tab)
  const move = () => {
    D.units.forEach(u => { if (!u.r) return; const g = u.gps, e = stat(u) === 'expired';
      if (!g.real) { g.lat += (Math.random() - .5) * 8e-5 + (e ? 4e-5 : 0); g.lng += (Math.random() - .5) * 8e-5 + (e ? 5e-5 : 0); }   // real fixes are not simulated
      const d = km(g).d;
      if (d > D.depot.r && !u.gf) { u.gf = true; log('geofence', u.name, `Left the safe zone (${d.toFixed(2)} km from depot)`);
        NP('admin', 'Geofence Alert', `${u.name} left the ${D.depot.r} km safe zone.`, null, u); if (D.autoLock) lockU(u, 'Auto-locked: left safe zone', 'System'); }
      else if (d <= D.depot.r) u.gf = false; });
    save(); paintGps();
  };

  // ---- reusable blocks ----
  const warn = u => { const s = stat(u);
    return (s === 'expired' ? `<div class="warn">${Auth.icon('alert')}<div><b>Rental time expired. Please return the device now.</b><br>Overdue: <span data-od="${u.id}">${C.hms(-rem(u.r))}</span></div></div>`
      : s === 'soon' ? `<div class="warn amber">${Auth.icon('bell')}<div><b>Your rental ends soon.</b><br>Please prepare to return the device.</div></div>` : '')
      + (u.lock === 'locked' ? `<div class="warn">${Auth.icon('lock')}<div><b>This device is locked.</b><br>Return it or request an unlock from the admin.</div><button class="btn sm" data-act="req" style="margin-left:auto">Request Unlock</button></div>` : ''); };
  const rcard = u => { const r = u.r, s = stat(u);
    return `<article class="panel rc ${s}" data-rental="${u.id}" tabindex="0" role="button" title="Click for details"><header><div><h3>${r.renter}</h3><p>${u.name}</p></div>${badge(s)}</header>
    <div class="timer sm">${cd(u)}${exp(u)}</div>${kv([['Rental ID', C.rid(r.start)], ['Start Time', C.t(r.start)], ['Duration', C.dur(r.dur)], ['Current Time', '<span data-clock="short"></span>'], ['End Time', C.t(end(r))], ['Device Lock', lockBadge(u)]])}</article>`; };
  const prog = u => !u.r || u.r.start > Date.now() ? 0 : Math.min(100, Math.max(0, (Date.now() - u.r.start) / (u.r.dur * M) * 100));
  const hero = u => { const s = stat(u), r = u.r;
    return `<div class="panel hero ${s}"><div class="label">${s === 'scheduled' ? 'STARTS IN' : s === 'expired' ? 'OVERDUE BY' : 'TIME REMAINING'}</div>
    <div class="timer">${s === 'expired' ? `<b class="cd" data-od="${u.id}">${C.hms(-rem(r))}</b>` : cd(u)}</div><div style="margin-top:.5rem">${badge(s)}</div>
    ${kv([['Assigned Device', u.name], ['Rental Start', `${C.t(r.start)}, ${C.d(r.start)}`], ['Expires', `${C.t(end(r))}, ${C.d(end(r))}`], ['Duration', C.dur(r.dur)]])}</div>`; };
  const homePopup = p => `<div class="pp"><b>${esc(p.name)}</b><small>Registered home address</small><p>${esc(addrText(p.address))}</p><small class="pn">Home address, not a live device location</small><div class="pl2"><a target="_blank" rel="noopener" href="${Maps.dirUrl(p.home.lat, p.home.lng)}">Get directions</a><a target="_blank" rel="noopener" href="${Maps.viewUrl(p.home.lat, p.home.lng)}">Open in Google Maps</a></div></div>`;
  const devPopup = u => `<div class="pp"><b>${u.name}</b><small>${u.r ? esc(u.r.renter) : 'In depot'} · live device GPS</small><p>${u.gps.lat.toFixed(5)}, ${u.gps.lng.toFixed(5)}</p><div class="pl2"><a target="_blank" rel="noopener" href="${Maps.viewUrl(u.gps.lat, u.gps.lng)}">Open in Google Maps</a></div></div>`;
  let lf = 'all', addDone = null, hsel = null, gtab = 'dev', gm = null, gMk = {}, hMk = {};

  // ---- pages: P[role][page]() returns HTML ----
  const P = {
    admin: {
      dashboard() {
        const us = D.units, c = s => us.filter(u => stat(u) === s).length, act = us.filter(u => ['active', 'soon'].includes(stat(u))), od = us.filter(u => stat(u) === 'expired');
        return clockBox() 
          + '<div class="cards">' + [['Total Units', us.length, 'monitor', 'navy', 'units.html'], ['Available', c('available'), 'check', 'green', 'units.html?q=Available'], ['Currently Rented', us.filter(u => u.r && stat(u) !== 'scheduled').length, 'clock', 'blue', 'tracker.html'],
          ['Active Renters', new Set(act.map(u => u.r.renter)).size, 'users', 'blue', 'renters.html'], ['Ending Soon', c('soon'), 'bell', 'amber', 'tracker.html?q=Ending%20Soon'], ['Completed Rentals', D.history.length, 'archive', 'green', 'history.html'],
          ['Overdue', od.length, 'alert', 'red', 'overdue.html'], ['Locked Devices', us.filter(u => u.lock === 'locked').length, 'lock', 'navy', 'security.html']]
          .map(([l, v, i, k, h]) => `<a class="panel stat" href="${h}" title="Open ${l}"><span class="ico ${k}">${Auth.icon(i)}</span><div><small>${l}</small><b>${v}</b></div></a>`).join('') + '</div><h2>Live Rentals</h2>' +
          table(['Rental ID', 'Renter', 'Unit', 'Remaining', 'Status', 'Lock'], us.filter(u => u.r).map(u => [C.rid(u.r.start), u.r.renter, u.name, cd(u), badge(stat(u)), lockBadge(u)]), us.filter(u => u.r).map(u => `data-rental="${u.id}"`));
      },
      tracker() { const us = D.units.filter(u => u.r); return clockBox() + (us.length ? `<div class="rgrid">${us.map(rcard).join('')}</div>` : '<div class="panel empty">No active rentals.</div>'); },
      gps() {
        if (!gsel || !unit(gsel)) gsel = (D.units.find(u => u.r) || D.units[0]).id;
        const u = unit(gsel), homes = D.renters.filter(p => p.home), hp = hsel && homes.find(p => p.username === hsel);
        const tgt = hp ? hp.home : u.gps, src = mapSrc(tgt), out = km(u.gps).d > D.depot.r;
        const devs = D.units.map(x => `<button class="dev${!hp && x.id === gsel ? ' on' : ''}" data-act="gsel" data-u="${x.id}"><span class="ico blue">${Auth.icon('map')}</span><span class="dt"><b>${x.name}</b><small>${x.r ? esc(x.r.renter) : 'In depot'} · <span data-gps="${x.id}"></span></small></span>${badge(stat(x))}</button>`).join('');
        const hl = homes.length ? homes.map(p => `<button class="dev${hp && p.username === hsel ? ' on' : ''}" data-act="ghome" data-un="${esc(p.username)}"><span class="ico green">${Auth.icon('user')}</span><span class="dt"><b>${esc(p.name)}</b><small>${esc(addrText(p.address))}</small></span></button>`).join('') : '<p class="hintp">No renter has a pinned home location yet.</p>';
        return `<div class="gpswrap"><section class="panel gm">
          <div class="gh"><div>${hp ? `<h3>${esc(hp.name)}</h3><small>Registered home address · not a live device location</small>` : `<h3>${u.name}</h3><small>${u.r ? esc(u.r.renter) + ' · Rental ' + C.rid(u.r.start) : 'In depot (available)'}</small>`}</div>
            <div class="ghb">${hp ? `<a class="btn sm" target="_blank" rel="noopener" href="${Maps.dirUrl(tgt.lat, tgt.lng)}">Get directions</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${Maps.viewUrl(tgt.lat, tgt.lng)}">Open in Google Maps</a>` : `<a class="btn sm ghost" data-gl="${u.id}" target="_blank" rel="noopener" href="#">Open in Google Maps</a>`}</div></div>
          ${hp ? `<p class="haddr">${Auth.icon('map')}<span>${esc(addrText(hp.address))}</span></p>` : ''}
          <div class="mapframe"><iframe id="gmap" data-s="${src}" src="${src}" title="Map location" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>
          ${hp ? `<div class="gfoot"><b>${tgt.lat.toFixed(5)}, ${tgt.lng.toFixed(5)}</b><span class="badge gray">Home address</span></div>`
            : `<div class="gfoot"><span><b data-gps="${u.id}"></b> · <span data-dist="${u.id}"></span> from depot</span><span class="badge ${out ? 'red' : 'green'}">${out ? 'Outside safe zone' : 'Inside safe zone'}</span><span class="badge ${u.gps.real ? 'blue' : 'gray'}">${u.gps.real ? 'Device GPS' : 'Simulated feed'}</span></div>`}
          <p class="cap">${hp ? 'The registered home is shown separately and is never used as the device’s live location.' : 'Interactive Google Map with a marker at the device’s last reported position (internet connection required). The map refreshes every 20 seconds.'}</p>
          ${hp ? '' : `<fieldset class="mset"><legend>Update device location</legend>
            <div class="mrow"><label>Latitude<input id="glat" type="number" step="any" value="${u.gps.lat.toFixed(6)}"></label><label>Longitude<input id="glng" type="number" step="any" value="${u.gps.lng.toFixed(6)}"></label></div>
            <div class="mrow"><button class="btn sm" data-act="gset" data-u="${u.id}">Save location</button><button class="btn sm ghost" data-act="gme" data-u="${u.id}">Use my current location</button></div></fieldset>`}</section>
          <section class="devlist"><div class="tabs2"><button class="${gtab === 'dev' ? 'on' : ''}" data-act="gtab" data-v="dev">Devices</button><button class="${gtab === 'home' ? 'on' : ''}" data-act="gtab" data-v="home">Registered homes <span class="cnt">${homes.length}</span></button></div>
            <div class="hl">${gtab === 'dev' ? devs : hl}</div></section></div>`;
      },
      units() {
        return table(['Unit', 'Name', 'Renter', 'Start', 'Duration', 'End', 'Remaining', 'Status', 'Lock', 'Action'], D.units.map(u => { const r = u.r, d = '—';
          return [u.id, u.name, r ? r.renter : d, r ? C.t(r.start) : d, r ? C.dur(r.dur) : d, r ? C.t(end(r)) : d, r ? cd(u) : d, badge(stat(u)), lockBadge(u),
            r ? `<button class="btn sm danger" data-act="end" data-u="${u.id}">${stat(u) === 'scheduled' ? 'Cancel Schedule' : 'End Rental'}</button>` : `<button class="btn sm" data-act="start" data-u="${u.id}">Start Rental</button>`]; }), D.units.map(u => `data-unit="${u.id}"`));
      },
      overdue() {
        const od = D.units.filter(u => stat(u) === 'expired');
        return `<div class="panel ovsum"><span class="ico red">${Auth.icon('alert')}</span><div><b>${od.length} overdue rental${od.length === 1 ? '' : 's'}</b><small>Rentals past their end time that have not been returned. Click a card to renew, end or view details.</small></div></div>`
          + (od.length ? `<div class="rgrid">${od.map(rcard).join('')}</div>` : '<div class="panel empty">No overdue rentals. Every rental is within its time.</div>');
      },
      security() {
        return table(['Unit', 'Renter', 'Status', 'Lock', 'Data', 'Remote Actions'], D.units.map(u => { const w = wstate(u), L = u.lock === 'locked';
          return [u.name, u.r ? u.r.renter : '—', badge(stat(u)), lockBadge(u),
            w === 'none' ? '—' : w === 'wiping' ? `<span class="badge amber" data-wp="${u.id}">Wiping ${Math.min(99, Math.floor((Date.now() - u.wipe.t) / 80))}%</span>` : '<span class="badge gray">Wiped</span>',
            `<button class="btn sm ${L ? '' : 'danger'}" data-act="${L ? 'unlock' : 'lock'}" data-u="${u.id}">${L ? 'Remote Unlock' : 'Remote Lock'}</button> <button class="btn sm ghost" data-act="wipe" data-u="${u.id}">Wipe Data</button>`]; }));
      },
      logs() {
        const T = { damage: ['Damage', 'amber'], tamper: ['Tamper', 'red'], lock: ['Locked', 'blue'], unlock: ['Unlocked', 'green'], wipe: ['Data Wipe', 'gray'], geofence: ['Geofence', 'amber'], overdue: ['Overdue', 'red'], gps: ['GPS', 'blue'] };
        const L = D.logs.filter(l => lf === 'all' || l.type === lf || (lf === 'lock' && l.type === 'unlock'));
        return `<div class="bar" style="margin-bottom:.75rem"><select id="lf" class="sel" aria-label="Filter">${[['all', 'All events'], ['damage', 'Damage'], ['tamper', 'Tamper'], ['lock', 'Lock / Unlock'], ['wipe', 'Data wipe'], ['geofence', 'Geofence'], ['overdue', 'Overdue'], ['gps', 'GPS location']].map(([v, l]) => `<option value="${v}"${v === lf ? ' selected' : ''}>${l}</option>`).join('')}</select><button class="btn sm" data-act="report">Report Incident</button></div>`
          + table(['Time', 'Unit', 'Type', 'Details', 'By'], L.map(l => [`${C.d(l.t)}, ${C.t(l.t)}`, l.unit, `<span class="badge ${T[l.type][1]}">${T[l.type][0]}</span>`, `<span class="wrap">${l.text}</span>`, l.by]));
      },
      renters() {
        return table(['Renter', 'Username', 'Contact', 'Home address', 'Device', 'Status', 'Actions'], D.renters.map(p => { const u = D.units.find(x => x.r && x.r.renter === p.name);
          return [`<b>${esc(p.name)}</b>`, esc(p.username), `${esc(p.phone || '—')}${p.email ? '<br><small>' + esc(p.email) + '</small>' : ''}`,
            p.address ? `<span class="wrap">${esc(addrText(p.address))}</span>${p.home ? `<br><a class="link" target="_blank" rel="noopener" href="${Maps.viewUrl(p.home.lat, p.home.lng)}">Home on map</a>` : ''}` : '—',
            u ? u.name : '—', u ? badge(stat(u)) : '<span class="badge gray">Idle</span>',
            `<button class="btn sm ghost" data-act="redit" data-un="${esc(p.username)}">Edit</button> <button class="btn sm ghost" data-act="rpw" data-un="${esc(p.username)}">Password</button> <button class="btn sm danger" data-act="rdel" data-un="${esc(p.username)}">Delete</button>`]; }));
      },
      'add-renter'() {
        if (addDone) { const d = addDone;
          return `<div class="panel done"><span class="ico green">${Auth.icon('check')}</span><h3>Renter account created</h3><p>${esc(d.name)} can now log in with the details below.</p>`
            + kv([['Username', esc(d.username)], ['Password', esc(d.password)], ['Assigned device', esc(d.dev || 'None')], ['Rental', esc(d.sched)], ['Home address', esc(d.addr)],
              ['Map location', d.home ? `<a class="link" target="_blank" rel="noopener" href="${Maps.viewUrl(d.home.lat, d.home.lng)}">${d.home.lat.toFixed(5)}, ${d.home.lng.toFixed(5)}</a>` : 'Not pinned']])
            + '<div class="acts"><button class="btn ghost" data-act="arnew">Add another renter</button><a class="btn" href="renters.html">View renters</a></div></div>'; }
        const fl = (id, label, x = '') => `<label>${label}<input id="${id}" ${x}></label>`, free = D.units.filter(u => !u.r);
        return `<form class="panel af" id="arForm" data-keep autocomplete="off" novalidate>
          <h3 class="ft">Renter details</h3>
          <div class="fgrid">${fl('ar-name', 'Full name *', 'maxlength="60" placeholder="e.g. Juan Dela Cruz"')}${fl('ar-phone', 'Phone *', 'type="tel" maxlength="20" placeholder="09XX XXX XXXX"')}${fl('ar-email', 'Email', 'type="email" maxlength="80" placeholder="name@example.com"')}</div>
          <h3 class="ft">Login account</h3>
          <div class="fgrid">${fl('ar-user', 'Username *', 'maxlength="20" autocapitalize="none" placeholder="3-20 letters or numbers"')}
            <label>Password *<span class="pwrow"><input id="ar-pw" type="password" maxlength="40" placeholder="At least 6 characters"><button type="button" class="toggle" data-act="arpw">Show</button></span></label>${fl('ar-pw2', 'Confirm password *', 'type="password" maxlength="40"')}</div>
          <div class="ft2"><h3 class="ft">Home address</h3><button type="button" class="btn sm ghost" data-act="pickloc">${Auth.icon('map')} Select Location on Map</button></div>
          <div class="fgrid">${fl('ar-house', 'House no. *', 'maxlength="30" placeholder="e.g. 12 or Lot 5 Blk 2"')}${fl('ar-street', 'Street *', 'maxlength="60"')}${fl('ar-brgy', 'Barangay *', 'maxlength="60"')}${fl('ar-city', 'City / Municipality *', 'maxlength="60"')}${fl('ar-prov', 'Province *', 'maxlength="60"')}</div>
          <input type="hidden" id="ar-lat"><input type="hidden" id="ar-lng">
          <p class="pinrow" id="ar-pin"><span class="badge gray">No map location pinned</span></p>
          <h3 class="ft">Rental assignment <small>(optional)</small></h3>
          <div class="fgrid"><label>Assigned device<select id="ar-dev"><option value="">No device yet</option>${free.map(u => `<option value="${u.id}">${u.name} (available)</option>`).join('')}</select></label>
            <label>Duration<select id="ar-dur" disabled>${mopt.map(([v, l]) => `<option value="${v}"${v === 120 ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
            <label>Start<select id="ar-mode" disabled><option value="now">Start now</option><option value="later">Schedule for later</option></select></label>
            <label id="ar-whenwrap" hidden>Start date and time<input id="ar-when" type="datetime-local"></label></div>
          <div class="alert" id="arErr" role="alert" hidden></div>
          <div class="acts"><button type="reset" class="btn ghost" data-act="arclear">Clear</button><button type="submit" class="btn">Create renter account</button></div></form>`;
      },
      notifications: () => Notify.page(),
      history() { return table(['Rental ID', 'Renter', 'Unit', 'Date', 'Start', 'End', 'Duration'], D.history.map(h => [C.rid(h.start), h.renter, h.unit, C.d(h.start), C.t(h.start), C.t(h.end), C.dur(h.dur)])); },
      settings() {
        const head = (ic, t2, d) => `<div class="sh"><span class="ico blue">${Auth.icon(ic)}</span><div><h3>${t2}</h3><p>${d}</p></div></div>`;
        const num = (set, v, min, max, u, ph) => `<input type="number" inputmode="numeric" min="${min}" max="${max}" data-set="${set}"${u ? ` data-u="${u.id}"` : ''} value="${v}" placeholder="${ph != null ? ph : ''}">`;
        const rows = D.units.map(u => [`<b>${u.name}</b>`, u.r ? `${esc(u.r.renter)}<br><small>Rental ${C.rid(u.r.start)}</small>` : '<small>No active rental</small>',
          num('soon', u.soon != null ? u.soon : '', 1, 120, u, D.soon), num('wipeOver', u.wipeOver != null ? u.wipeOver : '', 0, 1440, u, D.wipeOver)]);
        const tog = (set, on, t2, d) => `<label class="chk tog"><input type="checkbox" data-set="${set}" ${on ? 'checked' : ''}><span><b>${t2}</b><small>${d}</small></span></label>`;
        return `<div class="setgrid2">
          <section class="panel sc wide" data-keep>${head('bell', 'Rental alert and wipe rules', 'Set the default for all devices. To change it for one device, fill in that device’s row; leave it empty to use the default. Everything saves automatically.')}
            <div class="mrow"><label>Default “Ending soon” warning<span class="unit">minutes before the rental ends</span>${num('soon', D.soon, 1, 120)}</label><label>Default auto-wipe when overdue<span class="unit">minutes after expiry (0 = off)</span>${num('wipeOver', D.wipeOver, 0, 1440)}</label></div>
            ${table(['Device', 'Renter / Rental', 'Ending soon (min)', 'Auto-wipe (min)'], rows)}</section>
          <section class="panel sc" data-keep>${head('lock', 'Security automation', 'Applies to every device and rental.')}
            ${tog('autoLock', D.autoLock, 'Auto-lock devices', 'Lock when a rental expires, a device leaves the safe zone, or tamper is reported.')}
            ${tog('wipeReturn', D.wipeReturn, 'Wipe data after every rental', 'Run a privacy wipe when a rental is ended or returned.')}</section>
          <section class="panel sc" data-keep>${head('map', 'Safe zone', 'Devices that move outside this radius around the depot trigger a geofence alert.')}
            <div class="mrow"><label>Depot latitude<input type="number" step="any" data-dep="lat" value="${D.depot.lat}"></label><label>Depot longitude<input type="number" step="any" data-dep="lng" value="${D.depot.lng}"></label><label>Radius (km)<input type="number" step="0.1" min="0.1" max="50" data-dep="r" value="${D.depot.r}"></label></div></section>
          <section class="panel sc" data-keep>${head('map', 'Maps', 'Used by the address picker, GPS map and renter profile. Without a key, OpenStreetMap is used.')}
            <label>Google Maps API key (optional)<input type="text" data-gkey value="${esc(Maps.key())}" placeholder="Paste a key to use Google Maps" autocomplete="off" autocapitalize="none" spellcheck="false"></label>
            <small class="hintp">Currently using <b>${Maps.provider()}</b>. The key needs the Maps JavaScript API and Geocoding API enabled.</small></section>
          <section class="panel sc">${head('archive', 'Demo data', 'Restore the sample rentals, renters, logs and notifications.')}<button class="btn danger" data-act="reset">Reset demo data</button></section></div>`;
      }
    },
    renter: {
      dashboard() { const u = mine(); return `<h1 class="wel">Welcome, ${esc(Auth.user().name)}</h1>` + (u ? hero(u) : none()); },
      rental() {
        const u = mine(); if (!u) return none(); const r = u.r, s = stat(u);
        return `<div class="panel mr"><div class="gh"><div><h3>${u.name}</h3><small>${u.id} · Rental ${C.rid(r.start)}</small></div><div>${badge(s)} ${lockBadge(u)}</div></div>
          <div class="pbar"><i data-prog="${u.id}" class="${s}" style="width:${prog(u)}%"></i></div>
          <div class="pl"><span>Start ${C.t(r.start)}</span><span>${s === 'scheduled' ? 'Not started yet' : s === 'expired' ? 'Overdue' : 'Ends ' + C.t(end(r))}</span></div>
          ${kv([['Assigned Device', u.name], [s === 'scheduled' ? 'Starts In' : s === 'expired' ? 'Overdue By' : 'Time Left', s === 'expired' ? `<b class="cd" data-od="${u.id}">${C.hms(-rem(r))}</b>` : cd(u)], ['Device Lock', lockBadge(u)], ['Device Location', gmap(u.gps)]])}
          <h4 class="ms">Device actions</h4><div class="acts" style="justify-content:flex-start">${u.lock === 'locked' ? '<button class="btn sm" data-act="req">Request Unlock</button>' : ''}<button class="btn sm ghost" data-act="rshare">Share Device Location</button><button class="btn sm ghost" data-act="report">Report Damage</button></div></div>`;
      },
      'rental-details'() {
        const u = mine(), me = Auth.user(), H = D.history.filter(h => h.renter === me.name);
        return (u ? `<div class="panel">${kv([['Renter', esc(u.r.renter)], ['Unit', u.name], ['Rental ID', C.rid(u.r.start)], ['Rental Date', C.d(u.r.start)], ['Start Time', C.t(u.r.start)], ['Rental Duration', C.dur(u.r.dur)],
          ['End Time', C.t(end(u.r))], ['Current Time', '<span data-clock="short"></span>'], [stat(u) === 'expired' ? 'Overdue By' : 'Remaining', stat(u) === 'expired' ? `<b class="cd" data-od="${u.id}">${C.hms(-rem(u.r))}</b>` : cd(u)], ['Status', badge(stat(u))], ['Device Lock', lockBadge(u)]])}</div>` : none())
          + '<h2>My rental history</h2>' + table(['Rental ID', 'Device', 'Date', 'Start', 'End', 'Duration'], H.map(h => [C.rid(h.start), h.unit, C.d(h.start), C.t(h.start), C.t(h.end), C.dur(h.dur)]));
      },
      notifications() { const u = mine(); return (u ? warn(u) : '') + Notify.page(); },
      profile() {
        const me = Auth.user(), p = D.renters.find(x => x.username === me.username) || {}, u = mine();
        return `<div class="panel">${kv([['Name', esc(me.name)], ['Username', esc(me.username)], ['Role', 'Renter'], ['Phone', esc(p.phone || '—')], ['Email', esc(p.email || '—')], ['Assigned Device', u ? u.name : '—']])}</div>
          <h2>Registered home address</h2><div class="panel">${p.address ? `<p class="addr">${esc(addrText(p.address))}</p>` : '<p class="hintp">No address is registered yet. Please contact the admin.</p>'}
          ${p.home ? `<div class="pmap" id="pmap"></div><div class="acts" style="justify-content:flex-start"><a class="btn sm ghost" target="_blank" rel="noopener" href="${Maps.viewUrl(p.home.lat, p.home.lng)}">Open in Google Maps</a><a class="btn sm ghost" target="_blank" rel="noopener" href="${Maps.dirUrl(p.home.lat, p.home.lng)}">Get directions</a></div>` : ''}
          <p class="hintp">This is your registered home address. It is not your device’s live location.</p></div>`;
      }
    }
  };

  // ---- GPS helpers ----
  const mapSrc = g => `https://www.google.com/maps?q=${g.lat.toFixed(6)},${g.lng.toFixed(6)}&z=16&output=embed`;
  let gsel = null;
  const setGps = (u, lat, lng, why, by) => { u.gps = { lat, lng, real: true }; u.gf = false; log('gps', u.name, `${why} (${lat.toFixed(5)}, ${lng.toFixed(5)})`, by); save(); };
  const badgeOd = () => { const c = D.units.filter(u => stat(u) === 'expired').length; document.querySelectorAll('[data-ob]').forEach(e => { e.textContent = c; e.hidden = !c; }); };
  const renew = (id, min, by) => {
    const u = unit(id), r = u.r, base = Math.max(end(r), Date.now());
    r.dur = Math.ceil((base + min * M - r.start) / M); r.f = []; save();
    if (u.lock === 'locked') unlockU(u, 'Unlocked after rental renewal', by);
    NP('admin', 'Rental Renewed', `${r.renter}'s rental for ${u.name} was extended by ${C.dur(min)}. New end time ${C.t(end(r))}.`, null, u);
    NP('renter', 'Your rental has been renewed.', `${u.name} now ends at ${C.t(end(r))}.`, r.renter, u);
  };
  // Confirmation: SweetAlert2 when available, browser confirm otherwise
  const ask = (title, text, ok, danger = true) => window.Swal ? Swal.fire({ title, text, icon: 'warning', iconColor: '#d97706', showCancelButton: true, reverseButtons: true, focusCancel: true,
    confirmButtonText: ok, cancelButtonText: 'Cancel', buttonsStyling: false, customClass: { popup: 'rs-pop', title: 'rs-pt', htmlContainer: 'rs-px', actions: 'rs-act', confirmButton: 'btn' + (danger ? ' danger' : ''), cancelButton: 'btn ghost' },
    showClass: { popup: 'rs-in' }, hideClass: { popup: 'rs-out' } }).then(r => r.isConfirmed) : Promise.resolve(confirm(text || title));

  // ---- address picker (add / edit renter) ----
  const pinChip = pre => { const la = parseFloat($(`#${pre}-lat`).value), ln = parseFloat($(`#${pre}-lng`).value), el = $(`#${pre}-pin`);
    el.innerHTML = isNaN(la) ? '<span class="badge gray">No map location pinned</span>' : `<span class="badge green">Pinned: ${la.toFixed(6)}, ${ln.toFixed(6)}</span> <button type="button" class="link" data-act="clearpin" data-pre="${pre}">Clear pin</button>`; };
  const pickFor = pre => { const g = s => $(`#${pre}-${s}`), la = parseFloat(g('lat').value), ln = parseFloat(g('lng').value);
    Maps.pick({ lat: isNaN(la) ? null : la, lng: isNaN(ln) ? null : ln, query: ['house', 'street', 'brgy', 'city', 'prov'].map(s => g(s).value.trim()).filter(Boolean).join(', '),
      onConfirm: s => { g('lat').value = s.lat; g('lng').value = s.lng; const p = s.parts || {};
        [['house', 'house'], ['street', 'street'], ['brgy', 'barangay'], ['city', 'city'], ['prov', 'province']].forEach(([id, k]) => { if (!g(id).value.trim() && p[k]) g(id).value = p[k]; }); pinChip(pre); } }); };
  const mountProfile = async () => {
    const el = $('#pmap'); if (!el) return; const p = D.renters.find(x => x.username === Auth.user().username); if (!p || !p.home) return;
    try { await Maps.load(); } catch (e) { return Maps.err(el, e); }
    if (!document.body.contains(el)) return;
    const m = Maps.create(el, { center: [p.home.lat, p.home.lng], zoom: 16 }); m.marker({ kind: 'home', lat: p.home.lat, lng: p.home.lng, html: homePopup(p) }); setTimeout(() => m.invalidate(), 60);
  };

  // ---- detail modal: rental / device / notification ----
  let cur = null;                                                  // { t, id, v }
  const mopt = [[30, '30 Minutes'], [60, '1 Hour'], [120, '2 Hours'], [180, '3 Hours']];
  const msel = (id, sel = 60) => `<select id="${id}">${mopt.map(([v, l]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${l}</option>`).join('')}</select>`;
  const person = n => D.renters.find(p => p.name === n) || {};
  const gmap = g => `<a class="link" target="_blank" rel="noopener" href="https://www.google.com/maps?q=${g.lat},${g.lng}">View on Google Maps</a>`;
  const manage = u => `<fieldset class="mset"${u.r ? '' : ' disabled'}><legend>Manage current rental</legend><div class="mrow"><label>Extend by${msel('mx')}</label><button class="btn sm" data-act="mrenew" data-u="${u.id}">Renew Rental</button><button class="btn sm danger" data-act="mend" data-u="${u.id}">End Rental</button></div>${u.r ? '' : '<p class="hintp">No active rental on this device.</p>'}</fieldset>`;
  const rentalBody = u => { const r = u.r, p = person(r.renter);
    return `<div class="timer sm">${cd(u)}${exp(u)}</div><div style="margin-bottom:.75rem">${badge(stat(u))} ${lockBadge(u)}</div>`
      + kv([['Rental ID', C.rid(r.start)], ['Device', u.name], ['Phone', p.phone || '—'], ['Started', C.t(r.start)], ['Duration', C.dur(r.dur)], ['Ends', C.t(end(r))]])
      + manage(u) + '<div class="mrow"><button class="btn sm ghost" data-act="mdetails">View Details</button></div>'; };
  const detBody = u => { const r = u.r, p = person(r.renter), w = wstate(u), k = km(u.gps), L = D.logs.filter(l => l.unit === u.name).slice(0, 4);
    return `<button class="btn sm ghost" data-act="mback">&larr; Back</button><div style="height:.75rem"></div>`
      + kv([['Renter', r.renter], ['Phone', p.phone || '—'], ['Username', p.username || '—'], ['Device', u.name], ['Unit ID', u.id], ['Rental ID', C.rid(r.start)], ['Rental Date', C.d(r.start)], ['Start Time', C.t(r.start)],
        ['Duration', C.dur(r.dur)], ['End Time', C.t(end(r))], ['Current Time', '<span data-clock="short"></span>'], [stat(u) === 'expired' ? 'Overdue' : 'Remaining', stat(u) === 'expired' ? `<span data-od="${u.id}">${C.hms(-rem(r))}</span>` : cd(u)],
        ['Status', badge(stat(u))], ['Device Lock', lockBadge(u)], ['Data', w === 'none' ? '—' : w === 'wiping' ? 'Wiping…' : 'Wiped'], ['Location', gmap(u.gps)], ['From depot', k.d.toFixed(2) + ' km']])
      + `<h4 class="ms">Recent activity</h4>` + (L.length ? `<ul class="mlog">${L.map(l => `<li><b>${l.type}</b> ${l.text}<small>${C.t(l.t)}, ${C.d(l.t)}</small></li>`).join('')}</ul>` : '<p class="hintp">No activity logged for this device.</p>') + manage(u); };
  const unitBody = u => { const r = u.r, p = r ? person(r.renter) : {}, w = wstate(u), free = D.renters.filter(x => !D.units.some(z => z.r && z.r.renter === x.name));
    return '<h4 class="ms">Device</h4>' + kv([['Device', u.name], ['Unit ID', u.id], ['Status', badge(stat(u))], ['Device Lock', lockBadge(u)], ['Data', w === 'none' ? '—' : w === 'wiping' ? 'Wiping…' : 'Wiped'], ['Location', gmap(u.gps)]])
      + '<h4 class="ms">Renter</h4>' + (r ? kv([['Name', r.renter], ['Phone', p.phone || '—'], ['Rental ID', C.rid(r.start)], ['Started', C.t(r.start)], ['Duration', C.dur(r.dur)], ['Ends', C.t(end(r))], [stat(u) === 'expired' ? 'Overdue' : 'Remaining', cd(u) + exp(u)]]) : '<p class="hintp">No active renter. This device is available.</p>')
      + `<fieldset class="mset"${r ? ' disabled' : ''}><legend>Start a rental</legend><div class="mrow"><label>Renter<select id="ms-r">${free.length ? free.map(x => `<option>${x.name}</option>`).join('') : '<option value="">No free renter</option>'}</select></label><label>Duration${msel('ms-d', 120)}</label><button class="btn sm" data-act="mstart" data-u="${u.id}">Start Rental</button></div></fieldset>` + manage(u); };
  const noteBody = n => { const s = n.snap || {}, live = s.unit && unit(s.unit) && unit(s.unit).r && unit(s.unit).r.renter === s.renter && Math.abs(unit(s.unit).r.start - s.start) < 5000 ? unit(s.unit) : null;
    const status = live ? badge(stat(live)) : s.start ? '<span class="badge gray">Completed</span>' : '—';
    return `<p class="mmsg">${n.text}</p>` + kv([['Device', s.device || '—'], ['Renter', s.renter || '—'], ['Rental Status', status], ['Expiration Time', s.end ? `${C.t(s.end)}, ${C.d(s.end)}` : '—'], ['Rental ID', s.start ? C.rid(s.start) : '—'], ['Received', `${C.t(n.t)}, ${C.d(n.t)}`]])
      + (live && role() === 'admin' ? `<div class="mrow" style="margin-top:1rem"><button class="btn sm" data-act="mopen" data-u="${live.id}">Manage Rental</button></div>` : ''); };
  const paintModal = () => { const d = $('#mdlg'); if (!d || !cur || !d.open) return; if ((cur.t === 'redit' || cur.t === 'rpw') && cur.done) return; let title = '', body = '';
    if (cur.t === 'rental') { const u = unit(cur.id); if (!u || !u.r) { d.close(); return; } title = `${u.r.renter} <small>${u.name}</small>`; body = cur.v === 'det' ? detBody(u) : rentalBody(u); }
    else if (cur.t === 'unit') { const u = unit(cur.id); title = `${u.name} <small>${u.id}</small>`; body = unitBody(u); }
    else if (cur.t === 'redit') { const p = D.renters.find(x => x.username === cur.id); if (!p) { d.close(); return; } const a = p.address || {}, h = p.home; cur.done = true; title = `Edit renter <small>${esc(p.name)}</small>`;
      const f = (id, l, v, x = '') => `<label>${l}<input id="re-${id}" value="${esc(v)}" ${x}></label>`;
      body = `<div class="fgrid">${f('name', 'Full name', p.name, 'disabled')}${f('phone', 'Phone *', p.phone, 'type="tel"')}${f('email', 'Email', p.email, 'type="email"')}${f('user', 'Username *', p.username, 'autocapitalize="none"')}</div>
        <div class="ft2"><h4 class="ms">Home address</h4><button type="button" class="btn sm ghost" data-act="epick">${Auth.icon('map')} Select Location on Map</button></div>
        <div class="fgrid">${f('house', 'House no. *', a.house)}${f('street', 'Street *', a.street)}${f('brgy', 'Barangay *', a.barangay)}${f('city', 'City / Municipality *', a.city)}${f('prov', 'Province *', a.province)}</div>
        <input type="hidden" id="re-lat" value="${h ? h.lat : ''}"><input type="hidden" id="re-lng" value="${h ? h.lng : ''}"><p class="pinrow" id="re-pin"></p>
        <div class="acts"><button class="btn ghost" data-act="mclose">Cancel</button><button class="btn" data-act="rsave" data-un="${esc(p.username)}">Save changes</button></div>`; }
    else if (cur.t === 'rpw') { const p = D.renters.find(x => x.username === cur.id); if (!p) { d.close(); return; } cur.done = true; title = `Reset password <small>${esc(p.name)} (${esc(p.username)})</small>`;
      body = `<label>New password<input id="rp-pw" type="text" maxlength="40" placeholder="At least 6 characters" autocomplete="off"></label><div class="acts"><button class="btn ghost" data-act="mclose">Cancel</button><button class="btn" data-act="rpwsave" data-un="${esc(p.username)}">Save password</button></div>`; }
    else { const n = Notify.find(cur.id); if (!n) { d.close(); return; } title = n.title; body = noteBody(n); }
    d.querySelector('.mi').innerHTML = `<header class="mh"><h3>${title}</h3><button class="mxb" data-act="mclose" aria-label="Close">${Auth.icon('x')}</button></header><div class="mbody">${body}</div>`; C.update(); if (cur.t === 'redit') pinChip('re'); };
  const openM = (t2, id, v) => { cur = { t: t2, id, v: v || 'sum' }; const d = $('#mdlg'); if (!d.open) d.showModal(); paintModal(); };

  // ---- render + live loop ----
  let sig = '', n = 0;
  const role = () => document.body.dataset.role, pg = () => document.body.dataset.page;
  const key = () => D.units.map(u => stat(u) + u.lock + wstate(u)).join();
  const render = soft => {
    if (soft && [...document.querySelectorAll('#page [data-keep]')].some(x => x.contains(document.activeElement))) { sig = key(); return; }   // don't wipe a form while it is being edited
    sig = key(); if (gm) { try { gm.destroy(); } catch (e) {} gm = null; gMk = {}; hMk = {}; }
    $('#page').innerHTML = P[role()][pg()](); C.update(); Notify.bell(); paintGps(); badgeOd(); paintModal(); window.dispatchEvent(new Event('rs:render'));
    if (role() === 'renter' && pg() === 'profile') mountProfile();
    if (location.hash) { const t = document.querySelector(location.hash); t && t.scrollIntoView(); } };
  const tick = () => {
    D.units.forEach(check);
    if (role() === 'admin' && ++n % 3 === 0) move();
    if (key() !== sig) return render(true);                          // status/lock/wipe changed
    document.querySelectorAll('[data-cd]').forEach(e => { const u = unit(e.dataset.cd); if (u && u.r) e.textContent = C.hms(left(u.r)); });
    document.querySelectorAll('[data-prog]').forEach(e => { const u = unit(e.dataset.prog); if (u && u.r) e.style.width = prog(u) + '%'; });
    document.querySelectorAll('[data-od]').forEach(e => { const u = unit(e.dataset.od); if (u && u.r) e.textContent = C.hms(-rem(u.r)); });
    document.querySelectorAll('[data-wp]').forEach(e => { const u = unit(e.dataset.wp); if (u && u.wipe) e.textContent = 'Wiping ' + Math.min(99, Math.floor((Date.now() - u.wipe.t) / 80)) + '%'; });
  };
  const toast = m => { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2200); };
  const TYPES = [['damage|Cracked screen', 'Damage: Cracked screen'], ['damage|Water damage', 'Damage: Water damage'], ['damage|Missing parts', 'Damage: Missing parts / accessories'], ['damage|Other damage', 'Damage: Other'],
    ['tamper|Case opened', 'Tamper: Case opened'], ['tamper|SIM or storage removed', 'Tamper: SIM / storage removed'], ['tamper|Lock bypass attempt', 'Tamper: Lock bypass attempt']];

  // Search index (used by js/search.js): every record the signed-in role may see
  const index = () => {
    const out = [], adm = role() === 'admin', add = (g, title, sub, href, q) => out.push({ g, title, sub, href, q, hay: (title + ' ' + sub).toLowerCase() });
    if (adm) {
      D.renters.forEach(p => { const u = D.units.find(x => x.r && x.r.renter === p.name); add('Renters', p.name, `${p.username} · ${p.phone}${u ? ' · ' + u.name : ''}${p.address ? ' · ' + addrText(p.address) : ''}`, 'renters.html', p.name); });
      D.units.forEach(u => add('Devices', u.name, `${u.id} · ${B[stat(u)][0]} · ${u.lock === 'locked' ? 'Locked' : 'Unlocked'}${u.r ? ' · ' + u.r.renter : ' · In depot'}`, 'units.html', u.name));
      D.units.filter(u => u.r).forEach(u => add('Rentals', `${C.rid(u.r.start)} · ${u.r.renter}`, `${u.name} · ${C.t(u.r.start)} to ${C.t(end(u.r))} · ${B[stat(u)][0]}`, 'tracker.html', C.rid(u.r.start)));
      D.history.forEach(h => add('Rental History', `${C.rid(h.start)} · ${h.renter}`, `${h.unit} · ${C.d(h.start)} · ${C.dur(h.dur)}`, 'history.html', C.rid(h.start)));
      D.logs.forEach(l => add('Logs', `${l.unit} · ${l.type}`, l.text, 'logs.html', l.unit));
    } else {
      const u = mine(); if (u) add('My Rental', `${C.rid(u.r.start)} · ${u.name}`, `${C.t(u.r.start)} to ${C.t(end(u.r))} · ${B[stat(u)][0]}`, 'rental.html', C.rid(u.r.start));
      Notify.list().forEach(x => add('Notifications', x.title, x.text, 'notifications.html', x.title));
    }
    return out;
  };

  return { index, boot() {
    Auth.shell(); C.start();
    const adm = role() === 'admin', me = Auth.user();
    document.body.insertAdjacentHTML('beforeend', (adm ? `<dialog id="dlg"><form method="dialog"><h3>Start Rental</h3><label>Renter<select id="dr"></select></label>
      <label>Duration<select id="dd"><option value="30">30 Minutes</option><option value="60">1 Hour</option><option value="120" selected>2 Hours</option><option value="180">3 Hours</option></select></label>
      <div class="acts"><button class="btn ghost" value="cancel">Cancel</button><button class="btn" value="ok">Start</button></div></form></dialog>` : '')
      + `<dialog id="rdlg"><form method="dialog"><h3>${adm ? 'Report Incident' : 'Report Damage'}</h3><label>Unit<select id="ru"></select></label>
      <label>Type<select id="rt">${TYPES.filter(t => adm || t[0][0] === 'd').map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}</select></label>
      <label>Notes (optional)<input id="rn" maxlength="120" placeholder="Describe what happened"></label>
      <div class="acts"><button class="btn ghost" value="cancel">Cancel</button><button class="btn" value="ok">Submit</button></div></form></dialog>`);
    document.body.insertAdjacentHTML('beforeend', '<dialog id="mdlg" aria-label="Details"><div class="mi"></div></dialog>');
    $('#mdlg').addEventListener('close', () => { cur = null; });
    $('#mdlg').addEventListener('click', e => { if (e.target.id === 'mdlg') e.target.close(); });   // click outside closes
    if (adm) $('#dlg').addEventListener('close', e => { if (e.target.returnValue === 'ok') { start(e.target.dataset.u, $('#dr').value, +$('#dd').value); render(); toast('Rental started'); } });
    $('#rdlg').addEventListener('close', e => {
      if (e.target.returnValue !== 'ok') return;
      const [type, label] = $('#rt').value.split('|'), note = esc($('#rn').value.trim()), u = unit($('#ru').value);
      log(type, u.name, label + (note ? ': ' + note : ''), me.name); save();
      NP('admin', type === 'tamper' ? 'Tamper Alert' : 'Damage Reported', `${u.name}: ${label}${adm ? '' : ' (reported by ' + me.name + ')'}`, null, u);
      if (type === 'tamper' && D.autoLock) lockU(u, 'Auto-locked: tamper detected', 'System');
      render(); toast('Report logged');
    });
    document.addEventListener('change', e => {
      const x = e.target, ds = x.dataset || {};
      if (x.id === 'lf') { lf = x.value; render(); }
      if (x.id === 'ar-dev') { ['ar-dur', 'ar-mode'].forEach(i => { $('#' + i).disabled = !x.value; }); if (!x.value) { $('#ar-mode').value = 'now'; $('#ar-whenwrap').hidden = true; } }
      if (x.id === 'ar-mode') { $('#ar-whenwrap').hidden = x.value !== 'later'; if (x.value === 'later' && !$('#ar-when').value) { const d = new Date(Date.now() + 36e5); $('#ar-when').value = new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 16); } }
      if (ds.set) {                                                    // Settings: auto-save
        if (x.type === 'checkbox') D[ds.set] = x.checked;
        else { const u = ds.u && unit(ds.u), raw = x.value.trim(), lo = ds.set === 'soon' ? 1 : 0, hi = ds.set === 'soon' ? 120 : 1440;
          if (u && raw === '') delete u[ds.set];
          else { const v = Math.min(hi, Math.max(lo, Math.round(+raw))); if (isNaN(v)) { x.value = u ? '' : D[ds.set]; return; } x.value = v; if (u) u[ds.set] = v; else D[ds.set] = v; }
          document.querySelectorAll(`input[data-set="${ds.set}"][data-u]`).forEach(i => { i.placeholder = D[ds.set]; }); }
        save(); toast('Saved'); }
      if (ds.dep) { const v = parseFloat(x.value), bad = isNaN(v) || (ds.dep === 'lat' && Math.abs(v) > 90) || (ds.dep === 'lng' && Math.abs(v) > 180) || (ds.dep === 'r' && v <= 0); if (bad) { x.value = D.depot[ds.dep]; return toast('Invalid value'); } D.depot[ds.dep] = v; save(); toast('Saved'); }
      if (ds.gkey !== undefined) { try { localStorage.setItem('rs_gkey', x.value.trim()); } catch (er) {} toast('Maps key saved. Reloading…'); setTimeout(() => location.reload(), 700); }
    });
    document.addEventListener('submit', e => {                          // Add New Renter
      if (e.target.id !== 'arForm') return; e.preventDefault();
      const v = id => $('#' + id).value.trim(), err = m => { const b = $('#arErr'); b.textContent = m; b.hidden = false; b.scrollIntoView({ block: 'nearest' }); };
      const f = { name: v('ar-name').replace(/\s+/g, ' '), phone: v('ar-phone'), email: v('ar-email'), username: v('ar-user').toLowerCase(), password: $('#ar-pw').value,
        address: { house: v('ar-house'), street: v('ar-street'), barangay: v('ar-brgy'), city: v('ar-city'), province: v('ar-prov') }, dev: $('#ar-dev').value, dur: +$('#ar-dur').value };
      if (!/^\p{L}[\p{L}\p{M} .'-]{2,59}$/u.test(f.name)) return err('Enter the renter’s full name (letters, spaces, dots, hyphens).');
      if (D.renters.some(p => p.name.toLowerCase() === f.name.toLowerCase())) return err('A renter with this full name already exists.');
      if (!/^[+\d][\d\s()-]{6,}$/.test(f.phone)) return err('Enter a valid phone number.');
      if (f.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.email)) return err('Enter a valid email address.');
      if (!/^[a-z0-9_.]{3,20}$/.test(f.username)) return err('Username must be 3–20 characters: letters, numbers, dot or underscore.');
      if (Auth.usernameTaken(f.username)) return err('That username is already taken.');
      if (f.password.length < 6) return err('Password must be at least 6 characters.');
      if (f.password !== $('#ar-pw2').value) return err('Passwords do not match.');
      if (Object.values(f.address).some(z => !z)) return err('Complete the address: house no., street, barangay, city and province.');
      const la = parseFloat($('#ar-lat').value), ln = parseFloat($('#ar-lng').value); f.home = isNaN(la) ? null : { lat: la, lng: ln };
      f.at = Date.now(); let sched = 'No device assigned';
      if (f.dev) { if ($('#ar-mode').value === 'later') { f.at = new Date($('#ar-when').value).getTime(); if (isNaN(f.at) || f.at < Date.now() + 60000) return err('Choose a start time in the future.'); sched = `Scheduled ${C.t(f.at)}, ${C.d(f.at)} · ${C.dur(f.dur)}`; } else sched = `Started now · ${C.dur(f.dur)}`; }
      addRenter(f); addDone = { name: f.name, username: f.username, password: f.password, dev: f.dev && unit(f.dev).name, sched, addr: addrText(f.address), home: f.home }; render(); toast('Renter account created');
    });
    document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('[data-rental],[data-unit],[data-nid]')) { e.preventDefault(); e.target.click(); } });
    document.addEventListener('click', e => {
      const o = e.target.closest('[data-rental],[data-unit],[data-nid]');                  // clickable card / row / notification
      if (o && !e.target.closest('button,a,select,input,label')) {
        if (o.dataset.nid !== undefined) { Notify.read(o.dataset.nid); const dd = $('[data-drop]'); if (dd) dd.hidden = true; openM('note', o.dataset.nid); }
        else openM(o.dataset.rental ? 'rental' : 'unit', o.dataset.rental || o.dataset.unit);
        return;
      }
      const b = e.target.closest('[data-act]'); if (!b) return; const a = b.dataset.act, u = b.dataset.u && unit(b.dataset.u);
      if (a === 'start') { $('#dr').innerHTML = D.renters.filter(p => !D.units.some(x => x.r && x.r.renter === p.name)).map(p => `<option>${p.name}</option>`).join(''); $('#dlg').dataset.u = u.id; $('#dlg').returnValue = ''; $('#dlg').showModal(); }
      if (a === 'end') ask('End this rental?', 'The device will be marked available.', 'Yes, End Rental').then(ok => { if (ok) { finish(u.id); render(); toast('Rental ended'); } });
      if (a === 'lock') { lockU(u, 'Remote lock by admin', me.name); render(); }
      if (a === 'unlock') { unlockU(u, 'Remote unlock by admin', me.name); render(); }
      if (a === 'wipe') ask(`Wipe ${u.name}?`, 'All user data on this device will be erased. This cannot be undone.', 'Yes, Wipe Data').then(ok => { if (ok) { wipeU(u, 'Remote wipe by admin', me.name); render(); } });
      if (a === 'report') { const list = adm ? D.units : [mine()].filter(Boolean); if (!list.length) return toast('No active rental'); $('#ru').innerHTML = list.map(x => `<option value="${x.id}">${x.name}</option>`).join(''); $('#rn').value = ''; $('#rdlg').returnValue = ''; $('#rdlg').showModal(); }
      if (a === 'req') { const x = mine(); log('unlock', x.name, 'Unlock requested by renter', me.name); save(); NP('admin', 'Unlock Requested', `${me.name} requested an unlock for ${x.name}.`, null, x); toast('Request sent to admin'); }
      if (a === 'reset') ask('Reset demo data?', 'Rentals, logs, settings and notifications return to the sample data.', 'Yes, Reset').then(ok => { if (ok) { localStorage.removeItem(KEY); localStorage.removeItem('rs_notes2'); localStorage.removeItem('rs_accounts'); location.reload(); } });
      if (a === 'mclose') $('#mdlg').close();
      if (a === 'mdetails') { cur.v = 'det'; paintModal(); }
      if (a === 'mback') { cur.v = 'sum'; paintModal(); }
      if (a === 'mopen') openM('rental', u.id);
      if (a === 'mrenew') { renew(u.id, +$('#mx').value, me.name); $('#mdlg').close(); render(); toast('Rental renewed'); }
      if (a === 'mstart') { const rn = $('#ms-r').value; if (!rn) return toast('No free renter available'); start(u.id, rn, +$('#ms-d').value); $('#mdlg').close(); render(); toast('Rental started'); }
      if (a === 'mend') { const keep = { ...cur }; $('#mdlg').close(); ask('End this rental?', `${u.r.renter}'s rental for ${u.name} will be completed and the device marked available.`, 'Yes, End Rental')
        .then(ok => { if (ok) { finish(u.id); render(); toast('Rental ended'); } else openM(keep.t, keep.id, keep.v); }); }
      if (a === 'gsel') { gsel = u.id; hsel = null; gtab = 'dev'; render(); }
      if (a === 'gset') { const la = parseFloat($('#glat').value), ln = parseFloat($('#glng').value);
        if (!(la >= -90 && la <= 90 && ln >= -180 && ln <= 180)) return toast('Enter a valid latitude and longitude'); setGps(u, la, ln, 'Location set by admin', me.name); render(); toast('Location saved'); }
      if (a === 'gme' || a === 'rshare') { const tg = a === 'gme' ? u : mine(); if (!tg) return toast('No active rental'); if (!navigator.geolocation) return toast('Geolocation is not supported here');
        navigator.geolocation.getCurrentPosition(p => { setGps(tg, p.coords.latitude, p.coords.longitude, a === 'gme' ? 'Location taken from admin device' : 'Location shared by renter', me.name);
          if (a === 'rshare') NP('admin', 'Location Shared', `${me.name} shared the location of ${tg.name}.`, null, tg); render(); toast('Location updated'); }, er => toast('Location unavailable: ' + er.message), { enableHighAccuracy: true, timeout: 10000 }); }
      if (a === 'gtab') { gtab = b.dataset.v; render(); }
      if (a === 'ghome') { hsel = b.dataset.un; gtab = 'home'; render(); }
      if (a === 'pickloc') pickFor('ar');
      if (a === 'epick') pickFor('re');
      if (a === 'clearpin') { $(`#${b.dataset.pre}-lat`).value = ''; $(`#${b.dataset.pre}-lng`).value = ''; pinChip(b.dataset.pre); }
      if (a === 'arpw') { const s = $('#ar-pw').type === 'password'; $('#ar-pw').type = $('#ar-pw2').type = s ? 'text' : 'password'; b.textContent = s ? 'Hide' : 'Show'; }
      if (a === 'arnew') { addDone = null; render(); }
      if (a === 'redit' || a === 'rpw') openM(a, b.dataset.un);
      if (a === 'rsave') { const p = D.renters.find(x => x.username === b.dataset.un), g = s => $('#re-' + s).value.trim(), un = g('user').toLowerCase();
        if (!/^[a-z0-9_.]{3,20}$/.test(un)) return toast('Username must be 3–20 letters, numbers, dot or underscore'); if (Auth.usernameTaken(un, p.username)) return toast('That username is already taken');
        if (!/^[+\d][\d\s()-]{6,}$/.test(g('phone'))) return toast('Enter a valid phone number'); const addr = { house: g('house'), street: g('street'), barangay: g('brgy'), city: g('city'), province: g('prov') };
        if (Object.values(addr).some(z => !z)) return toast('Complete the address'); const la = parseFloat(g('lat')), ln = parseFloat(g('lng'));
        Auth.updateAccount(p.username, { username: un }); Object.assign(p, { username: un, phone: g('phone'), email: g('email'), address: addr, home: isNaN(la) ? null : { lat: la, lng: ln } }); save(); $('#mdlg').close(); render(); toast('Renter updated'); }
      if (a === 'rpwsave') { const pw = $('#rp-pw').value; if (pw.length < 6) return toast('Password must be at least 6 characters'); Auth.updateAccount(b.dataset.un, { password: pw }); $('#mdlg').close(); toast('Password updated'); }
      if (a === 'rdel') { const p = D.renters.find(x => x.username === b.dataset.un); if (D.units.some(x => x.r && x.r.renter === p.name)) return toast('End or cancel this renter’s rental first');
        ask(`Delete ${p.name}?`, 'The renter account and registered address will be removed. Past rentals stay in history.', 'Yes, Delete').then(ok => { if (ok) { D.renters = D.renters.filter(x => x !== p); save(); Auth.removeAccount(p.username); render(); toast('Renter deleted'); } }); }
      if (a === 'readall') Notify.markAll();
      if (a === 'clear') Notify.clear();
    });
    window.addEventListener('rs:notes', () => { if (pg() === 'notifications') render(); });
    window.addEventListener('storage', e => { if (e.key === KEY && e.newValue) { D = JSON.parse(e.newValue); render(true); } }); // keep admin + renter tabs in sync
    setInterval(() => { const f = $('#gmap'); if (!f || !gsel || !unit(gsel) || hsel) return; const s = mapSrc(unit(gsel).gps); if (f.dataset.s !== s) { f.dataset.s = s; f.src = s; } }, 20000);
    render(); D.units.forEach(check); setInterval(tick, 1000); requestAnimationFrame(() => document.documentElement.classList.add('ready'));
  } };
})();
