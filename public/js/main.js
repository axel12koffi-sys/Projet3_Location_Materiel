// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [KAKK] Koffi, Kouadio Axel Kevin — Démarrage et navigation par onglets
// =====================================================================
(() => {
  const ONGLETS = ['tableau', 'materiels', 'clients', 'locations'];
  const boutons = document.querySelectorAll('.onglet');

  // [KAKK] Affiche une section, met à jour l'URL (#...) et recharge ses données
  App.afficherOnglet = (nom, { focus } = {}) => {
    if (!ONGLETS.includes(nom)) nom = 'tableau';
    for (const id of ONGLETS) document.getElementById(id).hidden = id !== nom;
    boutons.forEach(b => {
      if (b.dataset.onglet === nom) b.setAttribute('aria-current', 'page');
      else b.removeAttribute('aria-current');
    });
    if (location.hash !== `#${nom}`) history.replaceState(null, '', `#${nom}`);
    App.modules[nom]?.charger();
    if (focus) document.getElementById(focus)?.focus();
  };

  boutons.forEach(b => b.addEventListener('click', () => App.afficherOnglet(b.dataset.onglet)));
  window.addEventListener('hashchange', () => App.afficherOnglet(location.hash.slice(1)));

  // [KAKK] Au démarrage : configuration Stripe, puis onglet demandé dans l'URL
  (async () => {
    await App.paiements.initialiser();
    App.afficherOnglet(location.hash.slice(1) || 'tableau');
  })();
})();
