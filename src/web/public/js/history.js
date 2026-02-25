let currentPage = 1;
const LIMIT = 50;
let searchTimeout = null;
let sellers = [];

function money(n) { return (n || 0).toLocaleString('fr-FR') + '$'; }
function fmtDateTime(d) { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function truncId(id) { return id && id.length > 12 ? id.slice(0, 6) + '...' + id.slice(-4) : id; }

function buildParams() {
  const params = new URLSearchParams();
  params.set('page', currentPage);
  params.set('limit', LIMIT);
  const search = document.getElementById('searchInput').value.trim();
  if (search) params.set('search', search);
  const seller = document.getElementById('sellerFilter').value;
  if (seller) params.set('seller', seller);
  const period = document.getElementById('periodFilter').value;
  if (period) params.set('period', period);
  return params.toString();
}

async function loadSales() {
  try {
    const res = await fetch('/api/sales?' + buildParams());
    if (res.status === 401) { window.location.href = '/login'; return; }
    const data = await res.json();

    const tbody = document.getElementById('salesTable');
    if (!data.sales || data.sales.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="empty-state">Aucune vente trouvee</td></tr>';
      document.getElementById('pagination').innerHTML = '';
      return;
    }

    tbody.innerHTML = data.sales.map(s =>
      `<tr><td>${fmtDateTime(s.created_at)}</td><td title="${s.seller_id}">${truncId(s.seller_id)}</td><td>${s.prenom} ${s.nom}</td><td>${s.numero}</td><td>${s.quantite}</td><td>${money(s.gain_employe)}</td><td>${money(s.gain_entreprise)}</td></tr>`
    ).join('');

    renderPagination(data.total, data.page, data.limit);

    data.sales.forEach(s => {
      if (!sellers.includes(s.seller_id)) sellers.push(s.seller_id);
    });
    updateSellerFilter();
  } catch (err) { console.error('Erreur:', err); }
}

function updateSellerFilter() {
  const select = document.getElementById('sellerFilter');
  const current = select.value;
  const existing = new Set([...select.options].map(o => o.value));
  sellers.forEach(id => {
    if (!existing.has(id)) {
      const opt = document.createElement('option');
      opt.value = id; opt.textContent = truncId(id);
      select.appendChild(opt);
    }
  });
  select.value = current;
}

function renderPagination(total, page, limit) {
  const totalPages = Math.ceil(total / limit);
  const el = document.getElementById('pagination');
  if (totalPages <= 1) { el.innerHTML = `<span class="page-info">${total} resultat(s)</span>`; return; }
  let html = `<button class="page-btn" onclick="goToPage(${page - 1})" ${page <= 1 ? 'disabled' : ''}>&laquo;</button>`;
  const start = Math.max(1, page - 2);
  const end = Math.min(totalPages, page + 2);
  for (let i = start; i <= end; i++) html += `<button class="page-btn ${i === page ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
  html += `<button class="page-btn" onclick="goToPage(${page + 1})" ${page >= totalPages ? 'disabled' : ''}>&raquo;</button>`;
  html += `<span class="page-info">${total} resultat(s)</span>`;
  el.innerHTML = html;
}

function goToPage(p) { currentPage = p; loadSales(); }

document.getElementById('searchInput').addEventListener('input', () => {
  clearTimeout(searchTimeout);
  searchTimeout = setTimeout(() => { currentPage = 1; loadSales(); }, 400);
});

document.getElementById('sellerFilter').addEventListener('change', () => { currentPage = 1; loadSales(); });
document.getElementById('periodFilter').addEventListener('change', () => { currentPage = 1; loadSales(); });

document.getElementById('exportBtn').addEventListener('click', () => {
  const period = document.getElementById('periodFilter').value;
  const url = '/api/export/csv' + (period ? '?period=' + period : '');
  window.location.href = url;
});

document.getElementById('logoutBtn').addEventListener('click', async () => { await fetch('/auth/logout', { method: 'POST' }); window.location.href = '/login'; });

loadSales();
