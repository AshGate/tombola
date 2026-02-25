# Bot Discord - Système de Tombola

Bot Discord en Node.js avec discord.js v14 pour gérer un système de ventes de tickets de tombola.

## Configuration

### 1. Créer un bot Discord

1. Allez sur [Discord Developer Portal](https://discord.com/developers/applications)
2. Cliquez sur "New Application"
3. Donnez un nom à votre bot
4. Allez dans l'onglet "Bot"
5. Cliquez sur "Add Bot"
6. Activez les 3 "Privileged Gateway Intents":
   - Presence Intent
   - Server Members Intent
   - Message Content Intent
7. Copiez le token du bot

### 2. Inviter le bot sur votre serveur

1. Dans le Developer Portal, allez dans "OAuth2" > "URL Generator"
2. Cochez les scopes:
   - `bot`
   - `applications.commands`
3. Cochez les permissions:
   - Send Messages
   - Embed Links
   - Read Message History
   - Use Slash Commands
4. Copiez l'URL générée et ouvrez-la dans votre navigateur
5. Sélectionnez votre serveur et autorisez le bot

### 3. Configuration des variables d'environnement

Éditez le fichier `.env` et remplissez les valeurs suivantes:

```env
DISCORD_TOKEN=votre_token_discord
DISCORD_CLIENT_ID=votre_client_id
SUPABASE_SERVICE_ROLE_KEY=votre_service_role_key
```

Pour obtenir votre `SUPABASE_SERVICE_ROLE_KEY`:
1. Allez sur votre projet Supabase
2. Settings > API
3. Copiez la clé "service_role"

### 4. Installation et démarrage

```bash
npm install
npm start
```

## Utilisation

### Commandes

- `!setup` - Crée le message avec le bouton "Ajouter une vente"
- `!liste` - Affiche toutes les ventes enregistrées avec le total de tickets
- `!supprimer <ID>` - Supprime une vente (ID copié depuis la liste)
- `!modifier <ID>` - Ouvre un formulaire pour modifier une vente existante

### Ajouter une vente

1. Cliquez sur le bouton "Ajouter une vente"
2. Remplissez le formulaire:
   - Nom
   - Prénom
   - Numéro
   - Quantité de tickets vendus
3. Validez le formulaire

### Fonctionnalités

- Chaque vente a un ID unique généré automatiquement
- L'ID Discord du vendeur est enregistré automatiquement
- Les données sont stockées dans une base Supabase sécurisée
- Interface intuitive avec boutons et formulaires modaux
- Messages embed colorés pour une meilleure lisibilité
- Total des tickets vendus affiché dans la liste

## Structure de la base de données

La table `sales` contient:
- `id` - UUID unique
- `seller_id` - ID Discord du vendeur
- `nom` - Nom du client
- `prenom` - Prénom du client
- `numero` - Numéro du client
- `quantite` - Nombre de tickets vendus
- `created_at` - Date de création
- `updated_at` - Date de dernière modification
