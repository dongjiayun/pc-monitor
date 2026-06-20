/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}

interface Window {
  electronAPI: {
    getSystemInfo: () => Promise<SystemInfo>
    getCpuLoad: () => Promise<CpuLoadData>
    getGpuInfo: () => Promise<GpuInfoData>
    getMemoryInfo: () => Promise<MemoryInfoData>
    getDiskInfo: () => Promise<DiskInfoData[]>
    getNetworkInfo: () => Promise<NetworkInfoData>
    getVoltageInfo: () => Promise<VoltageInfoData>
    getProcessInfo: () => Promise<ProcessInfoData[]>
    onMonitorData: (callback: (data: AllMonitorData) => void) => void
    removeMonitorListener: () => void
    minimize: () => void
    close: () => void
    toggleWindow: () => void
    onOpenSettings: (callback: () => void) => void
    removeSettingsListener: () => void
    setAutoStart: (enable: boolean) => Promise<boolean>
    getAutoStart: () => Promise<boolean>
  } | null
}

interface SystemInfo {
  os: string
  hostname: string
  platform: string
  arch: string
  kernel: string
  cpuBrand: string
  cpuCores: number
  cpuPhysicalCores: number
  cpuSpeed: string
  systemUptime: string
}

interface CpuLoadData {
  currentLoad: number
  avgLoad: number
  tempMain: number
  tempMax: number
  cores: number[]
  speedAvg: number  // current CPU frequency in GHz
  fanSpeed: number
  powerDraw: number  // CPU package power in Watts
  processes: number
  threads: number
}

interface GpuInfoData {
  controllers: {
    model: string
    vendor: string
    temperature: number
    utilizationGpu: number
    utilizationMemory: number
    memoryTotal: number
    memoryUsed: number
    memoryFree: number
    fanSpeed: number
    powerDraw: number
  }[]
  display: {
    width: number
    height: number
    depth: number
    refreshRate: number
  }
}

interface MemoryInfoData {
  total: number
  free: number
  used: number
  swapTotal: number
  swapUsed: number
  swapFree: number
  usagePercent: number
  available: number
  layouts: MemoryLayoutItem[]
}

interface MemoryLayoutItem {
  size: number
  type: string
  speed: string
  manufacturer: string
  partNum: string
  serialNum: string
  formFactor: string
  clockSpeed: number
  voltageConfigured: number
}

interface DiskInfoData {
  fs: string
  size: number
  used: number
  available: number
  usePercent: number
  mount: string
  type: string
  ioReadSpeed: number
  ioWriteSpeed: number
  isSSD: boolean
  healthStatus: string  // 'Good' | 'Bad' | 'Unknown'
  diskName: string
  diskVendor: string
  interfaceType: string
  diskTemp: number
  diskHealthPercent: number  // 0-100, based on SSD wear level
  diskTotalWritten: number   // total data written (GB)
}

interface NetworkInfoData {
  iface: string
  ip4: string
  ip6: string
  mac: string
  rxSec: number
  txSec: number
  rxBytes: number
  txBytes: number
  rxTotal: number  // cumulative bytes received since boot
  txTotal: number  // cumulative bytes sent since boot
  vpnConnected: boolean
  vpnName: string
  vpnIp: string
}

interface VoltageInfoData {
  battery: {
    hasBattery: boolean
    percent: number
    isCharging: boolean
    voltage: number
    designCapacity: number
    currentCapacity: number
    timeRemaining: number
  }
  voltage: number
  // Motherboard rail voltages (from SuperIO)
  moboVcore: number | null
  mobo12V: number | null
  mobo5V: number | null
  mobo3V: number | null
  moboVcoreSoc: number | null
  // Temperature sensors from motherboard
  moboCpuSocketTemp: number | null
  moboChipsetTemp: number | null
  moboSystemTemp: number | null
  moboVrmTemp: number | null
  // Fan speeds from motherboard
  moboCpuFan: number | null
  moboSystemFan: number | null
}

interface ProcessInfoData {
  pid: number
  name: string
  cpu: number
  memory: number
  memoryRss: number
  state: string
}

interface AllMonitorData {
  cpu: CpuLoadData
  gpu: GpuInfoData
  memory: MemoryInfoData
  disks: DiskInfoData[]
  network: NetworkInfoData
  voltage: VoltageInfoData
  processes: ProcessInfoData[]
  totalPower: number  // estimated total system power consumption (W)
  timestamp: number
}
