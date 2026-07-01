/* ============================================================
   version-detail.js — logic for the resume version detail page.
   Reads the same localStorage keys as the main app (margin:entries,
   margin:versions, margin:theme) so it stays in sync automatically.
   ============================================================ */

const STORAGE_KEY_ENTRIES = 'margin:entries';
const STORAGE_KEY_VERSIONS = 'margin:versions';
const STORAGE_KEY_THEME = 'margin:theme';

// ---------- Theme (mirrors index page behavior) ----------
function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(STORAGE_KEY_THEME); } catch (e) { /* ignore */ }
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  applyTheme(theme);
}
function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  document.getElementById('themeToggle').textContent = theme === 'dark' ? '\u2600' : '\u263D';
  try { localStorage.setItem(STORAGE_KEY_THEME, theme); } catch (e) { /* ignore */ }
}
document.getElementById('themeToggle').addEventListener('click', () => {
  const current = document.documentElement.getAttribute('data-theme') || 'light';
  applyTheme(current === 'dark' ? 'light' : 'dark');
});

function renderDate() {
  document.getElementById('dateline').textContent =
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function formatBytes(bytes) {
  if (!bytes) return '';
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ---------- Toast (kept for parity / future use) ----------
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ============================================================
// Load data and resolve the version from the URL
// ============================================================
function getVersionIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get('id');
}

function loadVersionData() {
  let entries = [];
  let versions = [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ENTRIES);
    entries = raw ? JSON.parse(raw) : [];
  } catch (e) { entries = []; }
  try {
    const raw = localStorage.getItem(STORAGE_KEY_VERSIONS);
    versions = raw ? JSON.parse(raw) : [];
  } catch (e) { versions = []; }

  const id = getVersionIdFromUrl();
  const version = versions.find(v => v.id === id) || null;
  return { entries, versions, version };
}

// ============================================================
// Render
// ============================================================
function render() {
  const { entries, version } = loadVersionData();

  if (!version) {
    document.getElementById('notFoundState').style.display = 'block';
    document.getElementById('detailContent').style.display = 'none';
    return;
  }

  document.getElementById('notFoundState').style.display = 'none';
  document.getElementById('detailContent').style.display = 'block';

  document.title = `Margin — ${version.name}`;
  document.getElementById('versionName').textContent = version.name;
  document.getElementById('versionTag').textContent = 'resume version';
  document.getElementById('versionAdded').textContent = version.addedAt
    ? 'Added ' + formatDate(version.addedAt)
    : '';

  renderStats(entries, version);
  renderResume(version);
  renderUsedIn(entries, version);
}

function renderStats(entries, version) {
  const vEntries = entries.filter(e => e.resumeVersion === version.name);
  const total = vEntries.length;
  const interviewed = vEntries.filter(e => ['interview', 'offer'].includes(e.status)).length;
  const offered = vEntries.filter(e => e.status === 'offer').length;
  const pending = vEntries.filter(e => e.status === 'applied').length;
  const rate = total > 0 ? Math.round((interviewed / total) * 100) : null;

  document.getElementById('vStatUsed').textContent = total;
  document.getElementById('vStatUsedSub').textContent = total === 0 ? 'not used yet' : `submission${total === 1 ? '' : 's'}`;

  document.getElementById('vStatInterview').textContent = rate === null ? '—' : rate + '%';
  document.getElementById('vStatInterviewSub').textContent = total > 0 ? `${interviewed} of ${total}` : '—';

  document.getElementById('vStatOffers').textContent = offered;
  document.getElementById('vStatOffersSub').textContent = offered > 0 ? 'on the board' : 'none yet';

  document.getElementById('vStatPending').textContent = pending;
  document.getElementById('vStatPendingSub').textContent = pending > 0 ? 'awaiting response' : 'nothing waiting';
}

function renderResume(version) {
  const noFileState = document.getElementById('noFileState');
  const pdfViewer = document.getElementById('pdfViewer');
  const textViewer = document.getElementById('textViewer');

  noFileState.style.display = 'none';
  pdfViewer.style.display = 'none';
  textViewer.style.display = 'none';

  if (!version.fileType || !version.fileData) {
    noFileState.style.display = 'block';
    return;
  }

  if (version.fileType === 'text') {
    textViewer.style.display = 'block';
    textViewer.textContent = version.fileData;
    return;
  }

  if (version.fileType === 'pdf') {
    pdfViewer.style.display = 'block';
    pdfViewer.innerHTML = '<div class="pdf-loading">Loading resume...</div>';
    renderPdfFromBase64(version.fileData, pdfViewer).catch(err => {
      console.error('PDF render failed', err);
      pdfViewer.innerHTML = `<div class="pdf-error">Couldn't render this PDF. It may be corrupted — try re-attaching it from the backlog page.</div>`;
    });
  }
}

async function renderPdfFromBase64(base64, container) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;

  container.innerHTML = '';
  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1.4 });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    container.appendChild(canvas);
  }
}

function renderUsedIn(entries, version) {
  const list = document.getElementById('usedInList');
  const vEntries = entries.filter(e => e.resumeVersion === version.name);
  document.getElementById('usedInCount').textContent = vEntries.length;

  if (vEntries.length === 0) {
    list.innerHTML = '<div class="used-in-empty">Not tagged on any submission yet.</div>';
    return;
  }

  const sorted = [...vEntries].sort((a, b) => new Date(b.dateApplied || 0) - new Date(a.dateApplied || 0));
  list.innerHTML = '';
  sorted.forEach(e => {
    const row = document.createElement('a');
    row.className = 'used-in-row';
    row.href = `index.html?openEntry=${encodeURIComponent(e.id)}`;
    row.innerHTML = `
      <div class="used-in-top">
        <span class="used-in-company">${escapeHtml(e.company || '—')}</span>
        <span class="status-tag status-${e.status}">${e.status}</span>
      </div>
      <div class="used-in-role">${escapeHtml(e.role || '—')}</div>
      <div class="used-in-bottom">
        <span class="used-in-date">Applied ${formatDate(e.dateApplied)}</span>
      </div>
    `;
    list.appendChild(row);
  });
}

// ============================================================
// Init
// ============================================================
initTheme();
renderDate();
render();
initProfile();

// ============================================================
// Profile chip
// ============================================================
function initProfile() {
  let profile = null;
  try { const r = localStorage.getItem('margin:profile'); profile = r ? JSON.parse(r) : null; } catch (e) {}
  if (!profile) return;

  const chip = document.getElementById('profileChip');
  const nameEl = document.getElementById('profileName');
  const editBtn = document.getElementById('profileEditBtn');
  const logoutBtn = document.getElementById('profileLogoutBtn');
  if (!chip) return;

  nameEl.textContent = profile.firstName + (profile.lastName ? ' ' + profile.lastName[0] + '.' : '');
  chip.style.display = '';
  editBtn.style.display = '';
  logoutBtn.style.display = '';

  editBtn.addEventListener('click', () => {
    const ret = encodeURIComponent('version-detail.html' + window.location.search);
    window.location.href = 'login.html?edit=1&return=' + ret;
  });
  logoutBtn.addEventListener('click', () => {
    if (!confirm('Log out? Your submissions and resume versions will stay here — just your profile details will be cleared.')) return;
    try { localStorage.removeItem('margin:profile'); } catch (e) {}
    window.location.href = 'login.html';
  });
}
