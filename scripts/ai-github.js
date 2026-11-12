// IA exécutée sur les serveurs de GitHub Actions (modèle Qwen2.5 1.5B, via llama.cpp, sur CPU).
// Aucun service externe : le modèle est téléchargé une fois depuis Hugging Face puis mis en cache.
// Elle rédige : 1) une courte analyse (impact + que faire) pour chaque menace importante,
//               2) un brief des dernières 24 h et des 7 derniers jours.
const path = require('path');

const ORDER = { info: 0, faible: 1, moyen: 2, eleve: 3, critique: 4 };
const LBL = { critique: 'Critique', eleve: 'Élevé', moyen: 'Moyen', faible: 'Faible', info: 'Info' };
const SYSTEM = `Tu es un analyste de veille cybersécurité francophone. Tu travailles uniquement à partir des articles d'actualité publics fournis. Tu n'inventes rien. Tu réponds en français, de façon directe, sans introduction ni formule de politesse.`;

let llama, model, context, seq, LlamaChatSession;
async function load(cacheDir) {
  const lib = await import('node-llama-cpp');
  LlamaChatSession = lib.LlamaChatSession;
  const modelPath = await lib.resolveModelFile('hf:Qwen/Qwen2.5-1.5B-Instruct-GGUF:Q4_K_M', { directory: cacheDir, cli: false });
  llama = await lib.getLlama();
  model = await llama.loadModel({ modelPath });
  context = await model.createContext({ contextSize: 4096 });
  seq = context.getSequence();
}
async function prompt(text, maxTokens) {
  const s = new LlamaChatSession({ contextSequence: seq, systemPrompt: SYSTEM });
  try { return (await s.prompt(text, { maxTokens, temperature: 0.2 })).trim(); }
  finally { s.dispose({ disposeSequence: false }); await seq.clearHistory(); }
}

module.exports = async function runAI({ articles, srcName, brief, root, budgetMs = 180000 }) {
  const t0 = Date.now(), info = { error: null, analyses: 0, brief: false };
  try { await load(path.join(root, '.cache', 'models')); }
  catch (e) { info.error = 'chargement : ' + String(e.message).slice(0, 200); return info; }
  const left = () => budgetMs - (Date.now() - t0);
  const ctx = list => list.map((a, i) => `[${i + 1}] ${LBL[a.level]} ${a.score}/100 | ${srcName(a.sourceId)}${a.cves && a.cves.length ? ' | ' + a.cves.slice(0, 3).join(', ') : ''}\n${a.title}\n${(a.summary || '').slice(0, 300)}`).join('\n\n');
  const byCrit = (a, b) => ORDER[b.level] - ORDER[a.level] || b.score - a.score;

  try {
    // 1) Briefs (prioritaires)
    const now = Date.now();
    const jobs = [
      { key: 'h24', since: now - 864e5, every: 30 * 60e3, label: 'des dernières 24 heures' },
      { key: 'd7', since: now - 7 * 864e5, every: 3 * 36e5, label: 'des 7 derniers jours' },
    ];
    for (const j of []) { // briefs désactivés
      const cur = brief[j.key];
      if (cur && now - cur.at < j.every) continue;
      if (left() < 60000) break;
      const top = articles.filter(a => a.published >= j.since).sort(byCrit).slice(0, 10);
      if (!top.length) continue;
      const text = await prompt(`Voici les principales menaces cyber ${j.label} :\n\n${ctx(top)}\n\nRédige le point de situation : d'abord 2 phrases de synthèse, puis une liste à puces des menaces les plus graves (une ligne chacune, avec le numéro de l'article entre crochets comme [3]), puis 2 ou 3 recommandations concrètes. Utilise uniquement ces articles.`, 450);
      brief[j.key] = { at: now, text, refs: top.map(a => a.id) };
      info.brief = true;
    }

    // 2) Analyse courte de chaque menace importante récente
    const todo = articles.filter(a => !a.aiNote && ORDER[a.level] >= 2 && now - a.published < 7 * 864e5).sort(byCrit);
    for (const a of todo) {
      if (left() < 15000) break;
      a.aiNote = await prompt(`Article : ${a.title}\n${(a.summary || '').slice(0, 500)}${a.cves && a.cves.length ? '\nCVE : ' + a.cves.join(', ') : ''}\n\nEn 2 phrases maximum : quel est l'impact concret et que faut-il faire ?`, 110);
      info.analyses++;
    }
  } catch (e) { info.error = String(e.message).slice(0, 200); }
  info.ms = Date.now() - t0;
  return info;
};
