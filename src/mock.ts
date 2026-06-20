/**
 * Mock data for browser preview (when running without Electron)
 */
export function setupMockAPI() {
  if (window.electronAPI) return // real Electron, skip mock

  const mockSystemInfo = {
    os: 'Windows 11 Pro 64位',
    hostname: 'DESKTOP-PC',
    platform: 'win32',
    arch: 'x64',
    kernel: '10.0.22621',
    cpuBrand: 'Intel(R) Core(TM) i7-13700H',
    cpuCores: 16,
    cpuPhysicalCores: 8,
    cpuSpeed: '2.4 GHz',
    systemUptime: '2d 14h 32m'
  }

  function generateCpuLoad() {
    return {
      currentLoad: 35 + Math.random() * 30,
      avgLoad: 30 + Math.random() * 20,
      tempMain: 55 + Math.random() * 20,
      tempMax: 75 + Math.random() * 10,
      cores: Array.from({ length: 8 }, () => Math.random() * 80 + 10),
      speedAvg: 2.8 + Math.random() * 0.8,
      fanSpeed: 0
    }
  }

  function generateGpuInfo() {
    return {
      controllers: [{
        model: 'NVIDIA GeForce RTX 4060',
        vendor: 'NVIDIA',
        temperature: 50 + Math.random() * 30,
        utilizationGpu: Math.random() * 60 + 10,
        utilizationMemory: Math.random() * 40 + 10,
        memoryTotal: 8589934592,
        memoryUsed: 2147483648 + Math.random() * 2147483648,
        memoryFree: 4294967296 - Math.random() * 2147483648,
        fanSpeed: 800 + Math.random() * 1200,
        powerDraw: 60 + Math.random() * 55
      }],
      display: { width: 1920, height: 1080, depth: 32, refreshRate: 144 }
    }
  }

  function generateMemoryInfo() {
    const total = 34359738368 // 32GB
    const used = 8589934592 + Math.random() * 8589934592
    return {
      total,
      free: total - used,
      used,
      swapTotal: 8589934592,
      swapUsed: 104857600,
      swapFree: 8485076992,
      usagePercent: (used / total) * 100,
      available: total - used,
      layouts: [
        {
          size: 17179869184,
          type: 'DDR5',
          speed: '5600 MHz',
          manufacturer: 'Corsair',
          partNum: 'CMK32GX5M2B5600C36',
          serialNum: 'SN12345678',
          formFactor: 'DIMM',
          clockSpeed: 5600,
          voltageConfigured: 1.1
        },
        {
          size: 17179869184,
          type: 'DDR5',
          speed: '5600 MHz',
          manufacturer: 'Corsair',
          partNum: 'CMK32GX5M2B5600C36',
          serialNum: 'SN87654321',
          formFactor: 'DIMM',
          clockSpeed: 5600,
          voltageConfigured: 1.1
        }
      ]
    }
  }

  function generateDiskInfo() {
    return [
      {
        fs: 'C:\\',
        size: 512110190592,
        used: 256060514304,
        available: 256049676288,
        usePercent: 50,
        mount: 'C:',
        type: 'NTFS',
        ioReadSpeed: (120 + Math.random() * 80) * 1024 * 1024,
        ioWriteSpeed: (40 + Math.random() * 60) * 1024 * 1024,
        isSSD: true,
        healthStatus: 'Good',
        diskName: 'Samsung SSD 990 Pro',
        diskVendor: 'Samsung',
        interfaceType: 'NVMe',
        diskTemp: 42 + Math.random() * 8
      },
      {
        fs: 'D:\\',
        size: 1024123453440,
        used: 512061743104,
        available: 512061710336,
        usePercent: 50,
        mount: 'D:',
        type: 'NTFS',
        ioReadSpeed: (80 + Math.random() * 60) * 1024 * 1024,
        ioWriteSpeed: (30 + Math.random() * 40) * 1024 * 1024,
        isSSD: false,
        healthStatus: 'Good',
        diskName: 'WD Blue 1TB',
        diskVendor: 'Western Digital',
        interfaceType: 'SATA',
        diskTemp: 38 + Math.random() * 5
      },
      {
        fs: 'E:\\',
        size: 256060514304,
        used: 179242360013,
        available: 76818154291,
        usePercent: 70,
        mount: 'E:',
        type: 'NTFS',
        ioReadSpeed: (60 + Math.random() * 40) * 1024 * 1024,
        ioWriteSpeed: (20 + Math.random() * 30) * 1024 * 1024,
        isSSD: true,
        healthStatus: 'Good',
        diskName: 'Crucial P3 Plus',
        diskVendor: 'Micron',
        interfaceType: 'NVMe',
        diskTemp: 40 + Math.random() * 6
      }
    ]
  }

  let mockNetworkRxTotal = 10737418240   // 10 GB baseline
  let mockNetworkTxTotal = 5368709120    // 5 GB baseline
  let mockCallCount = 0

  function generateNetworkInfo() {
    mockCallCount++
    const rxSec = 102400 + Math.random() * 2048000
    const txSec = 51200 + Math.random() * 1024000
    // Increase cumulative totals each tick so Pinia delta tracking works
    mockNetworkRxTotal += Math.round(rxSec + Math.random() * 102400)
    mockNetworkTxTotal += Math.round(txSec + Math.random() * 51200)
    return {
      iface: 'Realtek PCIe GbE',
      ip4: '192.168.1.100',
      ip6: 'fe80::1',
      mac: '00:1A:2B:3C:4D:5E',
      rxSec,
      txSec,
      rxBytes: mockNetworkRxTotal,
      txBytes: mockNetworkTxTotal
    }
  }

  function generateVoltageInfo() {
    return {
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

  function generateProcesses() {
    const processes = [
      { name: 'chrome.exe', cpuBase: 25 },
      { name: 'code.exe', cpuBase: 12 },
      { name: 'System', cpuBase: 8 },
      { name: 'discord.exe', cpuBase: 6 },
      { name: 'spotify.exe', cpuBase: 5 },
      { name: 'explorer.exe', cpuBase: 4 },
      { name: 'nvcontainer.exe', cpuBase: 3 },
      { name: 'steam.exe', cpuBase: 3 },
      { name: 'python.exe', cpuBase: 2.5 },
      { name: 'node.exe', cpuBase: 2 },
      { name: 'svchost.exe', cpuBase: 1.8 },
      { name: 'SearchIndexer.exe', cpuBase: 1.5 },
      { name: 'OneDrive.exe', cpuBase: 1.2 },
      { name: 'Teams.exe', cpuBase: 1 },
      { name: 'Widgets.exe', cpuBase: 0.8 }
    ]
    return processes.map((p, i) => ({
      pid: 1000 + i,
      name: p.name,
      cpu: p.cpuBase + Math.random() * 5,
      memory: 1 + Math.random() * 10,
      memoryRss: 52428800 + Math.random() * 524288000,
      state: 'running'
    }))
  }

  // Inject mock API
  ;(window as any).electronAPI = {
    getSystemInfo: () => Promise.resolve(mockSystemInfo),

    getCpuLoad: () => Promise.resolve(generateCpuLoad()),
    getGpuInfo: () => Promise.resolve(generateGpuInfo()),
    getMemoryInfo: () => Promise.resolve(generateMemoryInfo()),
    getDiskInfo: () => Promise.resolve(generateDiskInfo()),
    getNetworkInfo: () => Promise.resolve(generateNetworkInfo()),
    getVoltageInfo: () => Promise.resolve(generateVoltageInfo()),
    getProcessInfo: () => Promise.resolve(generateProcesses()),

    onMonitorData: (callback: (data: any) => void) => {
      // Push mock data every second
      const interval = setInterval(() => {
        callback({
          cpu: generateCpuLoad(),
          gpu: generateGpuInfo(),
          memory: generateMemoryInfo(),
          disks: generateDiskInfo(),
          network: generateNetworkInfo(),
          voltage: generateVoltageInfo(),
          processes: generateProcesses(),
          timestamp: Date.now()
        })
      }, 1000)
      // Store interval for cleanup
      ;(window as any).__monitorInterval = interval
    },

    removeMonitorListener: () => {
      if ((window as any).__monitorInterval) {
        clearInterval((window as any).__monitorInterval)
      }
    },

    minimize: () => console.log('[Mock] minimize'),
    maximize: () => console.log('[Mock] maximize'),
    close: () => console.log('[Mock] close'),
    toggleWindow: () => console.log('[Mock] toggle-window'),
    onOpenSettings: () => {},
    removeSettingsListener: () => {}
  }
}
