import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'

vi.mock('@antv/g2', () => {
  function createMarkMock() {
    const mark = {
      data: vi.fn(() => mark),
      encode: vi.fn(() => mark),
      style: vi.fn(() => mark),
      scale: vi.fn(() => mark),
      axis: vi.fn(() => mark),
      legend: vi.fn(() => mark),
      changeData: vi.fn(),
    }
    return mark
  }
  const chartMock = {
    axis: vi.fn(() => chartMock),
    legend: vi.fn(() => chartMock),
    line: vi.fn(() => createMarkMock()),
    area: vi.fn(() => createMarkMock()),
    render: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
  }
  return { Chart: vi.fn(() => chartMock) }
})

// Mock echarts
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: vi.fn(),
    dispose: vi.fn()
  })),
  graphic: {
    LinearGradient: vi.fn()
  }
}))

describe('Monitor Components', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  describe('CpuMonitor', () => {
    it('should render CPU load correctly', async () => {
      const CpuMonitor = (await import('@/components/CpuMonitor.vue')).default
      const wrapper = mount(CpuMonitor, {
        props: {
          data: {
            currentLoad: 45.5,
            avgLoad: 40.2,
            tempMain: 65,
            tempMax: 72,
            cores: [45, 40, 50, 35, 55, 30, 48, 38],
            speedAvg: 3.2,
            fanSpeed: 0
          },
          history: [40, 42, 45, 43, 46, 45],
          tempHistory: [60, 62, 65, 63, 64, 65],
          timestamps: ['12:00:01', '12:00:02', '12:00:03', '12:00:04', '12:00:05', '12:00:06'],
          cpuBrand: 'Intel Core i7-13700K @ 3.4GHz',
          cpuCores: 16,
          cpuPhysicalCores: 8,
          cpuSpeed: '3.4 GHz'
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('CPU')
      expect(wrapper.text()).toContain('45.50')
      expect(wrapper.text()).toContain('65.00°C')
      // Intel hybrid detection: 16C/8T → P-cores + E-cores
      expect(wrapper.text()).toContain('P-核')
      // Only 8 cores provided, E-cores not present in this test data
    })

    it('should show core load bars', async () => {
      const CpuMonitor = (await import('@/components/CpuMonitor.vue')).default
      const wrapper = mount(CpuMonitor, {
        props: {
          data: {
            currentLoad: 30,
            avgLoad: 28,
            tempMain: 55,
            tempMax: 60,
            cores: [30, 25, 35, 28],
            speedAvg: 3.0,
            fanSpeed: 0
          },
          history: [],
          tempHistory: [],
          timestamps: [],
          cpuCores: 8,
          cpuPhysicalCores: 4
        }
      })

      // Should show 4 core load bars in core-grid
      const coreBars = wrapper.findAll('.core-bar-v-fill')
      expect(coreBars.length).toBeGreaterThanOrEqual(4)
    })
  })

  describe('MemoryMonitor', () => {
    it('should render memory usage correctly', async () => {
      const MemoryMonitor = (await import('@/components/MemoryMonitor.vue')).default
      const wrapper = mount(MemoryMonitor, {
        props: {
          data: {
            total: 17179869184,  // 16 GB
            free: 8589934592,    // 8 GB
            used: 8589934592,    // 8 GB
            swapTotal: 8589934592,
            swapUsed: 0,
            swapFree: 8589934592,
            usagePercent: 50,
            available: 8589934592,
            layouts: []
          },
          history: [48, 49, 50, 51, 50],
          timestamps: ['12:00:01', '12:00:02', '12:00:03', '12:00:04', '12:00:05'],
          formatBytes: (bytes: number) => {
            const gb = bytes / 1024 / 1024 / 1024
            return `${gb.toFixed(1)} GB`
          },
          formatSpeed: (bps: number) => `${(bps / 1024 / 1024).toFixed(1)} MB/s`
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('内存')
      expect(wrapper.text()).toContain('50.00%')
      expect(wrapper.text()).toContain('8.0 GB')  // used (formatBytes returns 1 decimal)
      expect(wrapper.text()).toContain('16.0 GB') // total
    })
  })

  describe('GpuMonitor', () => {
    it('should render GPU info correctly', async () => {
      const GpuMonitor = (await import('@/components/GpuMonitor.vue')).default
      const wrapper = mount(GpuMonitor, {
        props: {
          data: {
            controllers: [{
              model: 'NVIDIA GeForce RTX 3060',
              vendor: 'NVIDIA',
              temperature: 70,
              utilizationGpu: 55,
              utilizationMemory: 40,
              memoryTotal: 8589934592,
              memoryUsed: 3435973836,
              memoryFree: 5153960756,
              fanSpeed: 1500,
              powerDraw: 120
            }],
            display: { width: 1920, height: 1080, depth: 32, refreshRate: 144 }
          },
          history: [50, 52, 55, 53],
          tempHistory: [65, 67, 70, 68],
          timestamps: ['12:00:01', '12:00:02', '12:00:03', '12:00:04']
        }
      })

      expect(wrapper.text()).toContain('GPU')
      expect(wrapper.text()).toContain('55')  // integer utilization
      expect(wrapper.text()).toContain('1920×1080')
      expect(wrapper.text()).toContain('144Hz')
    })
  })

  describe('NetworkMonitor', () => {
    it('should render network speed correctly', async () => {
      const NetworkMonitor = (await import('@/components/NetworkMonitor.vue')).default
      const wrapper = mount(NetworkMonitor, {
        props: {
          data: {
            iface: 'eth0',
            ip4: '192.168.1.100',
            ip6: '',
            mac: '00:11:22:33:44:55',
            rxSec: 1024000,
            txSec: 512000,
            rxBytes: 1073741824,
            txBytes: 536870912,
            rxTotal: 107374182400,
            txTotal: 53687091200,
            vpnConnected: false,
            vpnName: '',
            vpnIp: ''
          },
          rxHistory: [1000, 1024, 980, 1050],
          txHistory: [500, 512, 480, 520],
          timestamps: ['12:00:01', '12:00:02', '12:00:03', '12:00:04'],
          formatSpeed: (bps: number) => {
            if (bps < 1024) return `${bps.toFixed(1)} B/s`
            return `${(bps / 1024).toFixed(1)} KB/s`
          },
          formatBytes: (bytes: number) => {
            const gb = bytes / 1024 / 1024 / 1024
            return `${gb.toFixed(2)} GB`
          }
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('网络')
      expect(wrapper.text()).toContain('eth0')
      // Should show cumulative traffic
      expect(wrapper.text()).toContain('100.00 GB')
      expect(wrapper.text()).toContain('50.00 GB')
      // Should show session traffic
      expect(wrapper.text()).toContain('本次')
      expect(wrapper.text()).toContain('1.00 GB')
      expect(wrapper.text()).toContain('0.50 GB')
    })
  })

  describe('VoltageMonitor', () => {
    it('should show desktop mode when no battery', async () => {
      const VoltageMonitor = (await import('@/components/VoltageMonitor.vue')).default
      const wrapper = mount(VoltageMonitor, {
        props: {
          data: {
            battery: {
              hasBattery: false,
              percent: 0,
              isCharging: false,
              voltage: 12.0,
              designCapacity: 0,
              currentCapacity: 0,
              timeRemaining: -1
            },
            voltage: 12.0
          }
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('电源')
      expect(wrapper.text()).toContain('电池')
      expect(wrapper.text()).toContain('无')
    })

    it('should show battery info when battery present', async () => {
      const VoltageMonitor = (await import('@/components/VoltageMonitor.vue')).default
      const wrapper = mount(VoltageMonitor, {
        props: {
          data: {
            battery: {
              hasBattery: true,
              percent: 85,
              isCharging: true,
              voltage: 12.3,
              designCapacity: 5000,
              currentCapacity: 4250,
              timeRemaining: 7200
            },
            voltage: 12.3
          }
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('85')  // integer percent
      expect(wrapper.text()).toContain('充电')
      expect(wrapper.text()).toContain('12.3V')
    })
  })

  describe('DiskMonitor', () => {
    it('should render disk info correctly', async () => {
      const DiskMonitor = (await import('@/components/DiskMonitor.vue')).default
      const wrapper = mount(DiskMonitor, {
        props: {
          disks: [{
            fs: 'C:\\',
            size: 256060514304,
            used: 128030257152,
            available: 128030257152,
            usePercent: 50,
            mount: 'C:',
            type: 'NTFS',
            ioReadSpeed: 150.5 * 1024 * 1024,
            ioWriteSpeed: 75.2 * 1024 * 1024,
            isSSD: true,
            healthStatus: 'Good',
            diskName: 'Samsung SSD 990 Pro',
            diskVendor: 'Samsung',
            interfaceType: 'NVMe',
            diskTemp: 45,
            diskHealthPercent: 97,
            diskTotalWritten: 15230
          }],
          formatBytes: (bytes: number) => {
            const gb = bytes / 1024 / 1024 / 1024
            return `${gb.toFixed(1)} GB`
          },
          formatSpeed: (bps: number) => `${(bps / 1024 / 1024).toFixed(1)} MB/s`
        }
      })

      expect(wrapper.exists()).toBe(true)
      expect(wrapper.text()).toContain('硬盘')
      expect(wrapper.text()).toContain('C:')
      expect(wrapper.text()).toContain('50.00%')
    })

    it('should show empty state when no disks', async () => {
      const DiskMonitor = (await import('@/components/DiskMonitor.vue')).default
      const wrapper = mount(DiskMonitor, {
        props: {
          disks: [],
          formatBytes: (bytes: number) => `${bytes} B`,
          formatSpeed: () => ''
        }
      })

      expect(wrapper.text()).toContain('硬盘')
      expect(wrapper.text()).toContain('0%')
    })
  })
})
