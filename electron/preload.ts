const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getSystemIdleTime: () => ipcRenderer.invoke('get-system-idle-time'),
  takeScreenshot: () => ipcRenderer.invoke('take-screenshot'),
  fetchLeadsCrm: (url: string, apiKey: string) => ipcRenderer.invoke('fetch-leads-crm', { url, apiKey }),
});
