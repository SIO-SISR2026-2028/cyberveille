// Exécuté par GitHub Actions toutes les ~15 min :
// 1) récupère les flux des 24 sources  2) calcule la gravité  3) écrit docs/data/*.json  4) envoie l'e-mail si c'est l'heure.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const Parser = require('rss-parser');
const nodemailer = require('nodemailer');
const sources = require('./sources');
const { scoreArticle } = require('./scoring');
const LocalAI = require('../docs/ai-local');

const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'docs', 'data');
const STATE = path.join(ROOT, 'state.json');
fs.mkdirSync(DATA, { recursive: true });
const readJSON = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const RETENTION_DAYS = 45;

const UA = 'Mozilla/5.0 (CyberVeille RSS aggregator)';
const parser = new Parser({ timeout: 10000, headers: { 'User-Agent': UA, Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml, */*' } });

const stripHtml = (s = '') => s.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&#8217;|&rsquo;/g, "'").replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, ' ').replace(/\s+/g, ' ').trim();

async function discoverFeed(siteUrl) {
  const html = await (await fetch(siteUrl, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(10000) })).text();
  for (const m of html.matchAll(/<link[^>]+type=["']application\/(rss|atom)\+xml["'][^>]*>/gi)) {
    const href = (m[0].match(/href=["']([^"']+)["']/i) || [])[1];
    if (href) return new URL(href, siteUrl).toString();
  }
  return null;
}

async function fetchSource(src, state, known) {
  const st = state.sources[src.id] || {};
  const candidates = [...new Set([st.feedUrl, ...(src.feeds || [])].filter(Boolean))];
  let feed = null, used = null, err = null;
  for (const url of candidates) { try { feed = await parser.parseURL(url); used = url; break; } catch (e) { err = e; } }
  if (!feed) { try { const auto = await discoverFeed(src.url); if (auto) { feed = await parser.parseURL(auto); used = auto; } } catch (e) { err = e; } }
  if (!feed) { state.sources[src.id] = { ...st, ok: false, lastCheck: Date.now(), lastError: String(err?.message || 'Flux introuvable').slice(0, 200) }; return []; }

  const fresh = [];
  for (const item of (feed.items || []).slice(0, 40)) {
    const link = item.link || item.guid;
    if (!link || !item.title) continue;
    const id = crypto.createHash('sha1').update(src.id + '|' + link).digest('hex').slice(0, 16);
    if (known.has(id)) continue;
    const pub = Date.parse(item.isoDate || item.pubDate) || Date.now();
    const art = { id, sourceId: src.id, title: stripHtml(item.title), link, summary: stripHtml(item.contentSnippet || item.summary || item.content || '').slice(0, 600), published: Math.min(pub, Date.now()), fetched: Date.now() };
    Object.assign(art, scoreArticle(art, src));
    fresh.push(art);
  }
  state.sources[src.id] = { ok: true, lastCheck: Date.now(), lastError: null, feedUrl: used };
  return fresh;
}

// ---------- E-mail ----------
const ORDER = { info: 0, faible: 1, moyen: 2, eleve: 3, critique: 4 };
const LABEL = { critique: 'Critique', eleve: 'Élevé', moyen: 'Moyen', faible: 'Faible', info: 'Info' };
const COLOR = { critique: '#ff3b5c', eleve: '#ff8a3d', moyen: '#f5c542', faible: '#3dd6a0', info: '#7c8cff' };
const esc = s => String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const md = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/^### (.+)$/gm, '<h3 style="margin:14px 0 6px;color:#fff;font-size:15px">$1</h3>').replace(/^- (.+)$/gm, '<div style="margin:4px 0 4px 8px">• $1</div>').replace(/\n/g, '<br>').replace(/<br>(<h3|<div)/g, '$1').replace(/(<\/h3>|<\/div>)<br>/g, '$1');
const srcName = id => (sources.find(s => s.id === id) || {}).name || id;

function parisNow() {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', weekday: 'short', hour12: false }).formatToParts(new Date()).map(x => [x.type, x.value]));
  const days = { 'dim.': 0, 'lun.': 1, 'mar.': 2, 'mer.': 3, 'jeu.': 4, 'ven.': 5, 'sam.': 6 };
  return { date: `${p.year}-${p.month}-${p.day}`, minutes: Number(p.hour) * 60 + Number(p.minute), weekday: days[p.weekday] };
}

function isDue(cfg, state) {
  const last = state.lastMail || 0, now = parisNow();
  const f = cfg.frequence;
  if (f === 'instantane') return true;
  if (f === 'horaire') return Date.now() - last >= 55 * 60e3;
  if (f === '6h') return Date.now() - last >= 355 * 60e3;
  const [h, m] = String(cfg.heure || '08:00').split(':').map(Number);
  if (now.minutes < h * 60 + m) return false;
  if (state.lastMailDate === now.date) return false;
  if (f === 'hebdomadaire' && now.weekday !== Number(cfg.jour_semaine ?? 1)) return false;
  return true;
}

function filterFor(cfg, list) {
  return list.filter(a => {
    if (ORDER[a.level] < ORDER[cfg.gravite_minimale || 'info']) return false;
    const s = sources.find(x => x.id === a.sourceId) || {};
    if (cfg.zone && cfg.zone !== 'toutes' && s.region !== cfg.zone) return false;
    if (cfg.sources?.length && !cfg.sources.includes(a.sourceId)) return false;
    if (cfg.mots_cles?.length) { const t = (a.title + ' ' + a.summary).toLowerCase(); if (!cfg.mots_cles.some(k => t.includes(String(k).toLowerCase()))) return false; }
    return true;
  }).sort((a, b) => ORDER[b.level] - ORDER[a.level] || b.score - a.score).slice(0, cfg.max_actus || 20);
}

async function maybeMail(articles, state) {
  const cfg = readJSON(path.join(ROOT, 'config.json'), {}).email || {};
  const { SMTP_USER, SMTP_PASS, MAIL_TO } = process.env;
  if (!cfg.actif || !SMTP_USER || !SMTP_PASS || !MAIL_TO) { console.log('[mail] désactivé ou secrets manquants'); return; }
  if (!isDue(cfg, state)) return;

  const since = cfg.frequence === 'instantane' ? (state.lastMail || Date.now() - 36e5) : (state.lastMail || Date.now() - 864e5);
  const list = filterFor(cfg, articles.filter(a => a.fetched > since));
  const markSent = () => { state.lastMail = Date.now(); state.lastMailDate = parisNow().date; };
  if (!list.length) { if (cfg.frequence !== 'instantane') markSent(); console.log('[mail] rien à envoyer'); return; }

  const ai = LocalAI.create(() => list, sources);
  const resume = cfg.resume && cfg.resume !== 'aucun' ? ai.summary(list, cfg.resume) : '';
  const titles = { instantane: 'Alerte', horaire: 'Point horaire', '6h': 'Point 6 h', quotidien: 'Digest quotidien', hebdomadaire: 'Digest hebdomadaire' };
  const site = process.env.SITE_URL || '';
  const html = `<!doctype html><html><body style="margin:0;background:#0b0e17;font-family:Segoe UI,Arial,sans-serif;color:#d6dbea">
   <div style="max-width:680px;margin:0 auto;padding:24px">
    <div style="font-size:22px;font-weight:700;color:#fff">🛡️ CyberVeille</div><div style="color:#8a93ad;margin-bottom:16px">${titles[cfg.frequence] || 'Digest'} — ${list.length} actus</div>
    ${resume ? `<div style="background:#161d30;border:1px solid #2a3350;border-radius:10px;padding:14px 16px;font-size:14px;line-height:1.55"><div style="font-weight:700;color:#fff;margin-bottom:6px">✦ Synthèse</div>${md(resume)}</div>` : ''}
    ${list.map((a, i) => `<div style="background:#131a2a;border-left:4px solid ${COLOR[a.level]};border-radius:8px;padding:12px 14px;margin:10px 0">
      <div style="font-size:11px;color:#8a93ad"><b style="color:${COLOR[a.level]}">[${i + 1}] ${LABEL[a.level].toUpperCase()} · ${a.score}/100</b> — ${esc(srcName(a.sourceId))}</div>
      <a href="${esc(a.link)}" style="color:#fff;font-weight:600;text-decoration:none;font-size:15px">${esc(a.title)}</a>
      ${a.cves?.length ? `<div style="font-size:12px;color:#7c8cff;margin-top:4px">${a.cves.join(' · ')}</div>` : ''}</div>`).join('')}
    <div style="margin-top:24px;font-size:12px;color:#6b7390">${site ? `<a style="color:#7c8cff" href="${site}">Ouvrir CyberVeille</a> · ` : ''}Pour changer la fréquence ou arrêter : modifiez config.json dans votre dépôt GitHub.</div>
   </div></body></html>`;

  const top = list[0];
  const subject = cfg.frequence === 'instantane' ? `[${LABEL[top.level]}] ${top.title}`.slice(0, 140) : `CyberVeille — ${titles[cfg.frequence]} : ${list.length} actus${list.some(a => a.level === 'critique') ? ' dont critiques ⚠️' : ''}`;
  const tx = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: Number(process.env.SMTP_PORT) || 465, secure: true, auth: { user: SMTP_USER, pass: SMTP_PASS } });
  await tx.sendMail({ from: `CyberVeille <${SMTP_USER}>`, to: MAIL_TO, subject, html });
  markSent();
  console.log('[mail] envoyé :', subject);
}

(async () => {
  const state = readJSON(STATE, { sources: {} });
  let articles = readJSON(path.join(DATA, 'articles.json'), []);
  const known = new Set(articles.map(a => a.id));
  const results = await Promise.allSettled(sources.map(s => Promise.race([fetchSource(s, state, known), new Promise((_, rej) => setTimeout(() => { state.sources[s.id] = { ...(state.sources[s.id] || {}), ok: false, lastCheck: Date.now(), lastError: 'Délai dépassé' }; rej(new Error('timeout')); }, 40000))])));
  const fresh = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
  const cutoff = Date.now() - RETENTION_DAYS * 864e5;
  articles = [...fresh, ...articles].filter(a => a.published >= cutoff).sort((a, b) => b.published - a.published);

  fs.writeFileSync(path.join(DATA, 'articles.json'), JSON.stringify(articles));
  fs.writeFileSync(path.join(DATA, 'meta.json'), JSON.stringify({
    updated: Date.now(),
    sources: sources.map(({ feeds, ...s }) => ({ ...s, status: state.sources[s.id] || null })),
  }));
  console.log(`[collecte] ${fresh.length} nouveaux, ${articles.length} au total, ${Object.values(state.sources).filter(s => s.ok).length}/${sources.length} sources OK`);

  try { await maybeMail(articles, state); } catch (e) { console.error('[mail] erreur :', e.message); }
  fs.writeFileSync(STATE, JSON.stringify(state, null, 1));
  process.exit(0);
})();
