/* ============================================================
   MARGIN — submission backlog
   app.js — all application logic
   ============================================================ */

// ---------- State ----------
let entries = [];
let versions = [];
let activeFilter = 'all';
let editingEntryId = null;
let activePromptEntryId = null;

const API_URL = "https://script.google.com/macros/s/AKfycbz4dbreuE8IJuF1ZMBkKlt_iR9lC8BD8afADwrlfR7RPLlFYTBYQFGH2mZmKHlSNIEGVw/exec";
const STORAGE_KEY_ENTRIES = 'margin:entries';
const STORAGE_KEY_VERSIONS = 'margin:versions';
const STORAGE_KEY_THEME = 'margin:theme';
const STORAGE_KEY_KEYWORD_MAP = 'margin:keywordCategoryMap';
const STORAGE_KEY_PROFILE = 'margin:profile';
const STORAGE_KEY_PROFILE_REGISTRY = 'margin:profiles:registry'; // array of {id, firstName, lastName, school, occupation, instagram, createdAt}

// ============================================================
// Date — masthead date refreshes itself, including across midnight
// without requiring a page reload
// ============================================================
function renderDate() {
  document.getElementById('dateline').textContent =
    new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }).toUpperCase();
}

function scheduleNextDateRefresh() {
  const now = new Date();
  const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  const msUntilMidnight = nextMidnight.getTime() - now.getTime();
  setTimeout(() => {
    renderDate();
    renderStats(); // "days old" / aging language depends on the date too
    renderSignals();
    scheduleNextDateRefresh();
  }, msUntilMidnight);
}

// Also catch the case where the laptop was asleep and the tab just woke up
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    renderDate();
  }
});

// ============================================================
// Theme
// ============================================================
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

// ============================================================
// Storage (plain localStorage — this runs as real local files now,
// not inside the Claude.ai artifact sandbox, so window.storage
// is not available here)
// ============================================================
async function loadData() {
    try {

        const response = await fetch(API_URL);

        const data = await response.json();

        entries = data.entries || [];
        versions = data.versions || [];

        render();

    } catch (err) {

        console.error(err);

        showToast("Couldn't load Google Sheets data.");

    }
  render();
  openEntryFromUrlIfPresent();
}

function openEntryFromUrlIfPresent() {
  const params = new URLSearchParams(window.location.search);
  const entryId = params.get('openEntry');
  if (!entryId) return;
  const exists = entries.some(e => e.id === entryId);
  if (exists) {
    openEntryModal(entryId);
  }
  // Clean the URL so a refresh doesn't reopen the same modal
  const url = new URL(window.location.href);
  url.searchParams.delete('openEntry');
  window.history.replaceState({}, '', url);
}

async function saveEntries() {

    await fetch(API_URL, {

        method: "POST",

        body: JSON.stringify({

            action: "saveEntries",

            entries

        })

    });

}
async function saveSubmissionToGoogle(data) {

    const response = await fetch(API_URL, {
        method: "POST",
        body: JSON.stringify({
            action: "saveSubmission",
            ...data
        })
    });

    return await response.json();
}
async function saveVersions() {

    await fetch(API_URL, {

        method: "POST",

        body: JSON.stringify({

            action: "saveVersions",

            versions

        })

    });

}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ---------- Render: orchestrator ----------
function render() {
  renderStats();
  renderRadar();
  renderSignals();
  renderMascot();
  renderVersions();
  renderTable();
}

// ============================================================
// Stats — with animated count-up
// ============================================================
function animateCount(el, target, opts) {
  opts = opts || {};
  const suffix = opts.suffix || '';
  const duration = opts.duration || 700;
  const start = 0;
  const startTime = performance.now();
  el.classList.add('counting');

  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const value = Math.round(start + (target - start) * eased);
    el.textContent = value + suffix;
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      el.textContent = target + suffix;
      el.classList.remove('counting');
    }
  }
  requestAnimationFrame(tick);
}

function triggerCellAnimation(id) {
  const cell = document.getElementById(id);
  if (!cell) return;
  cell.classList.remove('animate-in');
  // restart the CSS animation by forcing reflow
  void cell.offsetWidth;
  cell.classList.add('animate-in');
}

function renderStats() {
  const total = entries.length;
  const totalEl = document.getElementById('statTotal');
  animateCount(totalEl, total);
  document.getElementById('statTotalSub').textContent = total === 0 ? 'Log your first one' : `across ${versions.length} resume version${versions.length === 1 ? '' : 's'}`;

  const interviewed = entries.filter(e => ['interview', 'offer'].includes(e.status)).length;
  const offered = entries.filter(e => e.status === 'offer').length;
  const pending = entries.filter(e => e.status === 'applied').length;

  const interviewRate = total > 0 ? Math.round((interviewed / total) * 100) : null;
  const offerRate = total > 0 ? Math.round((offered / total) * 100) : null;

  const interviewEl = document.getElementById('statInterviewRate');
  if (interviewRate === null) {
    interviewEl.textContent = '—';
  } else {
    animateCount(interviewEl, interviewRate, { suffix: '%' });
  }
  document.getElementById('statInterviewSub').textContent = total > 0 ? `${interviewed} of ${total}` : '—';

  const offerEl = document.getElementById('statOfferRate');
  if (offerRate === null) {
    offerEl.textContent = '—';
  } else {
    animateCount(offerEl, offerRate, { suffix: '%' });
  }
  document.getElementById('statOfferSub').textContent = total > 0 ? `${offered} of ${total}` : '—';

  animateCount(document.getElementById('statPending'), pending);
  document.getElementById('statPendingSub').textContent = pending > 0 ? agingNote() : 'nothing waiting';

  ['statCellTotal', 'statCellInterview', 'statCellOffer', 'statCellPending'].forEach((id, i) => {
    setTimeout(() => triggerCellAnimation(id), i * 80);
  });
}

function agingNote() {
  const stale = entries.filter(e => {
    if (e.status !== 'applied') return false;
    const applied = new Date(e.dateApplied);
    const days = (Date.now() - applied.getTime()) / 86400000;
    return days > 21;
  }).length;
  return stale > 0 ? `${stale} over 3 weeks old` : 'all recent';
}

// ============================================================
// Mascot — reacts to the same signals driving the signal box
// ============================================================
function renderMascot() {
  const svg = document.getElementById('mascotSvg');
  const mouth = document.getElementById('mascotMouth');
  const line = document.getElementById('mascotLine');
  const title = document.getElementById('mascotTitle');

  svg.classList.remove('mood-up', 'mood-down', 'mood-neutral');

  if (entries.length === 0) {
    svg.classList.add('mood-neutral');
    mouth.setAttribute('d', 'M 20 40 Q 30 40 40 40');
    line.innerHTML = "Log a submission and I'll start tracking how it's going.";
    title.textContent = 'Margin is waiting for data';
    return;
  }

  const total = entries.length;
  const interviewed = entries.filter(e => ['interview', 'offer'].includes(e.status)).length;
  const offers = entries.filter(e => e.status === 'offer').length;
  const rate = interviewed / total;
  const stale = entries.filter(e => {
    if (e.status !== 'applied') return false;
    const days = (Date.now() - new Date(e.dateApplied).getTime()) / 86400000;
    return days > 21;
  }).length;

  let mood = 'neutral';
  let mouthPath = 'M 20 40 Q 30 40 40 40';
  let text = `${total} submission${total === 1 ? '' : 's'} logged so far.`;

  if (offers > 0) {
    mood = 'up';
    mouthPath = 'M 18 38 Q 30 48 42 38';
    text = `<b>${offers} offer${offers === 1 ? '' : 's'}</b> on the board. That's the number that matters.`;
  } else if (total >= 8 && rate > 0.3) {
    mood = 'up';
    mouthPath = 'M 18 38 Q 30 46 42 38';
    text = `<b>${Math.round(rate * 100)}% interview rate</b> across ${total} — the resume is clearing the bar.`;
  } else if (total >= 8 && rate < 0.1) {
    mood = 'down';
    mouthPath = 'M 20 42 Q 30 34 40 42';
    text = `Interview rate is under 10% across ${total} submissions. Might be worth a resume pass before the next batch.`;
  } else if (stale >= 3) {
    mood = 'down';
    mouthPath = 'M 22 40 L 38 40';
    text = `<b>${stale} applications</b> have gone quiet for 3+ weeks. Probably safe to write those off and move on.`;
  } else if (total < 5) {
    mood = 'neutral';
    mouthPath = 'M 20 40 Q 30 40 40 40';
    text = `${total} logged. Give it a few more before the patterns get reliable.`;
  } else {
    mood = 'neutral';
    mouthPath = 'M 20 40 Q 30 42 40 40';
    text = `${interviewed} of ${total} have moved to interview or further. Steady so far.`;
  }

  svg.classList.add('mood-' + mood);
  mouth.setAttribute('d', mouthPath);
  line.innerHTML = text;
  title.textContent = 'Margin mood: ' + mood;
}

// ============================================================
// Keyword radar
//
// Pulls candidate keywords/phrases out of job posting text and
// saved Claude notes across every entry, scores each one on two
// axes (how often it shows up, and the interview-or-better rate
// among entries that mention it), and renders a two-shape radar
// chart. An optional category map (built via the "refine with
// Claude" handoff) can bucket raw keywords into cleaner labels
// before the math runs.
// ============================================================

const STOPWORDS = new Set([
  'the','and','for','are','but','not','you','your','with','this','that','have','will',
  'from','they','their','what','which','about','into','our','out','can','all','any',
  'has','was','were','been','being','these','those','than','then','there','here','who',
  'whom','its','itself','more','most','other','some','such','only','own','same','should',
  'now','also','able','must','required','requirements','requirement','responsibilities',
  'experience','years','year','strong','team','teams','work','working','role','company',
  'including','etc','using','use','used','knowledge','skills','skill','ability','plus',
  'job','description','candidate','candidates','preferred','minimum','degree','field',
  'looking','join','within','across','high','low','new','well','good','great',
  'frontend','backend','fullstack','full-stack','developer','development','engineer',
  'engineering','position','opportunity','responsible','environment','communication',
  'player','bonus','helpful','solid','deep','hands','familiarity','familiar',
  'collaborate','collaboration','build','building','building','help','helping',
  'related','similar','various','multiple','range','wide','overall','fit','note',
  'noted','shows','show','real','depth','just','listing','resume'
]);

function tokenizeForKeywords(text) {
  if (!text) return [];
  return text
    .toLowerCase()
    .replace(/[^a-z0-9+.\s-]/g, ' ')
    .split(/\s+/)
    .map(w => w.trim())
    .filter(w => w.length > 2 && !STOPWORDS.has(w) && !/^\d+$/.test(w));
}

function loadKeywordCategoryMap() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_KEYWORD_MAP);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function saveKeywordCategoryMap(map) {
  try {
    localStorage.setItem(STORAGE_KEY_KEYWORD_MAP, JSON.stringify(map));
    return true;
  } catch (e) {
    console.error('Failed to save keyword category map', e);
    return false;
  }
}

function clearKeywordCategoryMap() {
  try { localStorage.removeItem(STORAGE_KEY_KEYWORD_MAP); } catch (e) { /* ignore */ }
}

// Returns up to `limit` { label, freqScore, successScore, count } objects.
// freqScore is "% of all submissions that mention this", not a relative
// ranking against the other shown keywords — that keeps the chart from
// flattening into a near-identical hexagon once several keywords are
// equally common, and makes the number mean something on its own.
function computeKeywordAxes(limit) {
  limit = limit || 6;
  const categoryMap = loadKeywordCategoryMap(); // raw keyword -> category label, or null
  const totalEntries = entries.length;
  if (totalEntries === 0) return [];

  // word -> Set of entry ids that mention it (dedup within an entry)
  const wordToEntryIds = {};

  entries.forEach(e => {
    const text = [e.posting || '', e.claudeNote || ''].join(' ');
    const words = new Set(tokenizeForKeywords(text));
    words.forEach(w => {
      const label = categoryMap && categoryMap[w] ? categoryMap[w] : w;
      if (!wordToEntryIds[label]) wordToEntryIds[label] = new Set();
      wordToEntryIds[label].add(e.id);
    });
  });

  const candidates = Object.entries(wordToEntryIds)
    .map(([label, idSet]) => ({ label, ids: Array.from(idSet), count: idSet.size }))
    .filter(c => c.count >= 2) // drop one-off noise
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);

  if (candidates.length === 0) return [];

  return candidates.map(c => {
    const relevantEntries = entries.filter(e => c.ids.includes(e.id));
    const interviewed = relevantEntries.filter(e => ['interview', 'offer'].includes(e.status)).length;
    const successScore = relevantEntries.length > 0 ? Math.round((interviewed / relevantEntries.length) * 100) : 0;
    const freqScore = Math.round((c.count / totalEntries) * 100);
    return { label: c.label, freqScore, successScore, count: c.count };
  });
}

function polarToXY(cx, cy, radius, angleRad) {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad)
  };
}

function buildRadarPolygonPath(cx, cy, maxRadius, values) {
  const n = values.length;
  const points = values.map((v, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (Math.max(0, Math.min(100, v)) / 100) * maxRadius;
    return polarToXY(cx, cy, r, angle);
  });
  return {
    path: points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ') + ' Z',
    points
  };
}

// ============================================================
// Keyword explanations — what a given axis actually signals in
// a hiring/interview context, shown on hover so the chart teaches
// something beyond its own numbers. Matching is loose: lowercase,
// substring-aware, so "react.js", "reactjs", "react" all hit the
// same explanation, and category labels like "Frontend/React"
// (from the Claude refine flow) still match on their "react" part.
// ============================================================
const KEYWORD_EXPLANATIONS = [
  { match: ['react'], text: 'A frontend JavaScript library. Employers list this when the role touches user-facing product work. On a resume, it only counts as a real signal if there\'s a project or feature behind it — "React" in a skills list with no shipped work reads as a checkbox, not a qualification.' },
  { match: ['typescript', 'ts'], text: 'A typed superset of JavaScript. Companies that ask for it tend to care about code reliability at scale — it\'s a signal they value maintainability, not just shipping fast. Worth highlighting if you\'ve used it on a team project, not just a solo script.' },
  { match: ['javascript', 'js'], text: 'The baseline language for almost all web development. By itself it\'s table-stakes, not a differentiator — what moves the needle is what you built with it.' },
  { match: ['python'], text: 'Broadly used across backend, data, and scripting roles. Because it\'s so general-purpose, postings that mention it often care more about what domain you used it in (data pipelines? APIs? automation?) than the language itself.' },
  { match: ['java'], text: 'Common in backend, enterprise, and Android roles. Often signals a more structured, larger-codebase environment than a startup scripting role.' },
  { match: ['aws', 'amazon web services'], text: 'Cloud infrastructure experience. This is frequently a real differentiator at the intern/early-career level, since fewer students have hands-on cloud exposure versus classroom-only experience. Specific services (S3, EC2, Lambda) you can speak to in an interview matter more than just "AWS" on a resume.' },
  { match: ['azure'], text: 'Microsoft\'s cloud platform. Common in enterprise and .NET-heavy environments — if a posting leans on this, the broader stack is likely more corporate/enterprise than startup.' },
  { match: ['gcp', 'google cloud'], text: 'Google\'s cloud platform. Less universally required than AWS, so when it shows up it\'s often because the company specifically standardized on it — worth mentioning directly if you have it.' },
  { match: ['docker'], text: 'Containerization. A strong signal that the role expects some DevOps literacy beyond just writing application code — knowing how software actually gets deployed, not just how it runs locally.' },
  { match: ['kubernetes', 'k8s'], text: 'Container orchestration at scale. This is a notably more advanced/infrastructure-heavy signal than Docker alone — postings asking for this usually mean a platform or infrastructure-leaning role, not a typical feature-development internship.' },
  { match: ['sql', 'postgres', 'postgresql', 'mysql'], text: 'Relational database skills. Almost universally useful and a safe thing to claim if you can actually write a non-trivial query — interviewers will often ask you to write one on the spot.' },
  { match: ['nosql', 'mongodb', 'mongo'], text: 'Non-relational database experience. Tends to show up in postings for services with flexible or rapidly-changing data shapes — startups and product teams more than backend-heavy enterprise roles.' },
  { match: ['machine learning', 'ml'], text: 'A high-demand but high-bar area. Postings mentioning this often expect either coursework with real projects (not just "took a class") or research experience — vague mentions without specifics tend to get questioned hardest in interviews.' },
  { match: ['ai', 'artificial intelligence'], text: 'Broad and often vaguely used in postings. Worth checking what they actually mean in context — applied ML, LLM integration, and research are very different bars, and interviewers will usually probe which one you mean.' },
  { match: ['rest', 'restful', 'api'], text: 'Building or consuming web APIs. A fairly universal full-stack/backend skill — useful to mention, but rarely a differentiator on its own since it\'s expected baseline for most software roles.' },
  { match: ['graphql'], text: 'An alternative API query language to REST. When a posting specifically calls this out, it usually means their actual stack uses it day-to-day, not just as a buzzword — good to brush up on the basics before an interview if you see this.' },
  { match: ['git', 'github', 'gitlab'], text: 'Version control. Essentially a baseline expectation at this point — its presence in a posting isn\'t very informative, but you should be ready to talk through your actual workflow (branching, PRs, code review) if asked.' },
  { match: ['agile', 'scrum'], text: 'A process/methodology signal, not a technical one. Suggests the team works in sprints with regular standups — more relevant to how you\'ll be managed day-to-day than what you\'ll actually build.' },
  { match: ['linux', 'unix'], text: 'Comfort with a command-line environment. A quiet but real differentiator for students — being able to navigate, debug, and script in a terminal is something many candidates haven\'t actually practiced.' },
  { match: ['c++', 'cpp'], text: 'Lower-level systems language. Common in performance-critical, embedded, or hardware-adjacent roles — given your interest in semiconductors, this one is worth taking seriously if it keeps showing up.' },
  { match: ['kotlin'], text: 'Modern Android development language. A more specific, current signal than just "Java" for mobile-focused roles.' },
  { match: ['swift'], text: 'iOS development language. Similar to Kotlin\'s role for Android — a specific, current mobile signal.' },
  { match: ['node', 'nodejs', 'node.js'], text: 'Server-side JavaScript. Common in startups running a single language across frontend and backend — its presence often hints the whole stack is JS-based.' },
  { match: ['c#', 'csharp', '.net', 'dotnet'], text: 'Microsoft-stack backend language. Tends to correlate with more traditional enterprise environments rather than early-stage startups.' },
  { match: ['data structures', 'algorithms', 'dsa'], text: 'Core interview-prep territory. If a posting calls this out explicitly, expect a LeetCode-style technical interview round — this is one of the few keywords that maps directly to a specific interview format you can prepare for.' },
  { match: ['kubernetes', 'devops', 'ci/cd', 'cicd'], text: 'Deployment/infrastructure automation. Signals the role cares about how code ships, not just how it\'s written — a step up in scope from a pure feature-development role.' },
];

const GENERIC_KEYWORD_EXPLANATION = 'This term shows up often enough across your submissions to be worth tracking, but it doesn\'t have a specific writeup yet. Worth asking: is this something you can speak to with a concrete project or example, or is it just appearing because it\'s common boilerplate in postings for this type of role?';

function getKeywordExplanation(rawLabel) {
  const normalized = String(rawLabel).toLowerCase();
  for (const entry of KEYWORD_EXPLANATIONS) {
    if (entry.match.some(m => normalized.includes(m))) {
      return entry.text;
    }
  }
  return GENERIC_KEYWORD_EXPLANATION;
}

function titleCaseLabel(label) {
  // Don't reformat anything that already has its own casing/punctuation —
  // that's a sign it came from a category map the person (or Claude) set
  // deliberately, e.g. "Frontend/React".
  if (/[A-Z/]/.test(label)) return label;
  return label
    .split(/[\s-]+/)
    .map(w => (w.length <= 3 && w === w.toLowerCase() && /^[a-z]+$/.test(w) && ['aws', 'sql', 'css', 'api'].includes(w))
      ? w.toUpperCase()
      : w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function renderRadar() {
  const empty = document.getElementById('radarEmpty');
  const svg = document.getElementById('radarSvg');

  const axes = computeKeywordAxes(6);

  if (axes.length < 3) {
    empty.style.display = 'block';
    svg.style.display = 'none';
    empty.textContent = entries.length === 0
      ? 'Log a few submissions with job posting text or saved Claude notes, and the recurring themes will show up here.'
      : 'Not enough recurring keywords yet — add job posting text or save a few Claude notes across your submissions to populate this.';
    document.getElementById('radarDetailPlaceholder').style.display = 'flex';
    document.getElementById('radarDetailContent').style.display = 'none';
    return;
  }

  empty.style.display = 'none';
  svg.style.display = 'block';
  hideRadarDetail();

  const cx = 200, cy = 195, maxRadius = 118;
  const ringCount = 4;

  let svgParts = [];

  // Grid rings, with a plain-language % scale along the top axis only
  // so the chart reads as an actual percentage chart, not abstract rings.
  for (let ring = 1; ring <= ringCount; ring++) {
    const r = (ring / ringCount) * maxRadius;
    const ringPath = buildRadarPolygonPath(cx, cy, r, axes.map(() => 100));
    svgParts.push(`<polygon class="radar-grid-ring" points="${ringPath.points.map(p => p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ')}"></polygon>`);
    const pct = Math.round((ring / ringCount) * 100);
    svgParts.push(`<text class="radar-scale-label" x="${(cx + 4).toFixed(1)}" y="${(cy - r - 2).toFixed(1)}">${pct}%</text>`);
  }

  // Axis lines + labels (each wrapped in a hoverable group with an
  // invisible, generously-sized hit circle — text alone is too thin
  // a target to hover reliably)
  axes.forEach((axis, i) => {
    const angle = (Math.PI * 2 * i) / axes.length - Math.PI / 2;
    const edge = polarToXY(cx, cy, maxRadius, angle);
    svgParts.push(`<line class="radar-axis-line" x1="${cx}" y1="${cy}" x2="${edge.x.toFixed(1)}" y2="${edge.y.toFixed(1)}"></line>`);

    const labelPos = polarToXY(cx, cy, maxRadius + 28, angle);
    let anchor = 'middle';
    if (labelPos.x < cx - 12) anchor = 'end';
    else if (labelPos.x > cx + 12) anchor = 'start';
    const displayLabel = titleCaseLabel(axis.label);
    const label = displayLabel.length > 16 ? displayLabel.slice(0, 15) + '\u2026' : displayLabel;

    svgParts.push(`<g class="radar-axis-label-group" data-axis-index="${i}" tabindex="0" role="button" aria-label="${escapeAttr(displayLabel)} details">`);
    svgParts.push(`<circle class="radar-axis-hit" cx="${labelPos.x.toFixed(1)}" cy="${labelPos.y.toFixed(1)}" r="22"></circle>`);
    svgParts.push(`<text class="radar-axis-label" x="${labelPos.x.toFixed(1)}" y="${labelPos.y.toFixed(1)}" text-anchor="${anchor}" dominant-baseline="middle">${escapeHtml(label)}</text>`);
    svgParts.push(`</g>`);
  });

  // Frequency shape
  const freqShape = buildRadarPolygonPath(cx, cy, maxRadius, axes.map(a => a.freqScore));
  svgParts.push(`<path class="radar-shape-freq" d="${freqShape.path}"></path>`);
  freqShape.points.forEach((p, i) => {
    svgParts.push(`<circle class="radar-point radar-point-freq" data-axis-index="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"></circle>`);
  });

  // Success shape
  const successShape = buildRadarPolygonPath(cx, cy, maxRadius, axes.map(a => a.successScore));
  svgParts.push(`<path class="radar-shape-success" d="${successShape.path}"></path>`);
  successShape.points.forEach((p, i) => {
    svgParts.push(`<circle class="radar-point radar-point-success" data-axis-index="${i}" cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5"></circle>`);
  });

  svg.innerHTML = svgParts.join('');
  wireRadarHoverEvents(svg, axes);
}

function showRadarDetail(axis) {
  const placeholder = document.getElementById('radarDetailPlaceholder');
  const content = document.getElementById('radarDetailContent');
  placeholder.style.display = 'none';
  content.style.display = 'block';

  document.getElementById('radarDetailName').textContent = titleCaseLabel(axis.label);
  document.getElementById('radarDetailFreqStat').textContent = `Shows up in ${axis.freqScore}% of submissions (${axis.count} of ${entries.length})`;
  document.getElementById('radarDetailSuccessStat').textContent = `${axis.successScore}% interview rate when present`;
  document.getElementById('radarDetailText').textContent = getKeywordExplanation(axis.label);
}

function hideRadarDetail() {
  document.getElementById('radarDetailPlaceholder').style.display = 'flex';
  document.getElementById('radarDetailContent').style.display = 'none';
}

function wireRadarHoverEvents(svg, axes) {
  let pinnedIndex = null; // clicking/tapping an axis "pins" it so touch devices can use this too

  function setActive(index) {
    svg.querySelectorAll('.radar-axis-label-group').forEach(g => {
      g.classList.toggle('active', Number(g.dataset.axisIndex) === index);
    });
  }

  function activate(index) {
    const axis = axes[index];
    if (!axis) return;
    showRadarDetail(axis);
    setActive(index);
  }

  function deactivate() {
    if (pinnedIndex !== null) return; // a pinned (clicked) axis stays shown until something else is clicked
    hideRadarDetail();
    setActive(-1);
  }

  // Label groups: hover (mouse) + focus (keyboard) + click (pin, for touch)
  svg.querySelectorAll('.radar-axis-label-group').forEach(group => {
    const index = Number(group.dataset.axisIndex);
    group.addEventListener('mouseenter', () => activate(index));
    group.addEventListener('mouseleave', deactivate);
    group.addEventListener('focus', () => activate(index));
    group.addEventListener('blur', deactivate);
    group.addEventListener('click', () => {
      pinnedIndex = (pinnedIndex === index) ? null : index;
      activate(index);
    });
    group.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        pinnedIndex = (pinnedIndex === index) ? null : index;
        activate(index);
      }
    });
  });

  // Point dots on either shape do the same thing, for people who hover the chart itself
  svg.querySelectorAll('.radar-point').forEach(point => {
    const index = Number(point.dataset.axisIndex);
    point.addEventListener('mouseenter', () => activate(index));
    point.addEventListener('mouseleave', deactivate);
  });
}

// ============================================================
// Signal generation (rule-based)
// ============================================================
function renderSignals() {
  const list = document.getElementById('signalList');
  list.innerHTML = '';
  const signals = computeSignals();
  if (signals.length === 0) {
    list.innerHTML = '<li class="signal-empty">Log a few submissions and patterns will show up here — version performance, stalled applications, response timing.</li>';
    return;
  }
  signals.forEach((s, i) => {
    const li = document.createElement('li');
    li.className = 'signal-item ' + s.tone;
    li.style.animationDelay = (i * 90) + 'ms';
    li.innerHTML = `<span class="marker"></span><span>${escapeHtml(s.text)}</span>`;
    list.appendChild(li);
  });
}

function computeSignals() {
  const signals = [];
  if (entries.length < 2) return signals;

  const versionStats = {};
  entries.forEach(e => {
    const v = e.resumeVersion || 'Unspecified';
    if (!versionStats[v]) versionStats[v] = { total: 0, interviewed: 0 };
    versionStats[v].total += 1;
    if (['interview', 'offer'].includes(e.status)) versionStats[v].interviewed += 1;
  });
  const versionEntries = Object.entries(versionStats).filter(([, s]) => s.total >= 3);
  if (versionEntries.length >= 2) {
    const withRates = versionEntries.map(([name, s]) => ({ name, rate: s.interviewed / s.total, total: s.total }));
    withRates.sort((a, b) => b.rate - a.rate);
    const best = withRates[0];
    const worst = withRates[withRates.length - 1];
    if (best.rate > 0 && best.rate > worst.rate * 1.4 && best.name !== worst.name) {
      const multiplier = worst.rate > 0 ? (best.rate / worst.rate).toFixed(1) : null;
      const comparison = multiplier
        ? `${multiplier}x higher interview rate than "${worst.name}"`
        : `the only version getting interviews so far`;
      signals.push({
        tone: 'up',
        text: `"${best.name}" has a ${Math.round(best.rate * 100)}% interview rate across ${best.total} applications — ${comparison}.`
      });
    }
  } else if (versionEntries.length === 1 && entries.length >= 5) {
    signals.push({
      tone: 'neutral',
      text: `All ${entries.length} submissions used one resume version — log a second version to see what actually moves the needle.`
    });
  }

  const stale = entries.filter(e => {
    if (e.status !== 'applied') return false;
    const days = (Date.now() - new Date(e.dateApplied).getTime()) / 86400000;
    return days > 21;
  });
  if (stale.length > 0) {
    signals.push({
      tone: 'down',
      text: `${stale.length} application${stale.length === 1 ? '' : 's'} ${stale.length === 1 ? 'has' : 'have'} sat for 3+ weeks with no status change — likely a silent rejection, worth a follow-up or writing off.`
    });
  }

  const rejected = entries.filter(e => e.status === 'rejected');
  if (rejected.length >= 3) {
    const roleWords = {};
    rejected.forEach(e => {
      (e.role || '').toLowerCase().split(/\s+/).filter(w => w.length > 3).forEach(w => {
        roleWords[w] = (roleWords[w] || 0) + 1;
      });
    });
    const topWord = Object.entries(roleWords).sort((a, b) => b[1] - a[1])[0];
    if (topWord && topWord[1] >= 3 && topWord[1] >= rejected.length * 0.5) {
      signals.push({
        tone: 'down',
        text: `Rejections are clustering around roles containing "${topWord[0]}" (${topWord[1]} of ${rejected.length} rejections) — worth checking whether the resume's framing actually fits that role type.`
      });
    }
  }

  if (entries.length >= 8) {
    const interviewed = entries.filter(e => ['interview', 'offer'].includes(e.status)).length;
    const rate = interviewed / entries.length;
    if (rate < 0.1) {
      signals.push({
        tone: 'down',
        text: `Interview rate is under 10% across ${entries.length} submissions — at this volume, that usually points to the resume itself rather than bad luck on any one application.`
      });
    } else if (rate > 0.3) {
      signals.push({
        tone: 'up',
        text: `Interview rate is above 30% across ${entries.length} submissions — the resume is clearing the bar; any gaps now are more likely about role fit or the interview stage itself.`
      });
    }
  }

  const offers = entries.filter(e => e.status === 'offer');
  if (offers.length > 0) {
    signals.push({
      tone: 'up',
      text: `${offers.length} offer${offers.length === 1 ? '' : 's'} logged${offers[0].resumeVersion ? ` — most recently using "${offers[offers.length - 1].resumeVersion}"` : ''}.`
    });
  }

  return signals;
}

// ============================================================
// Resume versions
// ============================================================
function renderVersions() {
  const grid = document.getElementById('versionGrid');
  const select = document.getElementById('fVersion');
  if (versions.length === 0) {
    grid.innerHTML = '<div class="version-empty">No resume versions yet. Add one before logging submissions so you can compare performance later.</div>';
    select.innerHTML = '<option value="">No versions yet</option>';
    return;
  }
  grid.innerHTML = '';
  const wrapper = document.createElement('div');
  wrapper.className = 'version-grid';
  versions.forEach(v => {
    const vEntries = entries.filter(e => e.resumeVersion === v.name);
    const interviewed = vEntries.filter(e => ['interview', 'offer'].includes(e.status)).length;
    const rate = vEntries.length > 0 ? Math.round((interviewed / vEntries.length) * 100) : null;
    const hasFile = !!v.fileType;
    const card = document.createElement('a');
    card.className = 'version-card-link';
    card.href = `version-detail.html?id=${encodeURIComponent(v.id)}`;
    card.innerHTML = `
      <div class="version-card">
        <button class="version-delete-btn" data-version-id="${escapeAttr(v.id)}" title="Delete this version" aria-label="Delete this resume version">&times;</button>
        <div class="vname">${escapeHtml(v.name)}${hasFile ? `<span class="vfile-badge">${v.fileType === 'pdf' ? 'PDF' : 'TEXT'}</span>` : ''}</div>
        <div class="vstats">
          <span><b>${vEntries.length}</b> used</span>
          <span><b>${rate === null ? '—' : rate + '%'}</b> interview rate</span>
        </div>
        <span class="v-arrow">&rarr;</span>
      </div>
    `;
    wrapper.appendChild(card);
  });
  grid.appendChild(wrapper);

  select.innerHTML = versions.map(v => `<option value="${escapeAttr(v.name)}">${escapeHtml(v.name)}</option>`).join('');

  grid.querySelectorAll('.version-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.preventDefault();   // don't follow the parent <a> to the detail page
      e.stopPropagation();  // don't let the click bubble to the card link either
      confirmDeleteVersion(btn.dataset.versionId);
    });
  });
}

function confirmDeleteVersion(versionId) {
  const version = versions.find(v => v.id === versionId);
  if (!version) return;
  const affected = entries.filter(e => e.resumeVersion === version.name);

  let message = `Delete "${version.name}"?`;
  if (affected.length > 0) {
    message += ` ${affected.length} submission${affected.length === 1 ? '' : 's'} ${affected.length === 1 ? 'is' : 'are'} tagged with it — they'll stay in your backlog, just untagged from this version.`;
  }
  if (!window.confirm(message)) return;

  affected.forEach(e => { e.resumeVersion = ''; });
  versions = versions.filter(v => v.id !== versionId);

  const entriesSaved = saveEntries();
  const versionsSaved = saveVersions();
  if (!entriesSaved || !versionsSaved) {
    showToast('Something went wrong deleting that version — your data may be unchanged. Try again.');
    return;
  }

  render();
  showToast(`"${version.name}" deleted.`);
}

// ============================================================
// Table
// ============================================================
function renderTable() {
  const tbody = document.getElementById('entryTbody');
  const emptyState = document.getElementById('emptyState');
  const filtered = activeFilter === 'all' ? entries : entries.filter(e => e.status === activeFilter);

  document.getElementById('entryCount').textContent = `${filtered.length} of ${entries.length}`;

  if (entries.length === 0) {
    tbody.innerHTML = '';
    emptyState.style.display = 'block';
    document.querySelector('#entryTable thead').style.display = 'none';
    return;
  }
  document.querySelector('#entryTable thead').style.display = '';
  emptyState.style.display = 'none';

  const sorted = [...filtered].sort((a, b) => new Date(b.dateApplied || 0) - new Date(a.dateApplied || 0));

  tbody.innerHTML = '';
  sorted.forEach((e, i) => {
    const tr = document.createElement('tr');
    tr.className = 'entry-row';
    tr.style.animationDelay = Math.min(i * 35, 400) + 'ms';
    tr.innerHTML = `
      <td class="cell-company">${escapeHtml(e.company || '—')}</td>
      <td class="cell-role">${escapeHtml(e.role || '—')}</td>
      <td><span class="status-tag status-${e.status}">${e.status}</span></td>
      <td class="cell-version">${escapeHtml(e.resumeVersion || '—')}</td>
      <td class="cell-date">${formatDate(e.dateApplied)}</td>
      <td class="cell-date">${formatDate(e.dateUpdated)}</td>
      <td>
        <div class="row-actions">
          <button class="icon-btn" data-action="claude" data-id="${e.id}" title="Get Claude's take">ask</button>
          <button class="icon-btn" data-action="edit" data-id="${e.id}" title="Edit">edit</button>
          <button class="icon-btn danger" data-action="delete" data-id="${e.id}" title="Delete">del</button>
        </div>
      </td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('[data-action="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openEntryModal(btn.dataset.id));
  });
  tbody.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', () => deleteEntry(btn.dataset.id));
  });
  tbody.querySelectorAll('[data-action="claude"]').forEach(btn => {
    btn.addEventListener('click', () => openPromptModal(btn.dataset.id));
  });
}

function formatDate(d) {
  if (!d) return '—';
  const date = new Date(d);
  if (isNaN(date)) return '—';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}
function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

// ---------- Filters ----------
document.getElementById('filterPills').addEventListener('click', e => {
  const btn = e.target.closest('.filter-pill');
  if (!btn) return;
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  btn.classList.add('active');
  activeFilter = btn.dataset.filter;
  renderTable();
});

// ============================================================
// Entry modal
// ============================================================
const entryModal = document.getElementById('entryModal');
function openEntryModal(id) {
  editingEntryId = id || null;
  const entry = id ? entries.find(e => e.id === id) : null;
  document.getElementById('entryModalTitle').textContent = entry ? 'Edit submission' : 'Log a submission';
  document.getElementById('fCompany').value = entry?.company || '';
  document.getElementById('fRole').value = entry?.role || '';
  document.getElementById('fStatus').value = entry?.status || 'applied';
  document.getElementById('fVersion').value = entry?.resumeVersion || (versions[0]?.name || '');
  document.getElementById('fDateApplied').value = entry?.dateApplied || todayStr();
  document.getElementById('fDateUpdated').value = entry?.dateUpdated || todayStr();
  document.getElementById('fNotes').value = entry?.notes || '';
  document.getElementById('fPosting').value = entry?.posting || '';
  document.getElementById('deleteEntryBtn').style.display = entry ? 'inline-block' : 'none';
  entryModal.classList.add('show');
}
function closeEntryModal() {
  entryModal.classList.remove('show');
  editingEntryId = null;
}
document.getElementById('addEntryBtn').addEventListener('click', () => openEntryModal(null));
document.getElementById('emptyAddBtn').addEventListener('click', () => openEntryModal(null));
document.getElementById('entryModalClose').addEventListener('click', closeEntryModal);
entryModal.addEventListener('click', e => { if (e.target === entryModal) closeEntryModal(); });

document.getElementById('saveEntryBtn').addEventListener('click', async () => {
  const company = document.getElementById('fCompany').value.trim();
  const role = document.getElementById('fRole').value.trim();
  if (!company || !role) {
    showToast('Add at least a company and role title.');
    return;
  }
  const data = {
    company,
    role,
    status: document.getElementById('fStatus').value,
    resumeVersion: document.getElementById('fVersion').value,
    dateApplied: document.getElementById('fDateApplied').value,
    dateUpdated: document.getElementById('fDateUpdated').value,
    notes: document.getElementById('fNotes').value.trim(),
    posting: document.getElementById('fPosting').value.trim()
  };
  if (editingEntryId) {
    const idx = entries.findIndex(e => e.id === editingEntryId);
    if (idx > -1) entries[idx] = { ...entries[idx], ...data };
  } else {
    entries.push({ id: uid(), ...data, claudeNote: '' });
  }
  await saveEntries();
  closeEntryModal();
  render();
  showToast('Submission saved.');
});

document.getElementById('deleteEntryBtn').addEventListener('click', () => {
  if (editingEntryId) deleteEntry(editingEntryId);
  closeEntryModal();
});

async function deleteEntry(id) {
  entries = entries.filter(e => e.id !== id);
  await saveEntries();
  render();
  showToast('Entry deleted.');
}

// ============================================================
// Version modal — supports attaching a PDF (stored as base64)
// or pasted text, with size-aware warnings since localStorage
// has a small shared quota (~5-10MB across the whole app).
// ============================================================
const WARN_BYTES = 1.5 * 1024 * 1024;   // 1.5MB raw file — nudge toward caution
const BLOCK_BYTES = 4 * 1024 * 1024;    // 4MB raw file — refuse, suggest pasting text instead

const versionModal = document.getElementById('versionModal');
const versionDropzone = document.getElementById('versionDropzone');
const versionFileInput = document.getElementById('versionFileInput');
const versionFilenameChip = document.getElementById('versionFilenameChip');
const versionFilenameText = document.getElementById('versionFilenameText');
const versionFilenameSize = document.getElementById('versionFilenameSize');
const versionClearFile = document.getElementById('versionClearFile');
const versionSizeWarning = document.getElementById('versionSizeWarning');
const fVersionText = document.getElementById('fVersionText');

let pendingVersionFile = null; // { fileName, base64, sizeBytes }

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function resetVersionFileUI() {
  pendingVersionFile = null;
  versionFileInput.value = '';
  versionFilenameChip.classList.remove('show');
  versionSizeWarning.classList.remove('show', 'blocking');
  fVersionText.disabled = false;
  fVersionText.style.opacity = '1';
}

document.getElementById('addVersionBtn').addEventListener('click', () => {
  document.getElementById('fVersionName').value = '';
  fVersionText.value = '';
  resetVersionFileUI();
  versionModal.classList.add('show');
});
document.getElementById('versionModalClose').addEventListener('click', () => versionModal.classList.remove('show'));
versionModal.addEventListener('click', e => { if (e.target === versionModal) versionModal.classList.remove('show'); });

versionDropzone.addEventListener('click', () => versionFileInput.click());
versionDropzone.addEventListener('dragover', e => { e.preventDefault(); versionDropzone.classList.add('drag'); });
versionDropzone.addEventListener('dragleave', () => versionDropzone.classList.remove('drag'));
versionDropzone.addEventListener('drop', e => {
  e.preventDefault();
  versionDropzone.classList.remove('drag');
  if (e.dataTransfer.files.length) handleVersionFile(e.dataTransfer.files[0]);
});
versionFileInput.addEventListener('change', e => {
  if (e.target.files.length) handleVersionFile(e.target.files[0]);
});
versionClearFile.addEventListener('click', e => {
  e.stopPropagation();
  resetVersionFileUI();
});

function handleVersionFile(file) {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    showToast('Please attach a PDF — or paste the text below instead.');
    return;
  }

  if (file.size > BLOCK_BYTES) {
    versionSizeWarning.textContent = `That file is ${formatBytes(file.size)} — too large to store reliably alongside your submissions data. Paste the resume text below instead.`;
    versionSizeWarning.classList.add('show', 'blocking');
    versionFilenameChip.classList.remove('show');
    pendingVersionFile = null;
    return;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const base64 = reader.result.split(',')[1];
    pendingVersionFile = { fileName: file.name, base64, sizeBytes: file.size };
    versionFilenameText.textContent = file.name;
    versionFilenameSize.textContent = formatBytes(file.size);
    versionFilenameChip.classList.add('show');

    if (file.size > WARN_BYTES) {
      versionSizeWarning.textContent = `That's ${formatBytes(file.size)} — on the larger side. Resumes under ~1.5MB keep things running smoothly since this is shared storage with your whole backlog.`;
      versionSizeWarning.classList.add('show');
      versionSizeWarning.classList.remove('blocking');
    } else {
      versionSizeWarning.classList.remove('show', 'blocking');
    }

    fVersionText.disabled = true;
    fVersionText.style.opacity = '0.5';
    fVersionText.placeholder = `(using ${file.name})`;
  };
  reader.onerror = () => showToast('Could not read that file.');
  reader.readAsDataURL(file);
}

document.getElementById('saveVersionBtn').addEventListener('click', () => {
  const name = document.getElementById('fVersionName').value.trim();
  if (!name) { showToast('Give the version a name.'); return; }
  if (versions.some(v => v.name === name)) { showToast('That version name already exists.'); return; }

  const pastedText = fVersionText.value.trim();
  const newVersion = { id: uid(), name, addedAt: new Date().toISOString() };

  if (pendingVersionFile) {
    newVersion.fileType = 'pdf';
    newVersion.fileName = pendingVersionFile.fileName;
    newVersion.fileData = pendingVersionFile.base64;
    newVersion.fileSizeBytes = pendingVersionFile.sizeBytes;
  } else if (pastedText) {
    newVersion.fileType = 'text';
    newVersion.fileName = null;
    newVersion.fileData = pastedText;
    newVersion.fileSizeBytes = pastedText.length;
  } else {
    newVersion.fileType = null;
  }

  versions.push(newVersion);
  const saved = saveVersions();
  if (!saved) {
    versions.pop();
    showToast('Could not save — storage is full. Try a smaller file or remove an old version first.');
    return;
  }
  versionModal.classList.remove('show');
  resetVersionFileUI();
  render();
  showToast(newVersion.fileType ? 'Resume version added with file attached.' : 'Resume version added.');
});

// ============================================================
// Claude prompt handoff
// ============================================================
const promptModal = document.getElementById('promptModal');
function openPromptModal(id) {
  activePromptEntryId = id;
  const entry = entries.find(e => e.id === id);
  if (!entry) return;
  document.getElementById('promptText').textContent = buildPrompt(entry);
  const noteDisplay = document.getElementById('savedNoteDisplay');
  if (entry.claudeNote) {
    noteDisplay.classList.add('show');
    document.getElementById('savedNoteText').textContent = entry.claudeNote;
  } else {
    noteDisplay.classList.remove('show');
  }
  document.getElementById('responsePaste').value = '';
  promptModal.classList.add('show');
}
document.getElementById('promptModalClose').addEventListener('click', () => promptModal.classList.remove('show'));
promptModal.addEventListener('click', e => { if (e.target === promptModal) promptModal.classList.remove('show'); });

function buildPrompt(entry) {
  const total = entries.length;
  const interviewed = entries.filter(e => ['interview', 'offer'].includes(e.status)).length;
  const overallRate = total > 0 ? Math.round((interviewed / total) * 100) : 0;

  const versionStats = {};
  entries.forEach(e => {
    const v = e.resumeVersion || 'Unspecified';
    if (!versionStats[v]) versionStats[v] = { total: 0, interviewed: 0 };
    versionStats[v].total += 1;
    if (['interview', 'offer'].includes(e.status)) versionStats[v].interviewed += 1;
  });
  const versionSummary = Object.entries(versionStats)
    .map(([name, s]) => `- "${name}": ${s.total} submissions, ${s.total > 0 ? Math.round((s.interviewed / s.total) * 100) : 0}% interview rate`)
    .join('\n');

  const similarEntries = entries
    .filter(e => e.id !== entry.id && (e.role || '').toLowerCase().split(' ').some(w => w.length > 3 && (entry.role || '').toLowerCase().includes(w)))
    .slice(0, 8)
    .map(e => `- ${e.company} / ${e.role} — ${e.status}${e.resumeVersion ? ` (resume: ${e.resumeVersion})` : ''}`)
    .join('\n') || 'None found with a similar role title.';

  let prompt = `I'm tracking my job application backlog and want your read on one specific submission, using the pattern of my other submissions as context.\n\n`;
  prompt += `THIS SUBMISSION:\n`;
  prompt += `Company: ${entry.company}\nRole: ${entry.role}\nStatus: ${entry.status}\nResume version used: ${entry.resumeVersion || 'unspecified'}\nDate applied: ${entry.dateApplied || 'unspecified'}\n`;
  if (entry.notes) prompt += `My notes: ${entry.notes}\n`;
  if (entry.posting) prompt += `\nJOB POSTING TEXT:\n${entry.posting.slice(0, 6000)}\n`;
  prompt += `\nBACKLOG CONTEXT:\nTotal submissions logged: ${total}\nOverall interview rate: ${overallRate}%\n\nResume version performance:\n${versionSummary || 'No version data yet.'}\n\nOther submissions with a similar role title:\n${similarEntries}\n\n`;
  prompt += `Based on all of this, give me your honest read on this specific submission: is the resume version used the right one for this role given how it's performed elsewhere, what — if anything — about the role or company suggests I should approach the resume differently next time, and if the status is "applied," whether the data suggests this is worth following up on or more likely a quiet pass. Be specific to this submission, not generic job-search advice.`;
  return prompt;
}

document.getElementById('copyPromptBtn').addEventListener('click', () => {
  const text = document.getElementById('promptText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const confirm = document.getElementById('copyConfirm');
    confirm.classList.add('show');
    setTimeout(() => confirm.classList.remove('show'), 1800);
  }).catch(() => {
    showToast('Could not copy automatically — select the text manually.');
  });
});

document.getElementById('saveResponseBtn').addEventListener('click', () => {
  const response = document.getElementById('responsePaste').value.trim();
  if (!response) { showToast('Paste a response first.'); return; }
  const idx = entries.findIndex(e => e.id === activePromptEntryId);
  if (idx > -1) {
    entries[idx].claudeNote = response;
    saveEntries();
    document.getElementById('savedNoteDisplay').classList.add('show');
    document.getElementById('savedNoteText').textContent = response;
    renderRadar(); // notes feed keyword extraction, so refresh the chart too
    showToast('Note saved to this entry.');
  }
});

// ============================================================
// Keyword category refinement (radar) — same copy/paste pattern
// as the per-entry Claude handoff above, but operates on the
// whole backlog's extracted keywords rather than one entry.
// ============================================================
const refineModal = document.getElementById('refineModal');

document.getElementById('refineKeywordsBtn').addEventListener('click', () => {
  const rawAxes = computeKeywordAxes(12); // a slightly wider pull for refinement than the 6 shown on the chart
  if (rawAxes.length === 0) {
    showToast('Not enough keyword data yet to refine — log a few submissions with posting text or notes first.');
    return;
  }
  document.getElementById('refinePromptText').textContent = buildRefinePrompt(rawAxes);
  const existingMap = loadKeywordCategoryMap();
  const appliedDisplay = document.getElementById('refineAppliedDisplay');
  if (existingMap) {
    appliedDisplay.classList.add('show');
    document.getElementById('refineAppliedText').textContent = `Currently applied: ${Object.keys(existingMap).length} keyword mappings across ${new Set(Object.values(existingMap)).size} categories.`;
  } else {
    appliedDisplay.classList.remove('show');
  }
  document.getElementById('refineResponsePaste').value = '';
  refineModal.classList.add('show');
});
document.getElementById('refineModalClose').addEventListener('click', () => refineModal.classList.remove('show'));
refineModal.addEventListener('click', e => { if (e.target === refineModal) refineModal.classList.remove('show'); });

function buildRefinePrompt(rawAxes) {
  const keywordList = rawAxes.map(a => `- "${a.label}" (appears in ${a.count} submission${a.count === 1 ? '' : 's'})`).join('\n');
  return `I'm building a radar chart of keywords pulled from my job application backlog — these came from raw word-frequency matching across job posting text and saved notes, so related terms are currently split apart (e.g. "react" and "frontend" as separate entries when they should probably be one category).\n\nHere are the raw extracted keywords:\n${keywordList}\n\nPlease group these into 5-8 clean, meaningful categories that make sense for a software/tech job search (e.g. "Frontend/React", "Cloud/AWS", "Data/SQL"). Merge near-duplicates and drop anything that isn't a meaningful skill or theme.\n\nRespond with ONLY a valid JSON object, no markdown fences or preamble, mapping each original raw keyword (exact string, lowercase, as listed above) to its new category label. Every keyword in my list must appear as a key. Example shape:\n\n{\n  "react": "Frontend/React",\n  "frontend": "Frontend/React",\n  "aws": "Cloud/AWS"\n}`;
}

document.getElementById('copyRefinePromptBtn').addEventListener('click', () => {
  const text = document.getElementById('refinePromptText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const confirm = document.getElementById('copyRefineConfirm');
    confirm.classList.add('show');
    setTimeout(() => confirm.classList.remove('show'), 1800);
  }).catch(() => {
    showToast('Could not copy automatically — select the text manually.');
  });
});

document.getElementById('applyRefineBtn').addEventListener('click', () => {
  const raw = document.getElementById('refineResponsePaste').value.trim();
  if (!raw) { showToast('Paste Claude\'s response first.'); return; }
  let cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```\s*$/, '');
  let parsed;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch (err2) { parsed = null; }
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    showToast('That doesn\'t look like valid JSON — paste exactly what Claude returned.');
    return;
  }
  const entryCount = Object.keys(parsed).length;
  if (entryCount === 0) {
    showToast('That JSON object is empty — nothing to apply.');
    return;
  }
  const ok = saveKeywordCategoryMap(parsed);
  if (!ok) {
    showToast('Could not save the category map — storage may be full.');
    return;
  }
  refineModal.classList.remove('show');
  renderRadar();
  showToast(`Applied ${entryCount} keyword mappings to the radar.`);
});

document.getElementById('resetRefineBtn').addEventListener('click', () => {
  clearKeywordCategoryMap();
  document.getElementById('refineAppliedDisplay').classList.remove('show');
  renderRadar();
  showToast('Radar reset to raw keyword matching.');
});

// ============================================================
// Export / Import
// ============================================================
document.getElementById('exportBtn').addEventListener('click', () => {
  const payload = { entries, versions, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `margin-backlog-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Backlog exported.');
});

document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', async e => {
  const file = e.target.files[0];
  if (!file) return;
  try {
    const text = await file.text();
    const payload = JSON.parse(text);
    if (!Array.isArray(payload.entries)) throw new Error('Invalid format');
    const incomingEntries = payload.entries.map(en => ({ ...en, id: en.id || uid() }));
    const incomingVersions = Array.isArray(payload.versions) ? payload.versions : [];

    const existingIds = new Set(entries.map(e => e.id));
    const newEntries = incomingEntries.filter(e => !existingIds.has(e.id));
    entries = [...entries, ...newEntries];

    const existingVNames = new Set(versions.map(v => v.name));
    const newVersions = incomingVersions.filter(v => !existingVNames.has(v.name));
    versions = [...versions, ...newVersions];

    saveEntries();
    saveVersions();
    render();
    showToast(`Imported ${newEntries.length} new submission${newEntries.length === 1 ? '' : 's'}.`);
  } catch (err) {
    console.error(err);
    showToast("Could not read that file — make sure it's a backlog export from this tool.");
  }
  e.target.value = '';
});

// ---------- Toast ----------
let toastTimer = null;
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

// ============================================================
// Init
// ============================================================
initTheme();
renderDate();
scheduleNextDateRefresh();
loadData();
initProfile();

// ============================================================
// Profile chip (masthead)
// ============================================================
function initProfile() {
  let profile = null;
  try { const r = localStorage.getItem(STORAGE_KEY_PROFILE); profile = r ? JSON.parse(r) : null; } catch (e) {}
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
    window.location.href = 'login.html?edit=1&return=' + encodeURIComponent('index.html');
  });
  logoutBtn.addEventListener('click', () => {
    if (!confirm('Log out? Your submissions and resume versions will stay here — just your profile details will be cleared.')) return;
    try { localStorage.removeItem(STORAGE_KEY_PROFILE); } catch (e) {}
    window.location.href = 'login.html';
  });

  // Register this profile in the device-wide registry so the account panel
  // can list all profiles that have ever signed into this browser.
  registerProfileInRegistry(profile);

  // Init the account panel (rendered alongside signal box)
  initAccountPanel(profile);
}

// ============================================================
// Profile registry — keeps a lightweight index of all profiles
// that have ever been set on this device (keyed by createdAt,
// so switching profiles doesn't create duplicates). Used by the
// account panel's "all profiles on this device" section.
// ============================================================
function loadProfileRegistry() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PROFILE_REGISTRY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) { return []; }
}

function saveProfileRegistry(list) {
  try { localStorage.setItem(STORAGE_KEY_PROFILE_REGISTRY, JSON.stringify(list)); } catch (e) { /* ignore */ }
}

function registerProfileInRegistry(profile) {
  if (!profile || !profile.createdAt) return;
  const registry = loadProfileRegistry();
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
  if (existing > -1) {
    registry[existing] = entry;
  } else {
    registry.push(entry);
  }
  saveProfileRegistry(registry);
}

function removeProfileFromRegistry(createdAt) {
  const registry = loadProfileRegistry().filter(p => p.createdAt !== createdAt);
  saveProfileRegistry(registry);
}

// ============================================================
// Account panel
// ============================================================
function initAccountPanel(profile) {
  // --- Identity block ---
  const acctName = document.getElementById('acctName');
  const acctMeta = document.getElementById('acctMeta');
  const acctSince = document.getElementById('acctSince');
  if (!acctName) return;

  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ');
  acctName.textContent = fullName || '—';

  const metaParts = [];
  if (profile.school) metaParts.push(profile.school);
  if (profile.occupation) metaParts.push(profile.occupation);
  if (profile.instagram) metaParts.push('@' + profile.instagram);
  acctMeta.textContent = metaParts.join(' · ');

  if (profile.createdAt) {
    const d = new Date(profile.createdAt);
    if (!isNaN(d)) {
      acctSince.textContent = 'Using Margin since ' + d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();
    }
  }

  // --- Edit profile button ---
  document.getElementById('acctEditProfileBtn').addEventListener('click', () => {
    window.location.href = 'login.html?edit=1&return=' + encodeURIComponent('index.html');
  });

  // --- Delete account button (opens modal) ---
  document.getElementById('acctDeleteBtn').addEventListener('click', () => {
    openDeleteAccountModal(profile, /* isActiveProfile */ true);
  });

  // --- All profiles toggle ---
  const toggleBtn = document.getElementById('acctProfilesToggle');
  const profilesList = document.getElementById('acctProfilesList');
  toggleBtn.addEventListener('click', () => {
    const expanded = toggleBtn.getAttribute('aria-expanded') === 'true';
    toggleBtn.setAttribute('aria-expanded', String(!expanded));
    toggleBtn.textContent = expanded ? 'Show' : 'Hide';
    profilesList.style.display = expanded ? 'none' : 'flex';
    if (!expanded) renderProfilesList(profile);
  });
}

function renderProfilesList(activeProfile) {
  const list = document.getElementById('acctProfilesList');
  if (!list) return;
  const registry = loadProfileRegistry();
  list.innerHTML = '';

  if (registry.length === 0) {
    list.innerHTML = '<div class="acct-profiles-empty">No other profiles found on this device.</div>';
    return;
  }

  // Sort: active profile first, then by createdAt desc
  const sorted = [...registry].sort((a, b) => {
    if (a.createdAt === activeProfile.createdAt) return -1;
    if (b.createdAt === activeProfile.createdAt) return 1;
    return new Date(b.createdAt) - new Date(a.createdAt);
  });

  sorted.forEach(p => {
    const isActive = p.createdAt === activeProfile.createdAt;
    const row = document.createElement('div');
    row.className = 'acct-profile-row';

    const created = new Date(p.createdAt);
    const dateStr = !isNaN(created)
      ? created.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
      : '—';

    row.innerHTML = `
      <div class="acct-profile-info">
        <div class="acct-profile-pname">${escapeHtml([p.firstName, p.lastName].filter(Boolean).join(' ') || '—')}</div>
        <div class="acct-profile-pdate">Created ${dateStr}</div>
      </div>
      ${isActive ? '<span class="acct-profile-active-badge">Active</span>' : ''}
      <button class="acct-profile-del" data-created-at="${escapeAttr(p.createdAt)}" title="Delete this profile">&times;</button>
    `;
    list.appendChild(row);
  });

  list.querySelectorAll('.acct-profile-del').forEach(btn => {
    btn.addEventListener('click', () => {
      const createdAt = btn.dataset.createdAt;
      const p = registry.find(r => r.createdAt === createdAt);
      if (!p) return;
      const isActive = createdAt === activeProfile.createdAt;
      // Re-assemble a profile-shaped object for the modal
      openDeleteAccountModal(p, isActive);
    });
  });
}

// ============================================================
// Delete account modal
// ============================================================
const deleteAccountModal = document.getElementById('deleteAccountModal');

function openDeleteAccountModal(profile, isActiveProfile) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'this profile';
  document.getElementById('deleteAccountTitle').textContent = `Delete "${fullName}"`;
  document.getElementById('deleteAccountDesc').textContent = isActiveProfile
    ? 'This is your active profile. Deleting it will sign you out. Choose what to remove:'
    : `This profile is stored on your device but is not currently active. Choose what to remove:`;

  // Default to "everything" for active, "profile only" for inactive (safer)
  document.getElementById(isActiveProfile ? 'deleteScopeEverything' : 'deleteScopeProfileOnly').checked = true;

  deleteAccountModal.classList.add('show');

  // Swap in a fresh confirm listener each time to carry the right profile context
  const confirmBtn = document.getElementById('deleteAccountConfirmBtn');
  const newConfirm = confirmBtn.cloneNode(true);
  confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);

  newConfirm.addEventListener('click', () => {
    const scope = document.querySelector('input[name="deleteScope"]:checked')?.value || 'everything';
    executeDeleteAccount(profile, isActiveProfile, scope);
  });
}

function executeDeleteAccount(profile, isActiveProfile, scope) {
  const fullName = [profile.firstName, profile.lastName].filter(Boolean).join(' ') || 'Profile';

  if (scope === 'everything') {
    // Only wipe entries/versions/keywords if this is the active profile —
    // inactive profiles don't have separate data stores in this localStorage model
    if (isActiveProfile) {
      try { localStorage.removeItem(STORAGE_KEY_ENTRIES); } catch (e) {}
      try { localStorage.removeItem(STORAGE_KEY_VERSIONS); } catch (e) {}
      try { localStorage.removeItem(STORAGE_KEY_KEYWORD_MAP); } catch (e) {}
    }
  }

  // Always remove from registry
  removeProfileFromRegistry(profile.createdAt);

  if (isActiveProfile) {
    try { localStorage.removeItem(STORAGE_KEY_PROFILE); } catch (e) {}
    deleteAccountModal.classList.remove('show');
    // Redirect to login; data is gone
    window.location.href = 'login.html';
    return;
  }

  // Non-active profile — just removed from registry, stay on page
  deleteAccountModal.classList.remove('show');
  showToast(`"${fullName}" removed from this device.`);

  // Re-render the list if it's visible
  const list = document.getElementById('acctProfilesList');
  if (list && list.style.display !== 'none') {
    let activeProfile = null;
    try { const r = localStorage.getItem(STORAGE_KEY_PROFILE); activeProfile = r ? JSON.parse(r) : null; } catch (e) {}
    if (activeProfile) renderProfilesList(activeProfile);
  }
}

document.getElementById('deleteAccountModalClose').addEventListener('click', () => {
  deleteAccountModal.classList.remove('show');
});
document.getElementById('deleteAccountCancelBtn').addEventListener('click', () => {
  deleteAccountModal.classList.remove('show');
});
deleteAccountModal.addEventListener('click', e => {
  if (e.target === deleteAccountModal) deleteAccountModal.classList.remove('show');
});

// ============================================================
// Community panel — "Who's using Margin"
// Fetches a publicly hosted profiles.json from GitHub (raw URL)
// and renders a card grid. URL persisted in localStorage so it
// survives page refreshes. The "Export my profile card" button
// generates the JSON snippet for the user to paste into GitHub.
// ============================================================
const STORAGE_KEY_COMMUNITY_URL = 'margin:communityUrl';

function loadCommunityUrl() {
  try { return localStorage.getItem(STORAGE_KEY_COMMUNITY_URL) || ''; } catch (e) { return ''; }
}
function saveCommunityUrl(url) {
  try { localStorage.setItem(STORAGE_KEY_COMMUNITY_URL, url); } catch (e) { /* ignore */ }
}

function initCommunityPanel() {
  const urlInput = document.getElementById('communityGithubUrl');
  const setBtn   = document.getElementById('communitySetUrlBtn');
  const refreshBtn = document.getElementById('communityRefreshBtn');

  // Restore saved URL
  const saved = loadCommunityUrl();
  if (saved) {
    urlInput.value = saved;
    fetchAndRenderCommunity(saved);
  }

  setBtn.addEventListener('click', () => {
    const url = urlInput.value.trim();
    if (!url) { showToast('Paste a raw GitHub URL first.'); return; }
    if (!url.startsWith('https://raw.githubusercontent.com/')) {
      showToast('Use a raw.githubusercontent.com URL — click the Raw button on your file in GitHub.');
      return;
    }
    saveCommunityUrl(url);
    fetchAndRenderCommunity(url);
  });

  // Also trigger on Enter inside the input
  urlInput.addEventListener('keydown', e => {
    if (e.key === 'Enter') setBtn.click();
  });

  refreshBtn.addEventListener('click', () => {
    const url = loadCommunityUrl() || urlInput.value.trim();
    if (!url) { showToast('Set a GitHub URL first.'); return; }
    fetchAndRenderCommunity(url, /* forceRefresh */ true);
  });
}

async function fetchAndRenderCommunity(url, forceRefresh) {
  const loadingEl = document.getElementById('communityLoading');
  const errorEl   = document.getElementById('communityError');
  const gridEl    = document.getElementById('communityGrid');
  const refreshBtn = document.getElementById('communityRefreshBtn');

  loadingEl.style.display = 'flex';
  errorEl.style.display   = 'none';
  gridEl.style.display    = 'none';
  refreshBtn.classList.add('spinning');

  // Cache-bust on forced refresh so GitHub's CDN doesn't serve stale content
  const fetchUrl = forceRefresh ? url + '?_cb=' + Date.now() : url;

  try {
    const res = await fetch(fetchUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status} — make sure the file is public and the URL is correct.`);
    const data = await res.json();
    if (!Array.isArray(data.profiles)) throw new Error('Invalid format — expected a JSON object with a "profiles" array.');
    renderCommunityGrid(data.profiles);
  } catch (err) {
    loadingEl.style.display = 'none';
    errorEl.style.display   = 'block';
    errorEl.textContent     = 'Could not load profiles: ' + err.message;
  } finally {
    refreshBtn.classList.remove('spinning');
  }
}

function renderCommunityGrid(profiles) {
  const loadingEl = document.getElementById('communityLoading');
  const gridEl    = document.getElementById('communityGrid');

  loadingEl.style.display = 'none';

  // Figure out the active user so we can badge their card
  let activeProfile = null;
  try { const r = localStorage.getItem(STORAGE_KEY_PROFILE); activeProfile = r ? JSON.parse(r) : null; } catch (e) {}
  const activeName = activeProfile
    ? ([activeProfile.firstName, activeProfile.lastName].filter(Boolean).join(' ')).toLowerCase()
    : null;

  if (profiles.length === 0) {
    gridEl.innerHTML = '<div class="community-empty">No profiles in this file yet — export yours and add it to get started.</div>';
    gridEl.style.display = 'block';
    return;
  }

  gridEl.innerHTML = '';

  // Sort: "you" card first, then by submission count desc
  const sorted = [...profiles].sort((a, b) => {
    const aIsYou = activeName && (a.name || '').toLowerCase() === activeName;
    const bIsYou = activeName && (b.name || '').toLowerCase() === activeName;
    if (aIsYou && !bIsYou) return -1;
    if (bIsYou && !aIsYou) return 1;
    return (b.stats?.totalSubmissions || 0) - (a.stats?.totalSubmissions || 0);
  });

  sorted.forEach(p => {
    const isYou = activeName && (p.name || '').toLowerCase() === activeName;
    const s = p.stats || {};
    const metaParts = [p.school, p.occupation].filter(Boolean);
    const updated = p.updatedAt ? new Date(p.updatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : null;

    const card = document.createElement('div');
    card.className = 'community-card';
    card.innerHTML = `
      ${isYou ? '<span class="cc-you-badge">You</span>' : ''}
      <div class="cc-name">${escapeHtml(p.name || '—')}</div>
      <div class="cc-meta">${escapeHtml(metaParts.join(' · ') || '—')}</div>
      <div class="cc-stats">
        <div class="cc-stat-row">
          <span class="cc-stat-label">Submissions</span>
          <span class="cc-stat-value">${s.totalSubmissions ?? '—'}</span>
        </div>
        <div class="cc-stat-row">
          <span class="cc-stat-label">Interview rate</span>
          <span class="cc-stat-value">${s.interviewRate != null ? s.interviewRate + '%' : '—'}</span>
        </div>
        <div class="cc-stat-row">
          <span class="cc-stat-label">Offer rate</span>
          <span class="cc-stat-value">${s.offerRate != null ? s.offerRate + '%' : '—'}</span>
        </div>
        ${s.resumeVersions != null ? `<div class="cc-stat-row"><span class="cc-stat-label">Resume versions</span><span class="cc-stat-value">${s.resumeVersions}</span></div>` : ''}
      </div>
      ${s.topResumeVersion ? `<div class="cc-divider"></div><div class="cc-version"><span class="cc-version-label">Top version · </span>${escapeHtml(s.topResumeVersion)}</div>` : ''}
      ${updated ? `<div class="cc-updated">Updated ${updated}</div>` : ''}
    `;
    gridEl.appendChild(card);
  });

  gridEl.style.display = 'grid';
}

// ---------- Export profile card ----------
function buildProfileCardJson() {
  let profile = null;
  try { const r = localStorage.getItem(STORAGE_KEY_PROFILE); profile = r ? JSON.parse(r) : null; } catch (e) {}
  if (!profile) return null;

  const total = entries.length;
  const interviewed = entries.filter(e => ['interview', 'offer'].includes(e.status)).length;
  const offered     = entries.filter(e => e.status === 'offer').length;
  const interviewRate = total > 0 ? Math.round((interviewed / total) * 100) : 0;
  const offerRate     = total > 0 ? Math.round((offered / total) * 100) : 0;

  // Find the version with the highest interview rate (min 2 uses)
  const versionStats = {};
  entries.forEach(e => {
    if (!e.resumeVersion) return;
    if (!versionStats[e.resumeVersion]) versionStats[e.resumeVersion] = { total: 0, interviewed: 0 };
    versionStats[e.resumeVersion].total += 1;
    if (['interview', 'offer'].includes(e.status)) versionStats[e.resumeVersion].interviewed += 1;
  });
  const topVersion = Object.entries(versionStats)
    .filter(([, s]) => s.total >= 2)
    .sort((a, b) => (b[1].interviewed / b[1].total) - (a[1].interviewed / a[1].total))[0];

  const card = {
    id: 'user-' + (profile.createdAt ? new Date(profile.createdAt).getTime().toString(36) : uid()),
    name: [profile.firstName, profile.lastName].filter(Boolean).join(' '),
    school: profile.school || '',
    occupation: profile.occupation || '',
    instagram: profile.instagram || '',
    joinedAt: profile.createdAt || new Date().toISOString(),
    stats: {
      totalSubmissions: total,
      interviewRate,
      offerRate,
      resumeVersions: versions.length,
      ...(topVersion ? { topResumeVersion: topVersion[0] } : {})
    },
    updatedAt: new Date().toISOString()
  };

  return JSON.stringify(card, null, 2);
}

document.getElementById('exportProfileCardBtn').addEventListener('click', () => {
  const json = buildProfileCardJson();
  if (!json) { showToast('Set up your profile first.'); return; }
  document.getElementById('exportCardText').textContent = json;
  document.getElementById('exportCardModal').classList.add('show');
});

document.getElementById('exportCardModalClose').addEventListener('click', () => {
  document.getElementById('exportCardModal').classList.remove('show');
});
document.getElementById('exportCardModal').addEventListener('click', e => {
  if (e.target === document.getElementById('exportCardModal'))
    document.getElementById('exportCardModal').classList.remove('show');
});

document.getElementById('copyExportCardBtn').addEventListener('click', () => {
  const text = document.getElementById('exportCardText').textContent;
  navigator.clipboard.writeText(text).then(() => {
    const confirm = document.getElementById('copyExportCardConfirm');
    confirm.classList.add('show');
    setTimeout(() => confirm.classList.remove('show'), 1800);
  }).catch(() => showToast('Could not copy — select the text manually.'));
});

// Init the community panel on page load
initCommunityPanel();
