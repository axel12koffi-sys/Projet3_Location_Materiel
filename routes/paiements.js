// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [KAKK] Koffi, Kouadio Axel Kevin — Paiement en ligne avec Stripe Checkout
//
// Déroulement :
//   1. POST /api/paiements/checkout  → crée une session Stripe et renvoie son URL
//   2. Le client paie sur la page hébergée par Stripe (carte test 4242 4242 4242 4242)
//   3. Stripe redirige vers /?paiement=succes&session_id=...
//   4. GET /api/paiements/confirmer  → le serveur vérifie la session auprès de Stripe
//   5. (Optionnel) POST /api/paiements/webhook → confirmation envoyée par Stripe
// La clé secrète reste sur le serveur ; le navigateur ne la voit jamais.
// =====================================================================
const express = require('express');
const Stripe = require('stripe');
const { pool } = require('../config/db');
const v = require('../utils/validation');

const router = express.Router();
const DEVISE = (process.env.STRIPE_DEVISE || 'cad').toLowerCase();
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

function exigerStripe() {
  if (!stripe) throw new v.HttpError(503, 'Paiement indisponible : ajoutez STRIPE_SECRET_KEY dans le fichier .env.');
}

// [KAKK] Enregistre le résultat d'une session Stripe (utilisé par /confirmer et par le webhook)
async function enregistrerSession(session) {
  if (session.payment_status === 'paid') {
    const intention = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id ?? null;
    await pool.execute(
      `UPDATE paiements SET statut = 'paye', stripe_payment_intent = ?, paye_le = COALESCE(paye_le, NOW())
       WHERE stripe_session_id = ?`,
      [intention, session.id]);
    return 'paye';
  }
  if (session.status === 'expired') {
    await pool.execute("UPDATE paiements SET statut = 'expire' WHERE stripe_session_id = ? AND statut = 'en_attente'", [session.id]);
    return 'expire';
  }
  return 'en_attente';
}

// [KAKK] GET /api/paiements/config — l'interface sait si Stripe est configuré
router.get('/config', (req, res) => {
  res.json({ actif: Boolean(stripe), devise: DEVISE });
});

// [KAKK] GET /api/paiements?location_id= — historique des paiements
router.get('/', async (req, res) => {
  const valeurs = [];
  let where = '';
  if (req.query.location_id) {
    where = ' WHERE location_id = ?';
    valeurs.push(v.id(req.query.location_id, 'Location'));
  }
  const [lignes] = await pool.execute(
    `SELECT id, location_id, montant, devise, statut, cree_le, paye_le FROM paiements${where} ORDER BY id DESC`, valeurs);
  res.json(lignes);
});

// [KAKK] POST /api/paiements/checkout — body : { location_id }
router.post('/checkout', async (req, res) => {
  exigerStripe();
  const locationId = v.id(req.body?.location_id, 'Location');

  const [[l]] = await pool.execute(
    `SELECT l.id, l.statut, l.montant_total, l.date_debut, l.date_fin_prevue,
            m.nom AS materiel_nom, c.courriel,
            COALESCE((SELECT SUM(p.montant) FROM paiements p WHERE p.location_id = l.id AND p.statut = 'paye'), 0) AS paye
     FROM locations l
     JOIN materiels m ON m.id = l.materiel_id
     JOIN clients c ON c.id = l.client_id
     WHERE l.id = ?`, [locationId]);
  if (!l) throw new v.HttpError(404, 'Location introuvable.');
  if (l.statut === 'annulee') throw new v.HttpError(409, 'Cette location est annulée.');

  const solde = v.arrondir(l.montant_total - l.paye);
  if (solde < 0.5) throw new v.HttpError(400, 'Aucun solde à payer pour cette location.'); // minimum Stripe : 0,50 $

  const urlSite = process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer_email: l.courriel,
    line_items: [{
      quantity: 1,
      price_data: {
        currency: DEVISE,
        unit_amount: Math.round(solde * 100), // Stripe compte en cents
        product_data: {
          name: `Location #${l.id} — ${l.materiel_nom}`,
          description: `Du ${l.date_debut} au ${l.date_fin_prevue}`
        }
      }
    }],
    metadata: { location_id: String(l.id) },
    success_url: `${urlSite}/?paiement=succes&session_id={CHECKOUT_SESSION_ID}#locations`,
    cancel_url: `${urlSite}/?paiement=annule#locations`
  });

  await pool.execute(
    "INSERT INTO paiements (location_id, stripe_session_id, montant, devise, statut) VALUES (?, ?, ?, ?, 'en_attente')",
    [l.id, session.id, solde, DEVISE]);

  res.status(201).json({ url: session.url });
});

// [KAKK] GET /api/paiements/confirmer?session_id= — appelé au retour de Stripe
router.get('/confirmer', async (req, res) => {
  exigerStripe();
  const sessionId = String(req.query.session_id || '');
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) throw new v.HttpError(400, 'Session de paiement invalide.');

  const [[paiement]] = await pool.execute(
    'SELECT location_id, montant FROM paiements WHERE stripe_session_id = ?', [sessionId]);
  if (!paiement) throw new v.HttpError(404, 'Paiement introuvable.');

  const session = await stripe.checkout.sessions.retrieve(sessionId); // on ne se fie jamais à l'URL seule
  const statut = await enregistrerSession(session);
  res.json({ statut, location_id: paiement.location_id, montant: paiement.montant });
});

// [KAKK] POST /api/paiements/webhook — monté dans server.js AVANT express.json()
// (Stripe signe le corps brut ; il ne doit pas être transformé en objet)
async function webhook(req, res) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(503).json({ erreur: 'Webhook Stripe non configuré.' });
  }
  let evenement;
  try {
    evenement = stripe.webhooks.constructEvent(req.body, req.get('stripe-signature'), process.env.STRIPE_WEBHOOK_SECRET);
  } catch (erreur) {
    return res.status(400).json({ erreur: `Signature invalide : ${erreur.message}` });
  }
  if (['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired'].includes(evenement.type)) {
    await enregistrerSession(evenement.data.object);
  }
  res.json({ recu: true });
}

module.exports = { router, webhook };
