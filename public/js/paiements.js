// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [KAKK] Koffi, Kouadio Axel Kevin — Paiement Stripe côté navigateur
// Le navigateur ne connaît aucune clé : il demande au serveur une URL
// de paiement Stripe Checkout, puis y redirige le client.
// =====================================================================
(() => {
  App.paiements = {
    actif: false,

    // [KAKK] Vérifie si Stripe est configuré, puis traite un éventuel retour de Stripe
    async initialiser() {
      try {
        const config = await requete('/api/paiements/config');
        this.actif = config.actif;
      } catch {
        this.actif = false;
      }
      document.getElementById('note-stripe').hidden = this.actif;
      await this.traiterRetour();
    },

    // [KAKK] Clic sur « Payer » : création de la session puis redirection
    async payer(locationId, bouton) {
      bouton.disabled = true;
      bouton.textContent = 'Redirection…';
      try {
        const { url } = await requete('/api/paiements/checkout', { method: 'POST', body: { location_id: locationId } });
        window.location.assign(url);
      } catch (erreur) {
        afficherMessage(erreur.message, 'erreur');
        bouton.disabled = false;
        bouton.textContent = 'Payer';
      }
    },

    // [KAKK] Stripe revient sur /?paiement=succes&session_id=... ou /?paiement=annule
    async traiterRetour() {
      const params = new URLSearchParams(window.location.search);
      const resultat = params.get('paiement');
      if (!resultat) return;
      history.replaceState(null, '', `${window.location.pathname}${window.location.hash}`); // nettoie l'URL

      if (resultat === 'annule') {
        afficherMessage('Paiement annulé. Aucun montant n’a été prélevé.', 'info');
        return;
      }
      try {
        const reponse = await requete(`/api/paiements/confirmer?session_id=${encodeURIComponent(params.get('session_id') || '')}`);
        if (reponse.statut === 'paye') {
          afficherMessage(`Paiement de ${formaterMontant(reponse.montant)} reçu pour la location #${reponse.location_id}. Merci !`);
        } else {
          afficherMessage('Paiement en attente de confirmation par Stripe.', 'info');
        }
      } catch (erreur) {
        afficherMessage(erreur.message, 'erreur');
      }
    }
  };
})();
