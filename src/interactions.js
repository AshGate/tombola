const {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  EmbedBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require('discord.js');
const supabase = require('./supabase');
const { GAIN_EMPLOYE_PAR_TICKET, GAIN_ENTREPRISE_PAR_TICKET, SELLER_ROLE_ID } = require('./constants');
const { sendSaleLog } = require('./logs');

async function showAddSaleModal(interaction) {
  if (!interaction.member.roles.cache.has(SELLER_ROLE_ID)) {
    return interaction.reply({
      content: '❌ Vous n\'avez pas le role requis pour enregistrer une vente.',
      flags: 64,
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('add_sale_modal')
    .setTitle('Enregistrer une vente');

  const nomInput = new TextInputBuilder()
    .setCustomId('nom')
    .setLabel('Nom du client')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Dupont')
    .setRequired(true);

  const prenomInput = new TextInputBuilder()
    .setCustomId('prenom')
    .setLabel('Prénom du client')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: Jean')
    .setRequired(true);

  const numeroInput = new TextInputBuilder()
    .setCustomId('numero')
    .setLabel('Numéro de téléphone du client')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 06 12 34 56 78')
    .setRequired(true);

  const quantiteInput = new TextInputBuilder()
    .setCustomId('quantite')
    .setLabel('Nombre de tickets achetés')
    .setStyle(TextInputStyle.Short)
    .setPlaceholder('Ex: 5')
    .setRequired(true);

  const rows = [nomInput, prenomInput, numeroInput, quantiteInput].map(input =>
    new ActionRowBuilder().addComponents(input)
  );

  modal.addComponents(...rows);
  await interaction.showModal(modal);
}

async function handleAddSaleModal(interaction) {
  if (!interaction.member.roles.cache.has(SELLER_ROLE_ID)) {
    return interaction.reply({
      content: '❌ Vous n\'avez pas le role requis pour enregistrer une vente.',
      flags: 64,
    });
  }

  const nom = interaction.fields.getTextInputValue('nom');
  const prenom = interaction.fields.getTextInputValue('prenom');
  const numero = interaction.fields.getTextInputValue('numero');
  const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));

  if (isNaN(quantite) || quantite <= 0) {
    return interaction.reply({ content: '❌ La quantité doit être un nombre valide et positif.', flags: 64 });
  }

  const gain_employe = quantite * GAIN_EMPLOYE_PAR_TICKET;
  const gain_entreprise = quantite * GAIN_ENTREPRISE_PAR_TICKET;

  const { error } = await supabase
    .from('sales')
    .insert([{ seller_id: interaction.user.id, nom, prenom, numero, quantite, gain_employe, gain_entreprise }]);

  if (error) {
    console.error('Erreur lors de l\'ajout:', error);
    return interaction.reply({ content: '❌ Erreur lors de l\'enregistrement.', flags: 64 });
  }

  const sellerName = interaction.member?.displayName ?? interaction.user.username;

  const embed = new EmbedBuilder()
    .setTitle('✅ Vente enregistrée avec succès !')
    .setColor('#00B86B')
    .setDescription(`Vente enregistrée par **${sellerName}**`)
    .addFields(
      { name: '👤 Client', value: `${prenom} ${nom}`, inline: true },
      { name: '📞 Téléphone', value: numero, inline: true },
      { name: '🎟️ Tickets achetés', value: quantite.toString(), inline: true },
      { name: '💰 Gain vendeur', value: `${gain_employe.toLocaleString()}$`, inline: true },
      { name: '🏢 Gain entreprise', value: `${gain_entreprise.toLocaleString()}$`, inline: true }
    )
    .setFooter({ text: `Vendeur : ${sellerName}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], flags: 64 });

  sendSaleLog(interaction.client, interaction.guildId, {
    sellerDisplayName: sellerName,
    sellerMention: `<@${interaction.user.id}>`,
    nom,
    prenom,
    numero,
    quantite,
    gain_employe,
    gain_entreprise,
  }).catch(console.error);
}

async function handleEditSaleModal(interaction) {
  const id = interaction.customId.replace('edit_sale_modal_', '');
  const nom = interaction.fields.getTextInputValue('nom');
  const prenom = interaction.fields.getTextInputValue('prenom');
  const numero = interaction.fields.getTextInputValue('numero');
  const quantite = parseInt(interaction.fields.getTextInputValue('quantite'));

  if (isNaN(quantite) || quantite <= 0) {
    return interaction.reply({ content: '❌ La quantité doit être un nombre valide et positif.', flags: 64 });
  }

  const gain_employe = quantite * GAIN_EMPLOYE_PAR_TICKET;
  const gain_entreprise = quantite * GAIN_ENTREPRISE_PAR_TICKET;

  const { error } = await supabase
    .from('sales')
    .update({ nom, prenom, numero, quantite, gain_employe, gain_entreprise, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (error) {
    console.error('Erreur lors de la modification:', error);
    return interaction.reply({ content: '❌ Erreur lors de la modification.', flags: 64 });
  }

  const embed = new EmbedBuilder()
    .setTitle('✏️ Vente modifiée')
    .setColor('#FFA500')
    .addFields(
      { name: 'Nom', value: `${prenom} ${nom}`, inline: true },
      { name: 'Numéro', value: numero, inline: true },
      { name: 'Tickets', value: quantite.toString(), inline: true },
      { name: 'Gain employé', value: `${gain_employe.toLocaleString()}$`, inline: true },
      { name: 'Gain entreprise', value: `${gain_entreprise.toLocaleString()}$`, inline: true }
    );

  await interaction.reply({ embeds: [embed], flags: 64 });
}

async function handleRemoveTicketsModal(interaction) {
  const parts = interaction.customId.replace('remove_tickets_modal_', '').split('_');
  const sellerId = parts[0];
  const maxTickets = parseInt(parts[1]);
  const toRemove = parseInt(interaction.fields.getTextInputValue('tickets_to_remove'));

  if (isNaN(toRemove) || toRemove <= 0) {
    return interaction.reply({ content: '❌ Le nombre de tickets doit etre un nombre positif.', flags: 64 });
  }

  if (toRemove > maxTickets) {
    return interaction.reply({ content: `❌ Impossible de retirer ${toRemove} tickets. Maximum : ${maxTickets}.`, flags: 64 });
  }

  const { data: sales, error: fetchError } = await supabase
    .from('sales')
    .select('*')
    .eq('seller_id', sellerId)
    .order('created_at', { ascending: false });

  if (fetchError || !sales) {
    console.error('Erreur lors de la récupération:', fetchError);
    return interaction.reply({ content: '❌ Erreur lors de la récupération des ventes.', flags: 64 });
  }

  let remaining = toRemove;

  for (const sale of sales) {
    if (remaining <= 0) break;

    if (sale.quantite <= remaining) {
      remaining -= sale.quantite;
      const { error } = await supabase.from('sales').delete().eq('id', sale.id);
      if (error) {
        console.error('Erreur suppression:', error);
        return interaction.reply({ content: '❌ Erreur lors de la mise a jour.', flags: 64 });
      }
    } else {
      const newQty = sale.quantite - remaining;
      remaining = 0;
      const { error } = await supabase
        .from('sales')
        .update({
          quantite: newQty,
          gain_employe: newQty * GAIN_EMPLOYE_PAR_TICKET,
          gain_entreprise: newQty * GAIN_ENTREPRISE_PAR_TICKET,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sale.id);
      if (error) {
        console.error('Erreur mise a jour:', error);
        return interaction.reply({ content: '❌ Erreur lors de la mise a jour.', flags: 64 });
      }
    }
  }

  const newTotal = maxTickets - toRemove;
  const newGainEmploye = newTotal * GAIN_EMPLOYE_PAR_TICKET;
  const newGainEntreprise = newTotal * GAIN_ENTREPRISE_PAR_TICKET;

  const member = interaction.guild?.members.cache.get(sellerId)
    ?? await interaction.guild?.members.fetch(sellerId).catch(() => null);
  const displayName = member?.displayName ?? sellerId;
  const adminName = interaction.member?.displayName ?? interaction.user.username;

  const embed = new EmbedBuilder()
    .setTitle('Modification effectuee')
    .setColor('#FFA500')
    .addFields(
      { name: 'Employe', value: displayName, inline: true },
      { name: 'Tickets retires', value: toRemove.toString(), inline: true },
      { name: 'Nouveau total', value: newTotal.toString(), inline: true },
      { name: 'Nouveau gain employe', value: `${newGainEmploye.toLocaleString()}$`, inline: true },
      { name: 'Nouveau gain entreprise', value: `${newGainEntreprise.toLocaleString()}$`, inline: true }
    )
    .setFooter({ text: `Modifie par ${adminName}` })
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

module.exports = { showAddSaleModal, handleAddSaleModal, handleEditSaleModal, handleRemoveTicketsModal };
