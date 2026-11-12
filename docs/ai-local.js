// IA 100 % locale : tourne dans votre navigateur (et dans le script de collecte pour les e-mails).
// Aucune clé, aucun service externe, aucune donnée envoyée.
(function (root) {
  const LBL = { critique: 'Critique', eleve: 'Élevé', moyen: 'Moyen', faible: 'Faible', info: 'Info' };
  const ORDER = { info: 0, faible: 1, moyen: 2, eleve: 3, critique: 4 };
  const ALIASES = {
    certfr: ['cert-fr', 'certfr', 'cert fr'], anssi: ['anssi'], cybermalveillance: ['cybermalveillance'], cnil: ['cnil'],
    cybergend: ['cybergend', 'gendarmerie'], zataz: ['zataz'], cyberattaque: ['cyberattaque.org'], numerama: ['numerama', 'cyberguerre'],
    nextink: ['next.ink', 'next ink'], undernews: ['undernews'], gsm: ['global security mag', 'globalsecuritymag'], lemagit: ['lemagit'],
    lmi: ['monde informatique', 'lmi'], itconnect: ['it-connect', 'itconnect'], silicon: ['silicon'], solnum: ['solutions numeriques'],
    zdnetfr: ['zdnet'], usinedigitale: ['usine digitale'], riskintel: ['riskintel'], bleeping: ['bleepingcomputer', 'bleeping'],
    thn: ['hacker news', 'thehackernews', 'thn'], therecord: ['the record', 'therecord'], securityweek: ['securityweek'], darkreading: ['dark reading', 'darkreading'],
  };
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const STOP = new Set(norm('les des une un le la de du et en est que qui quoi quel quelle quelles quels pour sur dans avec par pas plus aux ces ses son sa leur mais donc car ont sont fait faire peux peut dois doit moi mes mon ton the and for what which are about cette cet tout tous toutes elle il ils on nous vous je tu me te se y a au ou ni si ne comment pourquoi quand combien explique resume resumer dis donne liste actu actus actualite actualites news semaine jour aujourd hui hier mois neuf publie alertes alerte').split(' '));
  const words = q => [...new Set(norm(q).split(/[^a-z0-9-]+/).filter(w => w.length > 2 && !STOP.has(w)))];
  const fmtDate = ts => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' });

  function create(getArticles, sources) {
    const srcName = id => (sources.find(s => s.id === id) || {}).name || id;
    const line = (a, n) => `- **${LBL[a.level]} ${a.score}/100** · ${a.title} (${srcName(a.sourceId)}, ${fmtDate(a.published)})${a.cves?.length ? ' — ' + a.cves.slice(0, 3).join(', ') : ''} [${n}]`;

    function period(q) {
      const n = norm(q);
      if (/aujourd|24 ?h|ce jour|today/.test(n)) return { ms: 864e5, label: 'les dernières 24 h' };
      if (/hier/.test(n)) return { ms: 2 * 864e5, label: 'depuis hier' };
      if (/mois|30 ?j/.test(n)) return { ms: 30 * 864e5, label: 'les 30 derniers jours' };
      return { ms: 7 * 864e5, label: 'les 7 derniers jours' };
    }

    function summary(arts, style = 'standard') {
      if (!arts.length) return 'Aucune nouvelle actualité sur la période.';
      const count = l => arts.filter(a => a.level === l).length;
      const tags = {}; arts.forEach(a => (a.tags || []).forEach(t => tags[t] = (tags[t] || 0) + 1));
      const topTags = Object.entries(tags).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([t, c]) => `${t} (${c})`);
      const cves = [...new Set(arts.flatMap(a => a.cves || []))];
      const ref = a => arts.indexOf(a) + 1;
      const n = { court: 4, standard: 6, detaille: 12 }[style] || 6;
      let out = `**${arts.length} actualités** · ${count('critique')} critiques · ${count('eleve')} élevées · ${count('moyen')} moyennes.`;
      if (topTags.length) out += `\nThèmes dominants : ${topTags.join(', ')}.`;
      const crit = arts.filter(a => ORDER[a.level] >= 3).slice(0, n);
      if (crit.length) out += `\n\n### À traiter en priorité\n` + crit.map(a => line(a, ref(a))).join('\n');
      if (style !== 'court') {
        const vuln = arts.filter(a => a.cves?.length && !crit.includes(a)).slice(0, n);
        if (vuln.length) out += `\n\n### Vulnérabilités\n` + vuln.map(a => line(a, ref(a))).join('\n');
        if (cves.length) out += `\n\nCVE citées : ${cves.slice(0, style === 'detaille' ? 30 : 12).join(', ')}${cves.length > 12 ? '…' : ''}`;
      }
      if (style === 'detaille') {
        for (const [tag, title] of [['Ransomware', 'Rançongiciels'], ['Fuite / compromission', 'Fuites & compromissions'], ['APT', 'Menaces étatiques'], ['Réglementation', 'Réglementation']]) {
          const g = arts.filter(a => a.tags?.includes(tag) && !crit.includes(a)).slice(0, 5);
          if (g.length) out += `\n\n### ${title}\n` + g.map(a => line(a, ref(a))).join('\n');
        }
      }
      return out;
    }

    function details(a) {
      const all = getArticles(), toks = new Set(norm(a.title).split(/[^a-z0-9-]+/).filter(w => w.length > 4 && !STOP.has(w)));
      const related = all.filter(b => b.id !== a.id && ((a.cves || []).some(c => (b.cves || []).includes(c)) || norm(b.title).split(/[^a-z0-9-]+/).filter(w => toks.has(w)).length >= 3)).slice(0, 5);
      let out = `### ${a.title}\n**${LBL[a.level]} · ${a.score}/100** — ${srcName(a.sourceId)}, ${fmtDate(a.published)}${a.france ? ' — concerne la France' : ''}`;
      if (a.summary) out += `\n\n${a.summary}`;
      if (a.titleOrig) out += `\n\n**Texte original :** ${a.titleOrig}${a.summaryOrig ? ' — ' + a.summaryOrig : ''}`;
      if (a.tags && a.tags.length) out += `\n\n**Caractéristiques :** ${a.tags.join(', ')}`;
      if (a.cves && a.cves.length) out += `\n**CVE :** ${a.cves.join(', ')}${a.cvss ? ' (CVSS ' + a.cvss + ')' : ''}`;
      const t = a.tags || [], reco = [];
      if (t.some(x => /Exploitée|0-day|KEV/.test(x))) reco.push('Faille exploitée : appliquer le correctif en urgence ou isoler les équipements concernés.');
      else if ((a.cves && a.cves.length) || t.includes('Vulnérabilité')) reco.push('Vérifier si vous utilisez le produit et planifier la mise à jour.');
      if (t.includes('Ransomware')) reco.push('Vérifier les sauvegardes hors ligne et surveiller les accès distants.');
      if (t.includes('Fuite / compromission')) reco.push('Si vous êtes concerné : changer vos mots de passe et vous méfier des e-mails de phishing.');
      if (t.includes('Phishing')) reco.push('Prévenir les utilisateurs et ne cliquer sur aucun lien suspect.');
      if (reco.length) out += `\n\n**Que faire :**\n` + reco.map(r => '- ' + r).join('\n');
      out += `\n\nArticle complet : [1]`;
      if (related.length) out += `\n\n**Actus liées :**\n` + related.map((b, i) => line(b, i + 2)).join('\n');
      return { answer: out, refs: [a].concat(related) };
    }

    function ask(question, lastRefs) {
      lastRefs = lastRefs || [];
      const pack = r => ({ answer: r.answer, refs: r.refs.map(a => ({ link: a.link, title: a.title, source: srcName(a.sourceId) })), refsRaw: r.refs });
      const dm = norm(question).match(/(?:detail|plus d.?info|explique|precise|developpe|en savoir plus|parle)[^0-9]*\[?(\d{1,2})\]?|^\s*\[?(\d{1,2})\]?\s*\??\s*$/);
      if (dm && lastRefs.length) {
        const n = +(dm[1] || dm[2]), a = lastRefs[n - 1];
        return a ? pack(details(a)) : { answer: `Pas d'article n°${n} dans ma dernière réponse.`, refs: [] };
      }
      return pack(askCore(question));
    }

    function askCore(question) {
      const all = getArticles(), n = norm(question), { ms, label } = period(question);
      let pool = all.filter(a => a.published >= Date.now() - ms), intro = '', list = [];
      const src = sources.find(s => (ALIASES[s.id] || [s.id]).some(al => new RegExp('(^|[^a-z0-9])' + al.replace(/[.-]/g, '\\$&') + '([^a-z0-9]|$)').test(n)));
      if (src) pool = pool.filter(a => a.sourceId === src.id);
      const cveQ = (question.match(/CVE-\d{4}-\d{4,7}/i) || [])[0];

      if (cveQ) {
        list = all.filter(a => (a.cves || []).includes(cveQ.toUpperCase()) || norm(a.title + a.summary).includes(norm(cveQ)));
        intro = list.length ? `**${cveQ.toUpperCase()}** est mentionnée dans ${list.length} article(s) :` : `Aucune source surveillée ne mentionne **${cveQ.toUpperCase()}** pour l'instant.`;
      } else if (/\bcve\b|corriger|patch|vulnerab|faille|mettre a jour|mise a jour/.test(n)) {
        list = pool.filter(a => a.cves?.length || a.tags?.includes('Vulnérabilité')).sort((a, b) => b.score - a.score);
        intro = `Vulnérabilités à traiter en priorité sur ${label} :`;
      } else if (/\bfrance\b|francais|hexagone/.test(n) && !/critique|grave|cve|faille/.test(n)) {
        list = pool.filter(a => a.france).sort((a, b) => ORDER[b.level] - ORDER[a.level] || b.score - a.score);
        intro = `Actualités qui concernent la France sur ${label} (par importance) :`;
      } else if (/critique|grave|urgent|important|prior|danger|menace/.test(n)) {
        list = pool.filter(a => ORDER[a.level] >= 3 && (!/france|francais/.test(n) || a.france)).sort((a, b) => (b.france - a.france) || b.score - a.score);
        intro = `Menaces de niveau Élevé ou Critique sur ${label}${src ? ' (' + src.name + ')' : ''} :`;
      } else if (/resum|synthese|bilan|point|quoi de neuf/.test(n) && !words(question).filter(w => !(src && (ALIASES[src.id] || []).some(a => a.includes(w)))).length) {
        const arts = pool.sort((a, b) => b.score - a.score);
        return { answer: summary(arts), refs: arts };
      } else {
        const kw = words(question).filter(w => !(src && (ALIASES[src.id] || []).some(a => a.includes(w))));
        const hits = (src ? pool : all).map(a => {
          const t = norm(a.title), b = norm(a.summary + ' ' + (a.tags || []).join(' '));
          return [a, kw.reduce((acc, w) => acc + (t.includes(w) ? 3 : 0) + (b.includes(w) ? 1 : 0), 0)];
        }).filter(([, s]) => s > 0 || src);
        list = hits.sort((x, y) => y[1] - x[1] || y[0].published - x[0].published).map(x => x[0]);
        intro = list.length
          ? `${list.length} actualité(s)${kw.length ? ' pour « ' + kw.join(', ') + ' »' : ''}${src ? ' chez ' + src.name : ''} :`
          : `Je n'ai rien trouvé à ce sujet dans les sources surveillées. Essayez d'autres mots-clés (éditeur, CVE, type d'attaque…).`;
      }
      list = list.slice(0, 10);
      let answer = intro + (list.length ? '\n' + list.map((a, i) => line(a, i + 1)).join('\n') : '');
      const crit = list.filter(a => a.level === 'critique').length;
      if (crit) answer += `\n\n**Attention :** ${crit} menace(s) critique(s) : consultez les avis et appliquez les correctifs sans attendre.`;
      if (list.length) answer += `\n\n*Tapez « détails sur 2 » pour approfondir une actu.*`;
      return { answer, refs: list };
    }

    return { ask, summary };
  }

  if (typeof module !== 'undefined') module.exports = { create };
  else root.LocalAI = { create };
})(this);
