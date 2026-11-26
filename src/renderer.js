// ============================================================
//  OpenWave — renderer (the UI logic, plain JS)
//  Talks to yt-dlp through window.api (exposed by preload.js),
//  plays audio from the local proxy in the main process.
// ============================================================

// ---------- DOM shortcuts ----------
const $ = (id) => document.getElementById(id);

const searchForm = $('search-form');
const searchInput = $('search-input');
const searchHistoryBox = $('search-history');
const resultsTitle = $('results-title');
const resultsList = $('results-list');
const statusEl = $('status');
const tileRecsPills = $('tile-recs-pills');
const tileLikedSub = $('tile-liked-sub');
const tileLikedPills = $('tile-liked-pills');
const tilePlSub = $('tile-pl-sub');
const tilePlPills = $('tile-pl-pills');
const foryouList = $('foryou-list');
const likedList = $('liked-list');
const likedCount = $('liked-count');
const playlistsGrid = $('playlists-grid');
const plOverviewCount = $('pl-overview-count');
const plNewBtn = $('pl-new-btn');
const plNewForm = $('pl-new-form');
const plNewName = $('pl-new-name');
const plNewCancel = $('pl-new-cancel');
const queueList = $('queue-list');
const queueCount = $('queue-count');
const clearQueueBtn = $('clear-queue');
const queueSaveBtn = $('queue-save-btn');
const queueSaveForm = $('queue-save-form');
const queueSaveName = $('queue-save-name');
const queueSaveCancel = $('queue-save-cancel');
const plTitle = $('pl-title');
const plCount = $('pl-count');
const playlistViewList = $('playlist-view-list');
const plEditBtn = $('pl-edit-btn');
const plEditOverlay = $('pl-edit-overlay');
const plEditName = $('pl-edit-name');
const plEditCoverImg = $('pl-edit-cover-img');
const plEditCoverPh = $('pl-edit-cover-ph');
const plEditCoverBtn = $('pl-edit-cover-btn');
const plEditCoverRemove = $('pl-edit-cover-remove');
const plEditFile = $('pl-edit-file');
const plEditSave = $('pl-edit-save');
const plEditCancel = $('pl-edit-cancel');
const npThumb = $('np-thumb');
const npTitle = $('np-title');
const npChannel = $('np-channel');
const btnLike = $('btn-like');
const btnRepeat = $('btn-repeat');
const btnMute = $('btn-mute');
const btnSleep = $('btn-sleep');
const btnPrev = $('btn-prev');
const btnPlay = $('btn-play');
const btnNext = $('btn-next');
const seek = $('seek');
const timeCurrent = $('time-current');
const timeTotal = $('time-total');
const volume = $('volume');
const ctxmenu = $('ctxmenu');

const LIKED = 'Liked Songs';

// ---------- state ----------
let queue = [];            // [{id, title, channel, duration, thumb, url}]
let current = -1;
let isSeeking = false;
let pendingSeek = null; // position to jump to once audio metadata loads
let lastResumeSave = 0;
let playlists = [];        // [{name, tracks: [...]}]  (Liked Songs is virtual)
let likedSongs = [];       // full track objects, most recent first
let recentlyPlayed = [];   // full track objects, most recent first
let searchResults = [];    // last search result list
let view = { type: 'home', name: null };

const audio = new Audio();
audio.crossOrigin = 'anonymous'; // lets the Web Audio analyser tap the proxy stream

// ---------- monochrome SVG icons ----------
const ICONS = {
  play: '<path d="M8.2 5.6v12.8c0 .9 1 1.45 1.77.97l10.13-6.4a1.15 1.15 0 0 0 0-1.94L9.97 4.63C9.2 4.15 8.2 4.7 8.2 5.6z"/>',
  pause: '<rect x="6.2" y="4.8" width="4" height="14.4" rx="1.7"/><rect x="13.8" y="4.8" width="4" height="14.4" rx="1.7"/>',
  heart: '<path d="M12 21.1l-1.6-1.44C5.2 14.9 2 12 2 8.5 2 5.4 4.4 3 7.5 3c1.9 0 3.6 1 4.5 2.5C12.9 4 14.6 3 16.5 3 19.6 3 22 5.4 22 8.5c0 3.5-3.2 6.4-8.4 11.16L12 21.1z"/>',
  heartO: '<path fill="none" stroke="currentColor" stroke-width="2" d="M12 19.6l-1.15-1.04C6.1 14.2 3.4 11.7 3.4 8.7c0-2.4 1.9-4.3 4.3-4.3 1.6 0 3.1.85 3.9 2.2l.4.7.4-.7c.8-1.35 2.3-2.2 3.9-2.2 2.4 0 4.3 1.9 4.3 4.3 0 3-2.7 5.5-7.45 9.86L12 19.6z"/>',
  x: '<path fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" d="M12 5.5v13M5.5 12h13"/>',
  note: '<path d="M9.5 18.7a3 3 0 1 1-2-2.83V5.5c0-.5.37-.93.86-1L17.6 3a1 1 0 0 1 1.14.99v10.3a2.9 2.9 0 1 1-2-2.6V8.3l-7.24 1.77v8.63z"/>',
  clock: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M12 7.2v5l3.4 2"/><circle cx="12" cy="12" r="8.2" fill="none" stroke="currentColor" stroke-width="2"/>',
  repeat: '<path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M17 2l4 4-4 4"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M3 11v-1a4 4 0 0 1 4-4h14"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M7 22l-4-4 4-4"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" d="M21 13v1a4 4 0 0 1-4 4H3"/>',
  volume: '<path d="M4 9.8v4.4c0 .55.45 1 1 1h2.6l3.8 3.3c.65.56 1.6.1 1.6-.75V6.25c0-.85-.95-1.31-1.6-.75L7.6 8.8H5c-.55 0-1 .45-1 1z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M15.8 9.2a4 4 0 0 1 0 5.6M18.2 7a7 7 0 0 1 0 10"/>',
  mute: '<path d="M4 9.8v4.4c0 .55.45 1 1 1h2.6l3.8 3.3c.65.56 1.6.1 1.6-.75V6.25c0-.85-.95-1.31-1.6-.75L7.6 8.8H5c-.55 0-1 .45-1 1z"/><path fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" d="M16 9.5l5 5M21 9.5l-5 5"/>',
  queue: '<rect x="3.5" y="5.4" width="13.5" height="2.5" rx="1.25"/><rect x="3.5" y="10.75" width="13.5" height="2.5" rx="1.25"/><rect x="3.5" y="16.1" width="9" height="2.5" rx="1.25"/><path d="M18.6 12.4v6.7c0 .77.85 1.24 1.5.83l4.5-2.85a.98.98 0 0 0 0-1.66l-4.5-2.85c-.65-.41-1.5.06-1.5.83z"/>',
};
function icon(name) {
  return `<svg class="ic" viewBox="0 0 24 24">${ICONS[name]}</svg>`;
}

// ---------- persistence ----------
function saveState() {
  localStorage.setItem('openwave:state', JSON.stringify({ queue, current }));
  updateRailBadges();
}
function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem('openwave:state'));
    if (saved && Array.isArray(saved.queue)) {
      queue = saved.queue;
      current = saved.current ?? -1;
    }
  } catch { /* corrupted state — start fresh */ }
}
function savePlaylists() {
  localStorage.setItem('openwave:playlists', JSON.stringify(playlists));
  renderRailPlaylists();
}
function loadPlaylists() {
  try {
    const saved = JSON.parse(localStorage.getItem('openwave:playlists'));
    if (Array.isArray(saved)) playlists = saved.filter(p => p.name !== LIKED);
  } catch { playlists = []; }
}
function saveLiked() {
  localStorage.setItem('openwave:liked', JSON.stringify(likedSongs));
  updateRailBadges();
}
function loadLiked() {
  try {
    const saved = JSON.parse(localStorage.getItem('openwave:liked'));
    if (Array.isArray(saved)) likedSongs = saved;
  } catch { likedSongs = []; }
}
function saveRecent() {
  localStorage.setItem('openwave:recent', JSON.stringify(recentlyPlayed));
}
function loadRecent() {
  try {
    const saved = JSON.parse(localStorage.getItem('openwave:recent'));
    if (Array.isArray(saved)) recentlyPlayed = saved;
  } catch { recentlyPlayed = []; }
}

// ---------- settings ----------
const ACCENT_PRESETS = ['#a5a6f6', '#8fd3f6', '#8fe3b0', '#f6a5c0', '#f6c46b', '#f68c6b'];
// ---------- search ----------
const SETTINGS_DEFAULTS = { accent: '#a5a6f6', autoplayNext: true, theme: 'dark', roundness: 'default' };
let settings = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('openwave:settings'));
    return { ...SETTINGS_DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) };
  } catch { return { ...SETTINGS_DEFAULTS }; }
})();

function saveSettings() {
  localStorage.setItem('openwave:settings', JSON.stringify(settings));
}

function hexToRgb(hex) {
  const m = String(hex).replace('#', '').match(/^([0-9a-f]{6})$/i);
  if (!m) return [165, 166, 246];
  const n = parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function lighten(hex, amt = 0.16) {
  const [r, g, b] = hexToRgb(hex);
  const f = (v) => Math.min(255, Math.round(v + (255 - v) * amt));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

function applySettings() {
  const root = document.documentElement;
  root.style.setProperty('--accent', settings.accent);
  root.style.setProperty('--accent-strong', lighten(settings.accent));
  const [r, g, b] = hexToRgb(settings.accent);
  root.style.setProperty('--accent-soft', `rgba(${r}, ${g}, ${b}, 0.12)`);
  const theme = settings.theme || 'dark';
  root.dataset.theme = theme;
  root.classList.toggle('r-sharp', settings.roundness === 'sharp');
  root.classList.toggle('r-round', settings.roundness === 'round');
  window.api.setBackground(theme);
}

// ---------- search history ----------
let searchHistory = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('openwave:searchhistory'));
    return Array.isArray(saved) ? saved.slice(0, 10) : [];
  } catch { return []; }
})();
function saveSearchHistory() {
  localStorage.setItem('openwave:searchhistory', JSON.stringify(searchHistory));
}
function pushSearchHistory(q) {
  searchHistory = [q, ...searchHistory.filter(h => h !== q)].slice(0, 10);
  saveSearchHistory();
}

// ---------- helpers ----------
function fmtTime(sec) {
  if (sec == null || !isFinite(sec)) return '--:--';
  const s = Math.round(sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function setStatus(msg, sticky = false) {
  statusEl.textContent = msg;
  statusEl.hidden = !msg;
  if (!sticky && msg) setTimeout(() => { statusEl.hidden = true; }, 4000);
}

function pushRecent(track) {
  recentlyPlayed = recentlyPlayed.filter(t => t.id !== track.id);
  recentlyPlayed.unshift({ ...track });
  if (recentlyPlayed.length > 30) recentlyPlayed.length = 30;
  saveRecent();
  if (view.type === 'home') renderHomeTiles();
}

// ---------- likes ----------
function isLiked(id) {
  return likedSongs.some(t => t.id === id);
}

function toggleLike(track) {
  if (!track) return;
  if (isLiked(track.id)) {
    likedSongs = likedSongs.filter(t => t.id !== track.id);
    setStatus(`Removed “${track.title}” from ${LIKED}.`);
  } else {
    likedSongs.unshift({ ...track });
    setStatus(`Added “${track.title}” to ${LIKED}.`);
  }
  saveLiked();
  refreshHearts();
  refreshNpLike();
  if (view.type === 'liked' || view.type === 'home') renderView();
  // little heart-beat animation
  btnLike.classList.remove('pop');
  void btnLike.offsetWidth;
  btnLike.classList.add('pop');
}

function refreshHearts() {
  for (const btn of document.querySelectorAll('.t-like')) {
    const l = isLiked(btn.dataset.id);
    btn.classList.toggle('liked', l);
    btn.innerHTML = icon(l ? 'heart' : 'heartO');
  }
}

function refreshNpLike() {
  const track = queue[current];
  const liked = track ? isLiked(track.id) : false;
  btnLike.classList.toggle('liked', liked);
  btnLike.innerHTML = icon(liked ? 'heart' : 'heartO');
  const npxLike = $('npx-like');
  if (npxLike) {
    npxLike.classList.toggle('liked', liked);
    npxLike.innerHTML = icon(liked ? 'heart' : 'heartO');
  }
}

// ---------- generic track row builder ----------
function trackEl(track, onClick, { removable = false, reorderable = false, index = 0, onReorder = null } = {}) {
  const li = document.createElement('li');
  li.className = 'track' + (queue[current]?.id === track.id ? ' playing' : '');
  li.dataset.id = track.id;

  const img = document.createElement('img');
  img.src = track.thumb;
  img.loading = 'lazy';

  const meta = document.createElement('div');
  meta.className = 'meta';
  const t = document.createElement('div');
  t.className = 't-title';
  t.textContent = track.title;
  const c = document.createElement('div');
  c.className = 't-channel';
  c.textContent = track.channel;
  meta.append(t, c);

  li.append(img, meta);

  // animated equalizer shown on whichever track is playing
  const eq = document.createElement('div');
  eq.className = 'eq';
  eq.innerHTML = '<i></i><i></i><i></i>';
  li.append(eq);

  const like = document.createElement('button');
  like.className = 't-like';
  like.dataset.id = track.id;
  like.title = 'Like / Unlike';
  like.innerHTML = icon(isLiked(track.id) ? 'heart' : 'heartO');
  like.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleLike(track);
  });
  li.append(like);

  if (track.duration != null) {
    const d = document.createElement('div');
    d.className = 't-duration';
    d.textContent = fmtTime(track.duration);
    li.append(d);
  }
  if (removable) {
    const x = document.createElement('button');
    x.className = 't-remove';
    x.title = 'Remove from queue';
    x.innerHTML = icon('x');
    x.addEventListener('click', (e) => {
      e.stopPropagation();
      removeAt(queue.indexOf(track));
    });
    li.append(x);
  }
  li.addEventListener('click', onClick);
  li.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openCtxMenu(e.clientX, e.clientY, track);
  });

  // every row is a drag source: drop it on a playlist card (or the Liked rail
  // icon) to add it. Queue rows additionally carry their index for reordering.
  li.draggable = true;
  li.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'copyMove';
    e.dataTransfer.setData('text/openwave-track', JSON.stringify(track));
    if (reorderable) e.dataTransfer.setData('text/openwave-index', String(index));
    li.classList.add('dragging');
  });
  if (reorderable) {
    li.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      li.classList.add('drag-over');
    });
    li.addEventListener('dragleave', () => li.classList.remove('drag-over'));
    li.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      li.classList.remove('drag-over');
      const from = parseInt(e.dataTransfer.getData('text/openwave-index'), 10);
      if (!isNaN(from) && from !== index) (onReorder || moveInQueue)(from, index);
    });
  }
  li.addEventListener('dragend', () => {
    li.classList.remove('dragging');
    document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
  });
  return li;
}

// move a queue entry, keeping the playing track's identity intact
function moveInQueue(from, to) {
  if (from < 0 || from >= queue.length || to < 0 || to >= queue.length) return;
  const [moved] = queue.splice(from, 1);
  queue.splice(to, 0, moved);
  if (current === from) current = to;
  else if (from < current && to >= current) current--;
  else if (from > current && to <= current) current++;
  saveState();
  renderQueueView();
  highlightPlaying();
}

function renderTrackList(container, tracks, opts) {
  container.textContent = '';
  const stagger = staggerNextList; // only on view switches, not every state change
  staggerNextList = false;
  tracks.forEach((track, i) => {
    const el = trackEl(track, () => playTrack(track), { ...opts, index: i });
    if (stagger) el.style.setProperty('--d', Math.min(i * 0.03, 0.3) + 's');
    container.append(el);
  });
}

// shimmer placeholder rows shown while a search is running
function showSkeletons(container, count = 6) {
  container.textContent = '';
  for (let i = 0; i < count; i++) {
    const li = document.createElement('li');
    li.className = 'skeleton-row';
    li.innerHTML = '<div class="sk-thumb"></div><div class="sk-lines"><div class="sk-line w60"></div><div class="sk-line w35"></div></div>';
    container.append(li);
  }
}

// “continue where you left off” hero card on home
function renderResumeHero() {
  const hero = $('resume-hero');
  const r = getResume();
  let track = null;
  if (r && r.id) {
    track = queue.find(t => t.id === r.id)
      || recentlyPlayed.find(t => t.id === r.id)
      || likedSongs.find(t => t.id === r.id);
  }
  // hide while that very track is actively playing (you haven't “left off”)
  if (!track || (queue[current]?.id === track.id && !audio.paused)) {
    hero.hidden = true;
    return;
  }
  hero.hidden = false;
  hero.textContent = '';

  const img = document.createElement('img');
  img.src = track.thumb;
  img.alt = '';

  const info = document.createElement('div');
  info.className = 'rh-info';
  const label = document.createElement('div');
  label.className = 'rh-label';
  label.textContent = 'Continue where you left off';
  const title = document.createElement('div');
  title.className = 'rh-title';
  title.textContent = trunc(track.title, 60);
  const sub = document.createElement('div');
  sub.className = 'rh-sub';
  sub.textContent = `${trunc(track.channel, 40)} · paused at ${fmtTime(r.position || 0)}`;
  info.append(label, title, sub);

  const btn = document.createElement('button');
  btn.className = 'btn-accent';
  btn.innerHTML = `${icon('play')}Resume`;
  btn.addEventListener('click', () => {
    let i = queue.findIndex(t => t.id === track.id);
    if (i === -1) { queue.push({ ...track }); i = queue.length - 1; saveState(); }
    playIndex(i, { startAt: r.position || 0 });
    hero.hidden = true;
    setView('queue');
  });

  hero.append(img, info, btn);
}

// re-render the hero when playback state changes (it reacts to pause/play)
audio.addEventListener('pause', () => { if (view.type === 'home') renderHomeTiles(); });
audio.addEventListener('play', () => { if (view.type === 'home') renderHomeTiles(); });

// friendly empty state instead of a blank list
function emptyState(container, message) {
  const li = document.createElement('li');
  li.className = 'empty-state';
  const ic = document.createElement('div');
  ic.className = 'es-icon';
  ic.innerHTML = icon('note');
  const p = document.createElement('p');
  p.textContent = message;
  li.append(ic, p);
  container.append(li);
}

// ---------- views ----------
// which rail button lights up for each view
let staggerNextList = false;
const NAV_MAP = {
  home: 'home', results: 'home', foryou: 'home', playlist: 'playlists',
  playlists: 'playlists', liked: 'liked', queue: 'queue', settings: 'settings',
};

function setView(type, name = null) {
  view = { type, name };
  staggerNextList = true;
  for (const el of document.querySelectorAll('.view')) el.hidden = true;
  $(`view-${type}`).hidden = false;
  for (const el of document.querySelectorAll('.rail-btn[data-view]')) {
    el.classList.toggle('active', NAV_MAP[type] === el.dataset.view);
  }
  renderView();
}

function renderView() {
  renderRailPlaylists();
  if (view.type === 'home') renderHomeTiles();
  else if (view.type === 'results') renderResultsView();
  else if (view.type === 'foryou') renderForYouView();
  else if (view.type === 'liked') renderLikedView();
  else if (view.type === 'playlists') renderPlaylistsGrid();
  else if (view.type === 'queue') renderQueueView();
  else if (view.type === 'playlist') renderPlaylistView();
  else if (view.type === 'settings') renderSettings();
  highlightPlaying();
}

function highlightPlaying() {
  const id = queue[current]?.id;
  for (const li of document.querySelectorAll('.track')) {
    li.classList.toggle('playing', li.dataset.id === id);
  }
}

// ---------- home dashboard ----------
// hard character caps — guaranteed truncation, immune to layout quirks
function trunc(text, max = 26) {
  return text.length > max ? text.slice(0, max - 1).trimEnd() + '…' : text;
}

function pillRow(textOrTrack, dim = false) {
  const div = document.createElement('div');
  div.className = 'tile-pill' + (dim ? ' dim' : '');
  if (typeof textOrTrack === 'string') {
    div.textContent = trunc(textOrTrack, 34);
  } else {
    // media pill: mini thumbnail + truncated title
    const img = document.createElement('img');
    img.src = textOrTrack.thumb;
    img.loading = 'lazy';
    const span = document.createElement('span');
    span.textContent = trunc(textOrTrack.title, 26);
    span.title = textOrTrack.title; // full name on hover
    div.append(img, span);
  }
  return div;
}

function recTracks() {
  // recent plays first, then liked songs not already included — a simple honest "for you"
  const seen = new Set();
  const out = [];
  for (const t of [...recentlyPlayed, ...likedSongs]) {
    if (!seen.has(t.id)) { seen.add(t.id); out.push(t); }
  }
  return out;
}

function renderHomeTiles() {
  renderResumeHero();

  // greeting header
  const h = new Date().getHours();
  $('greet-hi').textContent = h < 5 ? 'Good night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
  $('greet-sub').textContent = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  // recommendations pills
  tileRecsPills.textContent = '';
  const recs = recTracks();
  if (recs.length) {
    for (const t of recs.slice(0, 2)) tileRecsPills.append(pillRow(t));
  } else {
    tileRecsPills.append(pillRow('Play something to get recommendations', true));
  }

  // liked pills
  tileLikedSub.textContent = likedSongs.length ? `${likedSongs.length} song${likedSongs.length === 1 ? '' : 's'}` : 'Your favorites';
  tileLikedPills.textContent = '';
  if (likedSongs.length) {
    for (const t of likedSongs.slice(0, 2)) tileLikedPills.append(pillRow(t));
  } else {
    tileLikedPills.append(pillRow('Nothing liked yet', true));
  }

  // playlists pills
  tilePlSub.textContent = playlists.length ? `${playlists.length} playlist${playlists.length === 1 ? '' : 's'}` : 'Your collections';
  tilePlPills.textContent = '';
  if (playlists.length) {
    for (const p of playlists.slice(0, 2)) {
      tilePlPills.append(pillRow(`${p.name} · ${p.tracks.length}`));
    }
  } else {
    tilePlPills.append(pillRow('Right-click any song to create one', true));
  }

  renderRecentCards();
  ensureTrending();
}

// small wide cards for horizontal home rows
function mediaCard(track, index = 0) {
  const card = document.createElement('button');
  card.className = 'media-card';
  card.style.setProperty('--d', Math.min(index * 0.04, 0.36) + 's');
  card.draggable = true;
  card.addEventListener('dragstart', (e) => {
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/openwave-track', JSON.stringify(track));
  });
  const img = document.createElement('img');
  img.src = track.thumb;
  img.loading = 'lazy';
  const title = document.createElement('div');
  title.className = 'm-title';
  title.textContent = trunc(track.title, 60);
  const ch = document.createElement('div');
  ch.className = 'm-channel';
  ch.textContent = trunc(track.channel, 40);
  card.append(img, title, ch);
  card.addEventListener('click', () => playTrack(track));
  card.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    openCtxMenu(e.clientX, e.clientY, track);
  });
  return card;
}

function renderRecentCards() {
  const row = $('recent-cards');
  row.textContent = '';
  if (!recentlyPlayed.length) {
    const div = document.createElement('div');
    div.className = 'tile-sub';
    div.textContent = 'Nothing played yet — songs you play will appear here.';
    row.append(div);
    return;
  }
  recentlyPlayed.slice(0, 10).forEach((t, i) => row.append(mediaCard(t, i)));
}

let trendingState = 'idle'; // idle | loading | done | failed
let trendingRetryAt = 0;    // don't hammer yt-dlp after a failure
async function ensureTrending() {
  if (trendingState === 'loading' || trendingState === 'done') return;
  if (trendingState === 'failed' && Date.now() < trendingRetryAt) return;
  trendingRetryAt = Date.now() + 60000;
  const row = $('trending-cards');
  const status = $('trending-status');
  if (musicSource === 'soundcloud') {
    trendingState = 'done';
    status.textContent = 'Trending is a YouTube feature — switch the source toggle (YT/SC) to see it.';
    return;
  }
  trendingState = 'loading';
  status.textContent = 'Loading trending…';
  try {
    const tracks = await window.api.trendingYouTube();
    trendingState = 'done';
    status.textContent = 'YouTube Music · Top 100';
    row.textContent = '';
    tracks.forEach((t, i) => row.append(mediaCard(t, i)));
  } catch {
    trendingState = 'failed';
    row.textContent = '';
    status.textContent = 'Trending is unavailable right now — the charts playlist could not be read.';
  }
}

// tile clicks
for (const tile of document.querySelectorAll('.tile')) {
  tile.addEventListener('click', () => setView(tile.dataset.tile));
}

// rail nav
for (const btn of document.querySelectorAll('.rail-btn[data-view]')) {
  btn.addEventListener('click', () => setView(btn.dataset.view));
}

// ---------- search ----------
function hideSearchHistory() { searchHistoryBox.hidden = true; }

// the dropdown is a body-level fixed element (so its blur isn't clipped by the
// topbar's own backdrop-filter) — place it under the search pill ourselves
function positionSearchHistory() {
  const rect = $('search-wrap').getBoundingClientRect();
  searchHistoryBox.style.left = rect.left + 'px';
  searchHistoryBox.style.top = (rect.bottom + 8) + 'px';
  searchHistoryBox.style.width = rect.width + 'px';
}
window.addEventListener('resize', () => {
  if (!searchHistoryBox.hidden) positionSearchHistory();
});

function renderSearchHistory() {
  if (!searchInput.matches(':focus')) { hideSearchHistory(); return; }
  const q = searchInput.value.trim().toLowerCase();
  const items = q ? searchHistory.filter(h => h.toLowerCase().includes(q)) : searchHistory;
  if (!items.length) { hideSearchHistory(); return; }

  searchHistoryBox.textContent = '';
  for (const h of items) {
    const item = document.createElement('div');
    item.className = 'sh-item';
    item.innerHTML = icon('clock');
    const span = document.createElement('span');
    span.textContent = h;
    item.append(span);
    item.addEventListener('mousedown', (e) => {
      e.preventDefault(); // keep the input focused
      searchInput.value = h;
      hideSearchHistory();
      doSearch(h);
    });
    searchHistoryBox.append(item);
  }
  const clear = document.createElement('div');
  clear.className = 'sh-clear';
  clear.textContent = 'Clear search history';
  clear.addEventListener('mousedown', (e) => {
    e.preventDefault();
    searchHistory = [];
    saveSearchHistory();
    hideSearchHistory();
  });
  searchHistoryBox.append(clear);
  positionSearchHistory();
  searchHistoryBox.hidden = false;
}

searchInput.addEventListener('focus', renderSearchHistory);
searchInput.addEventListener('input', renderSearchHistory);
searchInput.addEventListener('blur', () => setTimeout(hideSearchHistory, 150));

async function doSearch(q) {
  q = q.trim();
  if (!q) return;

  resultsTitle.textContent = `Results for “${q}” (${musicSource === 'soundcloud' ? 'SoundCloud' : 'YouTube'})`;
  resultsList.textContent = '';
  showSkeletons(resultsList);
  setStatus('Searching…', true);
  try {
    searchResults = await window.api.searchTracks(q, musicSource);
    setStatus('');
    if (!searchResults.length) setStatus('No results found.');
  } catch (err) {
    searchResults = [];
    setStatus(`Search failed: ${err.message}`);
  }
  pushSearchHistory(q);
  setView('results');
}
searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  doSearch(searchInput.value);
  searchInput.blur();
});

function renderResultsView() {
  resultsTitle.textContent = resultsTitle.textContent.replace(/\s·\s\d+$/, '')
    + (searchResults.length ? ` · ${searchResults.length}` : '');
  renderTrackList(resultsList, searchResults, {});
  if (!searchResults.length) {
    emptyState(resultsList, 'No results — try different words, or check the artist spelling.');
  }
}

// ---------- recommendations / liked / playlists views ----------
$('foryou-playall').addEventListener('click', () => {
  const recs = recTracks();
  if (!recs.length) { setStatus('Nothing to recommend yet — play something first.'); return; }
  queue = recs.map(t => ({ ...t }));
  current = -1;
  saveState();
  setView('queue');
  playIndex(0);
});

function renderForYouView() {
  const recs = recTracks();
  renderTrackList(foryouList, recs, {});
  if (!recs.length) {
    emptyState(foryouList, 'Play or like a few songs and they will show up here.');
  }
}

function renderLikedView() {
  likedCount.textContent = likedSongs.length ? `· ${likedSongs.length}` : '';
  renderTrackList(likedList, likedSongs.map(t => ({ ...t })), {});
  if (!likedSongs.length) {
    emptyState(likedList, 'Nothing here yet — press L while a song plays, or click the ♡ on any track.');
  }
}

function renderPlaylistsGrid() {
  playlistsGrid.textContent = '';
  plOverviewCount.textContent = playlists.length ? `· ${playlists.length}` : '';
  if (!playlists.length) {
    const div = document.createElement('div');
    div.className = 'empty';
    div.textContent = 'No playlists yet — right-click any song and choose “New playlist…”.';
    playlistsGrid.append(div);
    return;
  }
  for (const pl of playlists) {
    const card = document.createElement('button');
    card.className = 'pl-card';

    const art = document.createElement('div');
    art.className = 'tile-art';
    if (pl.cover) {
      const img = document.createElement('img');
      img.className = 'c-cover';
      img.src = pl.cover;
      art.append(img);
    } else {
      art.innerHTML = icon('note');
    }

    const name = document.createElement('div');
    name.className = 'c-name';
    name.textContent = pl.name;

    const count = document.createElement('div');
    count.className = 'c-count';
    count.textContent = `${pl.tracks.length} song${pl.tracks.length === 1 ? '' : 's'}`;

    card.addEventListener('click', () => setView('playlist', pl.name));
    card.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      openPlaylistCtxMenu(e.clientX, e.clientY, pl);
    });
    // drop target: drag any song from search / queue / liked onto a card
    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      card.classList.add('drop-ready');
    });
    card.addEventListener('dragleave', () => card.classList.remove('drop-ready'));
    card.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      card.classList.remove('drop-ready');
      const track = parseTrackDrag(e);
      if (track) addTrackToPlaylist(pl, track);
    });
    card.append(art, name, count);
    playlistsGrid.append(card);
  }
}

function parseTrackDrag(e) {
  try { return JSON.parse(e.dataTransfer.getData('text/openwave-track')); } catch { return null; }
}

function addTrackToPlaylist(pl, track) {
  if (pl.tracks.some(t => t.id === track.id)) {
    setStatus(`“${trunc(track.title, 30)}” is already in ${pl.name}.`);
    return;
  }
  pl.tracks.push({ ...track });
  savePlaylists();
  if (view.type === 'playlists') renderPlaylistsGrid();
  if (view.type === 'playlist' && view.name === pl.name) renderPlaylistView();
  setStatus(`Added “${trunc(track.title, 30)}” to ${pl.name}.`);
}

// drag a song over a rail destination: it highlights, navigates after a short
// hover, and accepts the drop (playlists view → drop on a card; liked → instant like)
for (const { el, dest } of [
  { el: document.querySelector('.rail-btn[data-view="playlists"]'), dest: 'playlists' },
  { el: document.querySelector('.rail-btn[data-view="liked"]'), dest: 'liked' },
]) {
  if (!el) continue;
  let navTimer = null;
  el.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    el.classList.add('drop-ready');
    if (!navTimer && view.type !== dest) navTimer = setTimeout(() => { setView(dest); navTimer = null; }, 450);
  });
  el.addEventListener('dragleave', () => el.classList.remove('drop-ready'));
  el.addEventListener('dragend', () => { el.classList.remove('drop-ready'); });
  el.addEventListener('drop', (e) => {
    e.preventDefault();
    el.classList.remove('drop-ready');
    if (navTimer) { clearTimeout(navTimer); navTimer = null; }
    const track = parseTrackDrag(e);
    if (!track) return;
    if (dest === 'liked') {
      if (!isLiked(track.id)) { toggleLike(track); setStatus(`Added “${trunc(track.title, 30)}” to ${LIKED}.`); }
      else setStatus(`“${trunc(track.title, 30)}” is already in ${LIKED}.`);
    } else {
      setStatus('Now drop it on a playlist card below.');
    }
  });
}

// ---------- queue ----------
function renderQueueView() {
  const total = queue.reduce((acc, t) => acc + (Number(t.duration) || 0), 0);
  queueCount.textContent = queue.length
    ? `· ${queue.length} ${queue.length === 1 ? 'track' : 'tracks'}${total ? ' · ' + fmtTotal(total) : ''}`
    : '';
  renderTrackList(queueList, queue, { removable: true, reorderable: true });
  if (!queue.length) {
    emptyState(queueList, 'Your queue is empty — search for something, or load a playlist.');
  }
}

// total length like "1h 12m" / "43 min"
function fmtTotal(sec) {
  const h = Math.floor(sec / 3600);
  const m = Math.round((sec % 3600) / 60);
  return h ? `${h}h ${m}m` : `${m} min`;
}

// scroll the view to whatever is playing right now
$('queue-jump-btn').addEventListener('click', () => {
  if (!queue.length) { setStatus('Queue is empty.'); return; }
  const row = queueList.querySelector('.track.playing') || queueList.querySelector('.track');
  if (!row) return;
  row.scrollIntoView({ block: 'center', behavior: 'smooth' });
  row.classList.add('pulse');
  setTimeout(() => row.classList.remove('pulse'), 1300);
});

// playback helpers
function playTrack(track) {
  let i = queue.findIndex(t => t.id === track.id);
  if (i === -1) {
    queue.push({ ...track });
    i = queue.length - 1;
  }
  playIndex(i);
}

function addToQueue(track) {
  if (queue.some(t => t.id === track.id)) {
    setStatus(`“${track.title}” is already in the queue.`);
    return;
  }
  queue.push({ ...track });
  setStatus(`Added “${track.title}” to the queue.`);
  if (view.type === 'queue') renderQueueView();
  saveState();
}

// shuffle the current queue (keeps the playing song first)
$('queue-shuffle-btn').addEventListener('click', () => {
  if (queue.length < 2) { setStatus('Queue is too short to shuffle.'); return; }
  const playingTrack = queue[current];
  const rest = queue.filter((_, i) => i !== current);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [rest[i], rest[j]] = [rest[j], rest[i]];
  }
  queue = playingTrack ? [playingTrack, ...rest] : rest;
  current = playingTrack ? 0 : -1;
  saveState();
  if (view.type === 'queue') renderQueueView();
  setStatus('Queue shuffled.');
});

// settings page (rail bottom button)
$('rail-settings').addEventListener('click', () => setView('settings'));

// expand / collapse the sidebar
function applyRail() {
  document.body.classList.toggle('rail-expanded', localStorage.getItem('openwave:rail') === 'wide');
}
$('rail-expand').addEventListener('click', () => {
  const wide = document.body.classList.toggle('rail-expanded');
  localStorage.setItem('openwave:rail', wide ? 'wide' : 'slim');
});

// ---------- settings page logic ----------
function renderSettings() {
  // theme segmented control
  for (const b of document.querySelectorAll('#theme-seg button')) {
    b.classList.toggle('active', (settings.theme || 'dark') === b.dataset.theme);
  }
  // roundness segmented control
  for (const b of document.querySelectorAll('#round-seg button')) {
    b.classList.toggle('active', (settings.roundness || 'default') === b.dataset.round);
  }
  const sw = $('accent-swatches');
  sw.textContent = '';
  for (const c of ACCENT_PRESETS) {
    const b = document.createElement('button');
    b.className = 'swatch' + (settings.accent.toLowerCase() === c ? ' active' : '');
    b.style.background = c;
    b.title = c;
    b.addEventListener('click', () => {
      settings.accent = c;
      saveSettings();
      applySettings();
      renderSettings();
    });
    sw.append(b);
  }
  $('accent-custom').value = /^#[0-9a-f]{6}$/i.test(settings.accent) ? settings.accent : '#a5a6f6';
  $('set-autoplay').checked = settings.autoplayNext;

  // YouTube cookies preference
  const cookieSelect = $('cookie-select');
  const saved = localStorage.getItem('openwave:ytcookies');
  if (saved) cookieSelect.value = saved;
  window.api.getYtCookies().then((v) => {
    if (v) { cookieSelect.value = v; localStorage.setItem('openwave:ytcookies', v); }
  });
}

for (const btn of document.querySelectorAll('.set-nav')) {
  btn.addEventListener('click', () => {
    for (const b of document.querySelectorAll('.set-nav')) b.classList.toggle('active', b === btn);
    for (const p of document.querySelectorAll('.set-pane')) p.hidden = p.id !== `pane-${btn.dataset.pane}`;
  });
}

$('accent-custom').addEventListener('input', (e) => {
  const c = e.target.value;
  if (!/^#[0-9a-f]{6}$/i.test(c)) return;
  settings.accent = c;
  saveSettings();
  applySettings();
  renderSettings();
});

$('set-autoplay').addEventListener('change', (e) => {
  settings.autoplayNext = e.target.checked;
  saveSettings();
  setStatus(settings.autoplayNext ? 'Autoplay enabled.' : 'Playback will stop after the last song.');
});

$('cookie-select').addEventListener('change', async (e) => {
  const v = e.target.value;
  localStorage.setItem('openwave:ytcookies', v);
  await window.api.setYtCookies(v);
  setStatus(v === 'none'
    ? 'YouTube cookies disabled.'
    : `Using YouTube session from ${v}. Close ${v} fully first if it still fails.`);
});

for (const b of document.querySelectorAll('#theme-seg button')) {
  b.addEventListener('click', () => {
    settings.theme = b.dataset.theme;
    saveSettings();
    applySettings();
    renderSettings();
    setStatus(settings.theme === 'light' ? 'Light mode on ☀' : settings.theme === 'oled' ? 'OLED mode on — enjoy the blacks.' : 'Dark mode on ☾');
  });
}

for (const b of document.querySelectorAll('#round-seg button')) {
  b.addEventListener('click', () => {
    settings.roundness = b.dataset.round;
    saveSettings();
    applySettings();
    renderSettings();
  });
}

// storage clears — two clicks to confirm, then wipe
for (const btn of document.querySelectorAll('[data-clear]')) {
  const orig = btn.textContent;
  btn.addEventListener('click', () => {
    if (!btn.classList.contains('armed')) {
      btn.classList.add('armed');
      btn.textContent = 'Sure?';
      setTimeout(() => { btn.classList.remove('armed'); btn.textContent = orig; }, 3000);
      return;
    }
    const what = btn.dataset.clear;
    if (what === 'recent') {
      recentlyPlayed = [];
      saveRecent();
    } else if (what === 'liked') {
      likedSongs = [];
      saveLiked();
      refreshHearts();
      refreshNpLike();
    } else if (what === 'playlists') {
      playlists = [];
      savePlaylists();
    } else if (what === 'all') {
      stopPlayback();
      for (const k of ['openwave:state', 'openwave:playlists', 'openwave:liked', 'openwave:recent', 'openwave:volume', 'openwave:settings']) {
        localStorage.removeItem(k);
      }
      location.reload();
      return;
    }
    btn.classList.remove('armed');
    btn.textContent = orig;
    renderView();
    setStatus('Done.');
  });
}

// window controls (top bar buttons)
$('btn-minimize').addEventListener('click', () => window.api.windowControls.minimize());
$('btn-close').addEventListener('click', () => window.api.windowControls.close());
$('btn-maximize').addEventListener('click', () => window.api.windowControls.maximize());
// On Linux nothing maximizes a frameless drag region, so do it here.
// Windows/macOS already handle it at the native caption level — hooking it
// there too would maximize and immediately restore on a double-click.
if (window.api.platform === 'linux') {
  $('topbar').addEventListener('dblclick', (e) => {
    if (e.target.closest('button, input, form, a')) return;
    window.api.windowControls.maximize();
  });
}

// playlists overview: create empty playlist
$('pl-new-btn').addEventListener('click', () => {
  plNewForm.hidden = false;
  plNewName.focus();
});
$('pl-new-cancel').addEventListener('click', () => {
  plNewForm.hidden = true;
  plNewName.value = '';
});
plNewForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = plNewName.value.trim();
  if (!name || name === LIKED) return;
  if (playlists.some(p => p.name === name)) {
    setStatus(`A playlist called “${name}” already exists.`);
    return;
  }
  playlists.push({ name, tracks: [] });
  savePlaylists();
  plNewForm.hidden = true;
  plNewName.value = '';
  setView('playlist', name);
});
// ---------- context menu ----------
function ctxItem(label, onClick, iconName = '', iconSvg = '') {
  const el = document.createElement('div');
  el.className = 'ctx-item';
  const i = document.createElement('span');
  i.className = 'ci-icon';
  i.innerHTML = iconSvg || (iconName ? icon(iconName) : '');
  const span = document.createElement('span');
  span.textContent = label;
  el.append(i, span);
  el.addEventListener('click', onClick);
  return el;
}

function ctxSep() {
  const el = document.createElement('div');
  el.className = 'ctx-sep';
  return el;
}

function ctxDim(label) {
  const el = ctxItem(label, null);
  el.classList.add('dim');
  el.style.pointerEvents = 'none';
  return el;
}

function closeCtxMenu() {
  ctxmenu.hidden = true;
  ctxmenu.textContent = '';
}

function openCtxMenu(x, y, track) {
  closeCtxMenu();

  ctxmenu.append(ctxItem('Play now', () => playTrack(track), 'play'));
  ctxmenu.append(ctxItem('Play next', () => {
    if (!queue.some(t => t.id === track.id)) {
      queue.splice(current + 1, 0, { ...track });
    } else {
      // already queued: move it to right after the current song
      const i = queue.findIndex(t => t.id === track.id);
      const [t] = queue.splice(i, 1);
      queue.splice(Math.max(current + (i <= current ? 1 : 0), 0), 0, t);
    }
    saveState();
    if (view.type === 'queue') renderQueueView();
    setStatus(`“${track.title}” plays next.`);
  }, 'plus'));
  ctxmenu.append(ctxItem('Add to queue', () => addToQueue(track), 'plus'));

  ctxmenu.append(ctxSep());
  ctxmenu.append(ctxDim('Add to playlist'));

  ctxmenu.append(ctxItem(
    isLiked(track.id) ? `Remove from ${LIKED}` : LIKED,
    () => toggleLike(track),
    '',
    icon(isLiked(track.id) ? 'heart' : 'heartO')
  ));
  for (const pl of playlists) {
    ctxmenu.append(ctxItem(pl.name, () => {
      pl.tracks.push({ ...track });
      savePlaylists();
      renderView();
      setStatus(`Added “${track.title}” to “${pl.name}”.`);
    }, 'note'));
  }
  ctxmenu.append(ctxItem('New playlist…', () => showCtxNewPlaylist(track), 'plus'));

  ctxmenu.style.left = '-9999px';
  ctxmenu.style.top = '0';
  ctxmenu.hidden = false;
  const r = ctxmenu.getBoundingClientRect();
  if (x + r.width > innerWidth - 8) x = innerWidth - r.width - 8;
  if (y + r.height > innerHeight - 8) y = innerHeight - r.height - 8;
  ctxmenu.style.left = `${x}px`;
  ctxmenu.style.top = `${y}px`;
}

function openPlaylistCtxMenu(x, y, pl) {
  closeCtxMenu();
  ctxmenu.append(ctxItem('Open', () => setView('playlist', pl.name), 'note'));
  ctxmenu.append(ctxItem('Edit name / image', () => openPlaylistEditor(pl.name), 'note'));
  ctxmenu.append(ctxItem('Play all', () => {
    if (!pl.tracks.length) { setStatus('This playlist is empty.'); return; }
    queue = pl.tracks.map(t => ({ ...t }));
    current = -1;
    saveState();
    setView('queue');
    playIndex(0);
  }, 'play'));
  ctxmenu.append(ctxSep());
  ctxmenu.append(ctxItem('Delete playlist', () => {
    playlists = playlists.filter(p => p !== pl);
    savePlaylists();
    if (view.type === 'playlist' && view.name === pl.name) setView('playlists');
    else renderView();
    setStatus(`Deleted “${pl.name}”.`);
  }, 'x'));

  ctxmenu.style.left = '-9999px';
  ctxmenu.style.top = '0';
  ctxmenu.hidden = false;
  const r = ctxmenu.getBoundingClientRect();
  if (x + r.width > innerWidth - 8) x = innerWidth - r.width - 8;
  if (y + r.height > innerHeight - 8) y = innerHeight - r.height - 8;
  ctxmenu.style.left = `${x}px`;
  ctxmenu.style.top = `${y}px`;
}

function showCtxNewPlaylist(track) {
  closeCtxMenu();
  ctxmenu.hidden = false;
  ctxmenu.style.left = `${innerWidth / 2 - 130}px`;
  ctxmenu.style.top = `${innerHeight / 3}px`;

  const row = document.createElement('div');
  row.id = 'ctx-input-row';
  const input = document.createElement('input');
  input.id = 'ctx-input';
  input.placeholder = 'Playlist name…';
  input.maxLength = 40;
  const ok = document.createElement('button');
  ok.textContent = 'Create';
  ok.addEventListener('click', () => {
    const name = input.value.trim();
    if (!name || name === LIKED) return;
    let pl = playlists.find(p => p.name === name);
    if (!pl) {
      pl = { name, tracks: [] };
      playlists.push(pl);
    }
    pl.tracks.push({ ...track });
    savePlaylists();
    renderView();
    closeCtxMenu();
    setStatus(`Added “${track.title}” to “${name}”.`);
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); ok.click(); }
  });
  row.append(input, ok);
  ctxmenu.append(row);
  input.focus();
}

document.addEventListener('click', closeCtxMenu);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    closeCtxMenu();
    if (!plEditOverlay.hidden) closePlaylistEditor();
    if (typeof npExpand !== 'undefined' && !npExpand.hidden) closeNpExpand();
    $('kbd-overlay').hidden = true;
  }
});
window.addEventListener('blur', closeCtxMenu);

// ---------- playlist editor ----------
let editingPlaylist = null;
let pendingCover = null;

function openPlaylistEditor(name) {
  const pl = playlists.find(p => p.name === name);
  if (!pl) return;
  editingPlaylist = pl;
  pendingCover = pl.cover || null;
  plEditName.value = pl.name;
  updateCoverPreview();
  plEditOverlay.hidden = false;
  plEditName.focus();
}

function closePlaylistEditor() {
  plEditOverlay.hidden = true;
  editingPlaylist = null;
  pendingCover = null;
  plEditFile.value = '';
}

function updateCoverPreview() {
  if (pendingCover) {
    plEditCoverImg.src = pendingCover;
    plEditCoverImg.hidden = false;
    plEditCoverPh.hidden = true;
    plEditCoverRemove.hidden = false;
  } else {
    plEditCoverImg.hidden = true;
    plEditCoverPh.hidden = false;
    plEditCoverRemove.hidden = true;
  }
}

plEditBtn.addEventListener('click', () => openPlaylistEditor(view.name));
plEditCancel.addEventListener('click', closePlaylistEditor);

plEditCoverBtn.addEventListener('click', () => plEditFile.click());
plEditCoverRemove.addEventListener('click', () => {
  pendingCover = null;
  updateCoverPreview();
});

// pick an image, downscale it so it stays small in storage, preview it
plEditFile.addEventListener('change', () => {
  const file = plEditFile.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    const img = new Image();
    img.onload = () => {
      const max = 400; // plenty for a cover, tiny in storage
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      pendingCover = canvas.toDataURL('image/jpeg', 0.85);
      updateCoverPreview();
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
  plEditFile.value = '';
});

plEditSave.addEventListener('click', () => {
  if (!editingPlaylist) return;
  const newName = plEditName.value.trim();
  if (!newName || newName === LIKED) return;
  if (newName !== editingPlaylist.name && playlists.some(p => p.name === newName)) {
    setStatus(`A playlist called “${newName}” already exists.`);
    return;
  }
  editingPlaylist.name = newName;
  if (pendingCover) editingPlaylist.cover = pendingCover;
  else delete editingPlaylist.cover;
  savePlaylists();
  const wasOpen = view.type === 'playlist' && view.name === editingPlaylist.name;
  closePlaylistEditor();
  if (wasOpen) {
    view.name = newName;
    renderView();
  } else {
    renderView();
  }
  renderHomeTiles();
  setStatus('Playlist updated.');
});

// click on the dark backdrop also closes the editor
plEditOverlay.addEventListener('mousedown', (e) => {
  if (e.target === plEditOverlay) closePlaylistEditor();
});

// ---------- playlist view ----------
function renderPlaylistView() {
  const pl = playlists.find(p => p.name === view.name);
  if (!pl) { setView('home'); return; }
  plTitle.textContent = pl.name;
  plCount.textContent = pl.tracks.length ? `· ${pl.tracks.length}` : '';
  renderTrackList(playlistViewList, pl.tracks.map(t => ({ ...t })), {
    reorderable: true,
    onReorder: (from, to) => {
      const target = playlists.find(p => p.name === view.name);
      if (!target) return;
      const [moved] = target.tracks.splice(from, 1);
      target.tracks.splice(to, 0, moved);
      savePlaylists();
      renderPlaylistView();
    },
  });
}

$('pl-playall').addEventListener('click', () => {
  const pl = playlists.find(p => p.name === view.name);
  if (!pl || !pl.tracks.length) { setStatus('This playlist is empty.'); return; }
  queue = pl.tracks.map(t => ({ ...t }));
  current = -1;
  saveState();
  setView('queue');
  playIndex(0);
});

// liked play all
$('liked-playall').addEventListener('click', () => {
  if (!likedSongs.length) { setStatus('No liked songs yet.'); return; }
  queue = likedSongs.map(t => ({ ...t }));
  current = -1;
  saveState();
  setView('queue');
  playIndex(0);
});

// ---------- queue view actions ----------
clearQueueBtn.addEventListener('click', () => {
  stopPlayback();
  queue = [];
  current = -1;
  localStorage.removeItem('openwave:resume');
  saveState();
  renderQueueView();
  highlightPlaying();
});

queueSaveBtn.addEventListener('click', () => {
  if (!queue.length) {
    setStatus('Queue is empty — add some songs first.');
    return;
  }
  queueSaveForm.hidden = false;
  queueSaveName.focus();
});

queueSaveCancel.addEventListener('click', () => {
  queueSaveForm.hidden = true;
  queueSaveName.value = '';
});

queueSaveForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const name = queueSaveName.value.trim();
  if (!name || name === LIKED) return;
  const existing = playlists.findIndex(p => p.name === name);
  const snapshot = queue.map(t => ({ ...t }));
  if (existing !== -1) {
    playlists[existing].tracks = snapshot;
  } else {
    playlists.push({ name, tracks: snapshot });
  }
  savePlaylists();
  renderView();
  queueSaveForm.hidden = true;
  queueSaveName.value = '';
  setStatus(`Playlist “${name}” saved.`);
});

function getResume() {
  try { return JSON.parse(localStorage.getItem('openwave:resume')); } catch { return null; }
}

// ---------- playback ----------
async function playIndex(i, { startAt = null } = {}) {
  if (i < 0 || i >= queue.length) return;
  const track = queue[i];
  current = i;
  pendingSeek = startAt;
  saveState();
  pushRecent(track);

  // spinner on the row while the stream resolves
  const loadingRow = document.querySelector(`.track[data-id="${CSS.escape(track.id)}"]`);
  if (loadingRow) loadingRow.classList.add('loading');

  npTitle.textContent = track.title;
  npChannel.textContent = track.channel;
  if (track.thumb) {
    npThumb.onerror = () => { npThumb.onerror = null; };
    npThumb.src = track.thumb;
  } else {
    npThumb.src = `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
  }
  npThumb.hidden = false;
  document.title = `${track.title} · ${track.channel} — OpenWave`;
  btnPlay.innerHTML = icon('play');
  setStatus(`Loading “${track.title}”…`, true);

  try {
    const localUrl = await window.api.resolveStream(track);
    const loadingRow = document.querySelector(`.track[data-id="${CSS.escape(track.id)}"]`);
    if (loadingRow) loadingRow.classList.remove('loading');
    audio.src = localUrl;
    audio.play();
    setStatus('');
    if (!npExpand.hidden) fillNpExpand();
    // resolve the next song in the background — song switches become instant
    const repeat = localStorage.getItem('openwave:repeat');
    const nxt = repeat === 'one' ? null : queue[current + 1];
    if (nxt) window.api.prewarmStream(nxt).catch(() => {});
  } catch (err) {
    const loadingRow = document.querySelector(`.track[data-id="${CSS.escape(track.id)}"]`);
    if (loadingRow) loadingRow.classList.remove('loading');
    setStatus(`Couldn't play “${track.title}”: ${err.message}`);
    btnPlay.innerHTML = icon('play');
  }
  refreshNpLike();
  highlightPlaying();
  if (view.type === 'queue') renderQueueView();
}

function stopPlayback() {
  audio.pause();
  audio.removeAttribute('src');
  audio.load();
  btnPlay.innerHTML = icon('play');
  npTitle.textContent = 'Now playing';
  npChannel.textContent = '';
  npThumb.hidden = true;
  npThumb.classList.remove('playing');
  document.title = 'OpenWave';
  seek.value = 0;
  seek.style.removeProperty('--buffered');
  timeCurrent.textContent = '0:00';
  timeTotal.textContent = '0:00';
  refreshNpLike();
  updateRangeFill(seek);
}

function togglePlay() {
  if (!audio.src) {
    // resuming a saved session: resolve the stream and jump to the saved position
    if (queue[current]) {
      const r = getResume();
      playIndex(current, { startAt: r && r.id === queue[current].id ? (r.position || 0) : null });
    }
    return;
  }
  if (audio.paused) audio.play();
  else audio.pause();
}

function next() { playIndex(current + 1); }
function prev() {
  if (audio.currentTime > 3) { audio.currentTime = 0; return; }
  playIndex(current - 1);
}

audio.addEventListener('play', () => {
  btnPlay.innerHTML = icon('pause');
  npThumb.classList.add('playing');
  const npxPlay = $('npx-play');
  if (npxPlay) npxPlay.innerHTML = icon('pause');
  if (!audioCtx) ensureAnalyser();
  audioCtx?.resume?.();
});
audio.addEventListener('pause', () => {
  btnPlay.innerHTML = icon('play');
  npThumb.classList.remove('playing');
  const npxPlay = $('npx-play');
  if (npxPlay) npxPlay.innerHTML = icon('play');
});
audio.addEventListener('ended', () => {
  if (repeatMode === 'one') {
    audio.currentTime = 0;
    audio.play();
    return;
  }
  if (!settings.autoplayNext) {
    stopPlayback();
    return;
  }
  if (repeatMode === 'all' && current === queue.length - 1) playIndex(0);
  else next();
});

// ---------- repeat & mute ----------
let repeatMode = localStorage.getItem('openwave:repeat') || 'off';

function applyRepeat() {
  btnRepeat.classList.toggle('active', repeatMode !== 'off');
  btnRepeat.title = `Repeat: ${repeatMode} (R)`;
  btnRepeat.innerHTML = icon('repeat') + (repeatMode === 'one' ? '<span class="r-one">1</span>' : '');
  localStorage.setItem('openwave:repeat', repeatMode);
}

btnRepeat.addEventListener('click', () => {
  repeatMode = repeatMode === 'off' ? 'all' : repeatMode === 'all' ? 'one' : 'off';
  applyRepeat();
  setStatus(repeatMode === 'off' ? 'Repeat off.' : repeatMode === 'all' ? 'Repeating the whole queue.' : 'Repeating this song.');
});
applyRepeat();

function updateMuteIcon() {
  const muted = audio.muted || audio.volume === 0;
  btnMute.classList.toggle('muted', muted);
  btnMute.innerHTML = icon(muted ? 'mute' : 'volume');
  btnMute.title = muted ? 'Unmute (M)' : 'Mute (M)';
}

btnMute.addEventListener('click', () => {
  audio.muted = !audio.muted;
  updateMuteIcon();
});
updateMuteIcon();

audio.addEventListener('loadedmetadata', () => {
  if (pendingSeek != null && isFinite(audio.duration) && audio.duration > 0) {
    try { audio.currentTime = Math.min(pendingSeek, Math.max(audio.duration - 1, 0)); } catch { /* ignore */ }
    pendingSeek = null;
  }
});

// stream URLs can expire between sessions — retry once with a fresh resolve
audio.addEventListener('error', () => {
  const track = queue[current];
  if (!track || !audio.src) return;
  audio.removeAttribute('src');
  playIndex(current);
});

function removeAt(i) {
  queue.splice(i, 1);
  if (i < current) {
    current--;
  } else if (i === current) {
    const wasPlaying = !audio.paused;
    current = Math.min(current, queue.length - 1);
    if (current >= 0 && wasPlaying) {
      playIndex(current);
    } else if (current < 0) {
      stopPlayback();
    }
  }
  saveState();
  renderQueueView();
  highlightPlaying();
}

// ---------- player bar interactions ----------
btnLike.addEventListener('click', () => {
  toggleLike(queue[current]);
  btnLike.classList.remove('pop');
  void btnLike.offsetWidth; // restart the animation
  btnLike.classList.add('pop');
});
btnPlay.addEventListener('click', togglePlay);
btnNext.addEventListener('click', next);
btnPrev.addEventListener('click', prev);

audio.addEventListener('timeupdate', () => {
  if (!isSeeking && isFinite(audio.duration)) {
    seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
    updateRangeFill(seek);
    timeCurrent.textContent = fmtTime(audio.currentTime);
    updateTimeTotal();
    updateBuffered();
    if (!npExpand.hidden && !npxSeeking) {
      const ns = $('npx-seek');
      ns.value = Math.round((audio.currentTime / audio.duration) * 1000);
      updateRangeFill(ns);
      $('npx-t-cur').textContent = fmtTime(audio.currentTime);
      $('npx-t-total').textContent = fmtTime(audio.duration);
    }
  }

  if (!npExpand.hidden && lyricsTab === 'lyrics') updateLyricHighlight();

  if (isSeeking || !isFinite(audio.duration)) return;

  // remember playback position so the next launch resumes here (every ~5s)
  const now = Date.now();
  if (queue[current] && now - lastResumeSave > 5000) {
    lastResumeSave = now;
    localStorage.setItem('openwave:resume', JSON.stringify({
      id: queue[current].id,
      position: audio.currentTime || 0,
      duration: audio.duration || queue[current].duration || 0,
    }));
  }
});

// buffered-range indicator on the seek bar
function updateBuffered() {
  if (!isFinite(audio.duration) || !audio.buffered || !audio.buffered.length) return;
  const end = audio.buffered.end(audio.buffered.length - 1);
  seek.style.setProperty('--buffered', Math.min(100, (end / audio.duration) * 100) + '%');
}
audio.addEventListener('progress', updateBuffered);
audio.addEventListener('loadedmetadata', updateBuffered);

// click the total time to flip between total and remaining (-m:ss)
let showRemaining = localStorage.getItem('openwave:timermode') === 'remaining';
timeTotal.classList.add('clickable');
timeTotal.title = 'Click to toggle remaining time';
function updateTimeTotal() {
  if (showRemaining && isFinite(audio.duration)) {
    timeTotal.textContent = '-' + fmtTime(Math.max(0, audio.duration - audio.currentTime));
  } else {
    timeTotal.textContent = fmtTime(audio.duration);
  }
}
timeTotal.addEventListener('click', () => {
  showRemaining = !showRemaining;
  localStorage.setItem('openwave:timermode', showRemaining ? 'remaining' : 'total');
  updateTimeTotal();
});

// paint the filled portion of a slider via --fill (used by the track gradient)
function updateRangeFill(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--fill', pct + '%');
}

seek.addEventListener('input', () => { isSeeking = true; updateRangeFill(seek); });seek.addEventListener('change', () => {
  if (isFinite(audio.duration)) {
    audio.currentTime = (seek.value / 1000) * audio.duration;
  }
  isSeeking = false;
  updateRangeFill(seek);
});

// hover the seek bar for a time preview at the cursor
function attachSeekPreview(input) {
  const tip = document.createElement('div');
  tip.className = 'seek-tip';
  tip.hidden = true;
  document.body.append(tip);
  input.addEventListener('mousemove', (e) => {
    if (!isFinite(audio.duration)) { tip.hidden = true; return; }
    const rect = input.getBoundingClientRect();
    const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    tip.textContent = fmtTime(ratio * audio.duration);
    tip.style.left = Math.round(e.clientX) + 'px';
    tip.style.top = Math.round(rect.top - 34) + 'px';
    tip.hidden = false;
  });
  input.addEventListener('mouseleave', () => { tip.hidden = true; });
}
attachSeekPreview(seek);
attachSeekPreview($('npx-seek'));

volume.addEventListener('input', () => {
  if (audio.muted && volume.value > 0) audio.muted = false; // moving the slider unmutes
  audio.volume = volume.value / 100;
  localStorage.setItem('openwave:volume', volume.value);
  updateRangeFill(volume);
  updateMuteIcon();
});

function nudgeVolume(delta) {
  const v = Math.min(100, Math.max(0, Number(volume.value) + delta));
  if (audio.muted && v > 0) audio.muted = false;
  volume.value = v;
  audio.volume = v / 100;
  localStorage.setItem('openwave:volume', String(v));
  updateRangeFill(volume);
  updateMuteIcon();
  setStatus(`Volume ${v}%`);
}
audio.volume = (Number(localStorage.getItem('openwave:volume')) || 80) / 100;
volume.value = audio.volume * 100;
updateRangeFill(volume);

// keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
  else if (e.key === 'n') next();
  else if (e.key === 'p') prev();
  else if (e.key === 'l') toggleLike(queue[current]);
  else if (e.key === 'r') btnRepeat.click();
  else if (e.key === 'm') btnMute.click();
  else if (e.key === 'z') cycleSleepTimer();
  else if (e.key === 'e') openNpExpand();
  else if (e.key === '?') { const k = $('kbd-overlay'); k.hidden = !k.hidden; }
  else if (e.key === 'ArrowRight' && isFinite(audio.duration)) { e.preventDefault(); audio.currentTime = Math.min(audio.duration, audio.currentTime + 5); }
  else if (e.key === 'ArrowLeft' && isFinite(audio.duration)) { e.preventDefault(); audio.currentTime = Math.max(0, audio.currentTime - 5); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); nudgeVolume(5); }
  else if (e.key === 'ArrowDown') { e.preventDefault(); nudgeVolume(-5); }
});

$('kbd-overlay').addEventListener('click', (e) => {
  if (e.target === $('kbd-overlay')) $('kbd-overlay').hidden = true;
});

// ---------- expanded now playing + audio visualizer ----------
const npExpand = $('np-expand');
let npxSeeking = false;

function openNpExpand() {
  const track = queue[current];
  if (!track) { setStatus('Play something first.'); return; }
  fillNpExpand();
  npExpand.hidden = false;
  startViz();
}

function fillNpExpand() {
  const track = queue[current];
  if (!track) return;
  $('npx-title').textContent = track.title;
  $('npx-channel').textContent = track.channel;
  $('npx-thumb').src = track.thumb || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
  $('npx-play').innerHTML = icon(audio.paused ? 'play' : 'pause');
  refreshNpLike();
  renderNpxQueue();
  loadLyrics(track);
  updateLyricHighlight(true);
}

function renderNpxQueue() {
  renderTrackList($('npx-queue-list'), queue, { removable: true });
}

// ---------- lyrics (lrclib, time-synced when available) ----------
let lyricsFor = null;   // track id the panel currently belongs to
let lyricsLines = [];   // [{ t, text }] — empty when only plain lyrics exist
let lyricsIndex = -1;
let lyricsTab = 'queue';

function parseLrc(lrc) {
  const stamp = /\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g;
  const lines = [];
  for (const raw of String(lrc).split('\n')) {
    const times = [...raw.matchAll(stamp)];
    if (!times.length) continue;
    const text = raw.replace(stamp, '').trim();
    if (!text) continue;
    for (const m of times) {
      const frac = m[3] ? Number('0.' + m[3]) : 0;
      lines.push({ t: Number(m[1]) * 60 + Number(m[2]) + frac, text });
    }
  }
  lines.sort((a, b) => a.t - b.t);
  return lines;
}

function setNpxTab(tab) {
  lyricsTab = tab;
  $('npx-tab-queue').classList.toggle('active', tab === 'queue');
  $('npx-tab-lyrics').classList.toggle('active', tab === 'lyrics');
  $('npx-pane-queue').hidden = tab !== 'queue';
  $('npx-pane-lyrics').hidden = tab !== 'lyrics';
  if (tab === 'lyrics') updateLyricHighlight(true);
}

function updateLyricHighlight(force = false) {
  if (!lyricsLines.length) return;
  const t = audio.currentTime;
  let i = -1;
  while (i + 1 < lyricsLines.length && lyricsLines[i + 1].t <= t + 0.2) i++;
  if (i === lyricsIndex && !force) return;
  lyricsIndex = i;

  const box = $('npx-lyrics');
  const kids = box.children;
  for (let k = 0; k < kids.length; k++) kids[k].classList.toggle('now', k === i);
  const active = kids[i];
  if (active && !$('npx-pane-lyrics').hidden) {
    const top = active.offsetTop - box.clientHeight / 2 + active.clientHeight / 2;
    box.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }
}

function renderLyrics(res) {
  const box = $('npx-lyrics');
  const note = $('npx-lyrics-empty');
  box.textContent = '';
  lyricsLines = [];
  lyricsIndex = -1;
  $('npx-lyrics-dot').hidden = true;

  if (!res) {
    note.hidden = false;
    note.textContent = 'No lyrics found for this track.';
    return;
  }
  if (res.synced) lyricsLines = parseLrc(res.synced);

  if (lyricsLines.length) {
    note.hidden = true;
    for (const line of lyricsLines) {
      const div = document.createElement('div');
      div.className = 'npx-lyric';
      div.textContent = line.text;
      box.append(div);
    }
    $('npx-lyrics-dot').hidden = false;
  } else if (res.plain) {
    note.hidden = true;
    for (const line of res.plain.split('\n')) {
      const div = document.createElement('div');
      div.className = 'npx-lyric static';
      div.textContent = line.trim() || ' ';
      box.append(div);
    }
  } else {
    note.hidden = false;
    note.textContent = res.instrumental ? 'Instrumental — nothing to sing along to.' : 'No lyrics found for this track.';
  }
  updateLyricHighlight(true);
}

async function loadLyrics(track) {
  if (!track || !track.id) return;
  if (lyricsFor === track.id) return;
  lyricsFor = track.id;

  const box = $('npx-lyrics');
  const note = $('npx-lyrics-empty');
  box.textContent = '';
  lyricsLines = [];
  lyricsIndex = -1;
  note.hidden = false;
  note.textContent = 'Looking for lyrics…';
  $('npx-lyrics-dot').hidden = true;

  let res = null;
  try {
    res = await window.api.findLyrics({ title: track.title, channel: track.channel, duration: track.duration });
  } catch { res = null; }
  if (lyricsFor !== track.id) return; // switched songs while we were looking
  renderLyrics(res);
}

$('npx-tab-queue').addEventListener('click', () => setNpxTab('queue'));
$('npx-tab-lyrics').addEventListener('click', () => setNpxTab('lyrics'));

// ---------- sleep timer ----------
const SLEEP_STEPS = [0, 15, 30, 45, 60, 90];
let sleepStep = 0;
let sleepEndsAt = 0;
let sleepTick = 0;
let sleepFade = 0;

function sleepCountdown() {
  const s = Math.max(0, Math.ceil((sleepEndsAt - Date.now()) / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function refreshSleep() {
  btnSleep.classList.toggle('active', !!sleepEndsAt);
  btnSleep.title = sleepEndsAt ? 'Sleep in ' + sleepCountdown() + ' (Z)' : 'Sleep timer (Z)';
}

function clearSleepFade() {
  if (sleepFade) { clearInterval(sleepFade); sleepFade = 0; }
}

function stopSleepTimer() {
  clearInterval(sleepTick);
  sleepTick = 0;
  sleepEndsAt = 0;
  refreshSleep();
}

function sleepNow() {
  stopSleepTimer();
  clearSleepFade();
  const level = audio.volume;
  const steps = 32;
  let step = 0;
  setStatus('Sleep timer — fading out…', true);
  sleepFade = setInterval(() => {
    step++;
    audio.volume = Math.max(0, level * (1 - step / steps));
    if (step < steps) return;
    clearSleepFade();
    audio.pause();
    audio.volume = level;
    setStatus('Sleep timer — paused. Good night.');
  }, 180);
}

function setSleepTimer(minutes) {
  stopSleepTimer();
  clearSleepFade();
  if (!minutes) { setStatus('Sleep timer off.'); return; }
  sleepEndsAt = Date.now() + minutes * 60000;
  refreshSleep();
  setStatus('Sleep timer set for ' + minutes + ' minutes.');
  sleepTick = setInterval(() => {
    if (Date.now() >= sleepEndsAt) sleepNow();
    else refreshSleep();
  }, 1000);
}

function cycleSleepTimer() {
  sleepStep = (sleepStep + 1) % SLEEP_STEPS.length;
  setSleepTimer(SLEEP_STEPS[sleepStep]);
}

btnSleep.addEventListener('click', cycleSleepTimer);
refreshSleep();

function closeNpExpand() {
  npExpand.hidden = true;
  stopViz();
}

$('np-thumb').addEventListener('click', openNpExpand);
$('npx-close').addEventListener('click', closeNpExpand);
$('npx-play').addEventListener('click', togglePlay);
$('npx-prev').addEventListener('click', prev);
$('npx-next').addEventListener('click', next);
$('npx-like').addEventListener('click', () => toggleLike(queue[current]));

$('npx-seek').addEventListener('input', () => { npxSeeking = true; updateRangeFill($('npx-seek')); });
$('npx-seek').addEventListener('change', () => {
  if (isFinite(audio.duration)) audio.currentTime = ($('npx-seek').value / 1000) * audio.duration;
  npxSeeking = false;
  updateRangeFill($('npx-seek'));
});

// visualizer: a Web Audio analyser taps the localhost proxy stream
let audioCtx = null, analyser = null, vizData = null, vizRaf = 0;
function ensureAnalyser() {
  if (audioCtx) { audioCtx.resume?.(); return true; }
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const src = audioCtx.createMediaElementSource(audio);
    analyser = audioCtx.createAnalyser();
    analyser.fftSize = 256;
    analyser.smoothingTimeConstant = 0.82;
    src.connect(analyser);
    analyser.connect(audioCtx.destination);
    vizData = new Uint8Array(analyser.frequencyBinCount);
    return true;
  } catch { return false; }
}

function startViz() {
  if (!audioCtx) ensureAnalyser();
  audioCtx?.resume?.();
  cancelAnimationFrame(vizRaf);
  drawViz();
}
function stopViz() { cancelAnimationFrame(vizRaf); vizRaf = 0; }

function drawViz() {
  const c = $('viz');
  if (!c || npExpand.hidden) return;
  if (analyser) analyser.getByteFrequencyData(vizData);
  const w = c.clientWidth, h = c.clientHeight, dpr = window.devicePixelRatio || 1;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const g = c.getContext('2d');
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  g.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || '#a5a6f6';
  const barCount = 56, gap = 3;
  const bw = Math.max(2, (w - gap * (barCount - 1)) / barCount);
  const bins = analyser ? analyser.frequencyBinCount : 0;
  for (let i = 0; i < barCount; i++) {
    const bin = bins ? Math.min(bins - 1, Math.floor(Math.pow(i / barCount, 1.6) * bins * 0.75)) : 0;
    const v = analyser ? vizData[bin] / 255 : 0.03;
    const bh = Math.max(2, v * (h - 2));
    g.fillRect(i * (bw + gap), h - bh, bw, bh);
  }
  vizRaf = requestAnimationFrame(drawViz);
}

// ---------- startup splash ----------
const splash = $('splash');
const splashStatus = $('splash-status');
const splashError = $('splash-error');
const splashInstructions = $('splash-instructions');

function hideSplash() {
  splash.classList.add('out');
  setTimeout(() => { splash.hidden = true; }, 450);
}

function mkInstTitle(t) {
  const d = document.createElement('div');
  d.className = 'inst-title';
  d.textContent = t;
  return d;
}

function mkInstCode(cmd, note) {
  const wrap = document.createElement('div');
  if (note) {
    const n = document.createElement('div');
    n.className = 'inst-note';
    n.textContent = note;
    wrap.append(n);
  }
  const code = document.createElement('code');
  code.textContent = cmd;
  code.title = 'Click to copy';
  code.addEventListener('click', () => {
    navigator.clipboard.writeText(cmd);
    code.title = 'Copied!';
  });
  wrap.append(code);
  return wrap;
}

function showInstallInstructions() {
  splashStatus.textContent = '';
  document.querySelector('.splash-spinner').hidden = true;
  splashError.hidden = false;
  splashInstructions.textContent = '';

  if (navigator.userAgent.includes('Windows')) {
    const dl = document.createElement('a');
    dl.href = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
    dl.textContent = 'Or download yt-dlp.exe directly (then press Check again)';
    dl.style.color = 'var(--accent)';
    dl.style.cursor = 'pointer';
    dl.style.textDecoration = 'underline';
    dl.addEventListener('click', (e) => { e.preventDefault(); window.api.openExternal(dl.href); });
    splashInstructions.append(
      mkInstTitle('Windows — pick one'),
      dl,
      mkInstCode('winget install yt-dlp', 'or via terminal'),
      mkInstCode('scoop install yt-dlp'),
    );
  } else {
    splashInstructions.append(
      mkInstTitle('Linux — pick your distro'),
      mkInstCode('sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp && sudo chmod a+rx /usr/local/bin/yt-dlp', 'recommended — always the latest version'),
      mkInstCode('sudo pacman -S yt-dlp', 'Arch / CachyOS'),
      mkInstCode('sudo apt install yt-dlp', 'Debian / Ubuntu'),
    );
  }

  const note = document.createElement('div');
  note.className = 'inst-note';
  note.textContent = 'Click a command to copy it, run it, then press Check again. Keep yt-dlp updated: yt-dlp -U';
  splashInstructions.append(note);
}

async function bootSystemCheck() {
  splashStatus.textContent = 'Checking system…';
  try {
    const res = await window.api.checkSystem();
    if (res.ytdlpVersion) {
      splashStatus.textContent = `Ready — yt-dlp ${res.ytdlpVersion}`;
      if (!res.ffmpeg) {
        splashStatus.textContent += ' · warning: ffmpeg not found, some features may be limited';
      }
      setTimeout(hideSplash, 700);
    } else {
      showInstallInstructions();
    }
  } catch {
    showInstallInstructions();
  }
}

$('splash-recheck').addEventListener('click', async () => {
  splashError.hidden = true;
  document.querySelector('.splash-spinner').hidden = false;
  await bootSystemCheck();
});
$('splash-continue').addEventListener('click', hideSplash);

// ---------- music source (YouTube / SoundCloud) ----------
let musicSource = localStorage.getItem('openwave:source') || 'youtube';

function setSource(src) {
  musicSource = src;
  localStorage.setItem('openwave:source', src);
  $('src-youtube').classList.toggle('active', src === 'youtube');
  $('src-soundcloud').classList.toggle('active', src === 'soundcloud');
  searchInput.placeholder = src === 'youtube' ? 'Search YouTube' : 'Search SoundCloud';
}

$('src-youtube').addEventListener('click', () => setSource('youtube'));
$('src-soundcloud').addEventListener('click', () => setSource('soundcloud'));

// ---------- sidebar: count badges + recent playlists (drop targets) ----------
function updateRailBadges() {
  const q = $('rail-queue-badge');
  if (q) q.textContent = queue.length ? (queue.length > 99 ? '99+' : queue.length) : '';
  const l = $('rail-liked-badge');
  if (l) l.textContent = likedSongs.length ? (likedSongs.length > 99 ? '99+' : likedSongs.length) : '';
}

function renderRailPlaylists() {
  const box = $('rail-playlists');
  if (!box) return;
  box.textContent = '';
  for (const pl of playlists.slice(0, 5)) {
    const b = document.createElement('button');
    b.className = 'rail-pl' + (view.type === 'playlist' && view.name === pl.name ? ' active' : '');
    b.textContent = trunc(pl.name, 22);
    b.title = `${pl.name} — ${pl.tracks.length} song${pl.tracks.length === 1 ? '' : 's'}`;
    b.addEventListener('click', () => setView('playlist', pl.name));
    b.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
      b.classList.add('drop-ready');
    });
    b.addEventListener('dragleave', () => b.classList.remove('drop-ready'));
    b.addEventListener('drop', (e) => {
      e.preventDefault();
      e.stopPropagation();
      b.classList.remove('drop-ready');
      const track = parseTrackDrag(e);
      if (track) addTrackToPlaylist(pl, track);
    });
    box.append(b);
  }
  if (playlists.length > 5) {
    const more = document.createElement('button');
    more.className = 'rail-pl';
    more.textContent = `… ${playlists.length - 5} more`;
    more.addEventListener('click', () => setView('playlists'));
    box.append(more);
  }
}

// ---------- backup export / import ----------
function exportData() {
  const data = {
    app: 'openwave',
    exportedAt: new Date().toISOString(),
    playlists,
    likedSongs,
    recentlyPlayed,
    queue,
    settings,
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `openwave-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  setStatus('Backup downloaded.');
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const d = JSON.parse(reader.result);
      if (d.app !== 'openwave') throw new Error('this file is not an OpenWave backup');
      if (Array.isArray(d.playlists)) {
        playlists = d.playlists.filter(p => p && p.name && p.name !== LIKED && Array.isArray(p.tracks));
        savePlaylists();
      }
      if (Array.isArray(d.likedSongs)) {
        likedSongs = d.likedSongs.filter(t => t && t.id);
        saveLiked();
        refreshHearts();
        refreshNpLike();
      }
      if (Array.isArray(d.recentlyPlayed)) {
        recentlyPlayed = d.recentlyPlayed.filter(t => t && t.id);
        saveRecent();
      }
      if (d.settings && typeof d.settings === 'object') {
        settings = { ...SETTINGS_DEFAULTS, ...d.settings };
        saveSettings();
        applySettings();
      }
      if (Array.isArray(d.queue)) {
        queue = d.queue.filter(t => t && t.id);
        current = -1;
        saveState();
      }
      renderView();
      renderHomeTiles();
      setStatus(`Imported ${playlists.length} playlists and ${likedSongs.length} liked songs.`);
    } catch (err) {
      setStatus(`Import failed: ${err.message}`);
    }
  };
  reader.readAsText(file);
}

// show the real app version on the About page
window.api.getVersion().then((v) => {
  const el = $('about-version');
  if (el) el.textContent = `v${v}`;
});

// ---------- update checker (manual, About page) ----------
let releaseUrl = null;

function compareVersions(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    const x = pa[i] || 0;
    const y = pb[i] || 0;
    if (x !== y) return x - y;
  }
  return 0;
}

async function checkUpdates() {
  const statusEl = $('updates-status');
  const btn = $('btn-updates');
  statusEl.textContent = 'Checking…';
  try {
    const res = await window.api.checkUpdates();
    const cur = String(res.currentVersion).replace(/^v/, '');
    if (res.latest == null) {
      statusEl.textContent = "No release published yet — you're on the dev build.";
      return;
    }
    const latest = String(res.latest || '').replace(/^v/, '');
    if (compareVersions(latest, cur) > 0) {
      releaseUrl = res.url; // links to the release's download page on GitHub
      statusEl.textContent = `Update available: ${res.latest} — you're on v${cur}`;
      btn.textContent = 'Open download page';
      btn.classList.add('btn-accent');
    } else {
      statusEl.textContent = `You're up to date (v${cur})`;
    }
  } catch (err) {
    statusEl.textContent = String(err?.message).includes('repo-not-found')
      ? 'Repo not found — is it public and named molxxt/openwave?'
      : "Couldn't check — are you offline?";
  }
}

$('btn-updates').addEventListener('click', () => {
  if (releaseUrl) window.api.openExternal(releaseUrl);
  else checkUpdates();
});

$('btn-export-data').addEventListener('click', exportData);
$('btn-import-data').addEventListener('click', () => $('import-file').click());
$('import-file').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) importData(file);
  e.target.value = '';
});

// ---------- boot ----------
applySettings();
applyRail();
loadState();
loadPlaylists();
loadLiked();
loadRecent();
updateRailBadges();
setSource(musicSource);
setView('home');
refreshNpLike();
bootSystemCheck();

// resume last session: show the paused track and where it stopped
try {
  const r = getResume();
  if (r && r.id && queue[current] && queue[current].id === r.id) {
    const track = queue[current];
    npTitle.textContent = track.title;
    npChannel.textContent = track.channel;
    npThumb.src = track.thumb || `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
    npThumb.hidden = false;
    timeCurrent.textContent = fmtTime(r.position || 0);
    if (r.duration) {
      timeTotal.textContent = fmtTime(r.duration);
      seek.value = Math.round(((r.position || 0) / r.duration) * 1000);
      updateRangeFill(seek);
    }
    setStatus('Paused where you left off — press Space to continue.');
  }
} catch { /* resume is best-effort */ }
