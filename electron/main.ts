import { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage } from 'electron'
import path from 'path'
import fs from 'fs'
import { 
  getSystemInfo,
  getCpuLoadData,
  getGpuInfoData,
  getMemoryInfoData,
  getDiskInfoData,
  getNetworkInfoData,
  getVoltageInfoData,
  getProcessInfoData,
  getTotalPowerEstimate,
  preWarm
} from './monitor'

// ============ Global error handlers ============
process.on('uncaughtException', (err) => {
  console.error('[FATAL] Uncaught exception:', err.message, err.stack)
})

process.on('unhandledRejection', (reason) => {
  console.error('[FATAL] Unhandled rejection:', reason)
})

let mainWindow: BrowserWindow | null = null
let tray: Tray | null = null
let frameTimer: NodeJS.Timeout | null = null
let isQuitting = false

// ============ Window state persistence ============
const WINSTATE_PATH = path.join(app.getPath('userData'), 'window-state.json')

interface WindowState {
  x?: number
  y?: number
  width: number
  height: number
}

function loadWindowState(): WindowState | null {
  try {
    if (fs.existsSync(WINSTATE_PATH)) {
      const data = fs.readFileSync(WINSTATE_PATH, 'utf-8')
      return JSON.parse(data)
    }
  } catch (err) {
    console.error('[window] Failed to load window state:', err)
  }
  return null
}

function saveWindowState(state: WindowState) {
  try {
    const dir = path.dirname(WINSTATE_PATH)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(WINSTATE_PATH, JSON.stringify(state))
  } catch (err) {
    console.error('[window] Failed to save window state:', err)
  }
}

// ============ Icon path helper (dev vs production) ============
function getIconPath(name: string): string {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  if (isDev) {
    return path.resolve(process.cwd(), 'public', name)
  }
  // Production: extraResources copies to resources/icons/
  return path.resolve(process.resourcesPath, 'icons', name)
}

function createWindow() {
  const saved = loadWindowState()

  mainWindow = new BrowserWindow({
    x: saved?.x,
    y: saved?.y,
    width: saved?.width ?? 460,
    height: saved?.height ?? 840,
    show: true,             // 启动时自动显示窗口
    skipTaskbar: true,      // 始终不在任务栏显示图标
    type: 'toolbar',        // 工具窗口：不受"显示桌面"(Win+D) 影响
    resizable: true,
    minWidth: 320,
    minHeight: 500,
    frame: false,
    transparent: true,
    hasShadow: false,
    titleBarStyle: 'hidden',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // Save window state on move/resize (debounced)
  let saveTimer: NodeJS.Timeout | null = null
  function debounceSave() {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        const bounds = mainWindow.getBounds()
        saveWindowState({ x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height })
      }
    }, 500)
  }
  mainWindow.on('resize', debounceSave)
  mainWindow.on('move', debounceSave)

  if (process.env.VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // Intercept close → hide to tray instead of destroying the window
  mainWindow.on('close', (event) => {
    if (!isQuitting) {
      event.preventDefault()
      mainWindow?.hide()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Set window icon (taskbar icon)
  const winIconPath = getIconPath('icon.png')
  if (fs.existsSync(winIconPath)) {
    mainWindow.setIcon(nativeImage.createFromPath(winIconPath))
  }

  // Wait for page to fully render, then start monitoring.
  // Using single PowerShell call for ALL dynamic data (much faster than 7 separate spawns)
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('[startup] Page loaded, triggering monitor in 500ms...')
    setTimeout(async () => {
      console.log('[startup] Pre-warming static data...')
      await preWarm()

      console.log('[startup] Pushing first frame...')
      await pushFullFrame()

      scheduleNextFrame()
    }, 500)
  })
}

/** Non-overlapping frame scheduler — 0.5s gap between frames */
function scheduleNextFrame() {
  frameTimer = setTimeout(async () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    await pushFullFrame()
    scheduleNextFrame()
  }, 500)
}

/** Full frame — all metrics. Single PowerShell call (not 7 concurrent spawns). */
async function pushFullFrame() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  try {
    console.log('[frame] Starting data collection...')
    const [cpu, gpu, memory, disks, network, voltage, processes, totalPower] = await Promise.all([
      getCpuLoadData().catch(e => { console.error('[frame] cpu error:', e); return {} }),
      getGpuInfoData().catch(e => { console.error('[frame] gpu error:', e); return {} }),
      getMemoryInfoData().catch(e => { console.error('[frame] memory error:', e); return {} }),
      getDiskInfoData().catch(e => { console.error('[frame] disk error:', e); return [] }),
      getNetworkInfoData().catch(e => { console.error('[frame] network error:', e); return {} }),
      getVoltageInfoData().catch(e => { console.error('[frame] voltage error:', e); return {} }),
      getProcessInfoData().catch(e => { console.error('[frame] process error:', e); return [] }),
      getTotalPowerEstimate().catch(e => { console.error('[frame] totalPower error:', e); return 0 })
    ])
    console.log('[frame] All data collected. Sending to renderer...')
    mainWindow.webContents.send('monitor-data', {
      cpu, gpu, memory, disks, network, voltage, processes, totalPower,
      timestamp: Date.now()
    })
    console.log('[frame] Frame sent successfully')
  } catch (err) {
    console.error('[frame] Monitor data collection error:', err)
  }
}

function createTray() {
  const iconPath = getIconPath('icon-64.png')
  const icon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
  
  tray = new Tray(icon)
  tray.setToolTip('PC Monitor')

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createWindow()
        }
        if (mainWindow) {
          mainWindow.show()
          mainWindow.focus()
        }
      }
    },
    { type: 'separator' },
    {
      label: '设置',
      click: () => {
        if (!mainWindow || mainWindow.isDestroyed()) {
          createWindow()
        }
        if (mainWindow) {
          mainWindow.show()
          mainWindow.webContents.send('open-settings')
        }
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        isQuitting = true
        if (frameTimer) clearTimeout(frameTimer)
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)

  // Double-click tray to show window
  tray.on('double-click', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow()
    }
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide()
      } else {
        mainWindow.show()
        mainWindow.focus()
      }
    }
  })
}

// IPC handlers
ipcMain.handle('get-system-info', async () => await getSystemInfo())
ipcMain.handle('get-cpu-load', async () => await getCpuLoadData())
ipcMain.handle('get-gpu-info', async () => await getGpuInfoData())
ipcMain.handle('get-memory-info', async () => await getMemoryInfoData())
ipcMain.handle('get-disk-info', async () => await getDiskInfoData())
ipcMain.handle('get-network-info', async () => await getNetworkInfoData())
ipcMain.handle('get-voltage-info', async () => await getVoltageInfoData())
ipcMain.handle('get-process-info', async () => await getProcessInfoData())

// Window control (no maximize - window is fixed size)
ipcMain.on('window-minimize', () => mainWindow?.minimize())
ipcMain.on('window-close', () => {
  // Hide to tray instead of closing
  if (mainWindow) mainWindow.hide()
})

// Auto-start
ipcMain.handle('set-auto-start', (_event, enable: boolean) => {
  app.setLoginItemSettings({ openAtLogin: enable })
  return true
})
ipcMain.handle('get-auto-start', () => {
  return app.getLoginItemSettings().openAtLogin
})

// Toggle window visibility from renderer
ipcMain.on('toggle-window', () => {
  if (!mainWindow) return
  if (mainWindow.isVisible()) mainWindow.hide()
  else {
    mainWindow.show()
    mainWindow.focus()
  }
})

app.whenReady().then(() => {
  createWindow()
  createTray()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (frameTimer) clearTimeout(frameTimer)
  // Don't quit on window close - keep running in tray
  // Only quit when user clicks "退出" from tray menu
})

app.on('before-quit', () => {
  if (frameTimer) clearTimeout(frameTimer)
})
