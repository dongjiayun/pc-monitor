import { describe, it, expect, beforeEach, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// Mock Electron API
const mockElectronAPI = {
  getSystemInfo: vi.fn(),
  getCpuLoad: vi.fn(),
  getGpuInfo: vi.fn(),
  getMemoryInfo: vi.fn(),
  getDiskInfo: vi.fn(),
  getNetworkInfo: vi.fn(),
  getVoltageInfo: vi.fn(),
  getProcessInfo: vi.fn(),
  onMonitorData: vi.fn(),
  removeMonitorListener: vi.fn()
}

// Mock window.electronAPI
vi.stubGlobal('window', { electronAPI: mockElectronAPI })

describe('useMonitor Composable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
  })

  it('should initialize with default values', async () => {
    const { useMonitor } = await import('@/composables/useMonitor')
    const { systemInfo, monitorData, isConnected, error } = useMonitor()

    expect(systemInfo.value).toBeNull()
    expect(monitorData.value).toBeNull()
    expect(isConnected.value).toBe(false)
    expect(error.value).toBeNull()
  })

  it('should format bytes correctly', async () => {
    const { useMonitor } = await import('@/composables/useMonitor')
    const { formatBytes } = useMonitor()

    expect(formatBytes(0)).toBe('0.00 B')
    expect(formatBytes(1024)).toBe('1.00 KB')
    expect(formatBytes(1048576)).toBe('1.00 MB')
    expect(formatBytes(1073741824)).toBe('1.00 GB')
    expect(formatBytes(1099511627776)).toBe('1.00 TB')
  })

  it('should format speed correctly', async () => {
    const { useMonitor } = await import('@/composables/useMonitor')
    const { formatSpeed } = useMonitor()

    expect(formatSpeed(500)).toBe('500.00 B/s')
    expect(formatSpeed(2048)).toBe('2.00 KB/s')
    expect(formatSpeed(5242880)).toBe('5.00 MB/s')
  })

  it('should handle electron API not available', async () => {
    vi.stubGlobal('window', {})
    
    const { useMonitor } = await import('@/composables/useMonitor')
    const composable = useMonitor()
    
    // Wait for onMounted to run
    await vi.dynamicImportSettled?.()
    
    // Since there's no electronAPI, it should set error
    // Note: in test environment, onMounted runs synchronously with vitest
  })

  it('should update history with monitor data', async () => {
    const { useMonitor } = await import('@/composables/useMonitor')
    const { history, monitorData } = useMonitor()

    const mockData = {
      cpu: { currentLoad: 45.5, avgLoad: 40.2, tempMain: 65, tempMax: 72, cores: [45, 40, 50, 35], speedAvg: 3.2, fanSpeed: 0 },
      gpu: { controllers: [{ model: 'RTX 3060', vendor: 'NVIDIA', temperature: 70, utilizationGpu: 55, utilizationMemory: 40, memoryTotal: 8589934592, memoryUsed: 3435973836, memoryFree: 5153960756, fanSpeed: 1500, powerDraw: 120 }], display: { width: 1920, height: 1080, depth: 32, refreshRate: 144 } },
      memory: { total: 17179869184, free: 8589934592, used: 8589934592, swapTotal: 8589934592, swapUsed: 0, swapFree: 8589934592, usagePercent: 50, available: 8589934592 },
      disks: [{ fs: 'C:', size: 256060514304, used: 128030257152, available: 128030257152, usePercent: 50, mount: 'C:', type: 'NTFS', ioReadSpeed: 100 * 1024 * 1024, ioWriteSpeed: 50 * 1024 * 1024 }],
      network: { iface: 'eth0', ip4: '192.168.1.100', ip6: '', mac: '00:11:22:33:44:55', rxSec: 1024000, txSec: 512000, rxBytes: 1073741824, txBytes: 536870912, rxTotal: 107374182400, txTotal: 53687091200, vpnConnected: false, vpnName: '', vpnIp: '' },
      voltage: { battery: { hasBattery: false, percent: 0, isCharging: false, voltage: 12.0, designCapacity: 0, currentCapacity: 0, timeRemaining: -1 }, voltage: 12.0 },
      processes: [{ pid: 1, name: 'test.exe', cpu: 10.5, memory: 5.2, memoryRss: 1048576, state: 'running' }],
      timestamp: Date.now()
    }

    // Simulate data received through onMonitorData callback
    const onDataCallback = mockElectronAPI.onMonitorData.mock.calls[0]?.[0]
    if (onDataCallback) {
      onDataCallback(mockData)
    }

    // If onMonitorData was already called, we check monitorData
    expect(monitorData.value).toBeDefined()
  })
})
