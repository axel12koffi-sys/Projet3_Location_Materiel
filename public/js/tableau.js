// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [KAKK] Koffi, Kouadio Axel Kevin — Tableau de bord (statistiques)
// =====================================================================
(() => {
  const cartes = document.getElementById('cartes-stats');
  const corpsRetards = document.querySelector('#table-retards tbody');
  const listeCategories = document.getElementById('liste-categories-stats');

  function carteStat(libelle, valeur, detail, couleur = '') {
    return el('div', { class: `stat ${couleur}` },
      el('div', { class: 'libelle', text: libelle }),
      el('div', { class: 'valeur', text: String(valeur) }),
      el('div', { class: 'detail', text: detail }));
  }

  async function charger() {
    try {
      const s = await requete('/api/stats');

      cartes.replaceChildren(
        carteStat('Matériel', s.materiel.total,
          `${s.materiel.disponible} disponible(s) · ${s.materiel.maintenance} en maintenance`),
        carteStat('Locations en cours', s.locations.en_cours, `${s.materiel.loue} appareil(s) chez les clients`, 'vert'),
        carteStat('En retard', s.locations.en_retard,
          s.locations.en_retard ? 'À relancer' : 'Aucun retard', s.locations.en_retard ? 'rouge' : 'vert'),
        carteStat('Clients', s.clients, `${s.locations.terminees} location(s) terminée(s)`),
        carteStat('Encaissé', formaterMontant(s.revenus.encaisse), `sur ${formaterMontant(s.revenus.facture)} facturés`, 'orange')
      );

      if (!s.retards.length) {
        ligneVide(corpsRetards, 5, 'Aucune location en retard.');
      } else {
        corpsRetards.replaceChildren(...s.retards.map(r => el('tr', { class: 'retard' },
          el('td', { text: `#${r.id}` }),
          el('td', {}, `${r.client_prenom} ${r.client_nom}`,
            r.client_telephone ? el('div', { class: 'secondaire', text: r.client_telephone }) : null),
          el('td', { text: r.materiel_nom }),
          el('td', { text: formaterDate(r.date_fin_prevue) }),
          el('td', { class: 'num' }, badge(`${r.jours_retard} j`, 'en_retard')))));
      }

      const maximum = Math.max(1, ...s.categories.map(c => c.total));
      listeCategories.replaceChildren(...s.categories.map(c => el('li', {},
        el('div', { class: 'ligne' },
          el('span', { text: c.categorie }),
          el('span', { class: 'secondaire', text: `${c.disponibles} dispo. / ${c.total}` })),
        el('div', { class: 'piste' },
          el('div', { class: 'rempli', style: `width:${(c.total / maximum) * 100}%` })))));
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  }

  document.getElementById('btn-nouvelle-location')
    .addEventListener('click', () => App.afficherOnglet('locations', { focus: 'location-client' }));

  App.modules.tableau = { charger };
})();
