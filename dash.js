/* Shared code for results.html (Link A) and results-b.html (Link B).
   Plain JS, no libraries. Each page calls Dash.start({mode, render}). */
window.Dash = (() => {
  const TARGET = 9;                 // planned participants per link
  const POLL_MS = 10000, STORY_S = 20, ENDCARD_FROM = 17, LEFT_ZONE = 125;
  const PAGES = {A:'results.html', B:'results-b.html'};

  // ---------- Labels ----------
  const AREAS = {
    link:{label:'Play on iHeartRadio', color:'var(--link)'},
    sticker:{label:'Sticker card', color:'var(--sticker)'},
    video:{label:'Background video', color:'var(--video)'},
    profile:{label:'Name and avatar', color:'var(--profile)'},
    igui:{label:'Instagram buttons', color:'var(--igui)'},
    otherstory:{label:'Another story', color:'var(--otherstory)'},
    other:{label:'Other', color:'var(--other)'},
  };
  const NAMES = {
    'attribution-link':'Play on iHeartRadio','sticker-card':'Sticker card','background-video':'Video','avatar':'Avatar',
    'username':'Username','timestamp':'Timestamp “2m”','progress-bar':'Progress bar','status-bar':'Status bar',
    'action-activity':'Activity button','action-highlight':'Highlight button','action-send':'Send button','action-mention':'Mention button',
    'action-more':'More button','action-bar-empty':'Bottom bar (empty)','home-indicator':'Home bar','story-empty':'Empty area',
    'outside-phone-frame':'Outside the phone','unknown':'Unknown','prev-story':'Previous story','next-story':'Next story','reply-bar':'Reply bar'
  };
  const PARTS = {'left-third':'left side','right-third':'right side','center':'center','title':'title','show-art':'show art',
    'content-type':'“HIGHLIGHTS” label','iheart-logo':'iHeart logo','icon':'icon','text':'text','chevron':'arrow','right':'right side',
    'send-message':'message field','like':'like','send':'send'};
  const OUTCOME = {
    A:{first:'Link on the first tap', later:'Found it after other taps', never:'Never found it'},
    B:{first:'Link on the first try', later:'Left, came back, found it', never:'Never found it'},
  };
  const OUT_COLOR = {first:'var(--first)', later:'var(--later)', never:'var(--never)'};
  const ORDER = {first:0, later:1, never:2};

  // ---------- Helpers ----------
  const cat = el => el === 'prev-story' || el === 'next-story' ? 'otherstory' : el === 'reply-bar' ? 'igui' : el === 'attribution-link' ? 'link'
    : el === 'sticker-card' ? 'sticker' : el === 'background-video' ? 'video' : ['avatar','username','timestamp'].includes(el) ? 'profile'
    : (el || '').startsWith('action-') ? 'igui' : 'other';
  const name = (el, part) => (NAMES[el] || el) + (part && el !== 'attribution-link' ? ' · ' + (PARTS[part] || part) : '');
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const median = a => { a = a.filter(x => x != null && !isNaN(x)); if (!a.length) return null; const s = [...a].sort((x,y)=>x-y), m = s.length>>1; return s.length%2 ? s[m] : (s[m-1]+s[m])/2; };
  const fmtS = ms => ms == null ? '–' : (ms/1000 < 10 ? (ms/1000).toFixed(1) : Math.round(ms/1000)) + ' s';
  const fmtN = n => n == null ? '–' : (Number.isInteger(n) ? n : n.toFixed(1));
  const truthy = v => v === true || v === 'TRUE' || v === 'true';
  const device = ua => !ua ? '–' : /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : /Mac/.test(ua) ? 'Mac' : /Windows/.test(ua) ? 'Windows' : 'Other';
  const ord = n => n + (n % 10 === 1 && n % 100 !== 11 ? 'st' : n % 10 === 2 && n % 100 !== 12 ? 'nd' : n % 10 === 3 && n % 100 !== 13 ? 'rd' : 'th');
  const people = n => n === 1 ? '1 person' : n + ' people';
  const byOutcome = (a, b) => ORDER[a.outcome] - ORDER[b.outcome] || (a.tapsToReach ?? 1e9) - (b.tapsToReach ?? 1e9) || (a.timeToLink ?? 1e12) - (b.timeToLink ?? 1e12) || String(a.id).localeCompare(String(b.id));
  const byStart = (a, b) => String(a.started).localeCompare(String(b.started));
  const pid = s => `<button class="pid" data-id="${esc(s.id)}" title="${esc(OUTCOME[s.mode][s.outcome])}"><i style="background:${OUT_COLOR[s.outcome]}"></i>${esc(s.id)}</button>${s.debug ? '<span class="tag">test</span>' : ''}`;
  const startedAt = s => s.started ? new Date(s.started).toLocaleString([], {month:'short', day:'numeric', hour:'numeric', minute:'2-digit'}) : '–';

  // ---------- State ----------
  const state = {data:{taps:[], events:[]}, sample:false, selected:null, mode:'A', render:null, lastSig:'', lastOk:null};

  // ---------- Sessions ----------
  const SCREEN = {'story':'main','story-prev':'prev','story-next':'next'};
  function timeline(s){ // which story was on screen over time (Link B)
    const segs = []; let cur = 'main', t = 0;
    const push = (to, at) => { if (at > t) segs.push({kind:cur, t0:t, t1:at}); cur = to; t = Math.max(t, at); };
    s.events.forEach(e => {
      if (e.type.startsWith('nav_')) {
        const from = SCREEN[e.screen] || cur; let to = from;
        if (from === 'main') to = e.type === 'nav_prev' ? 'prev' : 'next';
        else if (from === 'prev') to = e.type === 'nav_prev' ? 'prev' : 'main';
        else if (from === 'next') to = e.type === 'nav_prev' ? 'main' : 'next';
        push(to, e.t_ms);
      } else if (e.type === 'app_opened') push('app', e.t_ms);
      else if (e.type === 'back_to_instagram') push('main', e.t_ms);
      else if (e.type === 'page_hidden' && cur !== 'gone') push('gone', e.t_ms);
    });
    const lastTap = s.taps.length ? s.taps[s.taps.length-1].t_ms : 0, lastEv = s.events.length ? s.events[s.events.length-1].t_ms : 0;
    if (cur !== 'gone') push('gone', Math.max(t + 1500, lastTap + 1500, lastEv));
    return segs.filter(g => g.kind !== 'gone');
  }
  function sessions(includeTest){
    const by = new Map();
    const get = id => { if (!by.has(id)) by.set(id, {id:String(id), taps:[], events:[], debug:false, ua:'', started:null}); return by.get(id); };
    state.data.events.forEach(e => { if (!e.session) return; const s = get(e.session); s.events.push({...e, type:String(e.type || ''), t_ms:+e.t_ms || 0});
      if (e.type === 'story_start') { s.debug = truthy(e.debug); s.ua = e.user_agent || ''; s.started = e.received_at; } });
    state.data.taps.filter(t => t.session && String(t.screen).startsWith('story')).forEach(t => get(t.session).taps.push({...t,
      x:+t.x, y:+t.y, t_ms:+t.t_ms || 0, seq:+t.seq || 0, story_loop:+t.story_loop || 0,
      video_time: t.video_time === '' || t.video_time == null ? null : +t.video_time}));
    const out = {A:[], B:[]};
    by.forEach(s => {
      if (!s.started && !s.taps.length) return;
      s.taps.sort((a,b) => a.seq - b.seq); s.events.sort((a,b) => a.t_ms - b.t_ms);
      s.mode = s.id.startsWith('HB-') ? 'B' : 'A';
      s.linkIdx = s.taps.findIndex(t => t.element === 'attribution-link');
      s.found = s.linkIdx >= 0; s.firstTry = s.linkIdx === 0;
      s.outcome = s.firstTry ? 'first' : s.found ? 'later' : 'never';
      s.tapsToReach = s.found ? s.linkIdx + 1 : null;
      s.timeToLink = s.found ? s.taps[s.linkIdx].t_ms : null;
      s.firstDelay = s.taps.length ? s.taps[0].t_ms : null;
      s.before = s.found ? s.taps.slice(0, s.linkIdx) : s.taps;
      s.loops = Math.max(0, ...s.events.filter(e => e.type === 'story_loop').map(e => +e.loop || 0));
      const opened = s.events.find(e => e.type === 'app_opened');
      s.opened = !!opened || s.found;
      s.wentBack = s.events.some(e => e.type === 'back_to_instagram');
      const leave = opened && s.events.find(e => e.t_ms > opened.t_ms && (e.type === 'back_to_instagram' || e.type === 'page_hidden'));
      s.appTime = leave ? leave.t_ms - opened.t_ms : null; s.appLeave = leave ? leave.type : null;
      s.started = s.started || (s.taps[0] && s.taps[0].received_at) || null;
      // Link B: first action and journey through the stories
      const ft = s.taps[0], firstNav = s.events.find(e => e.type.startsWith('nav_'));
      if (ft && ft.element === 'attribution-link') s.firstAction = 'link';
      else if (ft && (!firstNav || ft.t_ms <= firstNav.t_ms + 50)) s.firstAction = ft.screen === 'story' && ft.x < LEFT_ZONE ? 'prev' : 'next';
      else if (firstNav && firstNav.type === 'nav_auto') s.firstAction = 'auto';
      else s.firstAction = 'none';
      s.firstWrong = !s.firstTry && ft ? ft : null;
      s.segments = s.mode === 'B' ? timeline(s) : [];
      const away = s.segments.filter(g => g.kind === 'prev' || g.kind === 'next');
      s.awayTime = s.outcome === 'later' && away.length ? away.reduce((a,g) => a + g.t1 - g.t0, 0) : null;
      s.journey = s.segments.filter(g => g.kind !== 'app').map(g => g.kind).filter((k,i,a) => i === 0 || a[i-1] !== k);
      if (includeTest || !s.debug) out[s.mode].push(s);
    });
    out.A.sort(byOutcome); out.B.sort(byOutcome);
    return out;
  }
  // Tap areas up to the link, repeats collapsed (for the CSV)
  function pathOf(s){
    const steps = [];
    s.before.forEach(t => { const c = cat(t.element); if (steps.length && steps[steps.length-1].c === c) steps[steps.length-1].n++; else steps.push({c, n:1}); });
    return steps;
  }

  // ---------- Shared pieces of the page ----------
  function counts(S){ return {first:S.filter(s => s.outcome === 'first').length, later:S.filter(s => s.outcome === 'later').length, never:S.filter(s => s.outcome === 'never').length}; }

  function renderCompare(el, G){
    const card = m => {
      const S = G[m], n = S.length, here = m === state.mode, c = counts(S);
      const prog = n > TARGET ? `${n} sessions · planned ${TARGET}` : `${n} of ${TARGET} so far`;
      const sq = S.map(s => {
        const t = `${s.id} · ${OUTCOME[m][s.outcome]}${s.found ? ' · ' + ord(s.tapsToReach) + ' tap, ' + fmtS(s.timeToLink) : ''}`;
        return here
          ? `<button class="sq ${s.id === state.selected ? 'on' : ''} ${s.debug ? 'test' : ''}" style="background:${OUT_COLOR[s.outcome]}" data-id="${esc(s.id)}" title="${esc(t)}" aria-label="${esc(t)}"></button>`
          : `<a class="sq ${s.debug ? 'test' : ''}" style="background:${OUT_COLOR[s.outcome]}" href="${PAGES[m]}#s=${encodeURIComponent(s.id)}" title="${esc(t)}" aria-label="${esc(t)}"></a>`;
      }).join('') + Array(Math.max(0, TARGET - n)).fill('<span class="sq empty" title="Not run yet"></span>').join('');
      return `<section class="ccard ${here ? 'here' : ''}">
        <header><h3>Link ${m} <span>· ${m === 'A' ? 'taps do nothing' : 'realistic Instagram'}</span></h3>
        <span class="prog">${prog}${here ? '' : ` · <a href="${PAGES[m]}">open</a>`}</span></header>
        <div class="squares">${sq}</div>
        <div class="counts">${['first','later','never'].map(k => `<span><i style="background:${OUT_COLOR[k]}"></i><b>${c[k]}</b> ${esc(OUTCOME[m][k].toLowerCase())}</span>`).join('')}</div>
      </section>`;
    };
    el.innerHTML = card('A') + card('B');
    wireSelect(el);
  }

  // People who opened iHeart: how long they stayed and how they left
  function renderAfter(el, S){
    const O = S.filter(s => s.opened);
    if (!O.length) { el.innerHTML = '<div class="empty">Nobody has opened iHeart yet.</div>'; return; }
    const back = O.filter(s => s.wentBack), quick = back.filter(s => s.appTime != null && s.appTime < 10000);
    const maxMs = Math.max(30000, Math.ceil(Math.max(0, ...O.map(s => s.appTime || 0)) / 10000) * 10000);
    const rows = [...O].sort((a,b) => (b.wentBack - a.wentBack) || (a.appTime ?? 1e12) - (b.appTime ?? 1e12));
    el.innerHTML = `<div class="plist">${rows.map(s => {
      const on = s.id === state.selected ? ' style="background:var(--sel)"' : '';
      const end = s.wentBack ? `went back to Instagram after <b>${fmtS(s.appTime)}</b>` : s.appLeave === 'page_hidden' ? `left the page after ${fmtS(s.appTime)}` : 'still in iHeart when the session ended';
      const w = s.appTime != null ? Math.max(1.5, 100 * s.appTime / maxMs) : 100;
      const color = s.wentBack ? 'var(--sPrev)' : 'var(--first)';
      return `<div${on}>${pid(s)}</div><div${on}><div class="track"><i style="width:${w}%;background:${color};${s.appTime == null ? 'opacity:.35' : ''}"></i></div></div><div class="end"${on}><span>${end}</span></div>`;
    }).join('')}</div>
    <div class="legend"><span><i class="sqr" style="background:var(--first)"></i>Stayed in iHeart</span><span><i class="sqr" style="background:var(--sPrev)"></i>Went back to Instagram</span><span>Bar length: time in the iHeart player (full width = ${Math.round(maxMs/1000)} s)</span></div>
    <div class="read"><b>${O.length - back.length} of ${O.length}</b> who opened iHeart stayed there. ${back.length
      ? `${back.length} went back to Instagram${quick.length ? `, ${quick.length} within 10 seconds (${quick.map(s => esc(s.id)).join(', ')}). Watch those recordings: was the player what they expected?` : '.'}`
      : 'Nobody went back to Instagram.'}</div>`;
    wireSelect(el);
  }

  // ---------- Selection ----------
  function select(id, scrollTo){
    state.selected = state.selected === id ? null : id;
    rerender();
    if (scrollTo && state.selected) { const t = document.getElementById(scrollTo); if (t) t.scrollIntoView({behavior:'smooth', block:'center'}); }
  }
  function wireSelect(root, scrollTo){
    root.querySelectorAll('[data-id]').forEach(b => { if (b.tagName === 'A') return;
      b.onclick = e => { e.stopPropagation(); select(b.dataset.id, b.dataset.scroll || scrollTo); }; });
  }

  // ---------- Top bar, banner, dialogs ----------
  function mountChrome(){
    document.getElementById('bar').innerHTML = `<div class="wrap">
      <h1>Highlights share <span>· Instagram tap study</span></h1>
      <nav class="tabs" aria-label="Dashboards"><a href="${PAGES.A}" ${state.mode === 'A' ? 'aria-current="page"' : ''}>Link A</a><a href="${PAGES.B}" ${state.mode === 'B' ? 'aria-current="page"' : ''}>Link B</a></nav>
      <label class="toggle"><input type="checkbox" id="incTest"> Include my test sessions</label>
      <div class="status" id="status"><i></i><span>Connecting</span></div>
      <button class="btn" id="exportBtn">Download CSV</button>
      <button class="btn" id="clearBtn">Clear data</button>
      <button class="btn" id="settingsBtn">Settings</button></div>`;
    document.querySelector('main').insertAdjacentHTML('afterbegin',
      '<div class="banner" id="banner">You’re looking at <b>sample data</b>, not real participants. <button id="bannerBtn">Connect your Google Sheet</button> to see live results.</div>');
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="clearDlg"><form method="dialog">
        <h3>Clear all data?</h3>
        <p>This clears Link A and Link B together, and the dashboards start again from zero. Nothing is lost: the current data is moved to “archive” tabs in your Google Sheet, which you can delete there later.</p>
        <p id="clearMsg" style="color:var(--first);display:none"></p>
        <div class="row"><button class="btn" value="cancel">Cancel</button><button class="btn danger" id="clearGo" value="go">Clear data</button></div>
      </form></dialog>
      <dialog id="settings"><form method="dialog">
        <h3>Connect your Google Sheet</h3>
        <p>Paste the web app URL from Apps Script and the dashboard key you set in the script. They’re saved in this browser only and shared by both dashboards.</p>
        <label for="urlIn">Web app URL</label><input id="urlIn" placeholder="https://script.google.com/macros/s/…/exec">
        <label for="keyIn">Dashboard key</label><input id="keyIn" type="password" placeholder="The DASHBOARD_KEY from the script">
        <div class="row"><button class="btn" value="cancel">Cancel</button><button class="btn primary" value="save">Save and connect</button></div>
      </form></dialog>`);
  }

  const store = {
    get: k => { try { return localStorage.getItem(k); } catch (e) { return null; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) {} },
  };
  const cfg = () => ({ url: store.get('tapstudy.url') || (window.STUDY_CONFIG && window.STUDY_CONFIG.sheetUrl) || '', key: store.get('tapstudy.key') || '' });

  function wireChrome(){
    const dlg = document.getElementById('settings'), urlIn = document.getElementById('urlIn'), keyIn = document.getElementById('keyIn');
    const openSettings = () => { const c = cfg(); urlIn.value = c.url; keyIn.value = c.key; dlg.showModal(); };
    document.getElementById('settingsBtn').onclick = openSettings;
    document.getElementById('bannerBtn').onclick = openSettings;
    dlg.addEventListener('close', () => { if (dlg.returnValue !== 'save') return;
      store.set('tapstudy.url', urlIn.value.trim()); store.set('tapstudy.key', keyIn.value.trim()); state.lastSig = ''; poll(); });
    const inc = document.getElementById('incTest');
    inc.checked = store.get('tapstudy.incTest') === '1';
    inc.onchange = () => { store.set('tapstudy.incTest', inc.checked ? '1' : '0'); rerender(); };

    const clearDlg = document.getElementById('clearDlg'), clearMsg = document.getElementById('clearMsg'), clearGo = document.getElementById('clearGo');
    document.getElementById('clearBtn').onclick = () => { const c = cfg(); if (!c.url || !c.key) { openSettings(); return; }
      clearMsg.style.display = 'none'; clearGo.disabled = false; clearGo.textContent = 'Clear data'; clearDlg.showModal(); };
    clearGo.onclick = async ev => {
      ev.preventDefault(); const c = cfg(); clearGo.disabled = true; clearGo.textContent = 'Clearing…';
      try {
        const r = await fetch(`${c.url}?key=${encodeURIComponent(c.key)}&action=clear&t=${Date.now()}`); const j = await r.json();
        if (!j.cleared) throw new Error(j.error === 'wrong_key' ? 'Wrong dashboard key.' : 'The script didn’t confirm. Update the Apps Script code to the latest version.');
        clearDlg.close(); state.selected = null; state.lastSig = ''; state.data = {taps:[], events:[]}; rerender(); poll();
      } catch (e) { clearMsg.textContent = 'Couldn’t clear: ' + e.message; clearMsg.style.display = 'block'; clearGo.disabled = false; clearGo.textContent = 'Try again'; }
    };
    document.getElementById('exportBtn').onclick = exportCsv;
  }

  // ---------- Download CSV: both links, one row per story tap, participant summary on every row ----------
  function exportCsv(){
    const G = sessions(document.getElementById('incTest').checked);
    const cols = ['link','session','test','device','started','outcome','reached_iheart','taps_to_reach_iheart','time_to_link_s','first_tap_after_s',
      'loops_watched','first_action','journey','time_away_s','opened_iheart','time_in_iheart_s','went_back_to_instagram','tap_path',
      'tap_number','on_screen','element','part','label','area','is_attribution_link','x','y','time_s','video_time_s','story_loop','long_press','press_ms','input'];
    const q = v => { v = v == null ? '' : String(v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g,'""') + '"' : v; };
    const sec = ms => ms == null ? '' : (ms/1000).toFixed(1);
    const STORY = {main:'iHeart story', prev:'previous story', next:'next story'};
    const lines = [cols.join(',')];
    [...G.A.sort(byStart), ...G.B.sort(byStart)].forEach(s => {
      const path = pathOf(s).map(x => AREAS[x.c].label + (x.n > 1 ? ' x' + x.n : '')).concat(s.found ? ['Play on iHeartRadio'] : []).join(' > ');
      const base = [s.mode, s.id, s.debug, device(s.ua), s.started, OUTCOME[s.mode][s.outcome], s.found, s.tapsToReach ?? '', sec(s.timeToLink), sec(s.firstDelay),
        s.mode === 'A' ? s.loops : '', s.mode === 'B' ? s.firstAction : '', s.mode === 'B' ? s.journey.map(k => STORY[k]).join(' > ') : '', sec(s.awayTime),
        s.opened, sec(s.appTime), s.wentBack, path];
      if (!s.taps.length) lines.push([...base, ...Array(cols.length - base.length).fill('')].map(q).join(','));
      s.taps.forEach((t, i) => lines.push([...base, i + 1, t.screen, t.element, t.part, name(t.element, t.part), AREAS[cat(t.element)].label,
        t.element === 'attribution-link', t.x, t.y, (t.t_ms/1000).toFixed(2), t.video_time, t.story_loop, truthy(t.long_press), t.press_ms, t.pointer].map(q).join(',')));
    });
    const d = new Date(), stamp = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + lines.join('\n')], {type:'text/csv'}));
    a.download = `highlights-tap-study-${stamp}${state.sample ? '-SAMPLE' : ''}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }

  // ---------- Live data ----------
  function setStatus(kind, text){ const el = document.getElementById('status'); el.className = 'status ' + kind; el.querySelector('span').textContent = text; }
  async function poll(){
    const c = cfg();
    if (!c.url || !c.key) {
      if (!state.sample) { state.data = sampleData(); state.sample = true; rerender(); }
      document.getElementById('banner').classList.add('show'); setStatus('', 'Sample data'); return;
    }
    try {
      const r = await fetch(`${c.url}?key=${encodeURIComponent(c.key)}&t=${Date.now()}`); const j = await r.json();
      if (j.error === 'wrong_key') { setStatus('err', 'Wrong dashboard key'); return; }
      if (j.error) throw new Error(j.error);
      document.getElementById('banner').classList.remove('show');
      if (state.sample) { state.sample = false; state.lastSig = ''; }
      state.lastOk = Date.now();
      const sig = (j.taps || []).length + ':' + (j.events || []).length;
      if (sig !== state.lastSig) { state.lastSig = sig; state.data = {taps:j.taps || [], events:j.events || []}; rerender(); }
      setStatus('live', 'Live · updated just now');
    } catch (e) { setStatus('err', 'Can’t reach the Sheet. Retrying'); }
  }

  function rerender(){
    const inc = document.getElementById('incTest');
    const G = sessions(inc && inc.checked);
    state.render(G[state.mode], G);
  }

  function start({mode, render}){
    state.mode = mode; state.render = render;
    mountChrome(); wireChrome();
    const h = decodeURIComponent(location.hash || '');
    if (h.startsWith('#s=')) state.selected = h.slice(3);
    setInterval(() => { const el = document.getElementById('status');
      if (state.lastOk && el.classList.contains('live')) { const s = Math.round((Date.now() - state.lastOk)/1000); el.querySelector('span').textContent = `Live · updated ${s < 5 ? 'just now' : s + ' s ago'}`; } }, 1000);
    setInterval(poll, POLL_MS);
    poll();
  }

  // ---------- Sample data: 9 + 9 made-up sessions, shown only until a Sheet is connected ----------
  function sampleData(){
    let seed = 23; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const taps = [], events = [], now = Date.now();
    const spots = {
      'sticker-card|title':[190,560],'sticker-card|show-art':[64,557],'sticker-card|iheart-logo':[318,548],
      'background-video|center':[190,360],'background-video|right-third':[320,330],'background-video|left-third':[55,330],
      'username':[85,72],'avatar':[28,80],'action-send':[223,742],'action-more':[334,742],'progress-bar':[180,57]
    };
    const keys = Object.keys(spots), weights = [6,2,2,4,3,1,2,1,1,1,1];
    const pick = () => { let r = rnd() * weights.reduce((a,b)=>a+b), i = 0; while ((r -= weights[i]) > 0) i++; return keys[i]; };
    const code = p => (1200 + Math.floor(rnd()*8000)) + String.fromCharCode(65 + Math.floor(rnd()*26));
    // Link A
    const planA = ['first','later','later','first','never','later','later','first','never'];
    planA.forEach((plan, p) => {
      const id = 'HA-' + code(p), at = new Date(now - (9 - p) * 47 * 60000).toISOString();
      events.push({session:id, type:'story_start', t_ms:0, user_agent: rnd() > .15 ? 'iPhone' : 'Android', debug:false, received_at:at});
      let t = 1500 + rnd()*3000, seq = 0;
      const before = plan === 'first' ? 0 : plan === 'later' ? 1 + Math.floor(rnd()*4) : 5 + Math.floor(rnd()*4);
      for (let k = 0; k < before; k++) { const sp = pick(), [el, part] = sp.split('|');
        taps.push({session:id, seq:++seq, screen:'story', element:el, part:part || '', x:spots[sp][0] + (rnd()-.5)*30, y:spots[sp][1] + (rnd()-.5)*24, t_ms:Math.round(t), story_loop:Math.floor(t/20000), long_press: rnd() > .93, received_at:at});
        t += 1200 + rnd()*6000; }
      if (plan !== 'never') {
        taps.push({session:id, seq:++seq, screen:'story', element:'attribution-link', part:'text', x:100 + rnd()*60, y:91 + rnd()*5, t_ms:Math.round(t), story_loop:Math.floor(t/20000), long_press:false, received_at:at});
        events.push({session:id, type:'app_opened', t_ms:Math.round(t + 1950), received_at:at});
        events.push(rnd() > .7 ? {session:id, type:'back_to_instagram', t_ms:Math.round(t + 1950 + 3000 + rnd()*9000), received_at:at}
                               : {session:id, type:'page_hidden', t_ms:Math.round(t + 1950 + 15000 + rnd()*40000), received_at:at});
      }
      for (let l = 1; l <= Math.floor(t/20000); l++) events.push({session:id, type:'story_loop', loop:l, t_ms:l*20000, received_at:at});
    });
    // Link B
    const wrong = [['sticker-card','title',190,560],['sticker-card','show-art',64,557],['background-video','center',190,360],['background-video','right-third',320,330],
      ['background-video','left-third',55,330],['avatar','',28,80],['username','',85,72],['sticker-card','iheart-logo',318,548]];
    const W = [6,2,4,3,2,1,1,2], pickW = () => { let r = rnd() * W.reduce((a,b)=>a+b), i = 0; while ((r -= W[i]) > 0) i++; return wrong[i]; };
    const planB = ['first','later','never','later','first','later','never','auto','later'];
    planB.forEach((plan, p) => {
      const id = 'HB-' + code(p), at = new Date(now - (9 - p) * 39 * 60000).toISOString(); let seq = 0;
      events.push({session:id, type:'story_start', t_ms:0, user_agent: rnd() > .15 ? 'iPhone' : 'Android', debug:false, received_at:at});
      let t = 1200 + rnd()*5000, found = false;
      const tap = (screen, el, part, x, y, vt) => taps.push({session:id, seq:++seq, screen, element:el, part, x:x + (rnd()-.5)*24, y:y + (rnd()-.5)*20, t_ms:Math.round(t), video_time:vt, story_loop:0, received_at:at});
      const ev = (type, screen) => events.push({session:id, type, screen, t_ms:Math.round(t), received_at:at});
      if (plan === 'first') { if (rnd() < .5) t = 17200 + rnd()*2500; tap('story','attribution-link','text',120,93, +(t/1000).toFixed(2)); found = true; }
      else if (plan === 'auto') { t = 20000; ev('nav_auto','story'); t += 2000 + rnd()*2000;
        tap('story-next','next-story','left-third',50,420,null); ev('nav_prev','story-next');
        const back = t; t += 3000 + rnd()*6000; tap('story','attribution-link','text',120,93, +((t - back)/1000).toFixed(2)); found = true; }
      else {
        const w = pickW(), dir = w[2] < LEFT_ZONE ? 'prev' : 'next';
        tap('story', w[0], w[1], w[2], w[3], +(t/1000).toFixed(2)); ev(dir === 'prev' ? 'nav_prev' : 'nav_next', 'story');
        t += 1500 + rnd()*3000;
        if (plan === 'later') {
          tap('story-' + dir, dir + '-story', dir === 'next' ? 'left-third' : 'right', dir === 'next' ? 50 : 300, 420, null);
          ev(dir === 'next' ? 'nav_prev' : 'nav_next', 'story-' + dir);
          const back = t; t += 2000 + rnd()*7000;
          tap('story','attribution-link','text',120,93, +((t - back)/1000).toFixed(2)); found = true;
        } else { tap('story-' + dir, dir + '-story', 'right', 300, 420, null); ev('nav_next', 'story-' + dir); }
      }
      if (found) { ev('link_tapped'); t += 1950; ev('app_opened');
        const quick = rnd() < .3; t += quick ? 2500 + rnd()*7000 : 20000 + rnd()*50000; ev(quick ? 'back_to_instagram' : 'page_hidden'); }
      else { t += 4000; ev('page_hidden'); }
    });
    return {taps, events};
  }

  return {TARGET, STORY_S, ENDCARD_FROM, LEFT_ZONE, AREAS, NAMES, OUTCOME, OUT_COLOR, cat, name, esc, median, fmtS, fmtN, ord, people, pid, startedAt,
    device, truthy, byOutcome, byStart, counts, state, start, select, wireSelect, renderCompare, renderAfter};
})();
