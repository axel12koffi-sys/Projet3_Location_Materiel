// =====================================================================
// Projet 3 — Système de location de matériel informatique
// Serveur Express (API REST + fichiers statiques)
//
// Équipe :
//   JKK  = Kitiki, Jurel Kissel        → matériel
//   DKM  = Mpete, Dan Kazadi           → clients
//   KAKK = Koffi, Kouadio Axel Kevin   → serveur, tableau de bord, paiements Stripe
//   FO   = Olou, Fulgence              → locations et retours
// =====================================================================
require('dotenv').config({ quiet: true });
const express = require('express');
const path = require('path');
const paiements = require('./routes/paiements');
const { HttpError } = require('./utils/validation');

const app = express();

// [KAKK] Le webhook Stripe a besoin du corps brut : il passe avant express.json()
app.post('/api/paiements/webhook', express.raw({ type: 'application/json' }), paiements.webhook);

// [KAKK] Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Routes de l'API
app.use('/api/materiels', require('./routes/materiels')); // [JKK]
app.use('/api/clients', require('./routes/clients'));     // [DKM]
app.use('/api/locations', require('./routes/locations')); // [FO]
app.use('/api/stats', require('./routes/stats'));         // [KAKK]
app.use('/api/paiements', paiements.router);              // [KAKK]

// [KAKK] Route API inconnue → JSON (et non une page HTML)
app.use('/api', (req, res) => res.status(404).json({ erreur: 'Route introuvable.' }));

// [KAKK] Gestion centralisée des erreurs
// Express 5 transmet automatiquement ici les erreurs des routes async.
app.use((erreur, req, res, next) => {
  if (erreur instanceof HttpError) return res.status(erreur.status).json({ erreur: erreur.message });
  if (erreur.type === 'entity.parse.failed') return res.status(400).json({ erreur: 'JSON invalide.' });
  if (erreur.code === 'ER_DUP_ENTRY') {
    const message = erreur.message.includes('numero_serie') ? 'Ce numéro de série existe déjà.'
      : erreur.message.includes('courriel') ? 'Ce courriel est déjà utilisé.'
      : 'Cette valeur existe déjà.';
    return res.status(409).json({ erreur: message });
  }
  if (erreur.code === 'ER_ROW_IS_REFERENCED_2' || erreur.code === 'ER_ROW_IS_REFERENCED') {
    return res.status(409).json({ erreur: 'Suppression impossible : cet élément possède un historique de locations.' });
  }
  if (erreur.type?.startsWith?.('Stripe')) {
    console.error('[Stripe]', erreur.message);
    return res.status(502).json({ erreur: `Stripe : ${erreur.message}` });
  }
  if (erreur.code === 'ECONNREFUSED' || erreur.code === 'ER_ACCESS_DENIED_ERROR' || erreur.code === 'ER_BAD_DB_ERROR') {
    console.error('[MySQL]', erreur.code, erreur.message);
    return res.status(500).json({ erreur: 'Base de données inaccessible. Vérifiez MySQL et le fichier .env.' });
  }
  console.error(erreur);
  res.status(500).json({ erreur: 'Erreur interne du serveur.' });
});

const PORT = Number(process.env.PORT || 3000);
app.listen(PORT, () => console.log(`Serveur prêt : http://localhost:${PORT}`));
