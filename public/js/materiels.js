// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [JKK] Kitiki, Jurel Kissel — Module Matériel (formulaire, filtres, tableau)
// =====================================================================
(() => {
  const form = document.getElementById('form-materiel');
  const corps = document.querySelector('#table-materiels tbody');
  const recherche = document.getElementById('filtre-materiel-recherche');
  const filtreCategorie = document.getElementById('filtre-materiel-categorie');
  const filtreEtat = document.getElementById('filtre-materiel-etat');
  const suggestions = document.getElementById('liste-categories');
  const champ = (id) => document.getElementById(`materiel-${id}`);
  const selectEtat = champ('etat');
  const optionLoue = selectEtat.querySelector('option[value="loue"]');

  let idEnModification = null;
  let materiels = [];

  // [JKK] GET /api/materiels avec les filtres choisis
  async function charger() {
    const params = new URLSearchParams();
    if (recherche.value.trim()) params.set('recherche', recherche.value.trim());
    if (filtreCategorie.value) params.set('categorie', filtreCategorie.value);
    if (filtreEtat.value) params.set('etat', filtreEtat.value);
    try {
      const [liste, categories] = await Promise.all([
        requete(`/api/materiels?${params}`),
        requete('/api/materiels/categories')
      ]);
      materiels = liste;
      majCategories(categories);
      dessiner();
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  }

  function majCategories(categories) {
    const choix = filtreCategorie.value;
    filtreCategorie.replaceChildren(
      el('option', { value: '', text: 'Toutes les catégories' }),
      ...categories.map(c => el('option', { value: c, text: c })));
    filtreCategorie.value = categories.includes(choix) ? choix : '';
    suggestions.replaceChildren(...categories.map(c => el('option', { value: c })));
  }

  // [JKK] Affiche le tableau du matériel
  function dessiner() {
    document.getElementById('compteur-materiels').textContent = `${materiels.length} article(s)`;
    if (!materiels.length) return ligneVide(corps, 6, 'Aucun matériel trouvé.');
    corps.replaceChildren(...materiels.map(m => el('tr', {},
      el('td', {}, el('strong', { text: m.nom }),
        m.description ? el('div', { class: 'secondaire', text: m.description }) : null),
      el('td', { text: m.categorie }),
      el('td', { class: 'mono', text: m.numero_serie }),
      el('td', { class: 'num', text: formaterMontant(m.tarif_jour) }),
      el('td', {}, badge(LIBELLES_ETAT[m.etat], m.etat)),
      el('td', { class: 'actions' },
        el('button', { class: 'btn-petit', type: 'button', dataset: { action: 'modifier', id: m.id }, text: 'Modifier' }),
        el('button', {
          class: 'btn-petit danger', type: 'button', dataset: { action: 'supprimer', id: m.id }, text: 'Supprimer',
          disabled: m.etat === 'loue', title: m.etat === 'loue' ? 'Matériel en location' : null
        })))));
  }

  function reinitialiser() {
    form.reset();
    idEnModification = null;
    optionLoue.hidden = true;
    selectEtat.disabled = false;
    document.getElementById('titre-form-materiel').textContent = 'Ajouter un matériel';
    champ('enregistrer').textContent = 'Ajouter';
    champ('annuler').hidden = true;
  }

  function remplir(m) {
    idEnModification = m.id;
    champ('nom').value = m.nom;
    champ('categorie').value = m.categorie;
    champ('serie').value = m.numero_serie;
    champ('tarif').value = m.tarif_jour;
    champ('description').value = m.description || '';
    // Un matériel loué ne change d'état qu'au retour de la location
    optionLoue.hidden = m.etat !== 'loue';
    selectEtat.value = m.etat;
    selectEtat.disabled = m.etat === 'loue';
    document.getElementById('titre-form-materiel').textContent = `Modifier « ${m.nom} »`;
    champ('enregistrer').textContent = 'Enregistrer';
    champ('annuler').hidden = false;
    champ('nom').focus();
  }

  // [JKK] Ajout (POST) ou modification (PUT)
  form.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    const materiel = {
      nom: champ('nom').value.trim(),
      categorie: champ('categorie').value.trim(),
      numero_serie: champ('serie').value.trim(),
      tarif_jour: Number(champ('tarif').value),
      etat: selectEtat.value,
      description: champ('description').value.trim()
    };
    const modification = idEnModification !== null;
    try {
      await requete(modification ? `/api/materiels/${idEnModification}` : '/api/materiels',
        { method: modification ? 'PUT' : 'POST', body: materiel });
      reinitialiser();
      await charger();
      afficherMessage(modification ? 'Matériel modifié.' : 'Matériel ajouté.');
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  });

  // [JKK] Boutons Modifier / Supprimer (délégation d'événements)
  corps.addEventListener('click', async (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const materiel = materiels.find(m => String(m.id) === bouton.dataset.id);
    if (!materiel) return;

    if (bouton.dataset.action === 'modifier') return remplir(materiel);

    if (!confirm(`Supprimer « ${materiel.nom} » ?`)) return;
    try {
      await requete(`/api/materiels/${materiel.id}`, { method: 'DELETE' });
      if (idEnModification === materiel.id) reinitialiser();
      await charger();
      afficherMessage('Matériel supprimé.');
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  });

  champ('annuler').addEventListener('click', reinitialiser);
  recherche.addEventListener('input', delai(charger));
  filtreCategorie.addEventListener('change', charger);
  filtreEtat.addEventListener('change', charger);

  App.modules.materiels = { charger };
})();
