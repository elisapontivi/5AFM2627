'use strict';
/* Accesso al sito: numero di registro + compleanno (ggmm).
   Va caricato nel <head> DOPO config.js e cloud.js.
   Espone window.Accesso = { ready: Promise<profilo>, profile, logout() } */
(() => {
  const STUDENTI = 27;
  const root = document.documentElement;
  root.classList.add('gated');

  const style = document.createElement('style');
  style.textContent = `
.gated body>*:not(#gate){visibility:hidden}
#gate{position:fixed;inset:0;z-index:1000;display:grid;place-items:center;padding:20px;background:#102f43;font:16px/1.5 system-ui,-apple-system,Segoe UI,sans-serif;color:#102f43;overflow:auto}
#gate form{background:#fff;border-radius:16px;padding:30px 28px 24px;width:min(400px,100%);box-shadow:0 18px 50px rgba(0,0,0,.25)}
#gate .k{margin:0 0 4px;color:#156950;font-size:13px;font-weight:800;letter-spacing:.12em;text-transform:uppercase}
#gate h1{margin:0 0 6px;font-size:26px;letter-spacing:-.02em;line-height:1.2}
#gate p.sub{margin:0 0 18px;color:#526776;font-size:15px}
#gate label{display:block;font-weight:700;font-size:14px;margin:14px 0 6px}
#gate select,#gate input{width:100%;font:inherit;padding:11px 12px;border:1.5px solid #c4d3dc;border-radius:9px;background:#fff;color:inherit}
#gate select:focus,#gate input:focus{outline:3px solid #df9517;outline-offset:1px;border-color:#174e70}
#gate .hint{font-size:13px;color:#526776;margin:5px 0 0}
#gate .err{color:#a32121;font-size:14px;min-height:21px;margin:12px 0 4px}
#gate button.go{width:100%;font:inherit;font-weight:800;padding:12px;border:0;border-radius:9px;background:#174e70;color:#fff;cursor:pointer}
#gate button.go:disabled{opacity:.6;cursor:wait}
#gate .note{font-size:12.5px;color:#526776;margin:16px 0 0;border-top:1px solid #d7e2e8;padding-top:12px}
#gate button.link{background:none;border:0;padding:0;margin:10px 0 0;font:inherit;font-size:13px;color:#174e70;text-decoration:underline;cursor:pointer}
#who{position:fixed;right:14px;bottom:14px;z-index:900;display:flex;align-items:center;gap:10px;background:#102f43;color:#fff;border-radius:999px;padding:7px 8px 7px 15px;font:600 14px/1.2 system-ui,-apple-system,Segoe UI,sans-serif;box-shadow:0 6px 18px rgba(0,0,0,.2)}
#who a{color:#bcebd9}
#who button{font:inherit;font-size:13px;border:0;border-radius:999px;padding:6px 12px;background:rgba(255,255,255,.15);color:#fff;cursor:pointer}
#who button:focus-visible,#who a:focus-visible,#gate button.link:focus-visible{outline:3px solid #df9517;outline-offset:2px}
@media print{#who,#gate{display:none}}`;
  document.head.appendChild(style);

  let resolveReady;
  const Accesso = window.Accesso = {
    profile: null,
    ready: new Promise(r => { resolveReady = r; }),
    logout: async () => { try { await Cloud.logout(); } catch (e) { /* ignore */ } location.reload(); }
  };

  function entra(profile) {
    Accesso.profile = profile;
    document.getElementById('gate')?.remove();
    root.classList.remove('gated');
    const who = document.createElement('div');
    who.id = 'who';
    who.innerHTML = profile.role === 'teacher'
      ? `<span>Insegnante · <a href="registro-video.html">Registro video</a></span><button type="button">Esci</button>`
      : `<span>N. ${String(profile.student).padStart(2, '0')}</span><button type="button">Esci</button>`;
    who.querySelector('button').onclick = Accesso.logout;
    document.body.appendChild(who);
    if (location.hash) setTimeout(() => { const t = document.getElementById(decodeURIComponent(location.hash.slice(1))); if (t) t.scrollIntoView({ block: 'start' }); }, 60);
    resolveReady(profile);
  }

  function mostraAccesso() {
    let docente = false;
    const gate = document.createElement('div');
    gate.id = 'gate';
    gate.innerHTML = `
<form novalidate aria-labelledby="gateTitle">
  <p class="k">5AFM2627 · Economia aziendale</p>
  <h1 id="gateTitle">Accedi al materiale</h1>
  <p class="sub" id="gSub">Scegli il tuo numero di registro e scrivi il tuo compleanno.</p>
  <div id="gStud">
    <label for="gNum">Numero di registro</label>
    <select id="gNum" required><option value="">Scegli…</option>${Array.from({ length: STUDENTI }, (_, i) => `<option value="${i + 1}">${String(i + 1).padStart(2, '0')}</option>`).join('')}</select>
    <label for="gData">Compleanno (giorno e mese)</label>
    <input id="gData" inputmode="numeric" autocomplete="off" placeholder="gg/mm" aria-describedby="gHint">
    <p class="hint" id="gHint">Per esempio 16/09 oppure 1609 se sei nato il 16 settembre</p>
  </div>
  <div id="gDoc" hidden>
    <label for="gMail">Email</label>
    <input id="gMail" type="email" autocomplete="username">
    <label for="gPass">Password</label>
    <input id="gPass" type="password" autocomplete="current-password">
  </div>
  <p class="err" id="gErr" role="alert"></p>
  <button class="go" type="submit">Entra</button>
  <button class="link" type="button" id="gSwitch">Accesso insegnante</button>
</form>`;
    document.body.appendChild(gate);
    const $ = id => gate.querySelector('#' + id);
    const err = $('gErr');

    $('gSwitch').onclick = () => {
      docente = !docente;
      $('gStud').hidden = docente; $('gDoc').hidden = !docente;
      $('gSub').textContent = docente ? 'Entra con la tua email e la tua password.' : 'Scegli il tuo numero di registro e scrivi il tuo compleanno.';
      $('gSwitch').textContent = docente ? 'Sono uno studente' : 'Accesso insegnante';
      err.textContent = '';
      $(docente ? 'gMail' : 'gNum').focus();
    };

    gate.querySelector('form').onsubmit = async e => {
      e.preventDefault();
      err.textContent = '';
      let target, pass, mail;
      if (docente) {
        mail = $('gMail').value.trim(); pass = $('gPass').value; target = 'teacher';
        if (!mail || !pass) { err.textContent = 'Scrivi email e password.'; return; }
      } else {
        target = Number($('gNum').value);
        pass = $('gData').value.trim();          // cloud.js la trasforma in ggmm
        if (!target) { err.textContent = 'Scegli il tuo numero di registro.'; $('gNum').focus(); return; }
        if (!pass) { err.textContent = 'Scrivi giorno e mese così: 16/09'; $('gData').focus(); return; }
      }
      const btn = gate.querySelector('button.go');
      btn.disabled = true; btn.textContent = 'Accesso in corso…';
      try {
        const { profile } = await Cloud.login(target, pass, mail);
        entra(profile);
      } catch (ex) {
        const msg = String(ex && ex.message || '');
        err.textContent = /Connessione|Troppi|non è ancora attivo/.test(msg) ? msg
          : docente ? 'Email o password non corrette.' : 'Numero di registro o data di nascita non corretti.';
        btn.disabled = false; btn.textContent = 'Entra';
      }
    };
    $('gNum').focus();
  }

  async function avvio() {
    if (Cloud.keep()) {                       // sessione già aperta in questa scheda
      try {
        const profile = await Cloud.me();
        if (profile && (profile.role === 'student' || profile.role === 'teacher')) { entra(profile); return; }
      } catch (e) { /* sessione scaduta: si rientra */ }
      Cloud.forget();
    }
    mostraAccesso();
  }

  document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', avvio) : avvio();
})();
