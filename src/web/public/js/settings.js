let alertsData = [];

function showToast(msg, type) {
  let t = document.getElementById('toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; document.body.appendChild(t); }
  t.textContent = msg;
  t.className = 'toast show ' + (type || '');
  setTimeout(() => t.classList.remove('show'), 3000);
}

async function loadSettings() {
  try {
    const res = await fetch('/api/settings');
    if (res.status === 401) { window.location.href = '/login'; return; }
    const data = await res.json();

    const c = data.config || {};
    document.getElementById('prixTicket').value = c.prix_ticket || 1500;
    document.getElementById('gainEmploye').value = c.gain_employe_par_ticket || 400;
    document.getElementById('gainEntreprise').value = c.gain_entreprise_par_ticket || 1100;
    document.getElementById('recapHour').value = c.recap_hour !== undefined ? c.recap_hour : 17;

    const o = data.objectives || {};
    document.getElementById('monthlyGoal').value = o.monthly_ticket_goal || 0;

    alertsData = data.alerts || [];
    if (alertsData.length === 0) {
      alertsData = [
        { type: 'tickets_per_hour', threshold: 50, enabled: false },
        { type: 'balance_threshold', threshold: 100000, enabled: false },
      ];
    }
    renderAlerts();
  } catch (err) { console.error('Erreur settings:', err); }
}

function renderAlerts() {
  const labels = { tickets_per_hour: 'Alerte si un vendeur depasse X tickets en 1h', balance_threshold: 'Alerte si le solde depasse X $' };
  const el = document.getElementById('alertsList');
  el.innerHTML = alertsData.map((a, i) => `
    <div class="alert-row">
      <label class="alert-toggle"><input type="checkbox" data-idx="${i}" ${a.enabled ? 'checked' : ''}><span class="slider"></span></label>
      <div style="flex:1"><div style="font-size:13px;color:#e4e4e7;font-weight:500">${labels[a.type] || a.type}</div></div>
      <input type="number" class="setting-input" style="width:120px" data-idx="${i}" value="${a.threshold}" min="0">
    </div>
  `).join('');
}

document.getElementById('saveConfigBtn').addEventListener('click', async () => {
  try {
    const body = {
      prix_ticket: document.getElementById('prixTicket').value,
      gain_employe_par_ticket: document.getElementById('gainEmploye').value,
      gain_entreprise_par_ticket: document.getElementById('gainEntreprise').value,
      recap_hour: document.getElementById('recapHour').value,
    };
    const res = await fetch('/api/settings/config', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok && data.success) showToast('Configuration sauvegardee', 'success');
    else showToast(data.error || 'Erreur', 'error');
  } catch { showToast('Erreur de connexion', 'error'); }
});

document.getElementById('saveObjectiveBtn').addEventListener('click', async () => {
  try {
    const body = { monthly_ticket_goal: document.getElementById('monthlyGoal').value };
    const res = await fetch('/api/settings/objectives', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (res.ok && data.success) showToast('Objectif sauvegarde', 'success');
    else showToast(data.error || 'Erreur', 'error');
  } catch { showToast('Erreur de connexion', 'error'); }
});

document.getElementById('saveAlertsBtn').addEventListener('click', async () => {
  try {
    const checkboxes = document.querySelectorAll('#alertsList input[type="checkbox"]');
    const inputs = document.querySelectorAll('#alertsList input[type="number"]');
    checkboxes.forEach(cb => { alertsData[parseInt(cb.dataset.idx)].enabled = cb.checked; });
    inputs.forEach(inp => { alertsData[parseInt(inp.dataset.idx)].threshold = parseInt(inp.value) || 0; });

    const res = await fetch('/api/settings/alerts', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ alerts: alertsData }) });
    const data = await res.json();
    if (res.ok && data.success) showToast('Alertes sauvegardees', 'success');
    else showToast(data.error || 'Erreur', 'error');
  } catch { showToast('Erreur de connexion', 'error'); }
});

document.getElementById('logoutBtn').addEventListener('click', async () => { await fetch('/auth/logout', { method: 'POST' }); window.location.href = '/login'; });

loadSettings();
