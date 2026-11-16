// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [DKM] Mpete, Dan Kazadi — Routes REST des clients (/api/clients)
// =====================================================================
const express = require('express');
const { pool } = require('../config/db');
const v = require('../utils/validation');

const router = express.Router();

// [DKM] Nombre de locations par client, calculé directement en SQL
const SELECT_CLIENT = `
  SELECT c.id, c.nom, c.prenom, c.courriel, c.telephone, c.adresse,
         (SELECT COUNT(*) FROM locations l WHERE l.client_id = c.id) AS nb_locations,
         (SELECT COUNT(*) FROM locations l WHERE l.client_id = c.id AND l.statut = 'en_cours') AS nb_en_cours
  FROM clients c`;

// [DKM] Lit et valide le corps JSON d'un client
function lireClient(body = {}) {
  return {
    nom: v.texte(body.nom, 'Nom'),
    prenom: v.texte(body.prenom, 'Prénom'),
    courriel: v.courriel(body.courriel),
    telephone: v.telephone(body.telephone),
    adresse: v.texte(body.adresse, 'Adresse', { max: 255, requis: false })
  };
}

// [DKM] GET /api/clients?recherche=
router.get('/', async (req, res) => {
  const recherche = String(req.query.recherche || '').trim();
  const motif = `%${recherche}%`;
  const [lignes] = recherche
    ? await pool.execute(
        `${SELECT_CLIENT} WHERE c.nom LIKE ? OR c.prenom LIKE ? OR c.courriel LIKE ? OR c.telephone LIKE ? ORDER BY c.nom, c.prenom`,
        [motif, motif, motif, motif])
    : await pool.execute(`${SELECT_CLIENT} ORDER BY c.nom, c.prenom`);
  res.json(lignes);
});

// [DKM] GET /api/clients/:id
router.get('/:id', async (req, res) => {
  const id = v.id(req.params.id);
  const [[client]] = await pool.execute(`${SELECT_CLIENT} WHERE c.id = ?`, [id]);
  if (!client) throw new v.HttpError(404, 'Client introuvable.');
  res.json(client);
});

// [DKM] POST /api/clients
router.post('/', async (req, res) => {
  const c = lireClient(req.body);
  const [r] = await pool.execute(
    'INSERT INTO clients (nom, prenom, courriel, telephone, adresse) VALUES (?, ?, ?, ?, ?)',
    [c.nom, c.prenom, c.courriel, c.telephone, c.adresse]
  );
  res.status(201).json({ id: r.insertId, ...c });
});

// [DKM] PUT /api/clients/:id
router.put('/:id', async (req, res) => {
  const id = v.id(req.params.id);
  const c = lireClient(req.body);
  const [r] = await pool.execute(
    'UPDATE clients SET nom = ?, prenom = ?, courriel = ?, telephone = ?, adresse = ? WHERE id = ?',
    [c.nom, c.prenom, c.courriel, c.telephone, c.adresse, id]
  );
  if (!r.affectedRows) throw new v.HttpError(404, 'Client introuvable.');
  res.json({ id, ...c });
});

// [DKM] DELETE /api/clients/:id — refusé si le client a un historique de locations
router.delete('/:id', async (req, res) => {
  const id = v.id(req.params.id);
  const [r] = await pool.execute('DELETE FROM clients WHERE id = ?', [id]);
  if (!r.affectedRows) throw new v.HttpError(404, 'Client introuvable.');
  res.json({ message: 'Client supprimé.' });
});

module.exports = router;
