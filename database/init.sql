-- =====================================================================
-- Projet 3 — Système de location de matériel informatique
-- Script de création de la base de données (MySQL / MariaDB)
--
-- Équipe :
--   JKK  = Kitiki, Jurel Kissel
--   DKM  = Mpete, Dan Kazadi
--   KAKK = Koffi, Kouadio Axel Kevin
--   FO   = Olou, Fulgence
-- =====================================================================

SET NAMES utf8mb4; -- accents corrects (É, é, è…) à l'importation

CREATE DATABASE IF NOT EXISTS location_materiel
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE location_materiel;

-- On supprime dans l'ordre inverse des dépendances pour pouvoir relancer le script
DROP TABLE IF EXISTS paiements;
DROP TABLE IF EXISTS locations;
DROP TABLE IF EXISTS clients;
DROP TABLE IF EXISTS materiels;

-- [JKK] Table du matériel informatique ---------------------------------
CREATE TABLE materiels (
  id            INT AUTO_INCREMENT PRIMARY KEY,
  nom           VARCHAR(100)  NOT NULL,
  categorie     VARCHAR(50)   NOT NULL,
  numero_serie  VARCHAR(50)   NOT NULL UNIQUE,
  tarif_jour    DECIMAL(8,2)  NOT NULL CHECK (tarif_jour >= 0),
  etat          ENUM('disponible','loue','maintenance') NOT NULL DEFAULT 'disponible',
  description   VARCHAR(255)  NULL,
  cree_le       TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- [DKM] Table des clients ------------------------------------------------
CREATE TABLE clients (
  id         INT AUTO_INCREMENT PRIMARY KEY,
  nom        VARCHAR(100) NOT NULL,
  prenom     VARCHAR(100) NOT NULL,
  courriel   VARCHAR(150) NOT NULL UNIQUE,
  telephone  VARCHAR(20)  NULL,
  adresse    VARCHAR(255) NULL,
  cree_le    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- [FO] Table des locations -------------------------------------------------
-- Le tarif est copié au moment de la location : un changement de prix
-- du matériel ne modifie pas les locations déjà faites.
CREATE TABLE locations (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  client_id        INT           NOT NULL,
  materiel_id      INT           NOT NULL,
  date_debut       DATE          NOT NULL,
  date_fin_prevue  DATE          NOT NULL,
  date_retour      DATE          NULL,
  tarif_jour       DECIMAL(8,2)  NOT NULL,
  jours_prevus     INT           NOT NULL,
  montant_prevu    DECIMAL(10,2) NOT NULL,
  frais_retard     DECIMAL(10,2) NOT NULL DEFAULT 0,
  montant_total    DECIMAL(10,2) NOT NULL,
  statut           ENUM('en_cours','terminee','annulee') NOT NULL DEFAULT 'en_cours',
  remarque         VARCHAR(255)  NULL,
  cree_le          TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_location_client   FOREIGN KEY (client_id)   REFERENCES clients(id)   ON DELETE RESTRICT,
  CONSTRAINT fk_location_materiel FOREIGN KEY (materiel_id) REFERENCES materiels(id) ON DELETE RESTRICT,
  CONSTRAINT chk_dates CHECK (date_fin_prevue > date_debut),
  INDEX idx_location_statut (statut)
);

-- [KAKK] Table des paiements Stripe ----------------------------------------
CREATE TABLE paiements (
  id                     INT AUTO_INCREMENT PRIMARY KEY,
  location_id            INT           NOT NULL,
  stripe_session_id      VARCHAR(255)  NOT NULL UNIQUE,
  stripe_payment_intent  VARCHAR(255)  NULL,
  montant                DECIMAL(10,2) NOT NULL,
  devise                 CHAR(3)       NOT NULL DEFAULT 'cad',
  statut                 ENUM('en_attente','paye','echoue','expire') NOT NULL DEFAULT 'en_attente',
  cree_le                TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paye_le                DATETIME      NULL,
  CONSTRAINT fk_paiement_location FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE RESTRICT
);

-- =====================================================================
-- Données de démonstration
-- =====================================================================

-- [JKK]
INSERT INTO materiels (nom, categorie, numero_serie, tarif_jour, etat, description) VALUES
('Dell Latitude 5440',        'Ordinateur portable', 'DL5440-001', 25.00, 'loue',        'i5, 16 Go RAM, SSD 512 Go'),
('MacBook Air M2',            'Ordinateur portable', 'MBA-M2-002', 35.00, 'loue',        '13 pouces, 8 Go RAM'),
('Lenovo ThinkPad T14',       'Ordinateur portable', 'TP-T14-003', 22.00, 'disponible',  'Ryzen 5, 16 Go RAM'),
('Projecteur Epson EB-X51',   'Projecteur',          'EP-X51-004', 30.00, 'disponible',  '3800 lumens, HDMI'),
('Écran Dell 27" P2723D',     'Écran',               'DP27-005',   12.00, 'disponible',  'QHD, USB-C'),
('iPad 10e génération',       'Tablette',            'IPAD10-006', 18.00, 'disponible',  '64 Go, Wi-Fi'),
('Imprimante HP LaserJet',    'Imprimante',          'HPLJ-007',   15.00, 'maintenance', 'Bourrage papier à réparer'),
('Routeur Wi-Fi TP-Link AX55','Réseau',              'TPL-AX55-008', 8.00, 'disponible', 'Wi-Fi 6');

-- [DKM]
INSERT INTO clients (nom, prenom, courriel, telephone, adresse) VALUES
('Tremblay', 'Julie',   'julie.tremblay@exemple.ca', '819-555-0101', '12 rue Principale, Gatineau'),
('Nguyen',   'Minh',    'minh.nguyen@exemple.ca',    '613-555-0144', '450 av. Laurier, Ottawa'),
('Diallo',   'Aminata', 'aminata.diallo@exemple.ca', '819-555-0177', NULL),
('Roy',      'Marc',    'marc.roy@exemple.ca',       NULL,           '8 boul. Maloney, Gatineau');

-- [FO] Une location en cours, une en retard et une terminée
INSERT INTO locations
  (client_id, materiel_id, date_debut, date_fin_prevue, date_retour, tarif_jour, jours_prevus, montant_prevu, frais_retard, montant_total, statut, remarque)
VALUES
  (1, 1, CURDATE() - INTERVAL 2 DAY,  CURDATE() + INTERVAL 5 DAY, NULL, 25.00, 7, 175.00, 0, 175.00, 'en_cours', 'Stage en entreprise'),
  (2, 2, CURDATE() - INTERVAL 10 DAY, CURDATE() - INTERVAL 3 DAY, NULL, 35.00, 7, 245.00, 0, 245.00, 'en_cours', NULL),
  (3, 4, CURDATE() - INTERVAL 20 DAY, CURDATE() - INTERVAL 17 DAY, CURDATE() - INTERVAL 17 DAY, 30.00, 3, 90.00, 0, 90.00, 'terminee', 'Présentation client');

-- [KAKK] Paiement de démonstration (location terminée déjà réglée)
INSERT INTO paiements (location_id, stripe_session_id, montant, devise, statut, paye_le)
VALUES (3, 'cs_demo_location_3', 90.00, 'cad', 'paye', NOW() - INTERVAL 17 DAY);

-- Vérification
SELECT id, nom, etat FROM materiels;
