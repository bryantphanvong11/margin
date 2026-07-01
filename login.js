/* ============================================================
   login.js — logic for the profile/sign-in page.
   Stores a profile object under localStorage key 'margin:profile'.
   This is identity, not authentication — there's no password and
   no server; it just personalizes the shared local backlog data.
   ============================================================ */

const STORAGE_KEY_PROFILE = 'margin:profile';
const STORAGE_KEY_THEME = 'margin:theme';
const STORAGE_KEY_PROFILE_REGISTRY = 'margin:profiles:registry';
const API_URL = "https://script.google.com/macros/s/AKfycbzg0BseYMyBGkiKnvzi7YykUfrJBHqBEPVktjMfQl1XVPkJpwPjMsXi2xYCVNgASxC0NQ/exec";

// ---------- Theme (mirrors index/version-detail behavior) ----------
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

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ---------- Profile registry ----------
function registerProfileInRegistry(profile) {
  if (!profile || !profile.createdAt) return;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE_REGISTRY);
    const registry = raw ? JSON.parse(raw) : [];
    const existing = registry.findIndex(p => p.createdAt === profile.createdAt);
    const entry = {
      createdAt: profile.createdAt,
      firstName: profile.firstName,
      lastName: profile.lastName,
      school: profile.school || '',
      occupation: profile.occupation || '',
      instagram: profile.instagram || '',
      updatedAt: profile.updatedAt || profile.createdAt
    };
    if (existing > -1) { registry[existing] = entry; } else { registry.push(entry); }
    localStorage.setItem(STORAGE_KEY_PROFILE_REGISTRY, JSON.stringify(registry));
  } catch (e) { /* ignore */ }
}

// ---------- Profile storage ----------
function loadProfile() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE);
    return raw ? JSON.parse(raw) : null;
  } catch (e) { return null; }
}
function saveProfile(profile) {
  try {
    localStorage.setItem(STORAGE_KEY_PROFILE, JSON.stringify(profile));
    return true;
  } catch (e) { return false; }
}

// ---------- URL params ----------
function getParam(name) {
  return new URLSearchParams(window.location.search).get(name);
}
function safeReturnTarget() {
  // Only ever redirect within this app's own pages — never to an
  // arbitrary external URL, even if someone hand-edits the query string.
  const raw = getParam('return');
  if (!raw) return 'index.html';
  const decoded = decodeURIComponent(raw);
  if (/^(index\.html|version-detail\.html)(\?.*)?$/.test(decoded)) return decoded;
  return 'index.html';
}

// ---------- Field helpers ----------
function val(id) { return document.getElementById(id).value.trim(); }
function setVal(id, v) { document.getElementById(id).value = v || ''; }

function showError(msg) {
  const el = document.getElementById('loginError');
  el.textContent = msg;
  el.classList.add('show');
}
function clearError() {
  document.getElementById('loginError').classList.remove('show');
}

// ============================================================
// Init
// ============================================================
const isEdit = getParam('edit') === '1';
const returnTo = safeReturnTarget();
const existing = loadProfile();

if (existing && !isEdit) {
  // Already signed in on this browser — skip straight to where they were headed.
  window.location.replace(returnTo);
} else {
  initTheme();
  renderDate();

  if (isEdit && existing) {
    document.getElementById('loginHeading').textContent = 'Edit your profile';
    document.getElementById('loginDeck').textContent = 'Update your details — your submissions and resume versions are untouched.';
    document.getElementById('pageTag').textContent = 'edit profile';
    document.getElementById('loginSubmitBtn').textContent = 'Save changes';
    document.getElementById('loginCancel').href = returnTo;
    document.getElementById('loginCancel').style.display = 'inline';
    setVal('lFirstName', existing.firstName);
    setVal('lLastName', existing.lastName);
    setVal('lInstagram', existing.instagram);
    setVal('lSchool', existing.school);
    setVal('lOccupation', existing.occupation);
  }

  document.getElementById('loginForm').addEventListener('submit', async e => {
    e.preventDefault();
    clearError();

    const firstName = val('lFirstName');
    const lastName = val('lLastName');
    let instagram = val('lInstagram').replace(/^@+/, '');
    const school = val('lSchool');
    const occupation = val('lOccupation');

    if (!firstName || !lastName) {
      showError('First and last name are required so the page can greet the right person.');
      return;
    }
    
    const profile = {
      firstName,
      lastName,
      instagram,
      school,
      occupation,
      createdAt: (existing && existing.createdAt) || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {

    const response = await fetch(API_URL, {
        method: "POST",
        headers: {
            "Content-Type": "text/plain;charset=utf-8"
        },
        body: JSON.stringify({
            action: "createUser",
            firstName,
            lastName,
            instagram,
            school,
            occupation
        })
    });

    const result = await response.json();

    if (!result.success) {
        showError("Could not create your profile.");
        return;
    }

    profile.userId = result.userId;

    saveProfile(profile);
    registerProfileInRegistry(profile);

    window.location.href = returnTo;

} catch (err) {

    console.error(err);

    showError("Could not connect to the server.");

}
  });
}
localStorage.setItem(
    "marginUser",
    JSON.stringify({
        userId: "7b1c5d8e-...",
        firstName: "Bryant",
        lastName: "Phanvong",
        school: "Seattle Central",
        occupation: "Student"
    })
);
const currentUser = JSON.parse(localStorage.getItem("marginUser"));
currentUser.userId