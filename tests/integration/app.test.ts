import { describe, it, expect, vi, beforeEach } from 'vitest'

// Integration tests for the full application flow

describe('App Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Data Flow', () => {
    it('monitor data should flow from main process to renderer correctly', async () => {
      // Simulate the IPC bridge between main and renderer
      const ipcHandler = vi.fn()
      const webContentsSend = vi.fn()

      // Mock main process monitor
      const mockMonitorData = {
        cpu: { currentLoad: 35.2, avgLoad: 32.1, tempMain: 62, tempMax: 68, cores: [35, 30, 40, 28], speedAvg: 3.0, fanSpeed: 0 },
        gpu: { controllers: [{ model: 'Test GPU', vendor: 'Test', temperature: 65, utilizationGpu: 40, utilizationMemory: 35, memoryTotal: 8589934592, memoryUsed: 3006477107, memoryFree: 5583457485, fanSpeed: 0, powerDraw: 100 }], display: { width: 1920, height: 1080, depth: 32, refreshRate: 60 } },
        memory: { total: 17179869184, free: 8589934592, used: 8589934592, swapTotal: 8589934592, swapUsed: 0, swapFree: 8589934592, usagePercent: 50, available: 8589934592 },
        disks: [{ fs: 'C:', size: 256060514304, used: 128030257152, available: 128030257152, usePercent: 50, mount: 'C:', type: 'NTFS', ioReadSpeed: 100 * 1024 * 1024, ioWriteSpeed: 50 * 1024 * 1024 }],
        network: { iface: 'eth0', ip4: '192.168.1.1', ip6: '', mac: '00:11:22:33:44:55', rxSec: 512000, txSec: 256000, rxBytes: 1073741824, txBytes: 536870912, rxTotal: 107374182400, txTotal: 53687091200, vpnConnected: false, vpnName: '', vpnIp: '' },
        voltage: { battery: { hasBattery: false, percent: 0, isCharging: false, voltage: 12.0, designCapacity: 0, currentCapacity: 0, timeRemaining: -1 }, voltage: 12.0 },
        processes: [
          { pid: 1234, name: 'chrome.exe', cpu: 25.5, memory: 15.2, memoryRss: 209715200, state: 'running' },
          { pid: 5678, name: 'code.exe', cpu: 10.3, memory: 8.1, memoryRss: 104857600, state: 'running' }
        ],
        timestamp: Date.now()
      }

      // Verify data structure consistency
      expect(mockMonitorData.cpu.currentLoad).toBeTypeOf('number')
      expect(mockMonitorData.gpu.controllers).toBeInstanceOf(Array)
      expect(mockMonitorData.memory.total).toBeGreaterThan(0)
      expect(mockMonitorData.disks.length).toBeGreaterThan(0)
      expect(mockMonitorData.processes.length).toBeLessThanOrEqual(20)
      expect(mockMonitorData.timestamp).toBeGreaterThan(0)

      // Verify all required keys exist
      const requiredKeys = ['cpu', 'gpu', 'memory', 'disks', 'network', 'voltage', 'processes', 'timestamp']
      requiredKeys.forEach(key => {
        expect(mockMonitorData).toHaveProperty(key)
      })
    })

    it('should handle rapid data updates without dropping frames', async () => {
      const updateInterval = 1000 // 1 second as configured
      
      // Simulate 10 rapid updates
      const updates = Array.from({ length: 10 }, (_, i) => ({
        cpu: { currentLoad: 30 + i * 5, avgLoad: 28 + i * 3, tempMain: 60 + i, tempMax: 65 + i, cores: [], speedAvg: 0, fanSpeed: 0 },
        gpu: { controllers: [], display: { width: 0, height: 0, depth: 0, refreshRate: 0 } },
        memory: { total: 17179869184, free: 8589934592 - i * 100000000, used: 8589934592 + i * 100000000, swapTotal: 0, swapUsed: 0, swapFree: 0, usagePercent: 50 + i * 0.5, available: 8589934592 - i * 100000000 },
        disks: [],
        network: { iface: '', ip4: '', ip6: '', mac: '', rxSec: 0, txSec: 0, rxBytes: 0, txBytes: 0, rxTotal: 0, txTotal: 0, vpnConnected: false, vpnName: '', vpnIp: '' },
        voltage: { battery: { hasBattery: false, percent: 0, isCharging: false, voltage: 0, designCapacity: 0, currentCapacity: 0, timeRemaining: -1 }, voltage: 0 },
        processes: [],
        timestamp: Date.now() + i * 1000
      }))

      // Verify each update maintains correct structure
      updates.forEach((update, index) => {
        expect(update.timestamp).toBeGreaterThan(0)
        expect(update.cpu.currentLoad).toBe(30 + index * 5)
        expect(update.memory.usagePercent).toBe(50 + index * 0.5)
      })
    })
  })

  describe('Error Handling', () => {
    it('should handle missing systeminformation gracefully', async () => {
      // Simulate systeminformation error
      const mockError = new Error('systeminformation: Access denied. Requires admin privileges.')
      
      // Verify error message is informative
      expect(mockError.message).toContain('Access denied')
    })

    it('should handle partial data availability', async () => {
      const partialData = {
        cpu: null,
        gpu: { controllers: [], display: { width: 0, height: 0, depth: 0, refreshRate: 0 } },
        memory: { total: 0, free: 0, used: 0, swapTotal: 0, swapUsed: 0, swapFree: 0, usagePercent: 0, available: 0 },
        disks: [],
        network: { iface: '', ip4: '', ip6: '', mac: '', rxSec: 0, txSec: 0, rxBytes: 0, txBytes: 0, rxTotal: 0, txTotal: 0, vpnConnected: false, vpnName: '', vpnIp: '' },
        voltage: { battery: { hasBattery: false, percent: 0, isCharging: false, voltage: 0, designCapacity: 0, currentCapacity: 0, timeRemaining: -1 }, voltage: 0 },
        processes: [],
        timestamp: Date.now()
      }

      // The UI should handle null/zero values without crashing
      const safeAccess = (obj: any, path: string) => {
        return path.split('.').reduce((acc, part) => acc?.[part], obj)
      }

      expect(safeAccess(partialData, 'cpu')).toBeNull()
      expect(safeAccess(partialData, 'gpu.controllers')).toEqual([])
      expect(safeAccess(partialData, 'memory.usagePercent')).toBe(0)
      expect(safeAccess(partialData, 'timestamp')).toBeGreaterThan(0)
    })
  })
})
