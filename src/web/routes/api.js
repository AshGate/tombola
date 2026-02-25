const { Router } = require('express');
const supabase = require('../../supabase');
const { PRIX_TICKET } = require('../../constants');

const router = Router();

function buildDateFilter(query, req) {
  const { period, start, end } = req.query;
  if (period === 'today') {
    const d = new Date(); d.setHours(0, 0, 0, 0);
    query = query.gte('created_at', d.toISOString());
  } else if (period === '7days') {
    const d = new Date(); d.setDate(d.getDate() - 7); d.setHours(0, 0, 0, 0);
    query = query.gte('created_at', d.toISOString());
  } else if (period === '30days') {
    const d = new Date(); d.setDate(d.getDate() - 30); d.setHours(0, 0, 0, 0);
    query = query.gte('created_at', d.toISOString());
  } else if (period === 'custom' && start) {
    query = query.gte('created_at', new Date(start).toISOString());
    if (end) {
      const endDate = new Date(end); endDate.setHours(23, 59, 59, 999);
      query = query.lte('created_at', endDate.toISOString());
    }
  }
  return query;
}

router.get('/dashboard', async (req, res) => {
  try {
    let query = supabase.from('sales').select('*').order('created_at', { ascending: false });
    query = buildDateFilter(query, req);
    const { data: sales, error } = await query;
    if (error) throw error;

    const items = sales || [];
    const totalTickets = items.reduce((s, v) => s + v.quantite, 0);
    const totalGainEmployes = items.reduce((s, v) => s + v.gain_employe, 0);
    const totalGainEntreprise = items.reduce((s, v) => s + v.gain_entreprise, 0);
    const totalRevenue = totalTickets * PRIX_TICKET;

    const sellerMap = {};
    for (const sale of items) {
      if (!sellerMap[sale.seller_id]) {
        sellerMap[sale.seller_id] = { tickets: 0, gainEmploye: 0, gainEntreprise: 0, sales: 0 };
      }
      sellerMap[sale.seller_id].tickets += sale.quantite;
      sellerMap[sale.seller_id].gainEmploye += sale.gain_employe;
      sellerMap[sale.seller_id].gainEntreprise += sale.gain_entreprise;
      sellerMap[sale.seller_id].sales += 1;
    }

    const employees = Object.entries(sellerMap)
      .map(([id, stats]) => ({ seller_id: id, ...stats }))
      .sort((a, b) => b.tickets - a.tickets);

    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const todaySales = items.filter(s => new Date(s.created_at) >= startOfDay);
    const todayTickets = todaySales.reduce((s, v) => s + v.quantite, 0);

    const dailyMap = {};
    for (const sale of items) {
      const day = new Date(sale.created_at).toISOString().split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { tickets: 0, gainEntreprise: 0 };
      dailyMap[day].tickets += sale.quantite;
      dailyMap[day].gainEntreprise += sale.gain_entreprise;
    }
    const dailyStats = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats }));

    res.json({
      totalTickets, totalGainEmployes, totalGainEntreprise, totalRevenue,
      totalSales: items.length, todayTickets, todaySales: todaySales.length,
      employees, dailyStats,
    });
  } catch (err) {
    console.error('Erreur dashboard:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/seller/:id', async (req, res) => {
  try {
    let query = supabase.from('sales').select('*').eq('seller_id', req.params.id).order('created_at', { ascending: false });
    query = buildDateFilter(query, req);
    const { data: sales, error } = await query;
    if (error) throw error;

    const items = sales || [];
    const totalTickets = items.reduce((s, v) => s + v.quantite, 0);
    const totalGain = items.reduce((s, v) => s + v.gain_employe, 0);
    const avgPerSale = items.length > 0 ? Math.round(totalTickets / items.length) : 0;

    const dailyMap = {};
    for (const sale of items) {
      const day = new Date(sale.created_at).toISOString().split('T')[0];
      if (!dailyMap[day]) dailyMap[day] = { tickets: 0, gain: 0 };
      dailyMap[day].tickets += sale.quantite;
      dailyMap[day].gain += sale.gain_employe;
    }
    const dailyStats = Object.entries(dailyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, stats]) => ({ date, ...stats }));

    res.json({
      seller_id: req.params.id, totalTickets, totalGain,
      totalSales: items.length, avgPerSale, dailyStats, sales: items,
    });
  } catch (err) {
    console.error('Erreur seller:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/sales', async (req, res) => {
  try {
    const { page = 1, limit = 50, seller, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);

    let query = supabase.from('sales').select('*', { count: 'exact' }).order('created_at', { ascending: false });
    query = buildDateFilter(query, req);
    if (seller) query = query.eq('seller_id', seller);
    if (search) query = query.or(`nom.ilike.%${search}%,prenom.ilike.%${search}%,numero.ilike.%${search}%`);
    query = query.range(offset, offset + parseInt(limit) - 1);

    const { data, error, count } = await query;
    if (error) throw error;
    res.json({ sales: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Erreur sales:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    let query = supabase.from('sales').select('*').order('created_at', { ascending: false });
    query = buildDateFilter(query, req);
    const { data, error } = await query;
    if (error) throw error;

    const headers = ['ID', 'Vendeur ID', 'Nom', 'Prenom', 'Numero', 'Quantite', 'Gain Employe', 'Gain Entreprise', 'Date'];
    const rows = (data || []).map(s => [
      s.id, s.seller_id, s.nom, s.prenom, s.numero,
      s.quantite, s.gain_employe, s.gain_entreprise,
      new Date(s.created_at).toLocaleString('fr-FR'),
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(','))].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=ventes_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (err) {
    console.error('Erreur export:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/draw', async (req, res) => {
  try {
    let query = supabase.from('sales').select('*');
    query = buildDateFilter(query, req);
    const { data: sales, error } = await query;
    if (error) throw error;

    if (!sales || sales.length === 0) {
      return res.status(400).json({ error: 'Aucune vente pour cette periode.' });
    }

    const tickets = [];
    for (const sale of sales) {
      for (let i = 0; i < sale.quantite; i++) {
        tickets.push(sale);
      }
    }

    const winnerIndex = Math.floor(Math.random() * tickets.length);
    const winner = tickets[winnerIndex];

    res.json({
      winner: { nom: winner.nom, prenom: winner.prenom, numero: winner.numero, seller_id: winner.seller_id, quantite: winner.quantite },
      totalTickets: tickets.length,
      totalParticipants: new Set(sales.map(s => `${s.nom}-${s.prenom}-${s.numero}`)).size,
    });
  } catch (err) {
    console.error('Erreur draw:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/seasons', async (req, res) => {
  try {
    const { data, error } = await supabase.from('seasons').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ seasons: data || [] });
  } catch (err) {
    console.error('Erreur seasons:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/seasons/:id/sales', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    const { data, error, count } = await supabase
      .from('season_sales').select('*', { count: 'exact' })
      .eq('season_id', req.params.id)
      .order('created_at', { ascending: false })
      .range(offset, offset + parseInt(limit) - 1);
    if (error) throw error;
    res.json({ sales: data || [], total: count || 0, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    console.error('Erreur season sales:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.post('/seasons/close', async (req, res) => {
  try {
    const { name } = req.body || {};
    const { data: allSales, error: fetchErr } = await supabase.from('sales').select('*');
    if (fetchErr) throw fetchErr;

    if (!allSales || allSales.length === 0) {
      return res.status(400).json({ error: 'Aucune donnee a archiver.' });
    }

    const totalTickets = allSales.reduce((s, v) => s + v.quantite, 0);
    const totalGainEmployes = allSales.reduce((s, v) => s + v.gain_employe, 0);
    const totalGainEntreprise = allSales.reduce((s, v) => s + v.gain_entreprise, 0);
    const seasonName = name || `Saison du ${new Date().toLocaleDateString('fr-FR')}`;

    const { data: season, error: seasonErr } = await supabase
      .from('seasons')
      .insert({ name: seasonName, ended_at: new Date().toISOString(), total_tickets: totalTickets, total_gain_employes: totalGainEmployes, total_gain_entreprise: totalGainEntreprise, total_sales: allSales.length, is_active: false })
      .select().maybeSingle();
    if (seasonErr) throw seasonErr;

    const rows = allSales.map(s => ({
      season_id: season.id, seller_id: s.seller_id, nom: s.nom, prenom: s.prenom,
      numero: s.numero, quantite: s.quantite, gain_employe: s.gain_employe,
      gain_entreprise: s.gain_entreprise, created_at: s.created_at,
    }));
    const { error: insertErr } = await supabase.from('season_sales').insert(rows);
    if (insertErr) throw insertErr;

    const { error: deleteErr } = await supabase.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (deleteErr) throw deleteErr;

    res.json({ success: true, season: { id: season.id, name: seasonName, total_tickets: totalTickets, total_sales: allSales.length } });
  } catch (err) {
    console.error('Erreur close season:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const { data } = await supabase.from('bot_config').select('*').limit(1).maybeSingle();
    const { data: objectives } = await supabase.from('objectives').select('*').limit(1).maybeSingle();
    const { data: alerts } = await supabase.from('alert_rules').select('*').order('type');
    res.json({ config: data || {}, objectives: objectives || {}, alerts: alerts || [] });
  } catch (err) {
    console.error('Erreur settings:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/settings/config', async (req, res) => {
  try {
    const { prix_ticket, gain_employe_par_ticket, gain_entreprise_par_ticket, recap_hour } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (prix_ticket !== undefined) updates.prix_ticket = parseInt(prix_ticket);
    if (gain_employe_par_ticket !== undefined) updates.gain_employe_par_ticket = parseInt(gain_employe_par_ticket);
    if (gain_entreprise_par_ticket !== undefined) updates.gain_entreprise_par_ticket = parseInt(gain_entreprise_par_ticket);
    if (recap_hour !== undefined) updates.recap_hour = parseInt(recap_hour);

    const { data: existing } = await supabase.from('bot_config').select('id').limit(1).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('bot_config').update(updates).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('bot_config').insert({ ...updates, guild_id: 'default' });
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur update config:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/settings/objectives', async (req, res) => {
  try {
    const { monthly_ticket_goal } = req.body || {};
    const goal = parseInt(monthly_ticket_goal) || 0;
    const { data: existing } = await supabase.from('objectives').select('id').limit(1).maybeSingle();
    if (existing) {
      const { error } = await supabase.from('objectives').update({ monthly_ticket_goal: goal, updated_at: new Date().toISOString() }).eq('id', existing.id);
      if (error) throw error;
    } else {
      const { error } = await supabase.from('objectives').insert({ guild_id: 'default', monthly_ticket_goal: goal });
      if (error) throw error;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur update objectives:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.put('/settings/alerts', async (req, res) => {
  try {
    const { alerts } = req.body || {};
    if (!Array.isArray(alerts)) return res.status(400).json({ error: 'Format invalide.' });
    for (const alert of alerts) {
      if (alert.id) {
        const { error } = await supabase.from('alert_rules').update({ threshold: parseInt(alert.threshold), enabled: alert.enabled, updated_at: new Date().toISOString() }).eq('id', alert.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('alert_rules').insert({ guild_id: 'default', type: alert.type, threshold: parseInt(alert.threshold), enabled: alert.enabled });
        if (error) throw error;
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Erreur update alerts:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

router.get('/objectives/progress', async (req, res) => {
  try {
    const { data: obj } = await supabase.from('objectives').select('monthly_ticket_goal').limit(1).maybeSingle();
    const goal = obj?.monthly_ticket_goal || 0;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const { data: sales } = await supabase.from('sales').select('quantite').gte('created_at', startOfMonth.toISOString());
    const current = (sales || []).reduce((s, v) => s + v.quantite, 0);
    res.json({ goal, current, percentage: goal > 0 ? Math.min(100, Math.round((current / goal) * 100)) : 0 });
  } catch (err) {
    console.error('Erreur objectives progress:', err);
    res.status(500).json({ error: 'Erreur serveur.' });
  }
});

module.exports = router;
