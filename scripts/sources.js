// Liste des sources surveillées.
// `feeds` : flux RSS/Atom connus. S'ils échouent, le serveur détecte automatiquement
// le flux depuis la page d'accueil (<link rel="alternate" type="application/rss+xml">).
// `weight` : poids de la source dans le score d'importance (officiel = plus fort).
module.exports = [
  // 🇫🇷 Sources officielles
  { id: 'certfr', name: 'CERT-FR', url: 'https://cert.cyber.gouv.fr/', region: 'fr', type: 'officiel', weight: 25,
    feeds: ['https://cert.cyber.gouv.fr/feed/', 'https://www.cert.ssi.gouv.fr/feed/', 'https://www.cert.ssi.gouv.fr/alerte/feed/'] },
  { id: 'anssi', name: 'ANSSI', url: 'https://cyber.gouv.fr/', region: 'fr', type: 'officiel', weight: 20,
    feeds: ['https://cyber.gouv.fr/actualites/rss.xml', 'https://cyber.gouv.fr/rss.xml'] },
  { id: 'cybermalveillance', name: 'Cybermalveillance.gouv.fr', url: 'https://www.cybermalveillance.gouv.fr/', region: 'fr', type: 'officiel', weight: 18,
    feeds: ['https://www.cybermalveillance.gouv.fr/feed/atom-flux-actualites', 'https://www.cybermalveillance.gouv.fr/feed/atom-flux-alertes'] },
  { id: 'cnil', name: 'CNIL', url: 'https://www.cnil.fr/', region: 'fr', type: 'officiel', weight: 12,
    feeds: ['https://www.cnil.fr/fr/rss.xml'] },
  { id: 'cybergend', name: 'CyberGEND', url: 'https://www.gendarmerie.interieur.gouv.fr/', region: 'fr', type: 'officiel', weight: 12,
    feeds: ['https://www.gendarmerie.interieur.gouv.fr/rss'] },

  // 🇫🇷 Médias spécialisés
  { id: 'zataz', name: 'ZATAZ', url: 'https://www.zataz.com/', region: 'fr', type: 'media', weight: 8, feeds: ['https://www.zataz.com/feed/'] },
  { id: 'cyberattaque', name: 'Cyberattaque.org', url: 'https://www.cyberattaque.org/', region: 'fr', type: 'media', weight: 6, feeds: ['https://www.cyberattaque.org/feed/'] },
  { id: 'numerama', name: 'Cyberguerre (Numerama)', url: 'https://www.numerama.com/cyberguerre/', region: 'fr', type: 'media', weight: 7, feeds: ['https://www.numerama.com/cyberguerre/feed/'] },
  { id: 'nextink', name: 'Next.ink', url: 'https://next.ink/', region: 'fr', type: 'media', weight: 6, feeds: ['https://next.ink/feed/'] },
  { id: 'undernews', name: 'UnderNews', url: 'https://www.undernews.fr/', region: 'fr', type: 'media', weight: 6, feeds: ['https://www.undernews.fr/feed'] },
  { id: 'gsm', name: 'Global Security Mag', url: 'https://www.globalsecuritymag.fr/', region: 'fr', type: 'media', weight: 5, feeds: ['https://www.globalsecuritymag.fr/spip.php?page=backend'] },
  { id: 'lemagit', name: 'LeMagIT', url: 'https://www.lemagit.fr/', region: 'fr', type: 'media', weight: 7, feeds: ['https://www.lemagit.fr/rss/ContentSyndication.xml'] },
  { id: 'lmi', name: 'Le Monde Informatique', url: 'https://www.lemondeinformatique.fr/', region: 'fr', type: 'media', weight: 6, feeds: ['https://www.lemondeinformatique.fr/flux-rss/thematique/securite/rss.xml', 'https://www.lemondeinformatique.fr/flux-rss/rss.xml'] },
  { id: 'itconnect', name: 'IT-Connect', url: 'https://www.it-connect.fr/', region: 'fr', type: 'media', weight: 7, feeds: ['https://www.it-connect.fr/feed/'] },
  { id: 'silicon', name: 'Silicon.fr', url: 'https://www.silicon.fr/', region: 'fr', type: 'media', weight: 5, feeds: ['https://www.silicon.fr/feed'] },
  { id: 'solnum', name: 'Solutions Numériques', url: 'https://www.solutions-numeriques.com/', region: 'fr', type: 'media', weight: 5, feeds: ['https://www.solutions-numeriques.com/feed/'] },
  { id: 'zdnetfr', name: 'ZDNet France', url: 'https://www.zdnet.fr/', region: 'fr', type: 'media', weight: 6, feeds: ['https://www.zdnet.fr/feeds/rss/actualites/', 'https://www.zdnet.fr/feeds/rss/'] },
  { id: 'usinedigitale', name: "L'Usine Digitale", url: 'https://www.usine-digitale.fr/', region: 'fr', type: 'media', weight: 4, feeds: ['https://www.usine-digitale.fr/rss'] },
  { id: 'riskintel', name: 'RiskIntel', url: 'https://www.riskintel.fr/', region: 'fr', type: 'media', weight: 6, feeds: ['https://www.riskintel.fr/feed/'] },

  // 🌍 International
  { id: 'bleeping', name: 'BleepingComputer', url: 'https://www.bleepingcomputer.com/', region: 'int', type: 'media', weight: 9, feeds: ['https://www.bleepingcomputer.com/feed/'] },
  { id: 'thn', name: 'The Hacker News', url: 'https://thehackernews.com/', region: 'int', type: 'media', weight: 9, feeds: ['https://feeds.feedburner.com/TheHackersNews'] },
  { id: 'therecord', name: 'The Record', url: 'https://therecord.media/', region: 'int', type: 'media', weight: 8, feeds: ['https://therecord.media/feed'] },
  { id: 'securityweek', name: 'SecurityWeek', url: 'https://www.securityweek.com/', region: 'int', type: 'media', weight: 8, feeds: ['https://www.securityweek.com/feed/'] },
  { id: 'darkreading', name: 'Dark Reading', url: 'https://www.darkreading.com/', region: 'int', type: 'media', weight: 7, feeds: ['https://www.darkreading.com/rss.xml'] },
];
