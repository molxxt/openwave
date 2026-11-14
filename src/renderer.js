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
}
function loadPlaylists() {
  try {
    const saved = JSON.parse(localStorage.getItem('openwave:playlists'));
    if (Array.isArray(saved)) playlists = saved.filter(p => p.name !== LIKED);
  } catch { playlists = []; }
}
function saveLiked() {
  localStorage.setItem('openwave:liked', JSON.stringify(likedSongs));
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
}

// ---------- generic track row builder ----------
function trackEl(track, onClick, { removable = false, reorderable = false, index = 0 } = {}) {
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

  // drag-to-reorder (queue only)
  if (reorderable) {
    li.draggable = true;
    li.addEventListener('dragstart', (e) => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
      li.classList.add('dragging');
    });
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
      const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      if (!isNaN(from) && from !== index) moveInQueue(from, index);
    });
    li.addEventListener('dragend', () => {
      li.classList.remove('dragging');
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });
  }
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
  tracks.forEach((track, i) => {
    container.append(trackEl(track, () => playTrack(track), { ...opts, index: i }));
  });
}

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
const NAV_MAP = {
  home: 'home', results: 'home', foryou: 'home', playlist: 'playlists',
  playlists: 'playlists', liked: 'liked', queue: 'queue', settings: 'settings',
};

function setView(type, name = null) {
  view = { type, name };
  for (const el of document.querySelectorAll('.view')) el.hidden = true;
  $(`view-${type}`).hidden = false;
  for (const el of document.querySelectorAll('.rail-btn[data-view]')) {
    el.classList.toggle('active', NAV_MAP[type] === el.dataset.view);
  }
  renderView();
}

function renderView() {
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
function mediaCard(track) {
  const card = document.createElement('button');
  card.className = 'media-card';
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
  for (const t of recentlyPlayed.slice(0, 10)) row.append(mediaCard(t));
}

let trendingState = 'idle'; // idle | loading | done | failed
async function ensureTrending() {
  if (trendingState === 'loading' || trendingState === 'done') return;
  const row = $('trending-cards');
  const status = $('trending-status');
  trendingState = 'loading';
  status.textContent = 'Loading trending…';
  try {
    const tracks = await window.api.trendingYouTube();
    trendingState = 'done';
    status.textContent = '';
    row.textContent = '';
    for (const t of tracks) row.append(mediaCard(t));
  } catch {
    trendingState = 'failed';
    row.textContent = '';
    status.textContent = 'Trending is unavailable right now (yt-dlp could not fetch it).';
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
  searchHistoryBox.hidden = false;
}

searchInput.addEventListener('focus', renderSearchHistory);
searchInput.addEventListener('input', renderSearchHistory);
searchInput.addEventListener('blur', () => setTimeout(hideSearchHistory, 150));

async function doSearch(q) {
  q = q.trim();
  if (!q) return;

  resultsTitle.textContent = `Results for “${q}”`;
  resultsList.textContent = '';
  setStatus('Searching…', true);
  try {
    searchResults = await window.api.searchYouTube(q);
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
    card.append(art, name, count);
    playlistsGrid.append(card);
  }
}

// ---------- queue ----------
function renderQueueView() {
  queueCount.textContent = queue.length ? `· ${queue.length}` : '';
  renderTrackList(queueList, queue, { removable: true, reorderable: true });
  if (!queue.length) {
    emptyState(queueList, 'Your queue is empty — search for something, or load a playlist.');
  }
}

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
  renderTrackList(playlistViewList, pl.tracks.map(t => ({ ...t })), {});
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

  npTitle.textContent = track.title;
  npChannel.textContent = track.channel;
  npThumb.onerror = () => { npThumb.src = track.thumb; npThumb.onerror = null; };
  npThumb.src = `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
  npThumb.hidden = false;
  document.title = `${track.title} · ${track.channel} — OpenWave`;
  btnPlay.innerHTML = icon('play');
  setStatus(`Loading “${track.title}”…`, true);

  try {
    const localUrl = await window.api.resolveStream(track);
    audio.src = localUrl;
    audio.play();
    setStatus('');
  } catch (err) {
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
});
audio.addEventListener('pause', () => {
  btnPlay.innerHTML = icon('play');
  npThumb.classList.remove('playing');
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
btnLike.addEventListener('click', () => toggleLike(queue[current]));
btnPlay.addEventListener('click', togglePlay);
btnNext.addEventListener('click', next);
btnPrev.addEventListener('click', prev);

audio.addEventListener('timeupdate', () => {
  if (isSeeking || !isFinite(audio.duration)) return;
  seek.value = Math.round((audio.currentTime / audio.duration) * 1000);
  updateRangeFill(seek);
  timeCurrent.textContent = fmtTime(audio.currentTime);
  timeTotal.textContent = fmtTime(audio.duration);

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

// paint the filled portion of a slider via --fill (used by the track gradient)
function updateRangeFill(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--fill', pct + '%');
}

seek.addEventListener('input', () => { isSeeking = true; updateRangeFill(seek); });
seek.addEventListener('change', () => {
  if (isFinite(audio.duration)) {
    audio.currentTime = (seek.value / 1000) * audio.duration;
  }
  isSeeking = false;
  updateRangeFill(seek);
});

volume.addEventListener('input', () => {
  if (audio.muted && volume.value > 0) audio.muted = false; // moving the slider unmutes
  audio.volume = volume.value / 100;
  localStorage.setItem('openwave:volume', volume.value);
  updateRangeFill(volume);
  updateMuteIcon();
});
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
});

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

// ---------- update checker ----------
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
  statusEl.textContent = 'Checking…';
  try {
    const res = await window.api.checkUpdates();
    releaseUrl = res.url;
    const cur = String(res.currentVersion).replace(/^v/, '');
    const latest = String(res.latest || '').replace(/^v/, '');
    if (compareVersions(latest, cur) > 0) {
      statusEl.textContent = `Update available: ${res.latest} (you're on v${cur})`;
      $('btn-updates').textContent = 'Open download page';
    } else {
      statusEl.textContent = `You're up to date (v${cur})`;
    }
  } catch {
    statusEl.textContent = "Couldn't check — are you offline?";
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
    npThumb.src = `https://i.ytimg.com/vi/${track.id}/hqdefault.jpg`;
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
