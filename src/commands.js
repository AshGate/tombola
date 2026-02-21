const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const supabase = require('./supabase');
const { ADMIN_ROLE_NAME, GAIN_EMPLOYE_PAR_TICKET, GAIN_ENTREPRISE_PAR_TICKET, SELLER_ROLE_ID, DIRECTION_ROLE_ID } = require('./constants');
const { setLogsChannelId, archiveSales } = require('./logs');

async function setupButton(message) {
  const embed = new EmbedBuilder()
    .setTitle('🎟️ Système de Tombola')
    .setDescription('Cliquez sur le bouton ci-dessous pour enregistrer votre vente de tickets.')
    .setColor('#00B86B');

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('add_sale')
      .setLabel('Vendre')
      .setStyle(ButtonStyle.Success)
      .setEmoji('💰')
  );

  await message.channel.send({ embeds: [embed], components: [row] });
  await message.delete().catch(() => {});
}

async function listeSales(message) {
  const { data, error } = await supabase
    .from('sales')
    .select('seller_id, quantite, gain_employe, gain_entreprise');

  if (error) {
    console.error('Erreur lors de la récupération:', error);
    return message.reply('❌ Erreur lors de la récupération des ventes.');
  }

  if (!data || data.length === 0) {
    return message.reply('📋 Aucune vente enregistrée.');
  }

  const sellerMap = {};
  for (const sale of data) {
    if (!sellerMap[sale.seller_id]) {
      sellerMap[sale.seller_id] = { tickets: 0, gainEmploye: 0, gainEntreprise: 0 };
    }
    sellerMap[sale.seller_id].tickets += sale.quantite;
    sellerMap[sale.seller_id].gainEmploye += sale.gain_employe;
    sellerMap[sale.seller_id].gainEntreprise += sale.gain_entreprise;
  }

  const totalTickets = data.reduce((sum, s) => sum + s.quantite, 0);
  const totalGainEmployes = data.reduce((sum, s) => sum + s.gain_employe, 0);
  const totalGainEntreprise = data.reduce((sum, s) => sum + s.gain_entreprise, 0);

  const sellers = Object.entries(sellerMap)
    .sort((a, b) => b[1].tickets - a[1].tickets);

  const guild = message.guild;
  const sellerLines = [];

  for (const [sellerId, stats] of sellers.slice(0, 25)) {
    const member = guild.members.cache.get(sellerId)
      ?? await guild.members.fetch(sellerId).catch(() => null);
    const displayName = member?.displayName ?? `Utilisateur inconnu (${sellerId})`;

    sellerLines.push(
      `**${displayName}**\nTickets vendus : ${stats.tickets}\nTotal gagné : ${stats.gainEmploye.toLocaleString()}$`
    );
  }

  if (sellers.length > 25) {
    sellerLines.push(`\n*...et ${sellers.length - 25} vendeur(s) supplémentaire(s)*`);
  }

  const embed = new EmbedBuilder()
    .setTitle('📋 Statistiques par vendeur')
    .setColor('#0099FF')
    .setDescription(
      `**Total tickets : ${totalTickets}** | **Gains vendeurs : ${totalGainEmployes.toLocaleString()}$** | **Gains entreprise : ${totalGainEntreprise.toLocaleString()}$**\n\n` +
      sellerLines.join('\n\n')
    )
    .setFooter({ text: `${sellers.length} vendeur(s) — ${data.length} vente(s) enregistrée(s)` })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

async function mesGains(message) {
  if (!message.member.roles.cache.has(SELLER_ROLE_ID)) {
    return message.reply('❌ Vous n\'avez pas le role requis pour utiliser cette commande.');
  }

  const { data, error } = await supabase
    .from('sales')
    .select('quantite, gain_employe')
    .eq('seller_id', message.author.id);

  if (error) {
    console.error('Erreur lors de la récupération:', error);
    return message.reply('❌ Erreur lors de la récupération de vos gains.');
  }

  const displayName = message.member?.displayName ?? message.author.username;

  if (!data || data.length === 0) {
    return message.reply({ embeds: [
      new EmbedBuilder()
        .setTitle('📊 Statistiques')
        .setColor('#0099FF')
        .setDescription(`Statistiques de **${displayName}**\n\nAucune vente enregistrée.`)
    ]});
  }

  const totalTickets = data.reduce((sum, s) => sum + s.quantite, 0);
  const totalGains = data.reduce((sum, s) => sum + s.gain_employe, 0);

  const embed = new EmbedBuilder()
    .setTitle('📊 Statistiques')
    .setColor('#00B86B')
    .setDescription(`Statistiques de **${displayName}**`)
    .addFields(
      { name: 'Tickets vendus', value: totalTickets.toString(), inline: true },
      { name: 'Total gagné', value: `${totalGains.toLocaleString()}$`, inline: true }
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

async function solde(message) {
  const { data, error } = await supabase
    .from('sales')
    .select('quantite');

  if (error) {
    console.error('Erreur lors de la récupération:', error);
    return message.reply('❌ Erreur lors de la récupération du solde.');
  }

  if (!data || data.length === 0) {
    return message.reply({ embeds: [
      new EmbedBuilder()
        .setTitle('Solde entreprise')
        .setColor('#FFD700')
        .setDescription('Aucune vente enregistree pour le moment.')
    ]});
  }

  const totalTickets = data.reduce((sum, s) => sum + s.quantite, 0);
  const totalEntreprise = totalTickets * GAIN_ENTREPRISE_PAR_TICKET;

  const embed = new EmbedBuilder()
    .setTitle('Solde entreprise')
    .setColor('#FFD700')
    .addFields(
      { name: 'Total tickets vendus', value: `${totalTickets.toLocaleString()}`, inline: false },
      { name: 'Total gagne par l\'entreprise', value: `${totalEntreprise.toLocaleString()}$`, inline: false }
    )
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

async function statsEmploye(message) {
  const isAdmin =
    message.member.permissions.has('Administrator') ||
    message.member.roles.cache.some(r => r.name === ADMIN_ROLE_NAME);

  if (!isAdmin) {
    return message.reply({ content: '❌ Vous n\'avez pas la permission d\'utiliser cette commande.', flags: 64 });
  }

  const mention = message.mentions.users.first();
  if (!mention) {
    return message.reply('❌ Usage: `:stats @utilisateur`');
  }

  const mentionMember = message.guild?.members.cache.get(mention.id) ?? await message.guild?.members.fetch(mention.id).catch(() => null);
  const mentionDisplayName = mentionMember?.displayName ?? mention.username;

  const { data, error } = await supabase
    .from('sales')
    .select('quantite, gain_employe')
    .eq('seller_id', mention.id);

  if (error) {
    console.error('Erreur lors de la récupération:', error);
    return message.reply('❌ Erreur lors de la récupération des stats.');
  }

  if (!data || data.length === 0) {
    return message.reply(`📊 Aucune vente enregistrée pour **${mentionDisplayName}**.`);
  }

  const totalTickets = data.reduce((sum, s) => sum + s.quantite, 0);
  const totalGains = data.reduce((sum, s) => sum + s.gain_employe, 0);

  const authorDisplayName = message.member?.displayName ?? message.author.username;

  const embed = new EmbedBuilder()
    .setTitle(`📊 Statistiques de ${mentionDisplayName}`)
    .setColor('#0099FF')
    .setThumbnail(mention.displayAvatarURL())
    .addFields(
      { name: 'Tickets vendus', value: totalTickets.toString(), inline: true },
      { name: 'Total gagné', value: `${totalGains.toLocaleString()}$`, inline: true },
      { name: 'Nombre de ventes', value: data.length.toString(), inline: true }
    )
    .setFooter({ text: `Consulté par ${authorDisplayName}` })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

async function supprimerSale(message) {
  const id = message.content.replace(':supprimer ', '').trim();

  if (!id) return message.reply('❌ Usage: `:supprimer <ID>`');

  const { data: saleData, error: fetchError } = await supabase
    .from('sales')
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (fetchError) return message.reply('❌ Erreur lors de la recherche.');
  if (!saleData) return message.reply('❌ Aucune vente trouvée avec cet ID.');

  const { error } = await supabase.from('sales').delete().eq('id', id);

  if (error) {
    console.error('Erreur lors de la suppression:', error);
    return message.reply('❌ Erreur lors de la suppression.');
  }

  const embed = new EmbedBuilder()
    .setTitle('🗑️ Vente supprimée')
    .setColor('#FF0000')
    .addFields(
      { name: 'ID', value: saleData.id, inline: false },
      { name: 'Nom', value: `${saleData.prenom} ${saleData.nom}`, inline: true },
      { name: 'Tickets', value: saleData.quantite.toString(), inline: true }
    );

  await message.reply({ embeds: [embed] });
}

async function modifierSale(message) {
  if (!message.member.roles.cache.has(DIRECTION_ROLE_ID)) {
    return message.reply('❌ Seule la Direction peut utiliser cette commande.');
  }

  const mention = message.mentions.users.first();
  if (!mention) {
    return message.reply('❌ Usage: `:modifier @utilisateur`');
  }

  const mentionMember = message.guild?.members.cache.get(mention.id)
    ?? await message.guild?.members.fetch(mention.id).catch(() => null);
  const mentionDisplayName = mentionMember?.displayName ?? mention.username;

  const { data, error } = await supabase
    .from('sales')
    .select('quantite, gain_employe')
    .eq('seller_id', mention.id);

  if (error) {
    console.error('Erreur lors de la récupération:', error);
    return message.reply('❌ Erreur lors de la récupération des données.');
  }

  const totalTickets = data ? data.reduce((sum, s) => sum + s.quantite, 0) : 0;

  if (totalTickets === 0) {
    return message.reply(`❌ **${mentionDisplayName}** n'a aucun ticket enregistré.`);
  }

  const embed = new EmbedBuilder()
    .setTitle(`Modifier les tickets de ${mentionDisplayName}`)
    .setColor('#FFA500')
    .setDescription(`Cet employe a actuellement **${totalTickets} ticket(s)** vendus.\nCliquez sur le bouton pour retirer des tickets.`)
    .addFields(
      { name: 'Gain employe actuel', value: `${(totalTickets * GAIN_EMPLOYE_PAR_TICKET).toLocaleString()}$`, inline: true },
      { name: 'Gain entreprise actuel', value: `${(totalTickets * GAIN_ENTREPRISE_PAR_TICKET).toLocaleString()}$`, inline: true }
    );

  const buttonMessage = await message.reply({
    embeds: [embed],
    components: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`show_remove_modal_${mention.id}_${totalTickets}`)
          .setLabel('Retirer des tickets')
          .setStyle(ButtonStyle.Danger)
      )
    ]
  });

  const modal = new ModalBuilder()
    .setCustomId(`remove_tickets_modal_${mention.id}_${totalTickets}`)
    .setTitle('Retirer des tickets');

  const qtyInput = new TextInputBuilder()
    .setCustomId('tickets_to_remove')
    .setLabel(`Combien de tickets retirer ? (max: ${totalTickets})`)
    .setStyle(TextInputStyle.Short)
    .setPlaceholder(`Ex: 5 (max ${totalTickets})`)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(qtyInput));

  try {
    const filter = i => i.user.id === message.author.id;
    const buttonInteraction = await buttonMessage.awaitMessageComponent({ filter, time: 120000 });
    await buttonInteraction.showModal(modal);
  } catch {
    await buttonMessage.edit({ components: [] }).catch(() => {});
  }
}

async function topVendeurs(message) {
  const { data, error } = await supabase
    .from('sales')
    .select('seller_id, quantite, gain_employe');

  if (error) {
    console.error('Erreur lors de la récupération:', error);
    return message.reply('❌ Erreur lors de la récupération des données.');
  }

  if (!data || data.length === 0) {
    return message.reply('📋 Aucune vente enregistrée.');
  }

  const sellerMap = {};
  for (const sale of data) {
    if (!sellerMap[sale.seller_id]) {
      sellerMap[sale.seller_id] = { tickets: 0, gainEmploye: 0 };
    }
    sellerMap[sale.seller_id].tickets += sale.quantite;
    sellerMap[sale.seller_id].gainEmploye += sale.gain_employe;
  }

  const sorted = Object.entries(sellerMap)
    .sort((a, b) => b[1].tickets - a[1].tickets);

  const guild = message.guild;
  const medals = ['🥇', '🥈', '🥉'];
  const lines = [];

  for (let i = 0; i < sorted.length && i < 15; i++) {
    const [sellerId, stats] = sorted[i];
    const member = guild.members.cache.get(sellerId)
      ?? await guild.members.fetch(sellerId).catch(() => null);
    const displayName = member?.displayName ?? `Utilisateur inconnu`;
    const medal = medals[i] ?? `**#${i + 1}**`;

    lines.push(`${medal} ${displayName} — **${stats.tickets}** tickets — ${stats.gainEmploye.toLocaleString()}$`);
  }

  const totalTickets = data.reduce((sum, s) => sum + s.quantite, 0);

  const embed = new EmbedBuilder()
    .setTitle('🏆 Top Vendeurs')
    .setColor('#FFD700')
    .setDescription(
      `**${totalTickets} tickets vendus au total**\n\n` +
      lines.join('\n')
    )
    .setFooter({ text: 'Fait avec ❤️ par Serkan' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

async function showHelp(message) {
  const embed = new EmbedBuilder()
    .setTitle('📚 Liste des commandes disponibles')
    .setColor('#0099FF')
    .setDescription('Voici toutes les commandes disponibles pour gérer les ventes de tickets :')
    .addFields(
      { name: ':setup', value: 'Crée le bouton interactif pour ajouter des ventes', inline: false },
      { name: ':liste', value: 'Affiche toutes les ventes avec gains employé et entreprise', inline: false },
      { name: ':inscrits', value: 'Affiche la liste complète des clients inscrits (nom, prénom, numéro, tickets)', inline: false },
      { name: ':mesgains', value: 'Affiche vos statistiques personnelles (tickets vendus + total gagné)', inline: false },
      { name: ':solde', value: 'Affiche le solde total de l\'entreprise', inline: false },
      { name: ':stats @utilisateur', value: '(Admin) Affiche les statistiques d\'un employé', inline: false },
      { name: ':supprimer <ID>', value: 'Supprime une vente par son ID', inline: false },
      { name: ':modifier @utilisateur', value: '(Direction) Retirer des tickets a un employe et recalculer ses gains', inline: false },
      { name: ':renew', value: '(Direction) Supprime et recrée le salon actuel avec les mêmes paramètres', inline: false },
      { name: ':tutoriel', value: 'Affiche le guide complet d\'utilisation du bot', inline: false },
      { name: ':top', value: 'Affiche le classement des meilleurs vendeurs', inline: false },
      { name: ':setlogs #salon', value: '(Direction) Configure le salon pour les logs de ventes et recapitulatifs', inline: false },
      { name: ':help / :aide', value: 'Affiche cette aide', inline: false }
    )
    .setFooter({ text: 'Fait avec ❤️ par Serkan' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

async function tutoriel(message) {
  const embed = new EmbedBuilder()
    .setTitle('📖  Guide d\'utilisation — Bot Tombola')
    .setColor('#00B86B')
    .setDescription(
      '> Bienvenue ! Ce guide vous explique comment utiliser le systeme de gestion des ventes de tickets.\n' +
      '> Suivez les sections ci-dessous pour bien demarrer.\n\u200b'
    )
    .addFields(
      {
        name: '\u200b\n🎟️  Comment enregistrer une vente',
        value:
          '```\n' +
          '1. Cliquez sur le bouton  Ajouter une vente\n' +
          '2. Remplissez le formulaire qui s\'affiche\n' +
          '   (nom, prenom, numero, quantite)\n' +
          '3. Validez — les gains sont calcules automatiquement\n' +
          '```\n\u200b',
        inline: false,
      },
      {
        name: '👤  Qui peut vendre ?',
        value:
          'Seules les personnes ayant le role <@&1266876364355539179> peuvent enregistrer une vente.\n' +
          'Si vous n\'avez pas ce role, contactez la Direction.\n\u200b',
        inline: false,
      },
      {
        name: '💰  Voir ses gains personnels',
        value:
          'Utilisez la commande ci-dessous pour consulter vos tickets vendus et votre total gagne :\n' +
          '> `:mesgains`\n\u200b',
        inline: false,
      },
      {
        name: '🏢  Voir le solde de l\'entreprise',
        value:
          'Utilisez la commande ci-dessous pour consulter le total des gains de l\'entreprise :\n' +
          '> `:solde`\n\u200b',
        inline: false,
      },
      {
        name: '🛠️  Commandes Direction',
        value:
          'Reservees au role <@&1223303584360300605> uniquement :\n\n' +
          '> `:modifier @utilisateur` — Retirer des tickets a un employe\n' +
          '> `:stats @utilisateur` — Consulter les statistiques d\'un employe\n' +
          '> `:reset` — Reinitialiser les donnees\n\u200b',
        inline: false,
      },
      {
        name: '💵  Repartition des gains par ticket',
        value:
          '```\n' +
          'Prix du ticket        1 500$\n' +
          'Gain employe            400$\n' +
          'Gain entreprise       1 100$\n' +
          '```',
        inline: false,
      }
    )
    .setFooter({ text: 'Fait avec ❤️ par Serkan' })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

async function listeInscrits(message) {
  const { data, error } = await supabase
    .from('sales')
    .select('prenom, nom, numero, quantite, seller_id, created_at')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Erreur lors de la récupération:', error);
    return message.reply('❌ Erreur lors de la récupération des inscrits.');
  }

  if (!data || data.length === 0) {
    return message.reply('📋 Aucun client inscrit pour le moment.');
  }

  const guild = message.guild;
  const lines = [];

  for (let i = 0; i < data.length; i++) {
    const sale = data[i];
    const member = guild.members.cache.get(sale.seller_id)
      ?? await guild.members.fetch(sale.seller_id).catch(() => null);
    const sellerName = member?.displayName ?? 'Inconnu';

    lines.push(
      `**${i + 1}.** ${sale.prenom} ${sale.nom} — ${sale.numero}\n` +
      `Tickets : ${sale.quantite} | Vendeur : ${sellerName}`
    );
  }

  const totalTickets = data.reduce((sum, s) => sum + s.quantite, 0);

  const chunks = [];
  let current = '';
  for (const line of lines) {
    if ((current + '\n\n' + line).length > 3800) {
      chunks.push(current);
      current = line;
    } else {
      current = current ? current + '\n\n' + line : line;
    }
  }
  if (current) chunks.push(current);

  for (let i = 0; i < chunks.length; i++) {
    const embed = new EmbedBuilder()
      .setTitle(i === 0 ? '📋 Liste des clients inscrits' : '📋 Suite...')
      .setColor('#0099FF')
      .setDescription(
        (i === 0 ? `**${data.length} client(s) — ${totalTickets} ticket(s) au total**\n\n` : '') +
        chunks[i]
      );

    if (i === chunks.length - 1) {
      embed.setFooter({ text: `${data.length} inscription(s) enregistrée(s)` }).setTimestamp();
    }

    if (i === 0) {
      await message.reply({ embeds: [embed] });
    } else {
      await message.channel.send({ embeds: [embed] });
    }
  }
}

async function resetTombola(message) {
  if (!message.member.roles.cache.has(DIRECTION_ROLE_ID)) {
    return message.reply('❌ Seule la Direction peut utiliser cette commande.');
  }

  const { data, error: fetchError } = await supabase
    .from('sales')
    .select('quantite, gain_employe, gain_entreprise');

  if (fetchError) {
    console.error('Erreur lors de la récupération:', fetchError);
    return message.reply('❌ Erreur lors de la récupération des données.');
  }

  if (!data || data.length === 0) {
    return message.reply('❌ Aucune donnée a réinitialiser. La tombola est déjà vide.');
  }

  const totalTickets = data.reduce((sum, s) => sum + s.quantite, 0);
  const totalGainEmployes = data.reduce((sum, s) => sum + s.gain_employe, 0);
  const totalGainEntreprise = data.reduce((sum, s) => sum + s.gain_entreprise, 0);

  const warnEmbed = new EmbedBuilder()
    .setTitle('⚠️  Confirmation de réinitialisation')
    .setColor('#FF4444')
    .setDescription(
      '**Attention !** Cette action est irréversible.\n' +
      'Toutes les ventes et statistiques seront supprimées.\n\u200b'
    )
    .addFields(
      { name: 'Ventes enregistrées', value: data.length.toString(), inline: true },
      { name: 'Tickets vendus', value: totalTickets.toLocaleString(), inline: true },
      { name: 'Gains employés', value: `${totalGainEmployes.toLocaleString()}$`, inline: true },
      { name: 'Gains entreprise', value: `${totalGainEntreprise.toLocaleString()}$`, inline: true }
    )
    .setFooter({ text: 'Cette action supprimera définitivement toutes les données.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`reset_confirm_${message.author.id}`)
      .setLabel('Confirmer la réinitialisation')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`reset_cancel_${message.author.id}`)
      .setLabel('Annuler')
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmMessage = await message.reply({ embeds: [warnEmbed], components: [row] });

  try {
    const filter = i => i.user.id === message.author.id && i.customId.startsWith('reset_');
    const interaction = await confirmMessage.awaitMessageComponent({ filter, time: 30000 });

    if (interaction.customId.startsWith('reset_cancel_')) {
      const cancelEmbed = new EmbedBuilder()
        .setTitle('❎  Réinitialisation annulée')
        .setColor('#808080')
        .setDescription('La tombola n\'a pas été réinitialisée. Aucune donnée n\'a été supprimée.');

      await interaction.update({ embeds: [cancelEmbed], components: [] });
      return;
    }

    const { data: allSales } = await supabase.from('sales').select('*');
    await archiveSales(allSales);

    const { error } = await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    if (error) {
      console.error('Erreur lors de la réinitialisation:', error);
      await interaction.update({ content: '❌ Erreur lors de la réinitialisation.', embeds: [], components: [] });
      return;
    }

    const successEmbed = new EmbedBuilder()
      .setTitle('✅  Réinitialisation effectuée')
      .setColor('#00B86B')
      .setDescription('Toutes les statistiques ont été remises à zéro.')
      .addFields(
        { name: 'Ventes supprimées', value: data.length.toString(), inline: true },
        { name: 'Tickets supprimés', value: totalTickets.toLocaleString(), inline: true },
        { name: 'Gains effacés', value: `${(totalGainEmployes + totalGainEntreprise).toLocaleString()}$`, inline: true }
      )
      .setFooter({ text: `Réinitialisé par ${message.member?.displayName ?? message.author.username}` })
      .setTimestamp();

    await interaction.update({ embeds: [successEmbed], components: [] });
  } catch {
    await confirmMessage.edit({ components: [] }).catch(() => {});
  }
}

async function renewChannel(message) {
  if (!message.member.roles.cache.has(DIRECTION_ROLE_ID)) {
    return message.reply('❌ Seule la Direction peut utiliser cette commande.');
  }

  const channel = message.channel;
  const guild = message.guild;

  const warnEmbed = new EmbedBuilder()
    .setTitle('⚠️  Confirmation de renouvellement')
    .setColor('#FF4444')
    .setDescription(
      '**Attention !** Cette action va supprimer ce salon et le recréer avec les mêmes paramètres.\n' +
      'Tous les messages seront perdus de manière irréversible.\n\u200b'
    )
    .addFields(
      { name: 'Salon', value: `#${channel.name}`, inline: true },
      { name: 'Catégorie', value: channel.parent?.name ?? 'Aucune', inline: true }
    )
    .setFooter({ text: 'Cette action est irréversible.' });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`renew_confirm_${message.author.id}`)
      .setLabel('Confirmer le renouvellement')
      .setStyle(ButtonStyle.Danger),
    new ButtonBuilder()
      .setCustomId(`renew_cancel_${message.author.id}`)
      .setLabel('Annuler')
      .setStyle(ButtonStyle.Secondary)
  );

  const confirmMessage = await message.reply({ embeds: [warnEmbed], components: [row] });

  try {
    const filter = i => i.user.id === message.author.id && i.customId.startsWith('renew_');
    const interaction = await confirmMessage.awaitMessageComponent({ filter, time: 30000 });

    if (interaction.customId.startsWith('renew_cancel_')) {
      const cancelEmbed = new EmbedBuilder()
        .setTitle('❎  Renouvellement annulé')
        .setColor('#808080')
        .setDescription('Le salon n\'a pas été renouvelé.');

      await interaction.update({ embeds: [cancelEmbed], components: [] });
      return;
    }

    const channelConfig = {
      name: channel.name,
      type: ChannelType.GuildText,
      parent: channel.parentId,
      position: channel.position,
      topic: channel.topic,
      nsfw: channel.nsfw,
      rateLimitPerUser: channel.rateLimitPerUser,
      permissionOverwrites: channel.permissionOverwrites.cache.map(overwrite => ({
        id: overwrite.id,
        allow: overwrite.allow,
        deny: overwrite.deny,
        type: overwrite.type,
      })),
    };

    await channel.delete();

    const newChannel = await guild.channels.create(channelConfig);

    if (channelConfig.position !== undefined) {
      await newChannel.setPosition(channelConfig.position).catch(() => {});
    }

    const successEmbed = new EmbedBuilder()
      .setTitle('✅  Salon renouvelé')
      .setColor('#00B86B')
      .setDescription('Ce salon a été recréé avec succès. Tous les anciens messages ont été supprimés.')
      .setFooter({ text: `Renouvelé par ${message.member?.displayName ?? message.author.username}` })
      .setTimestamp();

    await newChannel.send({ embeds: [successEmbed] });
  } catch {
    await confirmMessage.edit({ components: [] }).catch(() => {});
  }
}

async function setLogs(message) {
  if (!message.member.roles.cache.has(DIRECTION_ROLE_ID)) {
    return message.reply('Seule la Direction peut utiliser cette commande.');
  }

  const channel = message.mentions.channels.first();
  if (!channel) {
    return message.reply('Usage: `:setlogs #salon`');
  }

  const success = await setLogsChannelId(message.guild.id, channel.id);

  if (!success) {
    return message.reply('Erreur lors de la configuration du salon de logs.');
  }

  const embed = new EmbedBuilder()
    .setTitle('Salon de logs configure')
    .setColor('#00B86B')
    .setDescription(`Les logs seront envoyees dans ${channel}.`)
    .setFooter({ text: `Configure par ${message.member?.displayName ?? message.author.username}` })
    .setTimestamp();

  await message.reply({ embeds: [embed] });
}

module.exports = {
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
};
