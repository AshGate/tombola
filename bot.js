require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const {
  setupButton,
  listeSales,
  listeInscrits,
  mesGains,
  solde,
  statsEmploye,
  supprimerSale,
  modifierSale,
  showHelp,
  tutoriel,
  topVendeurs,
  resetTombola,
  renewChannel,
  setLogs,
  webPanel,
} = require('./src/commands');
const { showAddSaleModal, handleAddSaleModal, handleEditSaleModal, handleRemoveTicketsModal } = require('./src/interactions');
const { scheduleDailyRecap } = require('./src/logs');
const { createWebServer } = require('./src/web/server');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once('clientReady', () => {
  console.log(`Bot connecté en tant que ${client.user.tag}`);
  scheduleDailyRecap(client);
  createWebServer(client);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  const content = message.content.trim();

  if (content === ':setup') return setupButton(message);
  if (content === ':liste') return listeSales(message);
  if (content === ':inscrits') return listeInscrits(message);
  if (content === ':mesgains') return mesGains(message);
  if (content === ':solde') return solde(message);
  if (content === ':help' || content === ':aide') return showHelp(message);
  if (content === ':tutoriel') return tutoriel(message);
  if (content.startsWith(':stats')) return statsEmploye(message);
  if (content.startsWith(':supprimer ')) return supprimerSale(message);
  if (content.startsWith(':modifier')) return modifierSale(message);
  if (content === ':top') return topVendeurs(message);
  if (content === ':reset') return resetTombola(message);
  if (content === ':renew') return renewChannel(message);
  if (content.startsWith(':setlogs')) return setLogs(message);
  if (content === ':web') return webPanel(message);
});

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    if (interaction.customId === 'add_sale') return showAddSaleModal(interaction);
  }

  if (interaction.isModalSubmit()) {
    if (interaction.customId === 'add_sale_modal') return handleAddSaleModal(interaction);
    if (interaction.customId.startsWith('edit_sale_modal_')) return handleEditSaleModal(interaction);
    if (interaction.customId.startsWith('remove_tickets_modal_')) return handleRemoveTicketsModal(interaction);
  }
});

client.login(process.env.TOKEN);
