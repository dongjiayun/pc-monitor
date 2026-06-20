import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

const STORAGE_KEY = 'pc-monitor-settings'

export interface MonitorSettings {
  showCpu: boolean
  showGpu: boolean
  showMemory: boolean
  showDisk: boolean
  showNetwork: boolean
  showVoltage: boolean
  showSystemInfo: boolean
  windowOpacity: number
  autoStart: boolean
}

function loadSettings(): MonitorSettings {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) return JSON.parse(saved)
  } catch {}
  return getDefaultSettings()
}

function getDefaultSettings(): MonitorSettings {
  return {
    showCpu: true,
    showGpu: true,
    showMemory: true,
    showDisk: true,
    showNetwork: true,
    showVoltage: true,
    showSystemInfo: true,
    windowOpacity: 0.82,
    autoStart: false
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<MonitorSettings>(loadSettings())

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
  }

  // Auto-save on changes
  watch(settings, save, { deep: true })

  // Sync auto-start with Electron
  watch(() => settings.value.autoStart, async (val) => {
    if (window.electronAPI) {
      try {
        await window.electronAPI.setAutoStart(val)
      } catch {}
    }
  })

  function reset() {
    settings.value = getDefaultSettings()
  }

  return { settings, save, reset }
})
