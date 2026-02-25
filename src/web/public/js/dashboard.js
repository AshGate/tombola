let currentPeriod = 'all';
let customStart = '';
let customEnd = '';
let chartTickets = null;
let chartGains = null;
let chartTop = null;

function money(n) { return (n || 0).toLocaleString('fr-FR') + '$'; }
function fmtDate(d) { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fmtDateTime(d) { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function truncId(id) { return id && id.length > 12 ? id.slice(0, 6) + '...' + id.slice(-4) : id; }

function periodParams() {
  if (currentPeriod === 'all') return '';
  if (currentPeriod === 'custom') return `&period=custom&start=${customStart}&end=${customEnd}`;
  return `&period=${currentPeriod}`;
}

async function api(url) {
  const sep = url.includes('?') ? '&' : '?';
  const res = await fetch(url + sep + periodParams().replace('&', ''));
  if (res.status === 401) { window.location.href = '/login'; return null; }
  if (!res.ok) throw new Error('Erreur serveur');
  return res.json();
}

function showToast(msg, type) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show ' + (type || '');
  setTimeout(() => t.classList.remove('show'), 3000);
}

const chartDefaults = { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { x: { grid: { color: '#1e2028' }, ticks: { color: '#52525b', font: { size: 10 } } }, y: { grid: { color: '#1e2028' }, ticks: { color: '#52525b', font: { size: 10 } }, beginAtZero: true } } };

function makeChart(ctx, labels, data, color, label) {
  return new Chart(ctx, {
    type: 'line', data: { labels, datasets: [{ label, data, borderColor: color, backgroundColor: color + '18', fill: true, tension: 0.3, borderWidth: 2, pointRadius: 3, pointBackgroundColor: color }] },
    options: chartDefaults,
  });
}

function makeBarChart(ctx, labels, data, colors) {
  return new Chart(ctx, {
    type: 'bar', data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 6, maxBarThickness: 40 }] },
    options: { ...chartDefaults, plugins: { legend: { display: false } }, indexAxis: 'y' },
  });
}

async function loadDashboard() {
  try {
    const data = await api('/api/dashboard');
    if (!data) return;

    document.getElementById('totalTickets').textContent = data.totalTickets.toLocaleString('fr-FR');
    document.getElementById('totalEntreprise').textContent = money(data.totalGainEntreprise);
    document.getElementById('totalEmployes').textContent = money(data.totalGainEmployes);
    document.getElementById('todaySales').textContent = data.todaySales + ' (' + data.todayTickets + ' tickets)';
    document.getElementById('employeeCount').textContent = data.employees.length;

    const listEl = document.getElementById('employeeList');
    if (data.employees.length === 0) {
      listEl.innerHTML = '<div class="empty-state">Aucun vendeur</div>';
    } else {
      listEl.innerHTML = data.employees.map((e, i) => {
        const rc = i === 0 ? 'gold' : i === 1 ? 'silver' : i === 2 ? 'bronze' : '';
        return `<div class="employee-item" data-seller="${e.seller_id}"><div class="employee-rank ${rc}">${i < 3 ? ['1er', '2e', '3e'][i] : (i + 1) + 'e'}</div><div class="employee-details"><div class="employee-id" title="${e.seller_id}">${truncId(e.seller_id)}</div><div class="employee-meta">${e.sales} vente(s)</div></div><div class="employee-stats"><div class="employee-tickets">${e.tickets} tickets</div><div class="employee-gain">${money(e.gainEmploye)}</div></div></div>`;
      }).join('');
    }

    const labels = data.dailyStats.map(d => { const p = d.date.split('-'); return p[2] + '/' + p[1]; });
    if (chartTickets) chartTickets.destroy();
    if (chartGains) chartGains.destroy();
    chartTickets = makeChart(document.getElementById('chartTickets'), labels, data.dailyStats.map(d => d.tickets), '#0ea5e9', 'Tickets');
    chartGains = makeChart(document.getElementById('chartGains'), labels, data.dailyStats.map(d => d.gainEntreprise), '#4ade80', 'Gains');

    if (chartTop) chartTop.destroy();
    const top5 = data.employees.slice(0, 5);
    const barColors = ['#0ea5e9', '#06b6d4', '#14b8a6', '#22c55e', '#84cc16'];
    chartTop = makeBarChart(document.getElementById('chartTopSellers'), top5.map(e => truncId(e.seller_id)), top5.map(e => e.tickets), barColors);
  } catch (err) { console.error('Erreur dashboard:', err); }
}

async function loadObjective() {
  try {
    const data = await api('/api/objectives/progress');
    if (!data || !data.goal) { document.getElementById('objectiveBar').style.display = 'none'; return; }
    document.getElementById('objectiveBar').style.display = '';
    document.getElementById('objCount').textContent = data.current + ' / ' + data.goal + ' tickets';
    document.getElementById('objFill').style.width = data.percentage + '%';
  } catch { document.getElementById('objectiveBar').style.display = 'none'; }
}

async function loadSeasons() {
  try {
    const data = await api('/api/seasons');
    if (!data) return;
    const el = document.getElementById('seasonsList');
    if (!data.seasons || data.seasons.length === 0) {
      el.innerHTML = '<div class="empty-state">Aucune saison archivee</div>';
      return;
    }
    el.innerHTML = data.seasons.map(s =>
      `<div class="season-item"><div><div class="season-name">${s.name}</div><div class="season-meta">${s.total_sales} ventes</div></div><div class="season-stats"><div class="season-tickets">${s.total_tickets} tickets</div><div class="season-date">${fmtDate(s.ended_at || s.created_at)}</div></div></div>`
    ).join('');
  } catch { document.getElementById('seasonsList').innerHTML = '<div class="empty-state">Erreur chargement</div>'; }
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentPeriod = btn.dataset.period;
    document.getElementById('customDates').style.display = currentPeriod === 'custom' ? 'flex' : 'none';
    if (currentPeriod !== 'custom') { loadDashboard(); loadObjective(); }
  });
});

document.getElementById('applyDates').addEventListener('click', () => {
  customStart = document.getElementById('dateStart').value;
  customEnd = document.getElementById('dateEnd').value;
  if (customStart) { loadDashboard(); loadObjective(); }
});

document.getElementById('drawBtn').addEventListener('click', async () => {
  const btn = document.getElementById('drawBtn');
  btn.disabled = true; btn.textContent = 'Tirage en cours...';
  try {
    const sep = '/api/draw?' + periodParams().replace('&', '');
    const res = await fetch(sep, { method: 'POST', headers: { 'Content-Type': 'application/json' } });
    const data = await res.json();
    if (!res.ok) { showToast(data.error || 'Erreur', 'error'); return; }
    const r = document.getElementById('drawResult');
    r.style.display = '';
    r.innerHTML = `<div class="winner-name">${data.winner.prenom} ${data.winner.nom}</div><div class="winner-info">Telephone: ${data.winner.numero} | Vendeur: ${truncId(data.winner.seller_id)} | Tickets: ${data.winner.quantite}</div><div class="winner-info">${data.totalParticipants} participants / ${data.totalTickets} tickets au total</div>`;
  } catch { showToast('Erreur lors du tirage', 'error'); }
  finally { btn.disabled = false; btn.textContent = 'Lancer le tirage'; }
});

document.getElementById('closeSeasonBtn').addEventListener('click', () => {
  document.getElementById('seasonModal').style.display = 'flex';
  document.getElementById('seasonName').value = '';
});
document.getElementById('seasonCancel').addEventListener('click', () => { document.getElementById('seasonModal').style.display = 'none'; });
document.getElementById('seasonModal').querySelector('.modal-backdrop').addEventListener('click', () => { document.getElementById('seasonModal').style.display = 'none'; });
document.getElementById('seasonConfirm').addEventListener('click', async () => {
  const name = document.getElementById('seasonName').value.trim();
  try {
    const res = await fetch('/api/seasons/close', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name }) });
    const data = await res.json();
    if (res.ok && data.success) {
      document.getElementById('seasonModal').style.display = 'none';
      showToast('Saison cloturee', 'success');
      loadDashboard(); loadSeasons(); loadObjective();
    } else { showToast(data.error || 'Erreur', 'error'); }
  } catch { showToast('Erreur de connexion', 'error'); }
});

document.getElementById('employeeList').addEventListener('click', (e) => {
  const item = e.target.closest('.employee-item');
  if (!item) return;
  openSellerModal(item.dataset.seller);
});

let sellerChart = null;
async function openSellerModal(sellerId) {
  document.getElementById('sellerModal').style.display = 'flex';
  document.getElementById('sellerModalTitle').textContent = 'Vendeur ' + truncId(sellerId);
  document.getElementById('sellerModalBody').innerHTML = '<div class="empty-state">Chargement...</div>';

  try {
    const data = await api('/api/seller/' + sellerId);
    if (!data) return;
    const body = document.getElementById('sellerModalBody');
    body.innerHTML = `
      <div class="seller-stats-grid">
        <div class="seller-stat"><div class="seller-stat-value">${data.totalTickets}</div><div class="seller-stat-label">Tickets</div></div>
        <div class="seller-stat"><div class="seller-stat-value">${money(data.totalGain)}</div><div class="seller-stat-label">Total gagne</div></div>
        <div class="seller-stat"><div class="seller-stat-value">${data.totalSales}</div><div class="seller-stat-label">Ventes</div></div>
        <div class="seller-stat"><div class="seller-stat-value">${data.avgPerSale}</div><div class="seller-stat-label">Moy/vente</div></div>
      </div>
      <div class="seller-chart-container"><canvas id="sellerChartCanvas"></canvas></div>
      <table class="data-table"><thead><tr><th>Date</th><th>Client</th><th>Telephone</th><th>Tickets</th><th>Gain</th></tr></thead><tbody>${
        data.sales.map(s => `<tr><td>${fmtDateTime(s.created_at)}</td><td>${s.prenom} ${s.nom}</td><td>${s.numero}</td><td>${s.quantite}</td><td>${money(s.gain_employe)}</td></tr>`).join('')
      }</tbody></table>`;

    if (sellerChart) sellerChart.destroy();
    const labels = data.dailyStats.map(d => { const p = d.date.split('-'); return p[2] + '/' + p[1]; });
    sellerChart = makeChart(document.getElementById('sellerChartCanvas'), labels, data.dailyStats.map(d => d.tickets), '#0ea5e9', 'Tickets');
  } catch { document.getElementById('sellerModalBody').innerHTML = '<div class="empty-state">Erreur chargement</div>'; }
}

document.getElementById('sellerModalClose').addEventListener('click', () => { document.getElementById('sellerModal').style.display = 'none'; });
document.getElementById('sellerModal').querySelector('.modal-backdrop').addEventListener('click', () => { document.getElementById('sellerModal').style.display = 'none'; });

document.getElementById('logoutBtn').addEventListener('click', async () => { await fetch('/auth/logout', { method: 'POST' }); window.location.href = '/login'; });

loadDashboard();
loadObjective();
loadSeasons();
setInterval(() => { loadDashboard(); loadObjective(); }, 60000);
