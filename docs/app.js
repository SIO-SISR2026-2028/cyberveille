const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const ORDER = { info: 0, faible: 1, moyen: 2, eleve: 3, critique: 4 };
const LBL = { critique: 'Critique', eleve: 'Élevé', moyen: 'Moyen', faible: 'Faible', info: 'Info' };
const LVLS = ['critique', 'eleve', 'moyen', 'faible', 'info'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('cv_' + k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('cv_' + k, JSON.stringify(v)); } catch {} } };

const S = {
  meta: null, articles: [], pending: [], freshIds: new Set(), chatHistory: [], lastRefs: [],
  pmode: store.get('pmode', 'week'), anchor: new Date(), loadedMonths: new Set(), view: store.get('view2', 'france'), region: store.get('region', 'all'),
  levels: new Set(store.get('levels', LVLS)), hidden: new Set(store.get('hidden', [])), q: '',
  ai: null,
};
const src = id => S.meta?.sources.find(s => s.id === id) || { name: id };

/* ---------- Utils ---------- */
function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; $('#toasts').append(t); setTimeout(() => t.remove(), 4200); }
function ago(ts) {
  const m = Math.round((Date.now() - ts) / 60000);
  if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`;
  return new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}
function dayLabel(ts) {
  const d = new Date(ts), t = new Date(); t.setHours(0, 0, 0, 0);
  const diff = Math.round((t - new Date(d).setHours(0, 0, 0, 0)) / 864e5);
  if (diff === 0) return "Aujourd'hui"; if (diff === 1) return 'Hier';
  const s = d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  return s[0].toUpperCase() + s.slice(1);
}
function md(text, refs = []) {
  let h = esc(text).replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2" target="_blank">lien</a>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>').replace(/^## (.+)$/gm, '<h3>$1</h3>').replace(/^# (.+)$/gm, '<h3>$1</h3>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/^\s*[-*•] (.+)$/gm, '<li>$1</li>').replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, '<ul>$1</ul>')
    .replace(/\[(\d{1,3})\]/g, (m, n) => { const r = refs[n - 1]; return r ? `<a class="ref" href="${esc(r.link)}" target="_blank" title="${esc(r.source + ' — ' + r.title)}">${n}</a>` : m; })
    
    .replace(/\n{2,}/g, '<br><br>').replace(/\n/g, '<br>');
  return h.replace(/<br>(<\/?(ul|li|h3))/g, '$1').replace(/(<\/(ul|li|h3)>)<br>/g, '$1');
}
async function api(url, opts = {}) {
  const r = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || 'Erreur ' + r.status);
  return j;
}

/* ---------- Période (semaine / mois / année) ---------- */
function range() {
  const d = new Date(S.anchor); d.setHours(0, 0, 0, 0);
  let start, end;
  if (S.pmode === 'week') { start = new Date(d); start.setDate(d.getDate() - ((d.getDay() + 6) % 7)); end = new Date(start); end.setDate(start.getDate() + 7); }
  else if (S.pmode === 'month') { start = new Date(d.getFullYear(), d.getMonth(), 1); end = new Date(d.getFullYear(), d.getMonth() + 1, 1); }
  else { start = new Date(d.getFullYear(), 0, 1); end = new Date(d.getFullYear() + 1, 0, 1); }
  return [start.getTime(), end.getTime()];
}
function periodLabel() {
  const [s, e] = range(), st = new Date(s), en = new Date(e - 1);
  if (S.pmode === 'week') {
    const f = (x, o) => x.toLocaleDateString('fr-FR', o);
    const cur = Date.now() >= s && Date.now() < e;
    return (cur ? 'Cette semaine · ' : '') + `${f(st, { day: 'numeric', month: st.getMonth() === en.getMonth() ? undefined : 'short' })} – ${f(en, { day: 'numeric', month: 'short', year: 'numeric' })}`;
  }
  if (S.pmode === 'month') { const t = st.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }); return t[0].toUpperCase() + t.slice(1); }
  return String(st.getFullYear());
}
function shift(dir) {
  const d = new Date(S.anchor);
  if (S.pmode === 'week') d.setDate(d.getDate() + 7 * dir);
  else if (S.pmode === 'month') d.setMonth(d.getMonth() + dir, 1);
  else d.setFullYear(d.getFullYear() + dir, 0, 1);
  S.anchor = d; changePeriod();
}
async function changePeriod() {
  $$('#pmode button').forEach(b => b.classList.toggle('on', b.dataset.m === S.pmode));
  $('#pLabel').textContent = periodLabel();
  $('#pNext').disabled = range()[1] > Date.now();
  await ensureMonths(); render();
}
// Charge les archives mensuelles nécessaires (au-delà des 45 derniers jours)
async function ensureMonths() {
  const [s, e] = range(), need = [];
  for (let d = new Date(s); d.getTime() < e; d.setMonth(d.getMonth() + 1, 1)) {
    const k = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    if ((S.meta.months || []).includes(k) && !S.loadedMonths.has(k)) need.push(k);
  }
  if (!need.length) return;
  $('#countLbl').textContent = 'Chargement des archives…';
  const lists = await Promise.all(need.map(k => api('data/archive/' + k + '.json').catch(() => [])));
  const ids = new Set(S.articles.map(a => a.id));
  lists.flat().forEach(a => { if (!ids.has(a.id)) { S.articles.push(a); ids.add(a.id); } });
  need.forEach(k => S.loadedMonths.add(k));
}

/* ---------- Filtering & rendering ---------- */
function filtered() {
  const [since, until] = range(), q = S.q.toLowerCase().trim();
  return S.articles.filter(a => a.published >= since && a.published < until && S.levels.has(a.level) && !S.hidden.has(a.sourceId)
    && (S.region === 'all' || (S.region === 'fr') === !!a.france)
    && (!q || (a.title + ' ' + a.summary + ' ' + (a.titleOrig || '') + ' ' + (a.summaryOrig || '') + ' ' + (a.cves || []).join(' ') + ' ' + src(a.sourceId).name + ' ' + (a.tags || []).join(' ')).toLowerCase().includes(q)));
}
function card(a, i) {
  const s = src(a.sourceId);
  return `<article class="art ${S.freshIds.has(a.id) ? 'fresh' : ''}" style="--c:var(--${a.level});--s:${a.score};animation-delay:${Math.min(i, 12) * 25}ms" data-id="${a.id}">
    <div class="gauge"><b>${a.score}</b></div>
    <div>
      <div class="art-meta"><span class="lvl">${LBL[a.level]}</span><b style="color:#cfd5e6">${esc(s.name)}</b>${a.france ? '<span class="fr-badge">🇫🇷 France</span>' : ''}${a.lang === 'en' ? '<span class="tr" title="Traduit automatiquement de l\'anglais">🌐 traduit</span>' : ''}<span title="${new Date(a.published).toLocaleString('fr-FR')}">· ${ago(a.published)}</span>${a.cvss ? `<span>· CVSS ${a.cvss}</span>` : ''}</div>
      <h3><a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.title)}</a></h3>
      ${a.summary ? `<p>${esc(a.summary)}</p>` : ''}
      ${a.titleOrig ? `<div class="orig" hidden><b>Original :</b> ${esc(a.titleOrig)}<br>${esc(a.summaryOrig || '')}</div>` : ''}
      ${a.aiNote ? `<div class="ai-note">✦ ${esc(a.aiNote)}</div>` : ''}
      ${(a.tags?.length || a.cves?.length) ? `<div class="tags">${(a.cves || []).slice(0, 4).map(c => `<span class="tag cve" data-q="${c}">${c}</span>`).join('')}${(a.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="art-actions"><button data-act="more">Développer</button>${S.meta.ai ? '<button data-act="ask">✦ Demander à l\'IA</button>' : ''}${a.titleOrig ? '<button data-act="orig">🌐 Voir l\'original</button>' : ''}<button data-act="copy">⧉ Copier le lien</button></div>
    </div></article>`;
}
function render() {
  const list = filtered(), feed = $('#feed');
  $('#countLbl').textContent = `${list.length} actualité${list.length > 1 ? 's' : ''}`;
  $('#empty').hidden = list.length > 0;
  let html = '';
  const rank = a => ORDER[a.level] * 100 + a.score + Math.max(0, 48 - (Date.now() - a.published) / 36e5) / 2;
  if (S.view === 'france') {
    // Bloc France (classé par importance) puis le reste du monde (classé par importance)
    const fr = list.filter(a => a.france).sort((a, b) => rank(b) - rank(a)).slice(0, 200);
    const world = list.filter(a => !a.france).sort((a, b) => rank(b) - rank(a)).slice(0, 200);
    if (fr.length) html += `<div class="day-head">🇫🇷 Concerne la France<span class="pill">${fr.length} actus</span><span class="bar"></span></div>` + fr.map(card).join('');
    if (world.length) html += `<div class="day-head">🌍 Reste du monde<span class="pill">${world.length} actus</span><span class="bar"></span></div>` + world.map(card).join('');
  } else if (S.view === 'priority') {
    html = list.sort((a, b) => rank(b) - rank(a)).slice(0, 300).map(card).join('');
  } else if (S.view === 'days') {
    const groups = new Map();
    list.sort((a, b) => b.published - a.published).forEach(a => {
      const k = new Date(a.published).toDateString(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a);
    });
    for (const [, arts] of groups) {
      arts.sort((a, b) => (b.france - a.france) || ORDER[b.level] - ORDER[a.level] || b.score - a.score);
      const crit = arts.filter(a => a.level === 'critique').length;
      html += `<div class="day-head">${dayLabel(arts[0].published)}<span class="pill">${arts.length} actus${crit ? ` · ${crit} critique${crit > 1 ? 's' : ''}` : ''}</span><span class="bar"></span></div>` + arts.map(card).join('');
    }
  } else {
    html = list.sort((a, b) => b.published - a.published).slice(0, 300).map(card).join('');
  }
  feed.innerHTML = html;
  renderStats(); renderSidebarCounts();
}
function renderStats() {
  const [since, until] = range();
  const base = S.articles.filter(a => a.published >= since && a.published < until && !S.hidden.has(a.sourceId) && (S.region === 'all' || (S.region === 'fr') === !!a.france));
  const c = l => base.filter(a => a.level === l).length;
  const today = base.filter(a => Date.now() - a.published < 864e5).length;
  $('#stats').innerHTML = [
    ['critique', c('critique'), 'Critiques'], ['eleve', c('eleve'), 'Élevées'], ['moyen', c('moyen'), 'Moyennes'],
    ['acc', base.filter(a => a.france && ORDER[a.level] >= 3).length, '🇫🇷 Graves en France'], ['faible', S.meta.sources.filter(s => s.status?.ok).length + '/' + S.meta.sources.length, 'Sources actives'],
  ].map(([k, v, l]) => `<div class="stat" data-lvl="${k}" style="--c:var(--${k})"><b>${v}</b><span>${l}</span></div>`).join('');
}
function renderSidebarCounts() {
  const [since, until] = range(), recent = S.articles.filter(a => a.published >= since && a.published < until);
  $('#levelFilters').innerHTML = LVLS.map(l => `<button class="lvl-chip ${S.levels.has(l) ? '' : 'off'}" data-l="${l}"><span class="sw" style="background:var(--${l})"></span>${LBL[l]}<span class="n">${recent.filter(a => a.level === l).length}</span></button>`).join('');
  const row = s => `<label class="src" title="${s.status?.ok ? 'OK — vérifié ' + ago(s.status.lastCheck) : esc(s.status?.lastError || 'En attente')}"><input type="checkbox" data-s="${s.id}" ${S.hidden.has(s.id) ? '' : 'checked'}><span class="st ${s.status ? (s.status.ok ? 'ok' : 'ko') : ''}"></span>${esc(s.name)}<span class="c">${recent.filter(a => a.sourceId === s.id).length}</span></label>`;
  const g = (t, f) => `<div class="src-group">${t}</div>` + S.meta.sources.filter(f).map(row).join('');
  $('#sourceList').innerHTML = g('🇫🇷 Officiel', s => s.type === 'officiel') + g('🇫🇷 Médias', s => s.region === 'fr' && s.type === 'media') + g('🌍 International', s => s.region === 'int');
}

/* ---------- Data loading (fichiers statiques mis à jour par GitHub Actions) ---------- */
async function fetchData() {
  const t = Date.now();
  const [meta, articles] = await Promise.all([api('data/meta.json?t=' + t), api('data/articles.json?t=' + t)]);
  meta.ai = true; return { meta, articles };
}
function setLive() {
  const m = Math.round((Date.now() - S.meta.updated) / 60000);
  $('#liveState').innerHTML = `<i class="dot ${m < 40 ? 'on' : ''}"></i> Mis à jour ${m < 1 ? "à l'instant" : 'il y a ' + (m < 60 ? m + ' min' : Math.round(m / 60) + ' h')}`;
}
async function load() {
  $('#feed').innerHTML = '<div class="skeleton"></div>'.repeat(6);
  try { ({ meta: S.meta, articles: S.articles } = await fetchData()); }
  catch { S.meta = { updated: Date.now(), sources: [], ai: true }; S.articles = []; $('#feed').innerHTML = ''; toast("Pas encore de données : la première collecte GitHub n'a pas encore tourné."); }
  S.ai = LocalAI.create(() => S.articles, S.meta.sources);
  await changePeriod(); setLive();
  setInterval(poll, 3 * 60000); setInterval(setLive, 60000);
}
async function poll(manual) {
  try {
    const d = await fetchData(), ids = new Set(S.articles.map(a => a.id));
    const fresh = d.articles.filter(a => !ids.has(a.id));
    S.meta = d.meta; setLive();
    if (fresh.length) {
      S.pending.push(...fresh.filter(a => !S.pending.some(p => p.id === a.id)));
      $('#newCount').textContent = S.pending.length; $('#newBanner').hidden = false;
      const crit = fresh.filter(a => ORDER[a.level] >= 3);
      if (crit.length) toast(`⚠️ ${crit.length} nouvelle(s) actu(s) ${LBL[crit[0].level].toLowerCase()} : ${crit[0].title.slice(0, 70)}…`);
      document.title = `(${S.pending.length}) CyberVeille`;
    } else if (manual) toast('Aucune nouveauté depuis la dernière collecte');
    renderSidebarCounts(); renderStats();
  } catch (e) { if (manual) toast('⚠️ ' + e.message); }
}
function flushPending() {
  const ids = new Set(S.articles.map(a => a.id));
  S.pending.forEach(a => { if (!ids.has(a.id)) { S.articles.unshift(a); S.freshIds.add(a.id); } });
  S.pending = []; $('#newBanner').hidden = true; document.title = 'CyberVeille — Veille cybersécurité en temps réel';
  render(); window.scrollTo({ top: 0, behavior: 'smooth' });
  setTimeout(() => { S.freshIds.clear(); $$('.art.fresh').forEach(e => e.classList.remove('fresh')); }, 8000);
}

/* ---------- Panels ---------- */
function open(id) { $('#' + id).classList.add('on'); $('#scrim').classList.add('on'); }
function closeAll() { $$('.drawer,.modal,.sidebar').forEach(e => e.classList.remove('on')); $('#scrim').classList.remove('on'); }

/* ---------- AI ---------- */
function addMsg(cls, html) { const d = document.createElement('div'); d.className = 'msg ' + cls; d.innerHTML = html; $('#chat').append(d); $('#chat').scrollTop = 1e9; return d; }
function ask(q) {
  if (!q.trim()) return;
  open('aiDrawer'); addMsg('user', esc(q));
  const t = addMsg('bot', '<span class="typing"><span></span><span></span><span></span></span>');
  setTimeout(() => { const r = S.ai.ask(q); t.innerHTML = md(r.answer, r.refs); }, 350);
}
function brief() {
  const since = Date.now() - $('#briefHours').value * 36e5;
  const arts = S.articles.filter(a => a.published >= since).sort((a, b) => b.score - a.score).slice(0, 80);
  const refs = arts.map(a => ({ link: a.link, title: a.title, source: src(a.sourceId).name }));
  $('#briefBody').innerHTML = md(S.ai.summary(arts, $('#briefStyle').value), refs) + `<div class="muted small" style="margin-top:8px">Basé sur ${arts.length} actualités</div>`;
  $('#btnBrief').textContent = 'Régénérer';
}

/* ---------- Alertes e-mail (lecture seule) ---------- */
async function openMail() {
  const m = location.hostname.match(/^([^.]+)\.github\.io$/), repo = location.pathname.split('/').filter(Boolean)[0];
  const base = m && repo ? `https://github.com/${m[1]}/${repo}` : null;
  $('#cfgLink').href = base ? base + '/edit/main/config.json' : '#';
  open('mailModal');
  try {
    const cfg = base ? (await (await fetch(`https://raw.githubusercontent.com/${m[1]}/${repo}/main/config.json?t=` + Date.now())).json()).email : null;
    if (!cfg) { $('#mailInfo').textContent = 'Réglages lisibles une fois le site publié sur GitHub Pages.'; return; }
    const f = { instantane: '⚡ Instantané', horaire: 'Toutes les heures', '6h': 'Toutes les 6 h', quotidien: 'Quotidien à ' + cfg.heure, hebdomadaire: 'Hebdomadaire' };
    $('#mailInfo').innerHTML = `<div class="cfg"><span>État</span><b>${cfg.actif ? '✅ Actif' : '⏸ Désactivé'}</b><span>Fréquence</span>${f[cfg.frequence] || cfg.frequence}
      <span>Gravité min.</span>${LBL[cfg.gravite_minimale] || 'Toutes'}<span>Zone</span>${cfg.zone}<span>Sources</span>${cfg.sources?.length ? cfg.sources.map(id => src(id).name).join(', ') : 'Toutes'}
      <span>Mots-clés</span>${cfg.mots_cles?.length ? esc(cfg.mots_cles.join(', ')) : '—'}<span>Résumé</span>${cfg.resume}<span>Max / e-mail</span>${cfg.max_actus}</div>`;
  } catch { $('#mailInfo').textContent = 'Impossible de lire config.json.'; }
}

/* ---------- Events ---------- */
function bind() {
  $('#btnMenu').onclick = () => open('sidebar');
  $('#btnCloseSide').onclick = closeAll; $('#scrim').onclick = closeAll;
  $$('[data-close]').forEach(b => b.onclick = closeAll);
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') closeAll();
    if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) { e.preventDefault(); $('#q').focus(); }
  });
  let qt; $('#q').oninput = e => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value; render(); }, 150); };

  $$('#pmode button').forEach(b => b.onclick = () => { S.pmode = b.dataset.m; store.set('pmode', S.pmode); changePeriod(); });
  $('#pPrev').onclick = () => shift(-1); $('#pNext').onclick = () => shift(1);
  $('#pToday').onclick = () => { S.anchor = new Date(); changePeriod(); };
  $$('#region button').forEach(b => { b.classList.toggle('on', b.dataset.r === S.region); b.onclick = () => { S.region = b.dataset.r; store.set('region', S.region); $$('#region button').forEach(x => x.classList.toggle('on', x === b)); render(); }; });
  $$('#viewTabs button').forEach(b => { b.classList.toggle('on', b.dataset.v === S.view); b.onclick = () => { S.view = b.dataset.v; store.set('view2', S.view); $$('#viewTabs button').forEach(x => x.classList.toggle('on', x === b)); render(); }; });

  $('#levelFilters').onclick = e => { const b = e.target.closest('[data-l]'); if (!b) return; const l = b.dataset.l; S.levels.has(l) ? S.levels.delete(l) : S.levels.add(l); store.set('levels', [...S.levels]); render(); };
  $('#stats').onclick = e => { const s = e.target.closest('[data-lvl]'); if (!s || !LVLS.includes(s.dataset.lvl)) return; S.levels = new Set([s.dataset.lvl]); store.set('levels', [...S.levels]); render(); toast('Filtre : ' + LBL[s.dataset.lvl] + ' uniquement'); };
  $('#sourceList').onchange = e => { const id = e.target.dataset.s; e.target.checked ? S.hidden.delete(id) : S.hidden.add(id); store.set('hidden', [...S.hidden]); render(); };
  $('#srcAll').onclick = e => { e.preventDefault(); S.hidden.clear(); store.set('hidden', []); render(); };
  $('#srcNone').onclick = e => { e.preventDefault(); S.hidden = new Set(S.meta.sources.map(s => s.id)); store.set('hidden', [...S.hidden]); render(); };

  $('#feed').onclick = e => {
    const art = e.target.closest('.art'); if (!art) return;
    const a = S.articles.find(x => x.id === art.dataset.id);
    const cve = e.target.closest('.cve'); if (cve) { $('#q').value = S.q = cve.dataset.q; render(); return; }
    const act = e.target.closest('[data-act]')?.dataset.act;
    if (act === 'more') { art.classList.toggle('open'); e.target.textContent = art.classList.contains('open') ? 'Réduire' : 'Développer'; }
    if (act === 'ask') ask(`Explique-moi cette actualité, son impact et les actions recommandées : « ${a.title} » (${src(a.sourceId).name})`);
    if (act === 'orig') { const o = art.querySelector('.orig'); o.hidden = !o.hidden; e.target.textContent = o.hidden ? "🌐 Voir l'original" : '🌐 Masquer l\'original'; }
    if (act === 'copy') navigator.clipboard.writeText(a.link).then(() => toast('Lien copié'));
  };
  $('#newBanner').onclick = flushPending;
  $('#btnRefresh').onclick = () => poll(true);

  $('#btnAI').onclick = () => { open('aiDrawer'); setTimeout(() => $('#chatQ').focus(), 300); };
  $('#suggest').onclick = e => e.target.tagName === 'BUTTON' && ask(e.target.textContent);
  $('#chatForm').onsubmit = e => { e.preventDefault(); const q = $('#chatQ').value; $('#chatQ').value = ''; ask(q); };
  $('#chatQ').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); } };
  $('#chatQ').oninput = e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; };
  $('#btnBrief').onclick = brief;

  $('#btnAlerts').onclick = openMail;
}

/* ---------- Boot ---------- */
bind();
load();
