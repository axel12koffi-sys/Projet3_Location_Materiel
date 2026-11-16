// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [FO] Olou, Fulgence — Module Locations (création, retour, annulation)
// =====================================================================
(() => {
  const TAUX_FRAIS_RETARD = 0.5; // même règle que le serveur (routes/locations.js)

  const form = document.getElementById('form-location');
  const corps = document.querySelector('#table-locations tbody');
  const recherche = document.getElementById('filtre-location-recherche');
  const filtreStatut = document.getElementById('filtre-location-statut');
  const selectClient = document.getElementById('location-client');
  const selectMateriel = document.getElementById('location-materiel');
  const dateDebut = document.getElementById('location-debut');
  const dateFin = document.getElementById('location-fin');
  const estimation = document.getElementById('location-estimation');

  const dialogue = document.getElementById('dialog-retour');
  const retourDate = document.getElementById('retour-date');
  const retourEndommage = document.getElementById('retour-endommage');
  const retourEstimation = document.getElementById('retour-estimation');

  let locations = [];
  let materielsDisponibles = [];
  let locationEnRetour = null;

  // [FO] Charge la liste des locations + les listes déroulantes du formulaire
  async function charger() {
    const params = new URLSearchParams();
    if (recherche.value.trim()) params.set('recherche', recherche.value.trim());
    if (filtreStatut.value) params.set('statut', filtreStatut.value);
    try {
      const [liste, clients, materiels] = await Promise.all([
        requete(`/api/locations?${params}`),
        requete('/api/clients'),
        requete('/api/materiels?etat=disponible')
      ]);
      locations = liste;
      materielsDisponibles = materiels;
      remplirListes(clients, materiels);
      dessiner();
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  }

  function remplirListes(clients, materiels) {
    const clientChoisi = selectClient.value;
    const materielChoisi = selectMateriel.value;
    selectClient.replaceChildren(el('option', { value: '', text: 'Choisir un client…' }),
      ...clients.map(c => el('option', { value: c.id, text: `${c.prenom} ${c.nom} — ${c.courriel}` })));
    selectMateriel.replaceChildren(el('option', { value: '', text: materiels.length ? 'Choisir un matériel…' : 'Aucun matériel disponible' }),
      ...materiels.map(m => el('option', { value: m.id, text: `${m.nom} (${m.numero_serie}) — ${formaterMontant(m.tarif_jour)}/jour` })));
    selectClient.value = clients.some(c => String(c.id) === clientChoisi) ? clientChoisi : '';
    selectMateriel.value = materiels.some(m => String(m.id) === materielChoisi) ? materielChoisi : '';
    calculerEstimation();
  }

  function statutLocation(l) {
    if (l.statut === 'en_cours' && l.en_retard) return badge('En retard', 'en_retard');
    return badge({ en_cours: 'En cours', terminee: 'Terminée', annulee: 'Annulée' }[l.statut], l.statut);
  }

  function statutPaiement(l) {
    if (l.statut === 'annulee') return null;
    if (l.solde <= 0) return badge('Payée', 'paye');
    return badge(l.montant_paye > 0 ? `Reste ${formaterMontant(l.solde)}` : 'Non payée', 'solde');
  }

  // [FO] Affiche le tableau des locations
  function dessiner() {
    document.getElementById('compteur-locations').textContent = `${locations.length} location(s)`;
    if (!locations.length) return ligneVide(corps, 6, 'Aucune location trouvée.');

    corps.replaceChildren(...locations.map(l => {
      const enCours = l.statut === 'en_cours';
      const actions = [];
      if (App.paiements?.actif && l.statut !== 'annulee' && l.solde >= 0.5) {
        actions.push(el('button', { class: 'btn-petit payer', type: 'button', dataset: { action: 'payer', id: l.id }, text: 'Payer' }));
      }
      if (enCours) {
        actions.push(el('button', { class: 'btn-petit', type: 'button', dataset: { action: 'retour', id: l.id }, text: 'Retour' }));
        actions.push(el('button', {
          class: 'btn-petit danger', type: 'button', dataset: { action: 'annuler', id: l.id }, text: 'Annuler',
          disabled: l.montant_paye > 0, title: l.montant_paye > 0 ? 'Location déjà payée' : null
        }));
      }

      return el('tr', { class: l.en_retard ? 'retard' : null },
        el('td', { class: 'secondaire', text: `#${l.id}` }),
        el('td', {},
          el('strong', { text: `${l.client_prenom} ${l.client_nom}` }),
          el('div', { class: 'secondaire', text: `${l.materiel_nom} · ${l.numero_serie}` })),
        el('td', {},
          el('span', { class: 'nowrap', text: `${formaterDate(l.date_debut)} → ${formaterDate(l.date_fin_prevue)}` }),
          el('div', { class: 'secondaire', text: l.date_retour ? `Rendu le ${formaterDate(l.date_retour)}` : `${l.jours_prevus} jour(s)` })),
        el('td', { class: 'num' },
          el('strong', { text: formaterMontant(l.montant_total) }),
          l.frais_retard > 0 ? el('div', { class: 'secondaire', text: `dont ${formaterMontant(l.frais_retard)} de retard` }) : null),
        el('td', { class: 'statuts' }, statutLocation(l), statutPaiement(l)),
        el('td', { class: 'actions' }, ...actions));
    }));
  }

  // [FO] Estimation du prix pendant la saisie
  function calculerEstimation() {
    const materiel = materielsDisponibles.find(m => String(m.id) === selectMateriel.value);
    dateFin.min = dateDebut.value ? decaler(dateDebut.value, 1) : '';
    if (!materiel || !dateDebut.value || !dateFin.value) {
      estimation.textContent = 'Choisissez un matériel et des dates.';
      return;
    }
    const jours = joursEntre(dateDebut.value, dateFin.value);
    if (jours < 1) {
      estimation.textContent = 'La date de fin doit être après la date de début.';
      return;
    }
    estimation.replaceChildren(`${jours} jour(s) × ${formaterMontant(materiel.tarif_jour)} = `,
      el('strong', { text: formaterMontant(jours * materiel.tarif_jour) }));
  }

  function decaler(iso, jours) {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + jours);
    return d.toLocaleDateString('en-CA');
  }

  function datesParDefaut() {
    dateDebut.min = aujourdhui();
    dateDebut.value = aujourdhui();
    dateFin.value = aujourdhui(3);
  }

  // [FO] POST /api/locations
  form.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    try {
      const l = await requete('/api/locations', {
        method: 'POST',
        body: {
          client_id: Number(selectClient.value),
          materiel_id: Number(selectMateriel.value),
          date_debut: dateDebut.value,
          date_fin_prevue: dateFin.value,
          remarque: document.getElementById('location-remarque').value.trim()
        }
      });
      form.reset();
      datesParDefaut();
      await charger();
      afficherMessage(`Location #${l.id} créée : ${l.materiel_nom} pour ${formaterMontant(l.montant_total)}.`);
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  });

  // [FO] Fenêtre de retour : date + état du matériel + frais de retard estimés
  function ouvrirRetour(l) {
    locationEnRetour = l;
    document.getElementById('retour-resume').textContent =
      `#${l.id} · ${l.materiel_nom} — ${l.client_prenom} ${l.client_nom} · fin prévue le ${formaterDate(l.date_fin_prevue)}`;
    retourDate.min = l.date_debut;
    retourDate.max = aujourdhui();
    retourDate.value = aujourdhui();
    retourEndommage.checked = false;
    estimerRetour();
    dialogue.showModal();
  }

  function estimerRetour() {
    const l = locationEnRetour;
    if (!l || !retourDate.value) return;
    const retard = Math.max(0, joursEntre(l.date_fin_prevue, retourDate.value));
    const frais = retard * l.tarif_jour * TAUX_FRAIS_RETARD;
    retourEstimation.replaceChildren(
      retard ? `${retard} jour(s) de retard → frais ${formaterMontant(frais)}. ` : 'Aucun retard. ',
      'Total : ', el('strong', { text: formaterMontant(l.montant_prevu + frais) }));
  }

  document.getElementById('form-retour').addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    const l = locationEnRetour;
    try {
      const resultat = await requete(`/api/locations/${l.id}/retour`, {
        method: 'PUT',
        body: { date_retour: retourDate.value, endommage: retourEndommage.checked }
      });
      dialogue.close();
      await charger();
      afficherMessage(`Retour enregistré. Montant final : ${formaterMontant(resultat.montant_total)}.`);
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  });

  // [FO] Boutons du tableau : Retour / Annuler / Payer
  corps.addEventListener('click', async (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const l = locations.find(x => String(x.id) === bouton.dataset.id);
    if (!l) return;

    if (bouton.dataset.action === 'retour') return ouvrirRetour(l);
    if (bouton.dataset.action === 'payer') return App.paiements.payer(l.id, bouton); // [KAKK]

    if (!confirm(`Annuler la location #${l.id} (${l.materiel_nom}) ?`)) return;
    try {
      await requete(`/api/locations/${l.id}/annuler`, { method: 'PUT' });
      await charger();
      afficherMessage('Location annulée, matériel de nouveau disponible.');
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  });

  document.getElementById('retour-fermer').addEventListener('click', () => dialogue.close());
  retourDate.addEventListener('input', estimerRetour);
  [selectMateriel, dateDebut, dateFin].forEach(c => c.addEventListener('input', calculerEstimation));
  recherche.addEventListener('input', delai(charger));
  filtreStatut.addEventListener('change', charger);
  datesParDefaut();

  App.modules.locations = { charger };
})();
