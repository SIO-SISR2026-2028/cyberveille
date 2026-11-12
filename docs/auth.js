// Écran d'accès : un code à 6 chiffres est envoyé par e-mail via Web3Forms.
// L'adresse de destination est enregistrée chez Web3Forms (liée à la clé ci-dessous) : elle n'apparaît pas dans ce code.
// La clé Web3Forms est publique par conception : elle permet seulement d'envoyer un message à son propriétaire.
(function () {
  const WEB3FORMS_KEY = '445243b8-a502-47c3-83c8-24e0ff529686';
  const DAYS = 30; // durée de la session sur cet appareil
  const KEY = 'cv_auth';

  const ok = () => { try { const s = JSON.parse(localStorage.getItem(KEY)); return s && s.until > Date.now(); } catch { return false; } };
  if (ok()) return;

  document.documentElement.classList.add('locked');
  const box = document.createElement('div');
  box.className = 'gate';
  box.innerHTML = `
    <div class="gate-card">
      <svg class="i gate-logo"><use href="#i-shield"/></svg>
      <h1>CyberVeille</h1>
      <p class="muted">Accès privé. Un code de connexion va être envoyé à l'adresse e-mail du propriétaire.</p>
      <button class="btn primary" id="gSend">Recevoir un code par e-mail</button>
      <form id="gForm" hidden>
        <input id="gCode" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="Code à 6 chiffres">
        <button class="btn primary">Se connecter</button>
      </form>
      <p class="small muted" id="gMsg"></p>
    </div>`;
  document.body.prepend(box);

  let hash = null, expires = 0, tries = 0;
  const sha = async s => [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)))].map(b => b.toString(16).padStart(2, '0')).join('');
  const msg = t => { box.querySelector('#gMsg').textContent = t; };

  box.querySelector('#gSend').onclick = async e => {
    const b = e.currentTarget; b.disabled = true; msg('Envoi…');
    const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
    try {
      const r = await fetch('https://api.web3forms.com/submit', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ access_key: WEB3FORMS_KEY, subject: 'CyberVeille : votre code de connexion', from_name: 'CyberVeille', message: `Votre code de connexion : ${code}\n\nIl est valable 10 minutes. Si vous n'avez pas demandé ce code, ignorez ce message.` }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok || j.success === false) throw new Error(j.message || 'Envoi impossible');
      hash = await sha(code); expires = Date.now() + 10 * 60e3; tries = 0;
      box.querySelector('#gForm').hidden = false; box.querySelector('#gCode').focus();
      msg('Code envoyé. Consultez votre boîte mail (et les spams).');
      setTimeout(() => { b.disabled = false; b.textContent = 'Renvoyer un code'; }, 30000);
    } catch (err) { msg('Erreur : ' + err.message); b.disabled = false; }
  };

  box.querySelector('#gForm').onsubmit = async e => {
    e.preventDefault();
    const v = box.querySelector('#gCode').value.trim();
    if (!hash || Date.now() > expires) return msg('Code expiré : demandez-en un nouveau.');
    if (++tries > 5) { hash = null; return msg('Trop d\'essais : demandez un nouveau code.'); }
    if (await sha(v) !== hash) return msg('Code incorrect.');
    localStorage.setItem(KEY, JSON.stringify({ until: Date.now() + DAYS * 864e5 }));
    document.documentElement.classList.remove('locked'); box.remove();
  };

  window.cvLogout = () => { localStorage.removeItem(KEY); location.reload(); };
})();
