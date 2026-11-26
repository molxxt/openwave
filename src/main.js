// ============================================================
//  OpenWave — main process
//  Runs in the background, owns the audio streaming proxy,
//  and talks to yt-dlp (which does the actual YouTube work).
// ============================================================
const { app, BrowserWindow, ipcMain, shell, Menu } = require('electron');
const { execFile } = require('child_process');
const path = require('path');
const http = require('http');
const https = require('https');
const fs = require('fs');
const os = require('os');
const { URL } = require('url');

let mainWindow = null;
let proxyServer = null;
let proxyPort = null;

// ----------------------------------------------------------
// yt-dlp helpers
// ----------------------------------------------------------

// yt-dlp resolution: prefer a binary bundled with the app (extraResources),
// fall back to whatever the OS provides. Bundling means users install nothing.
const YTDLP_NAME = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp-linux';
let ytdlpPathCache = null;
let cookiePref = null; // optional --cookies-from-browser value (user preference)

// cookie preference persists in userData so it survives restarts
function prefFile() { return path.join(app.getPath('userData'), 'openwave-prefs.json'); }
try { cookiePref = JSON.parse(fs.readFileSync(prefFile(), 'utf8')).cookies || null; } catch { /* none yet */ }

ipcMain.handle('ytcookies:get', () => cookiePref);
ipcMain.handle('ytcookies:set', (_event, browser) => {
  cookiePref = browser && browser !== 'none' ? String(browser) : null;
  try { fs.writeFileSync(prefFile(), JSON.stringify({ cookies: cookiePref })); } catch { /* best-effort */ }
  return cookiePref;
});

function findYtDlp() {
  if (ytdlpPathCache) return ytdlpPathCache;
  if (process.env.YTDLP_PATH) return (ytdlpPathCache = process.env.YTDLP_PATH);

  const candidates = [];
  if (process.resourcesPath) candidates.push(path.join(process.resourcesPath, YTDLP_NAME));
  candidates.push(path.join(__dirname, '..', 'build', YTDLP_NAME));
  for (const p of candidates) {
    try {
      if (fs.existsSync(p)) {
        if (process.platform !== 'win32') { try { fs.chmodSync(p, 0o755); } catch { /* ignore */ } }
        return (ytdlpPathCache = p);
      }
    } catch { /* ignore */ }
  }
  return null; // caller falls back to the system 'yt-dlp'
}

/** Run yt-dlp with the given arguments, return stdout as a string. */
function ytdlp(args) {
  const full = [];
  if (cookiePref) full.push('--cookies-from-browser', cookiePref);
  full.push(...args);
  const bin = findYtDlp() || 'yt-dlp';
  return new Promise((resolve, reject) => {
    execFile(bin, full, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || err.message || '').trim();
        if (err.code === 'ENOENT') {
          reject(new Error('yt-dlp is not available. Install it and press Check again, or restart OpenWave.'));
        } else {
          reject(new Error(msg || 'yt-dlp failed'));
        }
      } else {
        resolve(stdout);
      }
    });
  });
}

/** Parse yt-dlp --flat-playlist --dump-json output into track objects. */
/** Best thumbnail URL from a generic (non-YouTube) yt-dlp entry. */
function pickThumb(entry) {
  if (Array.isArray(entry.thumbnails) && entry.thumbnails.length) {
    const usable = entry.thumbnails.filter(t => t && t.url);
    return (usable[usable.length - 1] || usable[0]).url;
  }
  return entry.thumbnail || null;
}

function parseTracks(out, source = 'youtube') {
  const tracks = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || !entry.id) continue;
    tracks.push({
      id: entry.id,
      source,
      title: entry.title || 'Unknown title',
      channel: entry.uploader || entry.channel || 'Unknown channel',
      duration: entry.duration ?? null,
      thumb: source === 'youtube'
        ? `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`
        : pickThumb(entry),
      url: source === 'youtube'
        ? `https://www.youtube.com/watch?v=${entry.id}`
        : (entry.url || entry.webpage_url || null),
    });
  }
  return tracks;
}

/** Search YouTube or SoundCloud. Returns a list of tracks. */
async function searchTracks(query, source = 'youtube') {
  const prefix = source === 'soundcloud' ? 'scsearch15:' : 'ytsearch15:';
  const base = [
    `${prefix}${query}`,
    '--flat-playlist',
    '--dump-json',
    '--no-warnings',
  ];
  let out;
  try {
    out = await ytdlp(base);
  } catch (err) {
    if (/sign in to confirm/i.test(err.message)) {
      // YouTube bot-check: the tv player client usually slips through
      out = await ytdlp(['--extractor-args', 'youtube:player_client=tv', ...base]);
    } else {
      throw err;
    }
  }
  return parseTracks(out, source);
}

// ----------------------------------------------------------
// Trending
// YouTube retired the /feed/trending page (it now redirects to
// the home page), so trending comes from YouTube Music's
// official "Top 100 Songs" chart playlist instead. yt-dlp reads
// it like any other playlist, so every entry is a real video id.
// ----------------------------------------------------------
const TRENDING_LIST = 'https://www.youtube.com/playlist?list=PL4fGSI1pDJn6O1LS0XSdF3RyO0Rq_LDeI';
const TRENDING_TTL = 3 * 60 * 60 * 1000; // charts move slowly — 3h is plenty

let trendingCache = null;

function trendingCacheFile() { return path.join(app.getPath('userData'), 'openwave-trending.json'); }

function readTrendingCache() {
  try {
    const raw = JSON.parse(fs.readFileSync(trendingCacheFile(), 'utf8'));
    if (Array.isArray(raw.tracks) && raw.tracks.length && Date.now() - (raw.at || 0) < TRENDING_TTL) {
      return raw.tracks;
    }
  } catch { /* no usable cache yet */ }
  return null;
}

async function fetchTrending() {
  if (trendingCache) return trendingCache;
  const cached = readTrendingCache();
  if (cached) { trendingCache = cached; return cached; }

  const out = await ytdlp([
    '--flat-playlist',
    '--dump-json',
    '--no-warnings',
    '--playlist-end', '24',
    TRENDING_LIST,
  ]);
  const tracks = parseTracks(out).slice(0, 12);
  if (!tracks.length) throw new Error('The charts playlist came back empty');
  trendingCache = tracks;
  try { fs.writeFileSync(trendingCacheFile(), JSON.stringify({ at: Date.now(), tracks })); } catch { /* best-effort */ }
  return tracks;
}

/** Resolve a track to a direct audio stream URL (best audio-only format). */
async function resolveStreamUrl(track) {
  const isSc = track.source === 'soundcloud';
  if (isSc && !track.url) throw new Error('This SoundCloud track is missing its link and cannot be played');
  const url = isSc ? track.url : `https://www.youtube.com/watch?v=${track.id}`;
  // SoundCloud serves some tracks as HLS (.m3u8) which <audio> can't play;
  // prefer anything progressive, only fall back to HLS if nothing else exists.
  const fmt = isSc ? 'bestaudio[protocol!^=m3u8]/bestaudio/best' : 'bestaudio/best';
  const base = [
    '-f', fmt,
    '--no-playlist',
    '--no-warnings',
    '-g', // print the direct media URL only
    url,
  ];
  let out;
  try {
    out = await ytdlp(base);
  } catch (err) {
    if (/sign in to confirm/i.test(err.message)) {
      // YouTube bot-check: retry with the tv player client before giving up
      try {
        out = await ytdlp(['--extractor-args', 'youtube:player_client=tv', ...base]);
      } catch {
        throw new Error('YouTube is asking for human verification. Open Settings \u2192 Playback \u2192 \u201cYouTube cookies\u201d and pick your browser \u2014 that fixes it permanently.');
      }
    } else {
      throw err;
    }
  }
  const streamUrl = out.split('\n').map(s => s.trim()).filter(Boolean).pop();
  if (!streamUrl) throw new Error('Could not resolve an audio stream for this track');
  if (isSc && (/\.m3u8/i.test(streamUrl) || /format=hls/i.test(streamUrl))) {
    throw new Error('This SoundCloud track is stream-only (HLS) and can\u2019t be played here — try another one');
  }
  return streamUrl;
}

// ------------------------------------------------------------
// Local streaming proxy
//
// We can't feed YouTube's URLs straight to the <audio> element
// (they expire, need special headers). So the main process runs
// a tiny HTTP server on localhost: the renderer asks for
// /stream/<id>, we forward the request upstream — including
// Range headers so seeking works — and pipe the bytes back.
// ------------------------------------------------------------

// videoId -> { url, title } currently registered on the proxy
const activeStreams = new Map();
const ACTIVE_TTL = 45 * 60 * 1000; // resolved URLs stay valid ~45 min
const prewarming = new Set(); // ids currently being resolved in the background

function activeEntry(track) {
  const entry = activeStreams.get(track.id);
  if (!entry || Date.now() - entry.ts > ACTIVE_TTL) return null;
  return entry;
}

async function resolveAndRegister(track) {
  if (!track.source) track.source = 'youtube';
  const streamUrl = await resolveStreamUrl(track);
  activeStreams.set(track.id, { url: streamUrl, title: track.title, ts: Date.now() });
  return `http://127.0.0.1:${proxyPort}/stream/${encodeURIComponent(track.id)}`;
}

function startProxyServer() {
  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        const parsed = new URL(req.url, `http://127.0.0.1`);
        const match = parsed.pathname.match(/^\/stream\/(.+)$/);
        if (!match) { res.writeHead(404); return res.end('not found'); }

        const id = decodeURIComponent(match[1]);
        const entry = activeStreams.get(id);
        if (!entry) { res.writeHead(404); return res.end('stream not registered'); }

        // Forward the request upstream with the headers YouTube cares about
        const headers = {
          'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
          'Referer': 'https://www.youtube.com/',
        };
        if (req.headers.range) headers['Range'] = req.headers.range;

        const upstream = new URL(entry.url);
        const client = upstream.protocol === 'https:' ? https : http;
        const ureq = client.get(upstream, { headers }, (ures) => {
          // Copy the important response headers through
          const pass = {};
          for (const h of ['content-type', 'content-length', 'content-range', 'accept-ranges']) {
            if (ures.headers[h]) pass[h] = ures.headers[h];
          }
          // CORS: lets the renderer attach a Web Audio analyser to the stream
          pass['Access-Control-Allow-Origin'] = '*';
          res.writeHead(ures.statusCode, pass);
          ures.pipe(res);
        });
        ureq.on('error', (e) => {
          console.error('proxy upstream error:', e.message);
          res.writeHead(502); res.end('upstream error');
        });
      } catch (e) {
        console.error('proxy error:', e);
        res.writeHead(500); res.end('proxy error');
      }
    });
    server.on('error', reject);
    // Port 0 = pick a free port automatically
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

// ------------------------------------------------------------
// IPC API exposed to the renderer (UI) process
// ------------------------------------------------------------

ipcMain.handle('search:tracks', async (_event, query, source) => {
  return searchTracks(String(query || '').trim(), source === 'soundcloud' ? 'soundcloud' : 'youtube');
});

ipcMain.handle('stream:resolve', async (_event, track) => {
  if (!track || !track.id) throw new Error('no track id');
  const cached = activeEntry(track);
  if (cached) return `http://127.0.0.1:${proxyPort}/stream/${encodeURIComponent(track.id)}`;
  return resolveAndRegister(track);
});

// resolve the next song in the background so switching is instant
ipcMain.handle('stream:prewarm', async (_event, track) => {
  if (!track || !track.id) return;
  if (activeEntry(track) || prewarming.has(track.id)) return;
  prewarming.add(track.id);
  try { await resolveAndRegister(track); } catch { /* best-effort */ }
  finally { prewarming.delete(track.id); }
});

ipcMain.handle('app:openExternal', (_event, url) => {
  if (typeof url === 'string' && url.startsWith('https://')) shell.openExternal(url);
});

ipcMain.handle('trending:youtube', () => fetchTrending());

// ----------------------------------------------------------
// Lyrics — lrclib.net (free, open, no key). Returns time-synced
// LRC when the database has it, plain text otherwise.
// ----------------------------------------------------------
function lyricQuery(track) {
  const title = String(track.title || '')
    .replace(/\s*[([][^)\]]*(official|lyric|lyrics|video|audio|visuali[sz]er|remaster|explicit|mv|clip)[^)\]]*[)\]]/gi, ' ')
    .replace(/\s+(feat\.?|ft\.?|featuring)\s+.*$/i, '')
    .replace(/\s*[-–|]\s*(official|lyrics?|video|audio|visualizer|mv).*$/i, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  const artist = String(track.channel || '')
    .replace(/\s*-\s*topic$/i, '')
    .replace(/\s*vevo$/i, '')
    .trim();
  return { title, artist };
}

async function lrclib(url) {
  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'OpenWave (https://github.com/molxxt/openwave)' } });
    if (!res.ok) return null;
    return await res.json();
  } catch { return null; }
}

// rank a lrclib hit: synced lyrics win, then the closest duration
function lyricRank(entry, dur) {
  let score = entry.syncedLyrics ? 0 : 100;
  if (dur && entry.duration) {
    const diff = Math.abs(entry.duration - dur);
    score += diff > 20 ? 40 : diff / 5;
  }
  return score;
}

ipcMain.handle('lyrics:find', async (_event, track) => {
  if (!track || !track.title) return null;
  const { title, artist } = lyricQuery(track);
  const dur = Math.round(Number(track.duration) || 0);
  if (!title) return null;

  // YouTube titles are usually "Artist - Song"; lrclib indexes the song
  // alone, so try the whole title as well as each side of the dash.
  const variants = [];
  const addVariant = (value) => {
    const v = String(value || '').trim();
    if (v && !variants.includes(v)) variants.push(v);
  };
  addVariant(title);
  title.split(/\s+[-–—]\s+/).forEach(addVariant);

  const urls = [];
  for (const v of variants) {
    if (artist && dur) {
      urls.push('https://lrclib.net/api/get?artist_name=' + encodeURIComponent(artist)
        + '&track_name=' + encodeURIComponent(v) + '&duration=' + dur);
    }
  }
  for (const v of variants) {
    const params = new URLSearchParams({ track_name: v });
    if (artist) params.set('artist_name', artist);
    urls.push('https://lrclib.net/api/search?' + params.toString());
  }
  for (const v of variants) {
    const q = (v + ' ' + artist).trim();
    urls.push('https://lrclib.net/api/search?' + new URLSearchParams({ q }).toString());
  }

  let fallback = null;
  for (const url of urls) {
    const data = await lrclib(url);
    const list = (Array.isArray(data) ? data : data ? [data] : [])
      .filter((d) => d && (d.syncedLyrics || d.plainLyrics || d.instrumental));
    if (!list.length) continue;
    list.sort((a, b) => lyricRank(a, dur) - lyricRank(b, dur));
    const best = list[0];
    const payload = {
      synced: best.syncedLyrics || null,
      plain: best.plainLyrics || null,
      instrumental: !best.syncedLyrics && !best.plainLyrics,
    };
    if (payload.synced) return payload;   // synced always wins
    if (!fallback) fallback = payload;
  }
  return fallback;
});

ipcMain.handle('app:version', () => app.getVersion());

// update check: latest GitHub release vs running version (repo is public)
const GITHUB_REPO = 'molxxt/openwave';
ipcMain.handle('updates:check', async () => {
  // first verify the repo exists and is public (a 404 here means private/missing)
  const repoRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}`, {
    headers: { 'User-Agent': 'OpenWave-App' },
    signal: AbortSignal.timeout(10000),
  });
  if (!repoRes.ok) throw new Error('repo-not-found');

  // /releases/latest 404s when the repo has zero published releases
  const relRes = await fetch(`https://api.github.com/repos/${GITHUB_REPO}/releases/latest`, {
    headers: { 'User-Agent': 'OpenWave-App' },
    signal: AbortSignal.timeout(10000),
  });
  if (!relRes.ok) {
    return { latest: null, url: `https://github.com/${GITHUB_REPO}/releases`, currentVersion: app.getVersion() };
  }
  const data = await relRes.json();
  return {
    latest: data.tag_name,
    url: data.html_url || `https://github.com/${GITHUB_REPO}`,
    currentVersion: app.getVersion(),
  };
});

// keep the window's background color in sync with the chosen theme (no startup flash)
ipcMain.on('theme:background', (_event, theme) => {
  if (!mainWindow || ROUNDED_WINDOW) return; // keep the alpha channel intact
  const color = theme === 'light' ? '#f4f4f6' : theme === 'oled' ? '#000000' : '#121212';
  mainWindow.setBackgroundColor(color);
});

// startup system check: is yt-dlp available? is ffmpeg?
ipcMain.handle('system:check', () => new Promise((resolve) => {
  execFile(findYtDlp() || 'yt-dlp', ['--version'], { timeout: 15000 }, (err, stdout) => {
    const ytdlpVersion = err ? null : String(stdout || '').trim() || null;
    execFile('ffmpeg', ['-version'], { timeout: 15000 }, (err2) => {
      resolve({ ytdlpVersion, ffmpeg: !err2 });
    });
  });
}));

// window controls for the frameless-style top bar buttons
ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });

ipcMain.on('window:maximize', () => {
  if (!mainWindow) return;
  if (mainWindow.isMaximized()) mainWindow.unmaximize();
  else mainWindow.maximize();
});

// ------------------------------------------------------------
// App lifecycle
// ------------------------------------------------------------

// Linux gets a transparent window so the page can round its corners.
const ROUNDED_WINDOW = process.platform === 'linux';

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    title: 'OpenWave',
    frame: false,        // no OS title bar — the app draws its own
    autoHideMenuBar: true,
    // a transparent surface lets the page round its own corners; only Linux
    // needs it, Windows 11 already rounds frameless windows at the OS level
    transparent: ROUNDED_WINDOW,
    backgroundColor: ROUNDED_WINDOW ? '#00000000' : '#121218',
    icon: path.join(__dirname, 'assets', 'icon.png'), // taskbar / dock icon while running
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // renderer can't touch Node directly (safe by default)
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  // square off the corners while maximized — otherwise the desktop peeks through
  const sendMaximized = () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('window:maximized', mainWindow.isMaximized());
    }
  };
  mainWindow.on('maximize', sendMaximized);
  mainWindow.on('unmaximize', sendMaximized);

  // With no application menu, Chromium's edit shortcuts die on Linux.
  // Re-wire the standard text-editing keys manually.
  mainWindow.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    const wc = mainWindow.webContents;
    const key = (input.key || '').toLowerCase();
    if (input.control || input.meta) {
      const cmd = { c: 'copy', x: 'cut', v: 'paste', a: 'selectAll', z: 'undo', y: 'redo' }[key];
      if (cmd) {
        wc[cmd]();
        event.preventDefault();
      }
    }
  });
}

app.whenReady().then(async () => {
  proxyServer = await startProxyServer();
  proxyPort = proxyServer.address().port;
  // Remove the default File/Edit/View menu bar
  Menu.setApplicationMenu(null);
  createWindow();

  app.on('activate', () => {
    // macOS convention: re-create the window when the dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  // Standard: quit on Linux/Windows when all windows are closed
  if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
  if (proxyServer) proxyServer.close();
});
