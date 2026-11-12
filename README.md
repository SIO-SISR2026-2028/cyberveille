# 🛡️ CyberVeille : version 100 % gratuite (GitHub Pages)

- **Site** : `https://VOTRE-PSEUDO.github.io/cyberveille/`, gratuit, sans carte bancaire.
- **Collecte** : GitHub vérifie les 24 sources toutes les ~15 minutes et met le site à jour tout seul.
- **IA locale** : elle tourne dans votre navigateur. Rien n'est envoyé nulle part.
- **E-mails** : envoyés depuis votre Gmail vers votre adresse. Cette adresse est stockée dans un *Secret* chiffré, jamais publiée.
- **Vie privée** : aucun cookie, aucun traceur, aucune police Google. Le site n'enregistre rien sur ses visiteurs.

---

## Installation (≈ 15 minutes)

### 1. Créer un compte GitHub
https://github.com/signup : c'est gratuit. Votre pseudo apparaîtra dans l'adresse du site.

### 2. Créer le dépôt
1. Cliquez sur **+** (en haut à droite), puis **New repository**.
2. Nom : `cyberveille`. Cochez **Public**, c'est obligatoire pour GitHub Pages gratuit. Seules les actus publiques y figurent, jamais votre e-mail.
3. Cliquez sur **Create repository**.

### 3. Envoyer les fichiers
1. Sur la page du dépôt, cliquez sur **uploading an existing file**.
2. Dézippez `cyberveille-github.zip`, ouvrez le dossier `cv`, puis **glissez tout son contenu**. Attention, le dossier caché `.github` doit aussi être envoyé :
   - **Windows** : dans l'Explorateur, *Affichage → Afficher → Éléments masqués* ;
   - **Mac** : `Cmd + Maj + .` dans le Finder.
3. Cliquez sur **Commit changes**.

> Si le dossier `.github` refuse de s'envoyer : *Add file → Create new file*, tapez comme nom `.github/workflows/veille.yml`, puis collez-y le contenu du fichier `veille.yml`.

### 4. Activer le site
**Settings → Pages → Source : « GitHub Actions »**.

### 5. Autoriser la mise à jour automatique
**Settings → Actions → General → Workflow permissions → « Read and write permissions »**, puis **Save**.

### 6. Les e-mails (facultatif)
1. Sur votre compte Google : activez la validation en 2 étapes, puis créez un mot de passe d'application sur https://myaccount.google.com/apppasswords.
2. Dans le dépôt : **Settings → Secrets and variables → Actions → New repository secret**. Créez 3 secrets :
   - `SMTP_USER` : votre adresse Gmail (l'expéditeur)
   - `SMTP_PASS` : le mot de passe d'application de 16 lettres
   - `MAIL_TO` : l'adresse qui reçoit les actus

### 7. Premier lancement
**Actions → Veille cyber → Run workflow**. Au bout de 2 minutes environ, le site est en ligne : l'adresse s'affiche dans **Settings → Pages**.

---

## Personnaliser les e-mails
Dans le dépôt, ouvrez **`config.json`**, cliquez sur ✏️, modifiez, puis **Commit changes**.

| Réglage | Valeurs |
|---|---|
| `actif` | `true` / `false` (pause) |
| `frequence` | `instantane`, `horaire`, `6h`, `quotidien`, `hebdomadaire` |
| `heure` / `jour_semaine` | `"08:00"` (heure de Paris) / `1` = lundi |
| `gravite_minimale` | `info`, `faible`, `moyen`, `eleve`, `critique` |
| `zone` | `toutes`, `fr`, `int` |
| `sources` / `mots_cles` | listes, vides = tout |
| `max_actus` / `resume` | nombre / `aucun`, `court`, `standard`, `detaille` |

**Supprimer votre adresse** : supprimez le secret `MAIL_TO`. Plus rien ne sera envoyé.

## Bon à savoir
- GitHub peut retarder les tâches planifiées de quelques minutes, surtout aux heures de pointe.
- GitHub met en pause les tâches planifiées d'un dépôt public resté **60 jours sans activité**. Les mises à jour automatiques comptent normalement comme activité. En cas d'arrêt, cliquez sur **Actions → Enable workflow**.
- Ajouter ou retirer des sources : `scripts/sources.js`. Règles de gravité : `scripts/scoring.js`.
