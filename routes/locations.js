// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [FO] Olou, Fulgence — Routes REST des locations (/api/locations)
// Création, retour et annulation se font dans des transactions MySQL.
// =====================================================================
const express = require('express');
const { pool, transaction } = require('../config/db');
const v = require('../utils/validation');

const router = express.Router();
const TAUX_FRAIS_RETARD = 0.5; // [FO] chaque jour de retard coûte 50 % du tarif en plus

// [FO] Requête commune : location + client + matériel + total déjà payé (Stripe)
const SELECT_LOCATION = `
  SELECT l.id, l.client_id, l.materiel_id, l.date_debut, l.date_fin_prevue, l.date_retour,
         l.tarif_jour, l.jours_prevus, l.montant_prevu, l.frais_retard, l.montant_total,
         l.statut, l.remarque,
         c.nom AS client_nom, c.prenom AS client_prenom, c.courriel AS client_courriel,
         m.nom AS materiel_nom, m.numero_serie, m.categorie,
         COALESCE((SELECT SUM(p.montant) FROM paiements p
                   WHERE p.location_id = l.id AND p.statut = 'paye'), 0) AS montant_paye,
         (l.statut = 'en_cours' AND l.date_fin_prevue < CURDATE()) AS en_retard
  FROM locations l
  JOIN clients c   ON c.id = l.client_id
  JOIN materiels m ON m.id = l.materiel_id`;

// [FO] Ajoute les champs calculés côté serveur
function formater(l) {
  return { ...l, en_retard: Boolean(l.en_retard), solde: v.arrondir(l.montant_total - l.montant_paye) };
}

async function trouverLocation(executeur, id) {
  const [[location]] = await executeur.execute(`${SELECT_LOCATION} WHERE l.id = ?`, [id]);
  if (!location) throw new v.HttpError(404, 'Location introuvable.');
  return formater(location);
}

// [FO] GET /api/locations?statut=en_cours|en_retard|terminee|annulee&recherche=&client_id=
router.get('/', async (req, res) => {
  const conditions = [];
  const valeurs = [];
  const statut = v.choix(req.query.statut, 'Statut', ['en_cours', 'en_retard', 'terminee', 'annulee'], null);
  if (statut === 'en_retard') {
    conditions.push("l.statut = 'en_cours' AND l.date_fin_prevue < CURDATE()");
  } else if (statut) {
    conditions.push('l.statut = ?');
    valeurs.push(statut);
  }
  if (req.query.client_id) {
    conditions.push('l.client_id = ?');
    valeurs.push(v.id(req.query.client_id, 'Client'));
  }
  const recherche = String(req.query.recherche || '').trim();
  if (recherche) {
    conditions.push('(c.nom LIKE ? OR c.prenom LIKE ? OR m.nom LIKE ? OR m.numero_serie LIKE ?)');
    const motif = `%${recherche}%`;
    valeurs.push(motif, motif, motif, motif);
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const [lignes] = await pool.execute(
    `${SELECT_LOCATION}${where} ORDER BY FIELD(l.statut, 'en_cours', 'terminee', 'annulee'), l.date_debut DESC, l.id DESC`,
    valeurs
  );
  res.json(lignes.map(formater));
});

// [FO] GET /api/locations/:id
router.get('/:id', async (req, res) => {
  res.json(await trouverLocation(pool, v.id(req.params.id)));
});

// [FO] POST /api/locations — crée une location et marque le matériel « loué »
router.post('/', async (req, res) => {
  const body = req.body || {};
  const clientId = v.id(body.client_id, 'Client');
  const materielId = v.id(body.materiel_id, 'Matériel');
  const debut = v.date(body.date_debut, 'Date de début');
  const fin = v.date(body.date_fin_prevue, 'Date de fin prévue');
  const remarque = v.texte(body.remarque, 'Remarque', { max: 255, requis: false });

  if (debut < v.aujourdhui()) throw new v.HttpError(400, 'La date de début ne peut pas être dans le passé.');
  const jours = v.joursEntre(debut, fin);
  if (jours < 1) throw new v.HttpError(400, 'La date de fin doit être après la date de début.');
  if (jours > 365) throw new v.HttpError(400, 'Une location ne peut pas dépasser 365 jours.');

  const nouvelId = await transaction(async (cnx) => {
    const [[client]] = await cnx.execute('SELECT id FROM clients WHERE id = ?', [clientId]);
    if (!client) throw new v.HttpError(404, 'Client introuvable.');

    // FOR UPDATE verrouille la ligne : deux locations simultanées du même matériel sont impossibles
    const [[materiel]] = await cnx.execute(
      'SELECT id, nom, etat, tarif_jour FROM materiels WHERE id = ? FOR UPDATE', [materielId]);
    if (!materiel) throw new v.HttpError(404, 'Matériel introuvable.');
    if (materiel.etat !== 'disponible') {
      throw new v.HttpError(409, `« ${materiel.nom} » n’est pas disponible (${materiel.etat === 'loue' ? 'déjà loué' : 'en maintenance'}).`);
    }

    const montant = v.arrondir(jours * materiel.tarif_jour);
    const [r] = await cnx.execute(
      `INSERT INTO locations (client_id, materiel_id, date_debut, date_fin_prevue, tarif_jour, jours_prevus,
                              montant_prevu, frais_retard, montant_total, statut, remarque)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, 'en_cours', ?)`,
      [clientId, materielId, debut, fin, materiel.tarif_jour, jours, montant, montant, remarque]
    );
    await cnx.execute("UPDATE materiels SET etat = 'loue' WHERE id = ?", [materielId]);
    return r.insertId;
  });

  res.status(201).json(await trouverLocation(pool, nouvelId));
});

// [FO] PUT /api/locations/:id/retour — body : { date_retour?, endommage? }
router.put('/:id/retour', async (req, res) => {
  const id = v.id(req.params.id);
  const body = req.body || {};
  const dateRetour = body.date_retour ? v.date(body.date_retour, 'Date de retour') : v.aujourdhui();
  const endommage = body.endommage === true;
  if (dateRetour > v.aujourdhui()) throw new v.HttpError(400, 'La date de retour ne peut pas être dans le futur.');

  await transaction(async (cnx) => {
    const [[l]] = await cnx.execute(
      'SELECT id, materiel_id, statut, date_debut, date_fin_prevue, tarif_jour, montant_prevu FROM locations WHERE id = ? FOR UPDATE', [id]);
    if (!l) throw new v.HttpError(404, 'Location introuvable.');
    if (l.statut !== 'en_cours') throw new v.HttpError(409, 'Cette location n’est plus en cours.');
    if (dateRetour < l.date_debut) throw new v.HttpError(400, 'La date de retour est avant le début de la location.');

    const joursRetard = Math.max(0, v.joursEntre(l.date_fin_prevue, dateRetour));
    const frais = v.arrondir(joursRetard * l.tarif_jour * TAUX_FRAIS_RETARD);
    const total = v.arrondir(l.montant_prevu + frais);

    await cnx.execute(
      "UPDATE locations SET date_retour = ?, frais_retard = ?, montant_total = ?, statut = 'terminee' WHERE id = ?",
      [dateRetour, frais, total, id]);
    // Matériel endommagé → maintenance ; sinon il redevient disponible
    await cnx.execute('UPDATE materiels SET etat = ? WHERE id = ?', [endommage ? 'maintenance' : 'disponible', l.materiel_id]);
  });

  res.json(await trouverLocation(pool, id));
});

// [FO] PUT /api/locations/:id/annuler — seulement si en cours et non payée
router.put('/:id/annuler', async (req, res) => {
  const id = v.id(req.params.id);

  await transaction(async (cnx) => {
    const [[l]] = await cnx.execute('SELECT id, materiel_id, statut FROM locations WHERE id = ? FOR UPDATE', [id]);
    if (!l) throw new v.HttpError(404, 'Location introuvable.');
    if (l.statut !== 'en_cours') throw new v.HttpError(409, 'Seule une location en cours peut être annulée.');
    const [[{ paye }]] = await cnx.execute(
      "SELECT COUNT(*) AS paye FROM paiements WHERE location_id = ? AND statut = 'paye'", [id]);
    if (paye > 0) throw new v.HttpError(409, 'Location déjà payée : faites d’abord un remboursement dans Stripe.');

    await cnx.execute("UPDATE locations SET statut = 'annulee', montant_total = 0 WHERE id = ?", [id]);
    await cnx.execute("UPDATE materiels SET etat = 'disponible' WHERE id = ?", [l.materiel_id]);
  });

  res.json(await trouverLocation(pool, id));
});

module.exports = router;
