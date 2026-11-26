// preload.js — the security bridge between UI and the Electron main process.
// Exposes ONLY the small set of functions the UI needs, nothing else.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  searchTracks: (query, source) => ipcRenderer.invoke('search:tracks', query, source),
  trendingYouTube: () => ipcRenderer.invoke('trending:youtube'),
  findLyrics: (track) => ipcRenderer.invoke('lyrics:find', track),
  checkSystem: () => ipcRenderer.invoke('system:check'),
  getVersion: () => ipcRenderer.invoke('app:version'),
  prewarmStream: (track) => ipcRenderer.invoke('stream:prewarm', track),
  checkUpdates: () => ipcRenderer.invoke('updates:check'),
  setYtCookies: (browser) => ipcRenderer.invoke('ytcookies:set', browser),
  getYtCookies: () => ipcRenderer.invoke('ytcookies:get'),
  setBackground: (theme) => ipcRenderer.send('theme:background', theme),
  resolveStream: (track) => ipcRenderer.invoke('stream:resolve', track),
  openExternal: (url) => ipcRenderer.invoke('app:openExternal', url),
  platform: process.platform,
  platform: process.platform,
  windowControls: {
    minimize: () => ipcRenderer.send('window:minimize'),
    close: () => ipcRenderer.send('window:close'),
    maximize: () => ipcRenderer.send('window:maximize'),
    onMaximized: (cb) => ipcRenderer.on('window:maximized', (_e, value) => cb(value)),
  },
});
