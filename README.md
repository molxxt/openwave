# OpenWave 🌊

A free and open-source desktop music player for Linux that streams from **YouTube**.
Built with **Electron** + **yt-dlp**. No accounts, no ads, no subscriptions.

> ⚠️ **Legal note:** streaming from YouTube violates YouTube's Terms of Service
> (though personal use is not illegal in most places). Don't distribute this app
> through app stores and don't monetize it. It's a personal-use FOSS project.

## Features (v0.1)

- 🔍 Search YouTube and stream the best available audio
- ⏯️ Player bar: play/pause, previous/next, seek, volume
- 🎵 Queue (reorderable by re-clicking, removable tracks)
- 💾 Queue persists between sessions
- ⌨️ Shortcuts: `Space` = play/pause, `N` = next, `P` = previous

## Setup (Linux)

### 1. Install Node.js

Download from <https://nodejs.org> (LTS is fine), or via your package manager:

```bash
# Debian/Ubuntu
sudo apt install nodejs npm
# Fedora
sudo dnf install nodejs npm
# Arch
sudo pacman -S nodejs npm
```

### 2. Install yt-dlp

OpenWave uses [yt-dlp](https://github.com/yt-dlp/yt-dlp) to search YouTube and
extract audio streams. You also need `ffmpeg` (usually preinstalled).

```bash
# Option A: download the standalone binary (recommended)
sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
sudo chmod a+rx /usr/local/bin/yt-dlp

# Option B: via pip
python3 -m pip install yt-dlp
```

Keep yt-dlp updated — YouTube changes things often and yt-dlp fixes it quickly:

```bash
sudo yt-dlp -U   # standalone binary
```

### 3. Install & run OpenWave

```bash
npm install
npm start
```

## Project layout

```
src/main.js      Electron main process: window, yt-dlp calls, local stream proxy
src/preload.js   Security bridge exposing a tiny API to the UI
src/index.html   UI layout
src/style.css    Dark theme
src/renderer.js  UI logic: search, queue, playback
```

## Roadmap ideas

- SoundCloud support
- Favorites / playlists (local SQLite)
- Media key support (MPRIS on Linux)
- A "shuffle that doesn't suck"

## License

MIT — see [LICENSE](LICENSE).
