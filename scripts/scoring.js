// Score d'importance (0-100) et niveau de gravité d'un article, par analyse heuristique.
// L'IA peut ensuite affiner le niveau des articles les plus importants (voir ai.js).

const RULES = [
  // [regex, points, tag]
  [/\b(0-?day|zero[- ]?day|jour z[ée]ro)\b/i, 30, '0-day'],
  [/activ(e|ely|ement)[ -]?(exploit|exploité)|exploited in the wild|exploitée? activement|exploitation active|in-the-wild/i, 30, 'Exploitée'],
  [/\bKEV\b|known exploited/i, 20, 'CISA KEV'],
  [/ransomware|ran[çc]ongiciel|rançongiciel|lockbit|akira|black ?basta|qilin|clop|play ransomware/i, 20, 'Ransomware'],
  [/\b(RCE|remote code execution|ex[ée]cution de code (à distance|arbitraire))\b/i, 20, 'RCE'],
  [/\bCERTFR-\d{4}-ALE|alerte de s[ée]curit[ée]/i, 25, 'Alerte CERT-FR'],
  [/\bCERTFR-\d{4}-AVI/i, 8, 'Avis CERT-FR'],
  [/critical|critique|urgent|emergency|patch now|corrigez|mettez à jour/i, 12, 'Critique'],
  [/data breach|fuite de donn[ée]es|leak|exfiltr|vol de donn[ée]es|piratage|pirat[ée]|hacked|hackers?|compromis|compromise|cyberattaque|cyber-?attack|attaque informatique|intrusion|breach/i, 14, 'Fuite / compromission'],
  [/supply[- ]chain|chaîne d'approvisionnement/i, 14, 'Supply chain'],
  [/backdoor|porte dérobée|botnet|wiper|malware|maliciel|infostealer|stealer|trojan|cheval de troie/i, 10, 'Malware'],
  [/phishing|hameçonnage|arnaque|scam|smishing|escroquerie|fraude/i, 6, 'Phishing'],
  [/\bDDoS\b|déni de service/i, 8, 'DDoS'],
  [/authentication bypass|contournement d'authentification|privilege escalation|élévation de privil/i, 12, 'Bypass / Élévation'],
  [/APT\d*|state[- ]sponsored|étatique|espionnage|espionage|lazarus|sandworm|volt typhoon|salt typhoon/i, 12, 'APT'],
  [/h[ôo]pital|hospital|santé|healthcare|collectivit|mairie|ministère|government|gouvernement|infrastructure critique|critical infrastructure|OIV/i, 8, 'Secteur sensible'],
  [/fortinet|fortigate|ivanti|citrix|netscaler|palo alto|pan-os|cisco|vmware|esxi|exchange|sharepoint|windows|chrome|microsoft|apple|ios|android|linux|sonicwall|checkpoint|juniper|f5|atlassian|confluence|jenkins|moveit|veeam/i, 6, 'Produit majeur'],
  [/patch tuesday|security update|mise à jour de sécurité|correctif|vulnérabilit|vulnerabilit|faille|flaw/i, 5, 'Vulnérabilité'],
  [/sanction|amende|fine|RGPD|GDPR|NIS ?2|DORA|cyber resilience act/i, 4, 'Réglementation'],
];

const LEVELS = [
  { id: 'critique', label: 'Critique', min: 70 },
  { id: 'eleve', label: 'Élevé', min: 50 },
  { id: 'moyen', label: 'Moyen', min: 30 },
  { id: 'faible', label: 'Faible', min: 0 },
];

function levelFromScore(score) {
  return LEVELS.find(l => score >= l.min).id;
}

function scoreArticle(article, source) {
  const text = `${article.title} ${article.summary || ''}`;
  let score = source.weight || 5;
  const tags = new Set();

  for (const [re, pts, tag] of RULES) {
    if (re.test(text)) { score += pts; tags.add(tag); }
  }

  // CVE
  const cves = [...new Set((text.match(/CVE-\d{4}-\d{4,7}/gi) || []).map(c => c.toUpperCase()))];
  if (cves.length) { score += Math.min(15, 6 + cves.length * 3); }

  // CVSS
  let cvss = null;
  const m = text.match(/CVSS(?:v?3(?:\.\d)?|v?4(?:\.0)?)?(?: score)?[^0-9]{0,15}(\d{1,2}(?:[.,]\d)?)/i);
  if (m) {
    cvss = parseFloat(m[1].replace(',', '.'));
    if (cvss > 10) cvss = null;
  }
  if (cvss !== null) {
    if (cvss >= 9) { score += 25; tags.add(`CVSS ${cvss}`); }
    else if (cvss >= 7) { score += 15; tags.add(`CVSS ${cvss}`); }
    else if (cvss >= 4) { score += 5; tags.add(`CVSS ${cvss}`); }
  }

  score = Math.max(0, Math.min(100, Math.round(score)));
  return { score, level: levelFromScore(score), tags: [...tags].slice(0, 6), cves, cvss };
}

// Une actu est conservée seulement si elle parle d'une menace, d'une faille ou d'une attaque.
const THREAT_TAGS = new Set(['0-day', 'Exploitée', 'CISA KEV', 'Ransomware', 'RCE', 'Alerte CERT-FR', 'Avis CERT-FR', 'Fuite / compromission', 'Supply chain', 'Malware', 'Phishing', 'DDoS', 'Bypass / Élévation', 'APT', 'Vulnérabilité']);
const isThreat = a => (a.cves && a.cves.length > 0) || (a.tags || []).some(t => THREAT_TAGS.has(t) || t.startsWith('CVSS'));
module.exports = { isThreat, scoreArticle, levelFromScore, LEVELS };
