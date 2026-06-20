import { ref, onMounted, onUnmounted } from 'vue'
import type { AllMonitorData, SystemInfo } from '@/env.d'
import { useNetworkStore } from '@/stores/network'

export function useMonitor() {
  const systemInfo = ref<SystemInfo | null>(null)
  const monitorData = ref<AllMonitorData | null>(null)
  const isConnected = ref(false)
  const error = ref<string | null>(null)

  // History data for charts - use ref for reliable deep reactivity
  const MAX_HISTORY = 60
  const _history = {
    cpu: [] as number[],
    cpuTemp: [] as number[],
    gpu: [] as number[],
    gpuTemp: [] as number[],
    memory: [] as number[],
    networkRx: [] as number[],
    networkTx: [] as number[],
    timestamps: [] as string[]
  }
  const history = ref(_history)

  const networkStore = useNetworkStore()

  onMounted(() => {
    if (!window.electronAPI) {
      error.value = 'Electron API not available. Running in browser mode?'
      return
    }

    // CRITICAL: Register the data listener FIRST, before any IPC calls.
    // This ensures no frames are lost during startup.
    window.electronAPI.onMonitorData((data: AllMonitorData) => {
      monitorData.value = data
      isConnected.value = true
      error.value = null
      updateHistory(data)
      networkStore.updateTotals(data.network.rxBytes, data.network.txBytes)
    })

    // Then fetch system info fire-and-forget (don't block the listener registration)
    window.electronAPI.getSystemInfo().then(info => {
      systemInfo.value = info
    }).catch(err => {
      console.error('getSystemInfo error:', err)
    })
  })

  onUnmounted(() => {
    if (window.electronAPI) {
      window.electronAPI.removeMonitorListener()
    }
  })

  function updateHistory(data: AllMonitorData) {
    try {
      const h = history.value
      const time = new Date(data.timestamp).toLocaleTimeString()
      
      h.cpu.push(data.cpu.currentLoad)
      h.cpuTemp.push(data.cpu.tempMain)
      h.gpu.push(
        data.gpu?.controllers?.length > 0 ? data.gpu.controllers[0].utilizationGpu : 0
      )
      h.gpuTemp.push(
        data.gpu?.controllers?.length > 0 ? data.gpu.controllers[0].temperature : 0
      )
      h.memory.push(data.memory.usagePercent)
      h.networkRx.push(data.network.rxSec)
      h.networkTx.push(data.network.txSec)
      h.timestamps.push(time)

      // Trim to max size
      if (h.cpu.length > MAX_HISTORY) {
        h.cpu.shift()
        h.cpuTemp.shift()
        h.gpu.shift()
        h.gpuTemp.shift()
        h.memory.shift()
        h.networkRx.shift()
        h.networkTx.shift()
        h.timestamps.shift()
      }

      // Trigger reactivity by creating NEW array references
      history.value = {
        cpu: [...h.cpu],
        cpuTemp: [...h.cpuTemp],
        gpu: [...h.gpu],
        gpuTemp: [...h.gpuTemp],
        memory: [...h.memory],
        networkRx: [...h.networkRx],
        networkTx: [...h.networkTx],
        timestamps: [...h.timestamps]
      }
    } catch (err) {
      console.error('[updateHistory] Error:', err)
    }
  }

  function formatBytes(bytes: number): string {
    if (bytes === 0) return '0.00 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  }

  function formatSpeed(bytesPerSec: number): string {
    if (bytesPerSec === 0) return '0.00 B/s'
    const k = 1024
    const sizes = ['B/s', 'KB/s', 'MB/s']
    const i = Math.floor(Math.log(bytesPerSec) / Math.log(k))
    if (i >= sizes.length) return (bytesPerSec / Math.pow(k, 2)).toFixed(2) + ' MB/s'
    return (bytesPerSec / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i]
  }

  return {
    systemInfo,
    monitorData,
    history,
    isConnected,
    error,
    formatBytes,
    formatSpeed,
    // Exposed for testing
    ...(process.env.NODE_ENV === 'test' ? { updateHistory, MAX_HISTORY } : {})
  }
}
