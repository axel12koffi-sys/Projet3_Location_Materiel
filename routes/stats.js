// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [KAKK] Koffi, Kouadio Axel Kevin — Statistiques du tableau de bord (/api/stats)
// =====================================================================
const express = require('express');
const { pool } = require('../config/db');

const router = express.Router();

router.get('/', async (req, res) => {
  const [
    [[materiel]], [[clients]], [[locations]], [[revenus]], [retards], [categories]
  ] = await Promise.all([
    pool.execute(`SELECT COUNT(*) AS total,
                         COALESCE(SUM(etat = 'disponible'), 0)  AS disponible,
                         COALESCE(SUM(etat = 'loue'), 0)        AS loue,
                         COALESCE(SUM(etat = 'maintenance'), 0) AS maintenance
                  FROM materiels`),
    pool.execute('SELECT COUNT(*) AS total FROM clients'),
    pool.execute(`SELECT COALESCE(SUM(statut = 'en_cours'), 0) AS en_cours,
                         COALESCE(SUM(statut = 'en_cours' AND date_fin_prevue < CURDATE()), 0) AS en_retard,
                         COALESCE(SUM(statut = 'terminee'), 0) AS terminees
                  FROM locations`),
    pool.execute(`SELECT
                    (SELECT COALESCE(SUM(montant), 0) FROM paiements WHERE statut = 'paye') AS encaisse,
                    (SELECT COALESCE(SUM(montant_total), 0) FROM locations WHERE statut <> 'annulee') AS facture`),
    pool.execute(`SELECT l.id, l.date_fin_prevue, DATEDIFF(CURDATE(), l.date_fin_prevue) AS jours_retard,
                         c.prenom AS client_prenom, c.nom AS client_nom, c.telephone AS client_telephone,
                         m.nom AS materiel_nom
                  FROM locations l
                  JOIN clients c ON c.id = l.client_id
                  JOIN materiels m ON m.id = l.materiel_id
                  WHERE l.statut = 'en_cours' AND l.date_fin_prevue < CURDATE()
                  ORDER BY l.date_fin_prevue`),
    pool.execute(`SELECT categorie, COUNT(*) AS total, COALESCE(SUM(etat = 'disponible'), 0) AS disponibles
                  FROM materiels GROUP BY categorie ORDER BY total DESC, categorie`)
  ]);

  const nombre = (o) => Object.fromEntries(Object.entries(o).map(([k, val]) => [k, Number(val)]));
  res.json({
    materiel: nombre(materiel),
    clients: Number(clients.total),
    locations: nombre(locations),
    revenus: nombre(revenus),
    retards,
    categories: categories.map(c => ({ categorie: c.categorie, total: Number(c.total), disponibles: Number(c.disponibles) }))
  });
});

module.exports = router;
