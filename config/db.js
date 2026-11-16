// =====================================================================
// Projet 3 — Système de location de matériel informatique
// [KAKK] Koffi, Kouadio Axel Kevin — Connexion MySQL (pool + transactions)
// =====================================================================
const mysql = require('mysql2/promise');

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'location_materiel',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,    // [KAKK] les DATE arrivent en 'AAAA-MM-JJ' (pas de décalage de fuseau)
  decimalNumbers: true  // [KAKK] les DECIMAL arrivent en nombres et non en chaînes
});

// [KAKK] Exécute plusieurs requêtes en tout-ou-rien (BEGIN / COMMIT / ROLLBACK)
async function transaction(travail) {
  const connexion = await pool.getConnection();
  try {
    await connexion.beginTransaction();
    const resultat = await travail(connexion);
    await connexion.commit();
    return resultat;
  } catch (erreur) {
    await connexion.rollback();
    throw erreur;
  } finally {
    connexion.release();
  }
}

module.exports = { pool, transaction };
