# Projet 3 — Système de location de matériel informatique (LocaTech)

Application web de gestion de location de matériel informatique :
**Node.js / Express**, **MySQL**, **HTML / CSS / JavaScript** et paiement en ligne avec **Stripe Checkout**.

## Équipe

| Initiales | Membre | Responsabilités |
|---|---|---|
| **JKK** | Kitiki, Jurel Kissel | Matériel (route `/api/materiels`, `materiels.js`) |
| **DKM** | Mpete, Dan Kazadi | Clients (route `/api/clients`, `clients.js`, formulaires CSS) |
| **KAKK** | Koffi, Kouadio Axel Kevin | Serveur, base de données, tableau de bord, paiements Stripe |
| **FO** | Olou, Fulgence | Locations et retours (route `/api/locations`, `locations.js`) |

Chaque fichier et chaque section du code porte les initiales de son auteur en commentaire (ex. `// [FO]`).

## Fonctionnalités

- **Matériel** : ajout, modification, suppression, recherche, filtres par catégorie et par état (disponible, loué, maintenance).
- **Clients** : ajout, modification, suppression (refusée s'il y a un historique) et recherche.
- **Locations** : création avec calcul automatique du prix (jours × tarif), retour avec frais de retard (+50 % du tarif par jour), matériel endommagé envoyé en maintenance, annulation.
- **Paiement Stripe** : bouton « Payer » → page de paiement Stripe → confirmation automatique, avec gestion du solde restant (frais de retard).
- **Tableau de bord** : statistiques, locations en retard, matériel par catégorie, montants encaissés.

## Installation

1. Démarrer **Apache** et **MySQL** dans XAMPP.
2. Ouvrir **http://localhost/phpmyadmin**, onglet **SQL**, coller le contenu de `database/init.sql` et cliquer sur **Exécuter**.
3. Copier `.env.example` en `.env` et ajuster `DB_PASSWORD` (vide avec XAMPP).
4. Ajouter la clé Stripe de test (voir ci-dessous).
5. Dans le terminal du projet :
   ```
   npm install
   npm start
   ```
6. Ouvrir **http://localhost:3000**.

## Configuration de Stripe (mode test)

1. Créer un compte gratuit sur https://dashboard.stripe.com, en restant en **mode test**.
2. Copier la **clé secrète** (`sk_test_...`) dans `.env` : `STRIPE_SECRET_KEY=sk_test_...`
3. Redémarrer le serveur.
4. Carte de test : **4242 4242 4242 4242**, n'importe quelle date future, n'importe quel CVC.

Sans clé Stripe, l'application fonctionne normalement : seul le bouton « Payer » est masqué.

**Webhook (optionnel)** : avec Stripe CLI, lancer `stripe listen --forward-to localhost:3000/api/paiements/webhook`, puis copier le secret `whsec_...` dans `STRIPE_WEBHOOK_SECRET`.

## Structure

```
location-materiel/
├── server.js               [KAKK] serveur Express, gestion des erreurs
├── config/db.js            [KAKK] pool MySQL et transactions
├── utils/validation.js     [KAKK] validation des données
├── routes/
│   ├── materiels.js        [JKK]
│   ├── clients.js          [DKM]
│   ├── locations.js        [FO]
│   ├── stats.js            [KAKK]
│   └── paiements.js        [KAKK] Stripe Checkout + webhook
├── database/init.sql       tables + données de démonstration
└── public/
    ├── index.html
    ├── css/style.css
    └── js/ api.js, tableau.js, materiels.js, clients.js, locations.js, paiements.js, main.js
```

## API REST

| Méthode | URL | Description |
|---|---|---|
| GET | `/api/materiels?recherche=&categorie=&etat=` | Liste filtrée |
| GET | `/api/materiels/categories` | Catégories existantes |
| POST / PUT / DELETE | `/api/materiels[/:id]` | Ajouter / modifier / supprimer |
| GET | `/api/clients?recherche=` | Liste des clients |
| POST / PUT / DELETE | `/api/clients[/:id]` | Ajouter / modifier / supprimer |
| GET | `/api/locations?statut=&recherche=` | Liste (en_cours, en_retard, terminee, annulee) |
| POST | `/api/locations` | Créer une location |
| PUT | `/api/locations/:id/retour` | Enregistrer le retour |
| PUT | `/api/locations/:id/annuler` | Annuler |
| GET | `/api/stats` | Statistiques du tableau de bord |
| POST | `/api/paiements/checkout` | Créer une session Stripe |
| GET | `/api/paiements/confirmer?session_id=` | Vérifier un paiement |
| POST | `/api/paiements/webhook` | Notifications Stripe |

Codes de réponse : 200, 201, 400 (données invalides), 404 (introuvable), 409 (conflit : déjà loué, doublon, historique), 500, 502 (Stripe), 503 (Stripe non configuré).
