const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const ORDER = { info: 0, faible: 1, moyen: 2, eleve: 3, critique: 4 };
const REPO = (() => { const m = location.hostname.match(/^([^.]+)\.github\.io$/); const r = location.pathname.split('/').filter(Boolean)[0]; return m && r ? m[1] + '/' + r : 'SIO-SISR2026-2028/cyberveille'; })();
const ic = n => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;
const FLAG = '<span class="flag-fr" aria-hidden="true"></span>';
const LBL = { critique: 'Critique', eleve: 'Élevé', moyen: 'Moyen', faible: 'Faible', info: 'Info' };
const LVLS = ['critique', 'eleve', 'moyen', 'faible'];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = { get(k, d) { try { return JSON.parse(localStorage.getItem('cv_' + k)) ?? d; } catch { return d; } }, set(k, v) { try { localStorage.setItem('cv_' + k, JSON.stringify(v)); } catch {} } };

const S = {
  meta: null, articles: [], pending: [], freshIds: new Set(), chatHistory: [], lastRefs: [],
  pmode: store.get('pmode', 'week'), anchor: new Date(), loadedMonths: new Set(), view: store.get('view3', 'priority'), region: store.get('region', 'all'),
  levels: new Set(store.get('levels', LVLS).filter(l => l !== 'info')), hidden: new Set(store.get('hidden', [])), q: '',
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
  $('#tabPeriod').textContent = { week: 'Semaine', month: 'Mois', year: 'Année' }[S.pmode];
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
      <div class="art-meta"><span class="lvl">${LBL[a.level]}</span><b style="color:#cfd5e6">${esc(s.name)}</b>${a.france ? `<span class="fr-badge">${FLAG} France</span>` : ''}${a.lang === 'en' ? `<span class="tr" title="Traduit automatiquement de l'anglais">${ic('lang')} traduit</span>` : ''}<span title="${new Date(a.published).toLocaleString('fr-FR')}">· ${ago(a.published)}</span>${a.cvss ? `<span>· CVSS ${a.cvss}</span>` : ''}</div>
      <h3><a href="${esc(a.link)}" target="_blank" rel="noopener">${esc(a.title)}</a></h3>
      ${a.summary ? `<p>${esc(a.summary)}</p>` : ''}
      ${a.titleOrig ? `<div class="orig" hidden><b>Original :</b> ${esc(a.titleOrig)}<br>${esc(a.summaryOrig || '')}</div>` : ''}
      ${a.aiNote ? `<div class="ai-note">${ic('spark')} ${esc(a.aiNote)}</div>` : ''}
      ${(a.tags?.length || a.cves?.length) ? `<div class="tags">${(a.cves || []).slice(0, 4).map(c => `<span class="tag cve" data-q="${c}">${c}</span>`).join('')}${(a.tags || []).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>` : ''}
      <div class="art-actions"><button data-act="more">${ic('down')} Développer</button><button data-act="ask">${ic('spark')} Détails IA</button>${a.titleOrig ? `<button data-act="orig">${ic('lang')} Original</button>` : ''}<button data-act="copy">${ic('copy')} Copier le lien</button></div>
    </div></article>`;
}
function render() {
  const list = filtered(), feed = $('#feed');
  $('#countLbl').textContent = `${list.length} actualité${list.length > 1 ? 's' : ''}`;
  $('#empty').hidden = list.length > 0;
  let html = '';
  const byCrit = (a, b) => ORDER[b.level] - ORDER[a.level] || b.score - a.score || b.published - a.published;
  if (S.view === 'priority' || S.view === 'france') {
    html = list.sort(byCrit).slice(0, 300).map(card).join('');
  } else if (S.view === 'days') {
    const groups = new Map();
    list.sort((a, b) => b.published - a.published).forEach(a => {
      const k = new Date(a.published).toDateString(); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(a);
    });
    for (const [, arts] of groups) {
      arts.sort(byCrit);
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
    ['acc', base.filter(a => a.france && ORDER[a.level] >= 3).length, 'Graves en France'], ['faible', S.meta.sources.filter(s => s.status?.ok).length + '/' + S.meta.sources.length, 'Sources actives'],
  ].map(([k, v, l]) => `<div class="stat" data-lvl="${k}" style="--c:var(--${k})"><b>${v}</b><span>${l}</span></div>`).join('');
}
function renderSidebarCounts() {
  const [since, until] = range(), recent = S.articles.filter(a => a.published >= since && a.published < until);
  $('#levelFilters').innerHTML = LVLS.map(l => `<button class="lvl-chip ${S.levels.has(l) ? '' : 'off'}" data-l="${l}"><span class="sw" style="background:var(--${l})"></span>${LBL[l]}<span class="n">${recent.filter(a => a.level === l).length}</span></button>`).join('');
  const row = s => `<label class="src" title="${s.status?.ok ? 'OK — vérifié ' + ago(s.status.lastCheck) : esc(s.status?.lastError || 'En attente')}"><input type="checkbox" data-s="${s.id}" ${S.hidden.has(s.id) ? '' : 'checked'}><span class="st ${s.status ? (s.status.ok ? 'ok' : 'ko') : ''}"></span>${esc(s.name)}<span class="c">${recent.filter(a => a.sourceId === s.id).length}</span></label>`;
  const g = (t, f) => `<div class="src-group">${t}</div>` + S.meta.sources.filter(f).map(row).join('');
  $('#sourceList').innerHTML = g(ic('building') + ' Officiel', s => s.type === 'officiel') + g(ic('news') + ' Médias FR', s => s.region === 'fr' && s.type === 'media') + g(ic('globe') + ' International', s => s.region === 'int');
}

/* ---------- Data loading (fichiers statiques mis à jour par GitHub Actions) ---------- */
async function fetchData() {
  const t = Date.now();
  const [meta, articles] = await Promise.all([api('data/meta.json?t=' + t), api('data/articles.json?t=' + t)]);
  meta.ai = true; articles.forEach(x => { if (x.level === 'info') x.level = 'faible'; }); return { meta, articles };
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
  setInterval(poll, 60000); setInterval(setLive, 60000);
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
      if (crit.length) toast(`${crit.length} nouvelle(s) menace(s) ${LBL[crit[0].level].toLowerCase()} : ${crit[0].title.slice(0, 70)}…`);
      document.title = `(${S.pending.length}) CyberVeille`;
    } else if (manual) toast('Aucune nouveauté depuis la dernière collecte');
    renderSidebarCounts(); renderStats();
  } catch (e) { if (manual) toast(e.message); }
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
/* IA avancée : modèle de langage exécuté DANS le navigateur (WebLLM + WebGPU).
   Aucun compte, aucun serveur, aucune conversation conservée. Seul le modèle est mis en cache. */
const LLM_MODELS = {
  leger: { id: 'Qwen2.5-0.5B-Instruct-q4f16_1-MLC', label: 'Léger (~400 Mo, mobile)' },
  standard: { id: 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC', label: 'Standard (~1 Go)' },
  puissant: { id: 'Qwen2.5-3B-Instruct-q4f16_1-MLC', label: 'Puissant (~2 Go, PC)' },
};
const LLM = { engine: null, loading: false, size: null };
const SYS = `Tu es l'analyste de veille cybersécurité du site CyberVeille.
Règles strictes :
- Réponds UNIQUEMENT avec les informations des articles fournis dans le CONTEXTE. N'invente jamais de fait, de date, de CVE ou de chiffre.
- Si la réponse n'est pas dans le contexte, dis-le simplement.
- Cite les articles avec leur numéro entre crochets, ex. [2].
- Réponds en français, de façon claire et concise, avec des listes à puces si utile. Donne des recommandations concrètes quand c'est pertinent.`;

function llmStatus(html) { $$('.llm-status').forEach(e => e.innerHTML = html); }
async function loadLLM(size) {
  if (LLM.loading) return;
  if (!navigator.gpu) { llmStatus(`${ic('alert')} Votre navigateur ne gère pas WebGPU (essayez Chrome ou Edge à jour). IA simple utilisée.`); return; }
  LLM.loading = true; LLM.engine = null;
  $$('.llm-btn').forEach(b => b.disabled = true);
  try {
    const webllm = await import('https://esm.run/@mlc-ai/web-llm@0.2.88');
    LLM.engine = await webllm.CreateMLCEngine(LLM_MODELS[size].id, {
      initProgressCallback: p => llmStatus(`Téléchargement / chargement du modèle : ${Math.round((p.progress || 0) * 100)} % <span class="muted">(une seule fois, ensuite en cache)</span>`),
    });
    LLM.size = size; store.set('llmSize', size);
    llmStatus(`${ic('check')} IA avancée active : ${LLM_MODELS[size].label.split(' (')[0]} · 100 % dans votre navigateur`);
  } catch (e) {
    llmStatus(`${ic('alert')} Impossible de charger l'IA avancée (${esc(e.message)}). IA simple utilisée.`);
  }
  LLM.loading = false;
  $$('.llm-btn').forEach(b => b.disabled = false);
}

// Choisit les articles servant de contexte (recherche locale), puis laisse le modèle rédiger.
function contextFor(q) {
  const base = S.ai.ask(q, S.lastRefs);
  let refs = base.refsRaw || [];
  if (!refs.length) {
    const [s, e] = range();
    refs = S.articles.filter(a => a.published >= s && a.published < e && !S.hidden.has(a.sourceId))
      .sort((a, b) => ORDER[b.level] - ORDER[a.level] || b.score - a.score).slice(0, 12);
  }
  return { base, refs: refs.slice(0, 12) };
}
const ctxText = refs => refs.map((a, i) => `[${i + 1}] ${LBL[a.level]} ${a.score}/100 | ${src(a.sourceId).name} | ${new Date(a.published).toLocaleDateString('fr-FR')}${a.france ? ' | concerne la France' : ''}${a.cves && a.cves.length ? ' | ' + a.cves.join(', ') : ''}\nTitre : ${a.title}\nRésumé : ${(a.summary || '').slice(0, 450)}`).join('\n\n');
const refLinks = refs => refs.map(a => ({ link: a.link, title: a.title, source: src(a.sourceId).name }));

async function answer(q, el, history) {
  const { base, refs } = contextFor(q);
  if (base.refsRaw && base.refsRaw.length) S.lastRefs = base.refsRaw;
  if (!LLM.engine) { el.innerHTML = md(base.answer, base.refs); return base.answer; }
  S.lastRefs = refs;
  const messages = [
    { role: 'system', content: SYS + '\n\nCONTEXTE :\n' + ctxText(refs) },
    ...history.slice(-4),
    { role: 'user', content: q },
  ];
  let out = '';
  try {
    const stream = await LLM.engine.chat.completions.create({ messages, stream: true, temperature: 0.2, max_tokens: 700 });
    for await (const chunk of stream) {
      out += chunk.choices[0]?.delta?.content || '';
      el.innerHTML = md(out, refLinks(refs));
    }
  } catch (e) { el.innerHTML = md(base.answer, base.refs); return base.answer; }
  el.innerHTML = md(out, refLinks(refs)) + `<div class="muted small" style="margin-top:6px">Sources : ${refs.length} articles de vos sources</div>`;
  return out;
}

const chatHist = []; // en mémoire uniquement, effacé à la fermeture de la page
async function ask(q) {
  if (!q.trim()) return;
  open('aiDrawer'); addMsg('user', esc(q));
  const t = addMsg('bot', '<span class="typing"><span></span><span></span><span></span></span>');
  const out = await answer(q, t, chatHist);
  chatHist.push({ role: 'user', content: q }, { role: 'assistant', content: out });
}
const inlineHist = [];
async function askInline(q) {
  if (!q.trim()) return;
  const d = document.createElement('div'); d.className = 'qa';
  d.innerHTML = `<div class="q">${ic('chevR')} ${esc(q)}</div><div class="a"><span class="typing"><span></span><span></span><span></span></span></div>`;
  $('#askOut').prepend(d);
  const out = await answer(q, d.querySelector('.a'), inlineHist);
  inlineHist.push({ role: 'user', content: q }, { role: 'assistant', content: out });
}
function brief() {
  const since = Date.now() - $('#briefHours').value * 36e5;
  const arts = S.articles.filter(a => a.published >= since).sort((a, b) => b.score - a.score).slice(0, 80);
  const refs = arts.map(a => ({ link: a.link, title: a.title, source: src(a.sourceId).name }));
  $('#btnBrief').textContent = 'Régénérer';
  if (LLM.engine && arts.length) {
    const top = arts.slice().sort((a, b) => ORDER[b.level] - ORDER[a.level] || b.score - a.score).slice(0, 12);
    S.lastRefs = top; $('#briefBody').innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
    const len = { court: 'en 5 puces maximum', standard: 'en un paragraphe de synthèse puis les points clés', detaille: 'de façon détaillée : menaces critiques, vulnérabilités à corriger, incidents, recommandations' }[$('#briefStyle').value];
    LLM.engine.chat.completions.create({ messages: [{ role: 'system', content: SYS + '\n\nCONTEXTE :\n' + ctxText(top) }, { role: 'user', content: 'Fais le point sur les menaces de la période ' + len + '.' }], stream: true, temperature: 0.2, max_tokens: 800 })
      .then(async stream => { let out = ''; for await (const c of stream) { out += c.choices[0]?.delta?.content || ''; $('#briefBody').innerHTML = md(out, refLinks(top)); } })
      .catch(() => { $('#briefBody').innerHTML = md(S.ai.summary(arts, $('#briefStyle').value), refs); });
    return;
  }
  $('#briefBody').innerHTML = md(S.ai.summary(arts, $('#briefStyle').value), refs) + `<div class="muted small" style="margin-top:8px">Basé sur ${arts.length} actualités</div>`;
}

/* ---------- Alertes e-mail : interface de réglage ---------- */
async function gh(path, opts = {}) {
  const tok = store.get('ghToken', null);
  const r = await fetch('https://api.github.com/repos/' + REPO + path, {
    method: opts.method || 'GET',
    headers: { Authorization: 'Bearer ' + tok, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (r.status === 404 && opts.allow404) return null;
  if (!r.ok) {
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) throw new Error('Clé invalide ou expirée');
    if (r.status === 403) throw new Error('Permission manquante sur la clé (Contents, Secrets et Actions en lecture/écriture)');
    throw new Error(j.message || 'GitHub ' + r.status);
  }
  return r.status === 204 ? {} : r.json().catch(() => ({}));
}
const b64 = { enc: s => btoa(unescape(encodeURIComponent(s))), dec: s => decodeURIComponent(escape(atob(s.replace(/\n/g, '')))) };
let sodium = null;
async function setSecret(name, value) {
  if (!sodium) { sodium = (await import('https://esm.sh/libsodium-wrappers@0.7.13')).default; await sodium.ready; }
  const { key, key_id } = await gh('/actions/secrets/public-key');
  const enc = sodium.crypto_box_seal(sodium.from_string(value), sodium.from_base64(key, sodium.base64_variants.ORIGINAL));
  await gh('/actions/secrets/' + name, { method: 'PUT', body: { encrypted_value: sodium.to_base64(enc, sodium.base64_variants.ORIGINAL), key_id } });
}
const hasSecret = async n => !!(await gh('/actions/secrets/' + n, { allow404: true }));
const mask = e => e.replace(/^(.{2}).*(@.*)$/, '$1•••$2');
let CFG = null, CFG_SHA = null;
async function saveCfg(msg) {
  const r = await gh('/contents/config.json', { method: 'PUT', body: { message: msg, content: b64.enc(JSON.stringify(CFG, null, 2) + '\n'), sha: CFG_SHA } });
  CFG_SHA = r.content && r.content.sha;
}
function syncFreq() { const f = $('#mFreq').value; $('#lHour').style.display = ['quotidien', 'hebdomadaire'].includes(f) ? '' : 'none'; $('#lDay').style.display = f === 'hebdomadaire' ? '' : 'none'; }
async function openMail() {
  open('mailModal');
  const tok = store.get('ghToken', null);
  $('#connectBox').hidden = !!tok; $('#mailForm').hidden = !tok;
  $('#repoName').textContent = REPO;
  $('#tokLink').href = 'https://github.com/settings/personal-access-tokens/new';
  if (!tok) { $('#mailSub').textContent = 'Connexion à votre dépôt requise une seule fois.'; return; }
  $('#mailSub').textContent = 'Chargement des réglages…';
  try {
    const f = await gh('/contents/config.json');
    CFG = JSON.parse(b64.dec(f.content)); CFG_SHA = f.sha;
    const c = CFG.email || {};
    $('#mActive').checked = c.actif !== false; $('#mFreq').value = c.frequence || 'quotidien';
    $('#mHour').value = c.heure || '08:00'; $('#mDay').value = c.jour_semaine ?? 1;
    $('#mLevel').value = c.gravite_minimale === 'info' ? 'faible' : (c.gravite_minimale || 'moyen');
    $('#mRegion').value = c.zone === 'france' ? 'france' : 'toutes'; $('#mMax').value = c.max_actus || 20;
    $('#mStyle').value = c.resume || 'standard'; $('#mKw').value = (c.mots_cles || []).join(', ');
    $('#mSources').innerHTML = S.meta.sources.map(s => `<span class="chip ${(c.sources || []).includes(s.id) ? 'on' : ''}" data-id="${s.id}">${esc(s.name)}</span>`).join('');
    $('#mEmail').value = '';
    const [mail, su, sp] = await Promise.all([hasSecret('MAIL_TO'), hasSecret('SMTP_USER'), hasSecret('SMTP_PASS')]);
    $('#emailState').innerHTML = mail ? `<span class="status-ok">${ic('check')} Adresse enregistrée : ${esc(c.adresse_masquee || '••••')}</span> — saisissez-en une autre pour la remplacer.` : `<span class="status-ko">${ic('alert')} Aucune adresse enregistrée.</span>`;
    $('#smtpState').innerHTML = su && sp ? `<span class="status-ok">${ic('check')} Expéditeur configuré</span>` : `<span class="status-ko">${ic('alert')} Expéditeur non configuré : les e-mails ne peuvent pas partir.</span>`;
    if (!(su && sp)) $('#smtpState').closest('details').open = true;
    $('#mailSub').textContent = "Les changements s'appliquent dès la prochaine collecte (≤ 5 min).";
    syncFreq();
  } catch (e) { $('#mailSub').textContent = e.message; if (/invalide/.test(e.message)) { store.set('ghToken', null); openMail(); } }
}
async function saveMail(e) {
  e.preventDefault();
  const btn = $('#mSubmit'); btn.disabled = true; btn.textContent = 'Enregistrement…';
  try {
    const email = $('#mEmail').value.trim(), from = $('#mFrom').value.trim(), pass = $('#mPass').value.replace(/\s/g, '');
    if (email) await setSecret('MAIL_TO', email);
    if (from) await setSecret('SMTP_USER', from);
    if (pass) await setSecret('SMTP_PASS', pass);
    CFG.email = Object.assign({}, CFG.email || {}, {
      actif: $('#mActive').checked, frequence: $('#mFreq').value, heure: $('#mHour').value, jour_semaine: +$('#mDay').value,
      gravite_minimale: $('#mLevel').value, zone: $('#mRegion').value, max_actus: +$('#mMax').value, resume: $('#mStyle').value,
      mots_cles: $('#mKw').value.split(',').map(s => s.trim()).filter(Boolean),
      sources: $$('#mSources .chip.on').map(c => c.dataset.id),
    }, email ? { adresse_masquee: mask(email) } : {});
    await saveCfg('Réglages des alertes (depuis le site)');
    $('#mEmail').value = $('#mFrom').value = $('#mPass').value = '';
    toast('Réglages enregistrés'); closeAll();
  } catch (err) { toast(err.message); }
  btn.disabled = false; btn.textContent = 'Enregistrer';
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
  $$('#viewTabs button').forEach(b => { b.classList.toggle('on', b.dataset.v === S.view); b.onclick = () => { S.view = b.dataset.v; store.set('view3', S.view); $$('#viewTabs button').forEach(x => x.classList.toggle('on', x === b)); render(); }; });

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
    if (act === 'more') { art.classList.toggle('open'); e.target.closest('button').innerHTML = art.classList.contains('open') ? ic('up') + ' Réduire' : ic('down') + ' Développer'; }
    if (act === 'ask') { S.lastRefs = [a]; ask('détails sur 1'); }
    if (act === 'orig') { const o = art.querySelector('.orig'); o.hidden = !o.hidden; e.target.closest('button').innerHTML = ic('lang') + (o.hidden ? ' Original' : ' Masquer l\'original'); }
    if (act === 'copy') navigator.clipboard.writeText(a.link).then(() => toast('Lien copié'));
  };
  $('#newBanner').onclick = flushPending;
  $('#btnRefresh').onclick = async () => {
    if (!store.get('ghToken', null)) { poll(true); return; }
    try {
      await gh('/actions/workflows/veille.yml/dispatches', { method: 'POST', body: { ref: 'main' } });
      toast('Collecte lancée : nouvelles actus dans 1 à 2 minutes');
      let n = 0; const t = setInterval(() => { poll(false); if (++n >= 6) clearInterval(t); }, 30000);
    } catch (e) { toast(e.message); poll(true); }
  };

  $('#btnAI').onclick = () => { open('aiDrawer'); setTimeout(() => $('#chatQ').focus(), 300); };
  $('#suggest').onclick = e => e.target.tagName === 'BUTTON' && ask(e.target.textContent);
  $('#chatForm').onsubmit = e => { e.preventDefault(); const q = $('#chatQ').value; $('#chatQ').value = ''; ask(q); };
  $('#chatQ').onkeydown = e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); $('#chatForm').requestSubmit(); } };
  $('#chatQ').oninput = e => { e.target.style.height = 'auto'; e.target.style.height = e.target.scrollHeight + 'px'; };
  $('#btnBrief').onclick = brief;
  $$('.llm-btn').forEach(b => b.onclick = () => loadLLM(b.previousElementSibling.value));
  $$('.llm-size').forEach(s => { s.innerHTML = Object.entries(LLM_MODELS).map(([k, v]) => `<option value="${k}">${v.label}</option>`).join(''); s.value = store.get('llmSize', /Mobi|Android/i.test(navigator.userAgent) ? 'leger' : 'standard'); });
  if (store.get('llmSize', null) && navigator.gpu) loadLLM(store.get('llmSize'));
  $('#askForm').onsubmit = e => { e.preventDefault(); askInline($('#askQ').value); $('#askQ').value = ''; };

  $('#btnAlerts').onclick = openMail;
  $('#mFreq').onchange = syncFreq;
  $('#mSources').onclick = e => e.target.classList.contains('chip') && e.target.classList.toggle('on');
  $('#mailForm').onsubmit = saveMail;
  $('#tokSave').onclick = async () => {
    const t = $('#tokIn').value.trim(); if (!t) return;
    store.set('ghToken', t); $('#tokIn').value = '';
    try { await gh(''); toast('Connecté'); openMail(); } catch (e) { store.set('ghToken', null); toast(e.message); }
  };
  $('#mDisconnect').onclick = () => { store.set('ghToken', null); toast('Clé retirée de ce navigateur'); closeAll(); };
  $('#mUnsub').onclick = async () => {
    if (!confirm('Supprimer votre adresse ? Plus aucun e-mail ne sera envoyé.')) return;
    try {
      await gh('/actions/secrets/MAIL_TO', { method: 'DELETE', allow404: true });
      CFG.email = Object.assign({}, CFG.email, { actif: false }); delete CFG.email.adresse_masquee;
      await saveCfg('Désabonnement (depuis le site)');
      toast('Adresse supprimée'); closeAll();
    } catch (e) { toast(e.message); }
  };
}

/* ---------- Boot ---------- */
bind();
load();
