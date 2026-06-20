import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  // System info
  getSystemInfo: () => ipcRenderer.invoke('get-system-info'),
  
  // Hardware monitoring
  getCpuLoad: () => ipcRenderer.invoke('get-cpu-load'),
  getGpuInfo: () => ipcRenderer.invoke('get-gpu-info'),
  getMemoryInfo: () => ipcRenderer.invoke('get-memory-info'),
  getDiskInfo: () => ipcRenderer.invoke('get-disk-info'),
  getNetworkInfo: () => ipcRenderer.invoke('get-network-info'),
  getVoltageInfo: () => ipcRenderer.invoke('get-voltage-info'),
  getProcessInfo: () => ipcRenderer.invoke('get-process-info'),

  // Real-time data streaming
  onMonitorData: (callback: (data: any) => void) => {
    ipcRenderer.on('monitor-data', (_event, data) => callback(data))
  },
  removeMonitorListener: () => {
    ipcRenderer.removeAllListeners('monitor-data')
  },

  // Window controls
  minimize: () => ipcRenderer.send('window-minimize'),
  close: () => ipcRenderer.send('window-close'),
  toggleWindow: () => ipcRenderer.send('toggle-window'),

  // Settings
  onOpenSettings: (callback: () => void) => {
    ipcRenderer.on('open-settings', () => callback())
  },
  removeSettingsListener: () => {
    ipcRenderer.removeAllListeners('open-settings')
  },

  // Auto-start
  setAutoStart: (enable: boolean) => ipcRenderer.invoke('set-auto-start', enable),
  getAutoStart: () => ipcRenderer.invoke('get-auto-start')
})
