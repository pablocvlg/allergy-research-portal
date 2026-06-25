let allRecords = [];
let filtered   = [];
let currentUser = null;

const TYPE_LABELS = {
  paper:    'Paper',
  report:   'Report',
  slides:   'Slides',
  raw_data: 'Raw Data',
};

const TYPE_PLURAL = {
  paper:    'Papers',
  report:   'Reports',
  slides:   'Slides',
  raw_data: 'Raw Data',
};

const ROLES = {
  Admin:           { search: true, add: true,  edit: true,  delete: true  },
  'Data Engineer': { search: true, add: true,  edit: false, delete: false },
  Researcher:      { search: true, add: false, edit: false, delete: false },
};

// ── Auth ─────────────────────────────────────────────────────────────────────
function handleLogin() {
  const id       = document.getElementById('login-id').value.trim();
  const password = document.getElementById('login-password').value;
  const role     = document.getElementById('login-role').value;
  const err      = document.getElementById('login-error');

  if (!id || !password) {
    err.classList.remove('hidden');
    document.getElementById(!id ? 'login-id' : 'login-password').focus();
    return;
  }
  err.classList.add('hidden');

  currentUser = { id, role };
  sessionStorage.setItem('arp_user', JSON.stringify(currentUser));
  document.getElementById('login-overlay').classList.add('hidden');
  applyUserUI();
}

function handleLogout() {
  sessionStorage.removeItem('arp_user');
  currentUser = null;
  closeProfile();
  document.getElementById('login-id').value = '';
  document.getElementById('login-password').value = '';
  document.getElementById('login-role').value = 'Researcher';
  document.getElementById('login-error').classList.add('hidden');
  document.getElementById('login-overlay').classList.remove('hidden');
}

function applyUserUI() {
  const perms = ROLES[currentUser.role] || ROLES.Researcher;
  document.getElementById('profile-name').textContent = currentUser.id;
  document.getElementById('profile-role').textContent = currentUser.role;

  document.getElementById('profile-privileges').innerHTML = [
    perms.search && '<span class="priv priv-search">Search</span>',
    perms.add    && '<span class="priv priv-add">Add</span>',
    perms.edit   && '<span class="priv priv-edit">Edit</span>',
    perms.delete && '<span class="priv priv-delete">Delete</span>',
  ].filter(Boolean).join('');
}

// ── Bootstrap ────────────────────────────────────────────────────────────────
fetch('data/research.json')
  .then(r => r.json())
  .then(data => {
    allRecords = data;
    renderStats();
    applyFilters();
    bindEvents();
  })
  .catch(() => {
    document.getElementById('results-grid').innerHTML =
      '<p style="color:#dc2626;padding:20px;font-size:.88rem">Failed to load data/research.json. ' +
      'Serve via a local server: <code>npx serve .</code></p>';
  });

// Bind login events and restore session immediately (data loads in parallel)
(function initAuth() {
  document.getElementById('login-btn').addEventListener('click', handleLogin);
  document.getElementById('login-id').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('logout-btn').addEventListener('click', handleLogout);

  const saved = sessionStorage.getItem('arp_user');
  if (saved) {
    currentUser = JSON.parse(saved);
    document.getElementById('login-overlay').classList.add('hidden');
    applyUserUI();
  }
})();

// ── Events ───────────────────────────────────────────────────────────────────
function bindEvents() {
  document.getElementById('keyword-input').addEventListener('input', debounce(applyFilters, 200));
  document.getElementById('id-input').addEventListener('input', debounce(applyFilters, 200));
  document.getElementById('date-from').addEventListener('change', applyFilters);
  document.getElementById('date-to').addEventListener('change', applyFilters);
  document.getElementById('type-filter').addEventListener('change', applyFilters);
  document.getElementById('alk-filter').addEventListener('change', applyFilters);
  document.getElementById('sort-by').addEventListener('change', applyFilters);
  document.getElementById('clear-btn').addEventListener('click', clearAll);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeModal(); closeProfile(); } });

  const profileBtn   = document.getElementById('profile-btn');
  const profilePanel = document.getElementById('profile-panel');
  profileBtn.addEventListener('click', e => {
    e.stopPropagation();
    const open = !profilePanel.classList.contains('hidden');
    if (open) { closeProfile(); } else { openProfile(); }
  });
  document.addEventListener('click', e => {
    if (!profilePanel.classList.contains('hidden') && !profilePanel.contains(e.target)) {
      closeProfile();
    }
  });
}

// ── Filter & Sort ─────────────────────────────────────────────────────────────
function applyFilters() {
  const kw       = document.getElementById('keyword-input').value.trim().toLowerCase();
  const idQ      = document.getElementById('id-input').value.trim().toUpperCase();
  const dateFrom = document.getElementById('date-from').value;
  const dateTo   = document.getElementById('date-to').value;
  const typeQ    = document.getElementById('type-filter').value;
  const alkQ     = document.getElementById('alk-filter').value;
  const sortKey  = document.getElementById('sort-by').value;

  filtered = allRecords.filter(r => {
    if (idQ && !r.id.includes(idQ)) return false;
    if (typeQ && r.type !== typeQ)   return false;
    if (dateFrom && r.date < dateFrom) return false;
    if (dateTo   && r.date > dateTo)   return false;
    if (alkQ !== '' && String(r.alk) !== alkQ) return false;
    if (kw) {
      const blob = [
        r.title, r.abstract, r.id,
        ...(r.authors  || []),
        ...(r.keywords || []),
        ...(r.tags     || []),
        r.journal || '',
      ].join(' ').toLowerCase();
      if (!blob.includes(kw)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    if (sortKey === 'date-asc')  return a.date.localeCompare(b.date);
    if (sortKey === 'date-desc') return b.date.localeCompare(a.date);
    if (sortKey === 'id-asc')    return a.id.localeCompare(b.id);
    if (sortKey === 'title-asc') return a.title.localeCompare(b.title);
    return 0;
  });

  renderResults(kw);
}

// ── Render ───────────────────────────────────────────────────────────────────
function renderStats() {
  const counts = {};
  allRecords.forEach(r => { counts[r.type] = (counts[r.type] || 0) + 1; });
  const parts = Object.entries(counts).map(([t, n]) => `${n} ${TYPE_PLURAL[t] || t}`).join(' &middot; ');
  document.getElementById('stats').innerHTML = `${allRecords.length} records &mdash; ${parts}`;
}

function renderResults(kw) {
  const grid  = document.getElementById('results-grid');
  const noRes = document.getElementById('no-results');
  const count = document.getElementById('results-count');

  if (filtered.length === 0) {
    grid.innerHTML = '';
    noRes.classList.remove('hidden');
    count.innerHTML = '';
    return;
  }

  noRes.classList.add('hidden');
  count.innerHTML = `<strong>${filtered.length}</strong> of ${allRecords.length} records`;

  grid.innerHTML = filtered.map(r => cardHTML(r, kw)).join('');

  grid.querySelectorAll('.card').forEach(card => {
    card.addEventListener('click', () => openModal(card.dataset.id));
  });
  grid.querySelectorAll('.tag').forEach(tag => {
    tag.addEventListener('click', e => {
      e.stopPropagation();
      document.getElementById('keyword-input').value = tag.dataset.value;
      applyFilters();
    });
  });
}

function cardHTML(r, kw) {
  const hi = s => (kw && s) ? highlight(s, kw) : (s || '');
  const authStr = r.authors ? r.authors[0] + (r.authors.length > 1 ? ` +${r.authors.length - 1}` : '') : '';
  return `
    <div class="card" data-id="${r.id}">
      <div class="card-top">
        <span class="card-id">${r.id}</span>
        <span class="type-badge type-${r.type}">${TYPE_LABELS[r.type]}</span>
        <span class="file-badge">${r.fileType}</span>
        ${r.alk ? '<span class="alk-badge">ALK</span>' : ''}
      </div>
      <div class="card-title">${hi(r.title)}</div>
      <div class="card-meta">
        <span class="card-meta-item">${fmtDate(r.date)}</span>
        ${authStr ? `<span class="card-meta-item">${hi(authStr)}</span>` : ''}
        ${r.journal ? `<span class="card-meta-item">${hi(r.journal)}</span>` : ''}
      </div>
      <div class="card-abstract">${hi(r.abstract)}</div>
      <div class="card-tags">
        ${(r.tags || []).slice(0, 5).map(t =>
          `<span class="tag${kw && t.toLowerCase().includes(kw) ? ' highlight' : ''}"
                 data-value="${t}">${t}</span>`
        ).join('')}
      </div>
    </div>`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────
function openModal(id) {
  const r = allRecords.find(x => x.id === id);
  if (!r) return;

  const perms = currentUser ? (ROLES[currentUser.role] || ROLES.Researcher) : ROLES.Researcher;

  const editBtn = perms.edit
    ? `<button class="modal-action-btn modal-btn-edit">Edit</button>`
    : `<button class="modal-action-btn modal-btn-request">Request Access to Edit</button>`;

  const deleteBtn = perms.delete
    ? `<button class="modal-action-btn modal-btn-delete">Delete</button>`
    : `<button class="modal-action-btn modal-btn-delete" disabled>Delete</button>`;

  document.getElementById('modal-body').innerHTML = `
    <div class="modal-header-badges">
      <span class="card-id">${r.id}</span>
      <span class="type-badge type-${r.type}">${TYPE_LABELS[r.type]}</span>
      <span class="type-badge" style="background:var(--gray-100);color:var(--gray-500)">${r.fileType}</span>
      ${r.alk
        ? '<span class="alk-badge">ALK</span>'
        : '<span class="general-badge">General</span>'}
    </div>
    <h2>${r.title}</h2>
    <div class="modal-meta-grid">
      <div class="meta-item">
        <label>Date</label>
        <p>${fmtDate(r.date)}</p>
      </div>
      <div class="meta-item" style="grid-column:span 2">
        <label>Authors</label>
        <p>${(r.authors || []).join(', ') || '—'}</p>
      </div>
      ${r.journal ? `<div class="meta-item" style="grid-column:span 3">
        <label>Journal / Source</label>
        <p>${r.journal}</p>
      </div>` : ''}
    </div>
    <div class="modal-section-label">Abstract</div>
    <p class="modal-abstract">${r.abstract}</p>
    <div class="modal-section-label">Keywords</div>
    <div class="modal-keywords">
      ${(r.keywords || []).map(k =>
        `<span class="modal-keyword" onclick="setKeyword('${k.replace(/'/g,"\\'")}')">
          ${k}
        </span>`
      ).join('')}
    </div>
    ${r.doi ? `<p class="modal-doi">DOI: <a href="https://doi.org/${r.doi}" target="_blank" rel="noopener noreferrer">${r.doi}</a></p>` : ''}
    <div class="modal-actions">
      <button class="modal-action-btn modal-btn-download">Download</button>
      ${editBtn}
      ${deleteBtn}
    </div>
  `;

  document.getElementById('modal-overlay').classList.remove('hidden');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  document.body.style.overflow = '';
}

function openProfile() {
  document.getElementById('profile-panel').classList.remove('hidden');
  document.getElementById('profile-btn').setAttribute('aria-expanded', 'true');
}

function closeProfile() {
  document.getElementById('profile-panel').classList.add('hidden');
  document.getElementById('profile-btn').setAttribute('aria-expanded', 'false');
}

function setKeyword(kw) {
  document.getElementById('keyword-input').value = kw;
  closeModal();
  applyFilters();
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function clearAll() {
  ['keyword-input', 'id-input', 'date-from', 'date-to'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('type-filter').value = '';
  document.getElementById('alk-filter').value = '';
  document.getElementById('sort-by').value = 'date-desc';
  applyFilters();
}

function fmtDate(iso) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return new Date(+y, +m - 1, +d).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function highlight(text, kw) {
  if (!kw || !text) return text;
  const esc = kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${esc})`, 'gi'), '<mark>$1</mark>');
}

function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
