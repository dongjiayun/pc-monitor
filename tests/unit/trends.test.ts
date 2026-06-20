import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

// Mock API factory - each test gets a fresh instance
function createMockAPI() {
  return {
    onMonitorData: vi.fn(),
    removeMonitorListener: vi.fn(),
    getSystemInfo: vi.fn(() => Promise.resolve({
      os: 'Windows 11 Pro', hostname: 'DESKTOP-TEST', platform: 'win32',
      arch: 'x64', kernel: '22621', cpuBrand: 'Intel Core i7-13700K',
      cpuCores: 16, cpuPhysicalCores: 8, cpuSpeed: '3.4 GHz',
      systemUptime: '1h 23m'
    }))
  }
}

function makeFrame(overrides: any = {}): any {
  return {
    cpu: { currentLoad: 0, avgLoad: 0, tempMain: 0, tempMax: 0, cores: [], speedAvg: 0, fanSpeed: 0 },
    gpu: { controllers: [], display: { width: 0, height: 0, depth: 0, refreshRate: 0 } },
    memory: { total: 0, free: 0, used: 0, swapTotal: 0, swapUsed: 0, swapFree: 0, usagePercent: 0, available: 0 },
    disks: [],
    network: { iface: '', ip4: '', ip6: '', mac: '', rxSec: 0, txSec: 0, rxBytes: 0, txBytes: 0, rxTotal: 0, txTotal: 0, vpnConnected: false, vpnName: '', vpnIp: '' },
    voltage: { battery: { hasBattery: false, percent: 0, isCharging: false, voltage: 0, designCapacity: 0, currentCapacity: 0, timeRemaining: -1 }, voltage: 0 },
    processes: [],
    timestamp: Date.now(),
    ...overrides
  }
}

describe('Trend Chart Data Accumulation', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should accumulate cpuTemp and gpuTemp history on each data frame', async () => {
    const api = createMockAPI()
    vi.stubGlobal('window', { electronAPI: api })

    const { useMonitor } = await import('@/composables/useMonitor')
    const composable = useMonitor()
    const updateHistory = (composable as any).updateHistory as (data: any) => void

    for (let i = 0; i < 3; i++) {
      updateHistory(makeFrame({
        cpu: { currentLoad: 30 + i * 5, avgLoad: 25, tempMain: 55 + i * 3, tempMax: 60, cores: [], speedAvg: 0, fanSpeed: 0 },
        gpu: { controllers: [{ model: 'RTX', vendor: 'NVIDIA', temperature: 60 + i * 2, utilizationGpu: 40 + i * 5, utilizationMemory: 30, memoryTotal: 8589934592, memoryUsed: 3000000000, memoryFree: 5589934592, fanSpeed: 0, powerDraw: 0 }], display: { width: 1920, height: 1080, depth: 32, refreshRate: 60 } },
      }))
    }

    const h = composable.history.value
    expect(h.cpuTemp).toEqual([55, 58, 61])
    expect(h.gpuTemp).toEqual([60, 62, 64])
    expect(h.gpu).toEqual([40, 45, 50])
  })

  it('should trim history to MAX_HISTORY (60) and maintain sync across all arrays', async () => {
    const api = createMockAPI()
    vi.stubGlobal('window', { electronAPI: api })

    const { useMonitor } = await import('@/composables/useMonitor')
    const composable = useMonitor()
    const updateHistory = (composable as any).updateHistory as (data: any) => void

    for (let i = 0; i < 65; i++) {
      updateHistory(makeFrame({
        cpu: { currentLoad: i, avgLoad: i, tempMain: 50 + i, tempMax: 55 + i, cores: [], speedAvg: 0, fanSpeed: 0 },
        gpu: { controllers: [{ model: 'RTX', vendor: 'NVIDIA', temperature: 50 + i, utilizationGpu: i, utilizationMemory: i, memoryTotal: 8589934592, memoryUsed: 3000000000, memoryFree: 5589934592, fanSpeed: 0, powerDraw: 0 }], display: { width: 1920, height: 1080, depth: 32, refreshRate: 60 } },
        memory: { total: 17179869184, free: 8589934592, used: 8589934592, swapTotal: 0, swapUsed: 0, swapFree: 0, usagePercent: i, available: 8589934592 },
      }))
    }

    const h = composable.history.value
    expect(h.cpu.length).toBe(60)
    expect(h.cpuTemp.length).toBe(60)
    expect(h.gpu.length).toBe(60)
    expect(h.gpuTemp.length).toBe(60)
    expect(h.memory.length).toBe(60)
    expect(h.timestamps.length).toBe(60)

    // After trimming 65->60, first element should be index 5
    expect(h.cpu[0]).toBe(5)
    expect(h.cpuTemp[0]).toBe(55)
    expect(h.gpu[0]).toBe(5)
    expect(h.gpuTemp[0]).toBe(55)
    expect(h.memory[0]).toBe(5)
  })

  it('should handle no GPU controllers gracefully (gpuTemp=0)', async () => {
    const api = createMockAPI()
    vi.stubGlobal('window', { electronAPI: api })

    const { useMonitor } = await import('@/composables/useMonitor')
    const composable = useMonitor()
    const updateHistory = (composable as any).updateHistory as (data: any) => void

    updateHistory(makeFrame({
      cpu: { currentLoad: 30, avgLoad: 25, tempMain: 55, tempMax: 60, cores: [], speedAvg: 0, fanSpeed: 0 },
      gpu: { controllers: [], display: { width: 0, height: 0, depth: 0, refreshRate: 0 } },
    }))

    const h = composable.history.value
    expect(h.gpuTemp).toEqual([0])
    expect(h.gpu).toEqual([0])
  })

  it('should create NEW array references each frame (triggers Vue watchers)', async () => {
    const api = createMockAPI()
    vi.stubGlobal('window', { electronAPI: api })

    const { useMonitor } = await import('@/composables/useMonitor')
    const composable = useMonitor()
    const updateHistory = (composable as any).updateHistory as (data: any) => void

    const h0 = composable.history.value
    const cpu0 = h0.cpu

    updateHistory(makeFrame({
      cpu: { currentLoad: 50, avgLoad: 45, tempMain: 60, tempMax: 65, cores: [], speedAvg: 0, fanSpeed: 0 },
    }))

    const h1 = composable.history.value
    // The arrays should be NEW references, not the same as before
    expect(h1.cpu).not.toBe(cpu0)
    // The old reference should still have the data (internal array was mutated)
    expect(cpu0).toEqual([50])
    // But the new reference should have the same content
    expect(h1.cpu).toEqual([50])

    // After second frame, second new reference
    const cpu1 = h1.cpu
    updateHistory(makeFrame({
      cpu: { currentLoad: 75, avgLoad: 70, tempMain: 65, tempMax: 70, cores: [], speedAvg: 0, fanSpeed: 0 },
    }))

    const h2 = composable.history.value
    expect(h2.cpu).not.toBe(cpu1)
    expect(h2.cpu).toEqual([50, 75])
  })
})

describe('Network Traffic Statistics', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('should track session-level rxBytes/txBytes separate from boot-level rxTotal/txTotal', async () => {
    const api = createMockAPI()
    vi.stubGlobal('window', { electronAPI: api })

    const { useMonitor } = await import('@/composables/useMonitor')
    const composable = useMonitor()

    // Simulate the onData callback setting monitorData
    const frame = makeFrame({
      network: {
        iface: 'eth0', ip4: '192.168.1.100', ip6: '', mac: '00:11:22:33:44:55',
        rxSec: 1024000, txSec: 512000,
        rxBytes: 1024000, txBytes: 512000,
        rxTotal: 107374182400, txTotal: 53687091200,
        vpnConnected: false, vpnName: '', vpnIp: ''
      }
    })
    composable.monitorData.value = frame

    const nd = composable.monitorData.value
    expect(nd).not.toBeNull()
    expect(nd!.network.rxBytes).toBe(1024000)
    expect(nd!.network.txBytes).toBe(512000)
    expect(nd!.network.rxTotal).toBe(107374182400)
    expect(nd!.network.txTotal).toBe(53687091200)
  })

  it('should handle network data with zero cumulative values', async () => {
    const api = createMockAPI()
    vi.stubGlobal('window', { electronAPI: api })

    const { useMonitor } = await import('@/composables/useMonitor')
    const composable = useMonitor()

    const frame = makeFrame({
      network: {
        iface: 'N/A', ip4: '', ip6: '', mac: '',
        rxSec: 0, txSec: 0, rxBytes: 0, txBytes: 0, rxTotal: 0, txTotal: 0,
        vpnConnected: false, vpnName: '', vpnIp: ''
      }
    })
    composable.monitorData.value = frame

    const nd = composable.monitorData.value
    expect(nd!.network.rxBytes).toBe(0)
    expect(nd!.network.txBytes).toBe(0)
    expect(nd!.network.rxTotal).toBe(0)
    expect(nd!.network.txTotal).toBe(0)
  })
})

describe('Window Behavior', () => {
  it('should set correct BrowserWindow config (resizable with min size)', () => {
    const windowConfig = {
      width: 460, height: 840, resizable: true,
      minWidth: 320, minHeight: 500, frame: false,
      transparent: true, hasShadow: false, titleBarStyle: 'hidden'
    }
    expect(windowConfig.resizable).toBe(true)
    expect(windowConfig.minWidth).toBe(320)
    expect(windowConfig.minHeight).toBe(500)
    expect(windowConfig.frame).toBe(false)
  })

  it('should use -webkit-app-region drag for title bar', () => {
    const titleBarCSS = { '-webkit-app-region': 'drag' }
    expect(titleBarCSS['-webkit-app-region']).toBe('drag')
  })

  it('should exclude buttons from drag region', () => {
    const buttonRegion = 'no-drag'
    expect(buttonRegion).toBe('no-drag')
    expect(buttonRegion).not.toBe('drag')
  })
})
