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
const { URL } = require('url');

// yt-dlp binary name (or full path) — override with YTDLP_PATH env var
const YTDLP = process.env.YTDLP_PATH || 'yt-dlp';

let mainWindow = null;
let proxyServer = null;
let proxyPort = null;

// ----------------------------------------------------------
// yt-dlp helpers
// ----------------------------------------------------------
const APP_REPO = 'molxxt/openwave'; // change if you rename the repo

/** Run yt-dlp with the given arguments, return stdout as a string. */
function ytdlp(args) {
  return new Promise((resolve, reject) => {
    execFile(YTDLP, args, { maxBuffer: 20 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        const msg = (stderr || err.message || '').trim();
        if (err.code === 'ENOENT') {
          reject(new Error('yt-dlp was not found. Install it first: https://github.com/yt-dlp/yt-dlp#installation'));
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
function parseTracks(out) {
  const tracks = [];
  for (const line of out.split('\n')) {
    if (!line.trim()) continue;
    let entry;
    try { entry = JSON.parse(line); } catch { continue; }
    if (!entry || !entry.id) continue;
    tracks.push({
      id: entry.id,
      title: entry.title || 'Unknown title',
      channel: entry.uploader || entry.channel || 'Unknown channel',
      duration: entry.duration ?? null,
      thumb: `https://i.ytimg.com/vi/${entry.id}/mqdefault.jpg`,
      url: `https://www.youtube.com/watch?v=${entry.id}`,
    });
  }
  return tracks;
}

/** Search YouTube. Returns a list of tracks. */
async function searchYouTube(query) {
  const out = await ytdlp([
    `ytsearch15:${query}`,
    '--flat-playlist',
    '--dump-json',
    '--no-warnings',
  ]);
  return parseTracks(out);
}

// Trending feed, fetched once per session
let trendingCache = null;
async function fetchTrending() {
  if (trendingCache) return trendingCache;
  const out = await ytdlp([
    '--flat-playlist',
    '--dump-json',
    '--no-warnings',
    'https://www.youtube.com/feed/trending',
  ]);
  trendingCache = parseTracks(out).slice(0, 12);
  return trendingCache;
}

/** Resolve a video id to a direct audio stream URL (best audio-only format). */
async function resolveStreamUrl(videoId) {
  const url = `https://www.youtube.com/watch?v=${videoId}`;
  const out = await ytdlp([
    '-f', 'bestaudio/best',
    '--no-playlist',
    '--no-warnings',
    '-g', // print the direct media URL only
    url,
  ]);
  const streamUrl = out.split('\n').map(s => s.trim()).filter(Boolean).pop();
  if (!streamUrl) throw new Error('Could not resolve an audio stream for this track');
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

ipcMain.handle('search:youtube', async (_event, query) => {
  return searchYouTube(String(query || '').trim());
});

ipcMain.handle('stream:resolve', async (_event, track) => {
  if (!track || !track.id) throw new Error('no track id');
  const streamUrl = await resolveStreamUrl(track.id);
  activeStreams.set(track.id, { url: streamUrl, title: track.title });
  return `http://127.0.0.1:${proxyPort}/stream/${encodeURIComponent(track.id)}`;
});

ipcMain.handle('app:openExternal', (_event, url) => {
  if (typeof url === 'string' && url.startsWith('https://')) shell.openExternal(url);
});

ipcMain.handle('trending:youtube', () => fetchTrending());

// latest release from GitHub (update checker)
ipcMain.handle('updates:check', async () => {
  const res = await fetch(`https://api.github.com/repos/${APP_REPO}/releases/latest`, {
    headers: { 'User-Agent': 'OpenWave-App' },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`GitHub responded with ${res.status}`);
  const data = await res.json();
  return { latest: data.tag_name, url: data.html_url, currentVersion: app.getVersion() };
});

// keep the window's background color in sync with the chosen theme (no startup flash)
ipcMain.on('theme:background', (_event, theme) => {
  if (mainWindow) {
    const color = theme === 'light' ? '#f4f4f6' : theme === 'oled' ? '#000000' : '#121212';
    mainWindow.setBackgroundColor(color);
  }
});

// startup system check: is yt-dlp available? is ffmpeg?
ipcMain.handle('system:check', () => new Promise((resolve) => {
  execFile(YTDLP, ['--version'], { timeout: 15000 }, (err, stdout) => {
    const ytdlpVersion = err ? null : String(stdout || '').trim() || null;
    execFile('ffmpeg', ['-version'], { timeout: 15000 }, (err2) => {
      resolve({ ytdlpVersion, ffmpeg: !err2 });
    });
  });
}));

// window controls for the frameless-style top bar buttons
ipcMain.on('window:minimize', () => { if (mainWindow) mainWindow.minimize(); });
ipcMain.on('window:close', () => { if (mainWindow) mainWindow.close(); });

// ------------------------------------------------------------
// App lifecycle
// ------------------------------------------------------------

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 720,
    minHeight: 520,
    title: 'OpenWave',
    backgroundColor: '#121218',
    icon: path.join(__dirname, 'assets', 'icon.png'), // taskbar / dock icon while running
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true, // renderer can't touch Node directly (safe by default)
      nodeIntegration: false,
    },
  });
  mainWindow.loadFile(path.join(__dirname, 'index.html'));

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
