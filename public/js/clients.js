// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [DKM] Mpete, Dan Kazadi — Module Clients (formulaire, recherche, tableau)
// =====================================================================
(() => {
  const form = document.getElementById('form-client');
  const corps = document.querySelector('#table-clients tbody');
  const recherche = document.getElementById('filtre-client-recherche');
  const champ = (id) => document.getElementById(`client-${id}`);

  let idEnModification = null;
  let clients = [];

  // [DKM] GET /api/clients?recherche=
  async function charger() {
    const terme = recherche.value.trim();
    try {
      clients = await requete(terme ? `/api/clients?recherche=${encodeURIComponent(terme)}` : '/api/clients');
      dessiner();
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  }

  // [DKM] Affiche le tableau des clients
  function dessiner() {
    document.getElementById('compteur-clients').textContent = `${clients.length} client(s)`;
    if (!clients.length) return ligneVide(corps, 5, 'Aucun client trouvé.');
    corps.replaceChildren(...clients.map(c => el('tr', {},
      el('td', {}, el('strong', { text: `${c.prenom} ${c.nom}` }),
        c.adresse ? el('div', { class: 'secondaire', text: c.adresse }) : null),
      el('td', { text: c.courriel }),
      el('td', { text: c.telephone || '—' }),
      el('td', { class: 'num' },
        c.nb_en_cours ? badge(`${c.nb_en_cours} en cours`, 'en_cours') : null,
        el('span', { class: 'secondaire', text: ` ${c.nb_locations} au total` })),
      el('td', { class: 'actions' },
        el('button', { class: 'btn-petit', type: 'button', dataset: { action: 'modifier', id: c.id }, text: 'Modifier' }),
        el('button', {
          class: 'btn-petit danger', type: 'button', dataset: { action: 'supprimer', id: c.id }, text: 'Supprimer',
          disabled: c.nb_locations > 0, title: c.nb_locations > 0 ? 'Ce client a un historique de locations' : null
        })))));
  }

  function reinitialiser() {
    form.reset();
    idEnModification = null;
    document.getElementById('titre-form-client').textContent = 'Ajouter un client';
    champ('enregistrer').textContent = 'Ajouter';
    champ('annuler').hidden = true;
  }

  function remplir(c) {
    idEnModification = c.id;
    champ('prenom').value = c.prenom;
    champ('nom').value = c.nom;
    champ('courriel').value = c.courriel;
    champ('telephone').value = c.telephone || '';
    champ('adresse').value = c.adresse || '';
    document.getElementById('titre-form-client').textContent = `Modifier ${c.prenom} ${c.nom}`;
    champ('enregistrer').textContent = 'Enregistrer';
    champ('annuler').hidden = false;
    champ('prenom').focus();
  }

  // [DKM] Ajout (POST) ou modification (PUT)
  form.addEventListener('submit', async (evenement) => {
    evenement.preventDefault();
    const client = {
      prenom: champ('prenom').value.trim(),
      nom: champ('nom').value.trim(),
      courriel: champ('courriel').value.trim(),
      telephone: champ('telephone').value.trim(),
      adresse: champ('adresse').value.trim()
    };
    const modification = idEnModification !== null;
    try {
      await requete(modification ? `/api/clients/${idEnModification}` : '/api/clients',
        { method: modification ? 'PUT' : 'POST', body: client });
      reinitialiser();
      await charger();
      afficherMessage(modification ? 'Client modifié.' : 'Client ajouté.');
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  });

  // [DKM] Boutons Modifier / Supprimer
  corps.addEventListener('click', async (evenement) => {
    const bouton = evenement.target.closest('button[data-action]');
    if (!bouton) return;
    const client = clients.find(c => String(c.id) === bouton.dataset.id);
    if (!client) return;

    if (bouton.dataset.action === 'modifier') return remplir(client);

    if (!confirm(`Supprimer ${client.prenom} ${client.nom} ?`)) return;
    try {
      await requete(`/api/clients/${client.id}`, { method: 'DELETE' });
      if (idEnModification === client.id) reinitialiser();
      await charger();
      afficherMessage('Client supprimé.');
    } catch (erreur) {
      afficherMessage(erreur.message, 'erreur');
    }
  });

  champ('annuler').addEventListener('click', reinitialiser);
  recherche.addEventListener('input', delai(charger));

  App.modules.clients = { charger };
})();
