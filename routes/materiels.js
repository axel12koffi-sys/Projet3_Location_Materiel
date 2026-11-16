// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [JKK] Kitiki, Jurel Kissel — Routes REST du matériel (/api/materiels)
// =====================================================================
const express = require('express');
const { pool } = require('../config/db');
const v = require('../utils/validation');

const router = express.Router();
const ETATS = ['disponible', 'loue', 'maintenance'];
const ETATS_MODIFIABLES = ['disponible', 'maintenance']; // « loue » est géré par les locations

// [JKK] Lit et valide le corps JSON d'un matériel
function lireMateriel(body = {}) {
  return {
    nom: v.texte(body.nom, 'Nom'),
    categorie: v.texte(body.categorie, 'Catégorie', { max: 50 }),
    numero_serie: v.texte(body.numero_serie, 'Numéro de série', { max: 50 }).toUpperCase(),
    tarif_jour: v.montant(body.tarif_jour, 'Tarif par jour'),
    description: v.texte(body.description, 'Description', { max: 255, requis: false }),
    etat: body.etat ?? null
  };
}

// [JKK] GET /api/materiels?recherche=&categorie=&etat=
router.get('/', async (req, res) => {
  const conditions = [];
  const valeurs = [];
  const recherche = String(req.query.recherche || '').trim();
  if (recherche) {
    conditions.push('(nom LIKE ? OR numero_serie LIKE ? OR categorie LIKE ?)');
    const motif = `%${recherche}%`;
    valeurs.push(motif, motif, motif);
  }
  if (req.query.categorie) {
    conditions.push('categorie = ?');
    valeurs.push(String(req.query.categorie));
  }
  if (req.query.etat) {
    conditions.push('etat = ?');
    valeurs.push(v.choix(String(req.query.etat), 'État', ETATS));
  }
  const where = conditions.length ? ` WHERE ${conditions.join(' AND ')}` : '';
  const [lignes] = await pool.execute(
    `SELECT id, nom, categorie, numero_serie, tarif_jour, etat, description FROM materiels${where} ORDER BY nom`,
    valeurs
  );
  res.json(lignes);
});

// [JKK] GET /api/materiels/categories — liste pour les filtres
router.get('/categories', async (req, res) => {
  const [lignes] = await pool.execute('SELECT DISTINCT categorie FROM materiels ORDER BY categorie');
  res.json(lignes.map(l => l.categorie));
});

// [JKK] GET /api/materiels/:id
router.get('/:id', async (req, res) => {
  const id = v.id(req.params.id);
  const [[materiel]] = await pool.execute(
    'SELECT id, nom, categorie, numero_serie, tarif_jour, etat, description FROM materiels WHERE id = ?', [id]);
  if (!materiel) throw new v.HttpError(404, 'Matériel introuvable.');
  res.json(materiel);
});

// [JKK] POST /api/materiels
router.post('/', async (req, res) => {
  const m = lireMateriel(req.body);
  m.etat = v.choix(m.etat, 'État', ETATS_MODIFIABLES, 'disponible');
  const [r] = await pool.execute(
    'INSERT INTO materiels (nom, categorie, numero_serie, tarif_jour, etat, description) VALUES (?, ?, ?, ?, ?, ?)',
    [m.nom, m.categorie, m.numero_serie, m.tarif_jour, m.etat, m.description]
  );
  res.status(201).json({ id: r.insertId, ...m });
});

// [JKK] PUT /api/materiels/:id
router.put('/:id', async (req, res) => {
  const id = v.id(req.params.id);
  const m = lireMateriel(req.body);
  const [[actuel]] = await pool.execute('SELECT etat FROM materiels WHERE id = ?', [id]);
  if (!actuel) throw new v.HttpError(404, 'Matériel introuvable.');

  if (actuel.etat === 'loue') {
    // Un matériel loué le reste jusqu'au retour
    if (m.etat && m.etat !== 'loue') {
      throw new v.HttpError(409, 'Ce matériel est en location : enregistrez d’abord son retour.');
    }
    m.etat = 'loue';
  } else {
    m.etat = v.choix(m.etat, 'État', ETATS_MODIFIABLES, actuel.etat);
  }

  await pool.execute(
    'UPDATE materiels SET nom = ?, categorie = ?, numero_serie = ?, tarif_jour = ?, etat = ?, description = ? WHERE id = ?',
    [m.nom, m.categorie, m.numero_serie, m.tarif_jour, m.etat, m.description, id]
  );
  res.json({ id, ...m });
});

// [JKK] DELETE /api/materiels/:id
router.delete('/:id', async (req, res) => {
  const id = v.id(req.params.id);
  const [[actuel]] = await pool.execute('SELECT etat FROM materiels WHERE id = ?', [id]);
  if (!actuel) throw new v.HttpError(404, 'Matériel introuvable.');
  if (actuel.etat === 'loue') throw new v.HttpError(409, 'Impossible de supprimer un matériel en location.');
  await pool.execute('DELETE FROM materiels WHERE id = ?', [id]); // l'historique est protégé par la clé étrangère
  res.json({ message: 'Matériel supprimé.' });
});

module.exports = router;
