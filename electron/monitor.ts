import { execFile } from 'child_process'
import path from 'path'

// ============================================================================
// Configuration
// ============================================================================
const DEBUG = true
function debug(...args: any[]) { if (DEBUG) console.log('[monitor]', ...args) }

// ============================================================================
// Single PowerShell script that collects ALL dynamic data in one invocation
// ============================================================================
// NOTE: Do NOT use backtick (`) inside PowerShell scripts — it conflicts with JS template literals.
// Use semicolons or keep commands on a single line instead.
const PS_DYNAMIC_SCRIPT = [
  '$ErrorActionPreference = "Stop"',
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  '$result = @{}',
  // CPU
  'try { $cpu = Get-CimInstance Win32_PerfFormattedData_PerfOS_Processor -ErrorAction Stop',
  '  $total = $cpu | Where-Object Name -eq "_Total" | Select-Object -First 1',
  '  $cores = $cpu | Where-Object Name -ne "_Total" | Sort-Object Name',
  '  $result.cpu = @{ currentLoad = [math]::Round([double]($total.PercentProcessorTime), 1); avgLoad = [math]::Round([double]($total.PercentProcessorTime), 1); cores = @($cores | ForEach-Object { [math]::Round([double]($_.PercentProcessorTime), 1) }) }',
  '} catch { $result.cpu = $null }',
  // CPU Current Frequency & System Counters
  'try { $cpuFreq = Get-CimInstance Win32_Processor -ErrorAction Stop | Select-Object -First 1; $freq = [math]::Round([double]$cpuFreq.CurrentClockSpeed / 1000.0, 2); $result.cpuFreq = $freq } catch { $result.cpuFreq = $null }',
  // System process/thread counts
  'try { $sysPerf = Get-CimInstance Win32_PerfFormattedData_PerfOS_System -ErrorAction Stop; $result.sysCounters = @{ processes = [int]$sysPerf.Processes; threads = [int]$sysPerf.Threads } } catch { $result.sysCounters = $null }',
  // CPU Temperature — try multiple sources, filter unreliable values
  'function Get-CpuTemp {',
  '  # Method 1: MSAcpi_ThermalZoneTemperature (always available, reports chassis temp)',
  '  try { $acpi = Get-CimInstance -Namespace root/WMI -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop; $acpiTemps = @($acpi | ForEach-Object { [math]::Round(($_.CurrentTemperature - 2732) / 10.0, 1) }) | Where-Object { $_ -gt 10 -and $_ -lt 120 }; if ($acpiTemps.Count -gt 0) { return @{ main = ($acpiTemps | Measure-Object -Maximum).Maximum; source = "acpi" } } } catch {}',
  '  return $null',
  '}',
  '$cpuTempResult = Get-CpuTemp',
  'if ($cpuTempResult) { $result.cpuTemp = $cpuTempResult } else { $result.cpuTemp = $null }',
  // Memory
  'try { $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop; $totalMem = [double]$os.TotalVisibleMemorySize * 1024; $freeMem = [double]$os.FreePhysicalMemory * 1024; $usedMem = $totalMem - $freeMem; $result.mem = @{ total = $totalMem; free = $freeMem; used = $usedMem; percent = if ($totalMem -gt 0) { [math]::Round($usedMem / $totalMem * 100, 1) } else { 0 }; available = $freeMem } } catch { $result.mem = $null }',
  // Disk IO
  'try { $diskPerf = Get-CimInstance Win32_PerfFormattedData_PerfDisk_PhysicalDisk -ErrorAction Stop | Where-Object Name -ne "_Total"; $result.disksIO = @($diskPerf | ForEach-Object { @{ name = $_.Name; readBytesPerSec = [math]::Round([double]($_.DiskReadBytesPerSec), 0); writeBytesPerSec = [math]::Round([double]($_.DiskWriteBytesPerSec), 0) } }) } catch { $result.disksIO = $null }',
  // Network (PerfFormattedData = rates)
  'try { $net = Get-CimInstance Win32_PerfFormattedData_Tcpip_NetworkInterface -ErrorAction Stop; $result.network = @($net | ForEach-Object { @{ iface = $_.Name; rxBytesPerSec = [math]::Round([double]($_.BytesReceivedPerSec), 0); txBytesPerSec = [math]::Round([double]($_.BytesSentPerSec), 0) } }) } catch { $result.network = $null }',
  // Network cumulative totals (PerfRawData = cumulative counters since boot)
  'try { $netRaw = Get-CimInstance Win32_PerfRawData_Tcpip_NetworkInterface -ErrorAction Stop; $result.netCumulative = @($netRaw | ForEach-Object { @{ iface = $_.Name; rxTotal = [double]$_.BytesReceivedPerSec; txTotal = [double]$_.BytesSentPerSec } }) } catch { $result.netCumulative = $null }',
  // Processes (top 15 by CPU)
  'try { $procs = Get-CimInstance Win32_PerfFormattedData_PerfProc_Process -ErrorAction Stop | Where-Object { $_.Name -ne "_Total" -and $_.Name -ne "Idle" } | Sort-Object PercentProcessorTime -Descending | Select-Object -First 15; $result.processes = @($procs | ForEach-Object { @{ name = $_.Name; pid = [int]$_.IDProcess; cpu = [math]::Round([double]($_.PercentProcessorTime), 1) } }) } catch { $result.processes = $null }',
  // Battery
  'try { $bat = Get-CimInstance Win32_Battery -ErrorAction Stop | Select-Object -First 1; if ($bat) { $result.battery = @{ hasBattery = $true; percent = [int]$bat.EstimatedChargeRemaining; isCharging = ($bat.BatteryStatus -eq 2) -or ($bat.BatteryStatus -eq 6) -or ($bat.BatteryStatus -eq 10); voltage = [double]$bat.DesignVoltage / 1000.0; timeRemaining = [int]$bat.EstimatedRunTime } } else { $result.battery = @{ hasBattery = $false } } } catch { $result.battery = @{ hasBattery = $false } }',
  // Filesystem / Partitions
  'try { $vols = Get-CimInstance Win32_Volume -ErrorAction Stop | Where-Object { $_.DriveLetter -and $_.DriveType -eq 3 }; $result.volumes = @($vols | ForEach-Object { @{ drive = $_.DriveLetter; label = $_.Label; size = [double]$_.Capacity; free = [double]$_.FreeSpace; used = [double]$_.Capacity - [double]$_.FreeSpace; usedPct = if ($_.Capacity -gt 0) { [math]::Round(([double]$_.Capacity - [double]$_.FreeSpace) / [double]$_.Capacity * 100, 1) } else { 0 }; fsType = $_.FileSystem } }) } catch { $result.volumes = $null }',
  // GPU Utilization via WMI Performance Counters (no LHM needed)
  'try { $gpuPerf = Get-CimInstance Win32_PerfFormattedData_GPUPerformanceCounters_GPUEngine -ErrorAction Stop; $result.gpuUtil = @($gpuPerf | ForEach-Object { @{ engine = $_.Name; utilPct = [math]::Round([double]($_.PercentOfTime), 1) } }) } catch { $result.gpuUtil = $null }',
  // GPU Temperature via WMI (works on many Windows systems)
  'function Get-GpuSensorTemp {',
  '  try { $t = Get-CimInstance -Namespace root/wmi -ClassName GPU_CurrentTemperature -ErrorAction Stop; if ($t -and $t.CurrentTemperature) { return [math]::Round([double]($t.CurrentTemperature / 10.0), 1) } } catch {}',
  '  try { $t = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction Stop; $vals = @($t | ForEach-Object { [math]::Round(($_.CurrentTemperature - 2732) / 10.0, 1) }) | Where-Object { $_ -gt 10 -and $_ -lt 120 }; if ($vals.Count -gt 0) { return ($vals | Measure-Object -Maximum).Maximum } } catch {}',
  '  try { $t = Get-CimInstance -Namespace root/wmi -ClassName NVIDIA_Gpu_Temperature -ErrorAction Stop; if ($t) { return [math]::Round([double]($t.Temperature), 1) } } catch {}',
  '  return $null',
  '}',
  '$result.gpuSensorTemp = Get-GpuSensorTemp',
  // GPU Fan Speed via WMI
  'try { $f = Get-CimInstance -Namespace root/wmi -ClassName GPU_FanSpeed -ErrorAction Stop; $result.gpuSensorFan = [math]::Round([double]($f.FanSpeed), 0) } catch { $result.gpuSensorFan = $null }',
  // Output as Base64 to avoid encoding issues
  '$json = ConvertTo-Json $result -Compress -Depth 3',
  '[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))'
].join('\n')

// ============================================================================
// Static data (fetched once, cached forever)
// ============================================================================
const PS_STATIC_SCRIPT = [
  '$ErrorActionPreference = "Stop"',
  '[Console]::OutputEncoding = [System.Text.Encoding]::UTF8',
  '$result = @{}',
  // System Info
  'try { $os = Get-CimInstance Win32_OperatingSystem -ErrorAction Stop; $cpu = Get-CimInstance Win32_Processor -ErrorAction Stop | Select-Object -First 1; $comp = Get-CimInstance Win32_ComputerSystem -ErrorAction Stop; $upSecs = [int]((Get-Date) - $os.LastBootUpTime).TotalSeconds; $result.system = @{ osName = $os.Caption; osBuild = $os.BuildNumber; osArch = $os.OSArchitecture; hostname = $os.CSName; cpuBrand = $cpu.Name; cpuCores = [int]$cpu.NumberOfCores; cpuThreads = [int]$cpu.NumberOfLogicalProcessors; cpuSpeed = [math]::Round([double]$cpu.MaxClockSpeed / 1000.0, 1); totalPhys = [double]$comp.TotalPhysicalMemory; uptime = $upSecs; cpuVoltage = if ($cpu.CurrentVoltage -gt 0) { [math]::Round($cpu.CurrentVoltage / 10.0, 2) } else { $null }; l2Cache = [int]$cpu.L2CacheSize; l3Cache = [int]$cpu.L3CacheSize; extClock = [int]$cpu.ExtClock; maxClock = [int]$cpu.MaxClockSpeed } } catch { $result.system = $null }',
  // Physical Disk Layout
  'try { $disks = Get-CimInstance Win32_DiskDrive -ErrorAction Stop; $result.diskLayout = @($disks | ForEach-Object { @{ index = [int]$_.Index; model = $_.Model; size = [double]$_.Size; interfaceType = $_.InterfaceType; mediaType = $_.MediaType; serial = $_.SerialNumber; status = $_.Status } }) } catch { $result.diskLayout = $null }',
  // GPU Static Info (AdapterRAM is UInt32, overflows >4GB; try nvidia-smi for accurate VRAM)
  'try {',
  '  $gpu = Get-CimInstance Win32_VideoController -ErrorAction Stop;',
  '  $gpuArr = @($gpu | ForEach-Object {',
  '    $vram = [double]$_.AdapterRAM;',
  '    $name = $_.Name;',
  '    # Try nvidia-smi for accurate VRAM on NVIDIA GPUs',
  '    if ($name -match "NVIDIA") {',
  '      try { $ns = & nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits 2>$null; if ($ns) { $vram = [double]($ns -split "`n")[0].Trim() * 1MB } } catch {}',
  '    }',
  '    # If suspicious (near UInt32 max ~4.29GB), assume overflow and double',
  '    if ($vram -ge 4.28e9 -and $vram -le 4.3e9) { $vram = $vram * 2 }',
  '    @{ name = $name; vendor = $_.AdapterCompatibility; vram = $vram; resolution = $_.CurrentHorizontalResolution.ToString() + "x" + $_.CurrentVerticalResolution.ToString(); refreshRate = [int]$_.CurrentRefreshRate; bitDepth = [int]$_.CurrentBitsPerPixel }',
  '  });',
  '  $result.gpu = $gpuArr',
  '} catch { $result.gpu = $null }',
  // Physical Memory Layout - expanded SMBIOSMemoryType mapping
  'try { $mem = Get-CimInstance Win32_PhysicalMemory -ErrorAction Stop; $result.memLayout = @($mem | ForEach-Object {',
  '  $t = if ($_.SMBIOSMemoryType -is [int]) { [int]$_.SMBIOSMemoryType } else { -1 };',
  '  $type = if ($t -eq 20) { "DDR" } elseif ($t -eq 21) { "DDR2" } elseif ($t -eq 24 -or $t -eq 25) { "DDR3" } elseif ($t -eq 26) { "DDR4" } elseif ($t -eq 34) { "DDR5" } else { "" };',
  '  $mfr = $_.Manufacturer; $part = $_.PartNumber;',
  '  if ("$mfr" -match "^\s*$|^Unknown$|^System manufacturer$|^To Be Filled|^OEM|^Undefined$|^Default string$") { $mfr = "" }',
  '  if ("$mfr" -eq "" -and "$part" -ne "") {',
  '    $upper = $part.ToUpper()',
  '    # DRAM Chip Manufacturers (actual chip makers)',
  '    if ($upper -match "^M[34][0-9].*") { $mfr = "Samsung" }',
  '    elseif ($upper -match "^M47[14].*") { $mfr = "Samsung" }',
  '    elseif ($upper -match "^SEC.*") { $mfr = "Samsung" }',
  '    elseif ($upper -match "^HMA|^HMT|^MC[0-9].*") { $mfr = "SK Hynix" }',
  '    elseif ($upper -match "^H5[0-9].*|^H9[0-9].*") { $mfr = "SK Hynix" }',
  '    elseif ($upper -match "^MT[0-9].*|^MT[0-9].*") { $mfr = "Micron" }',
  '    elseif ($upper -match "^CT[0-9].*|^CT1[0-9].*") { $mfr = "Crucial" }',
  '    elseif ($upper -match "^NT[0-9].*") { $mfr = "Nanya" }',
  '    # Kingston',
  '    elseif ($upper -match "^KF[0-9].*") { $mfr = "Kingston FURY" }',
  '    elseif ($upper -match "^KSM[0-9].*") { $mfr = "Kingston" }',
  '    elseif ($upper -match "^KVR[0-9].*") { $mfr = "Kingston" }',
  '    elseif ($upper -match "^KCP[0-9].*") { $mfr = "Kingston" }',
  '    elseif ($upper -match "^KHX[0-9].*") { $mfr = "Kingston" }',
  '    # Corsair',
  '    elseif ($upper -match "^CMK[0-9].*|^CMD[0-9].*|^CM3[0-9].*|^CMH[0-9].*|^CMT[0-9].*|^CMW[0-9].*|^CMS[0-9].*") { $mfr = "Corsair" }',
  '    # G.Skill',
  '    elseif ($upper -match "^F3-[0-9].*") { $mfr = "G.Skill" }',
  '    elseif ($upper -match "^F4-[0-9].*") { $mfr = "G.Skill" }',
  '    elseif ($upper -match "^F5-[0-9].*") { $mfr = "G.Skill" }',
  '    # ADATA / XPG',
  '    elseif ($upper -match "^AD5[0-9].*|^AD4[0-9].*|^AX5U[0-9].*") { $mfr = "ADATA" }',
  '    # TeamGroup',
  '    elseif ($upper -match "^TED[0-9].*|^TMD[0-9].*|^TPD[0-9].*|^TCD[0-9].*") { $mfr = "TeamGroup" }',
  '    # Transcend',
  '    elseif ($upper -match "^TS[0-9].*") { $mfr = "Transcend" }',
  '    # Patriot',
  '    elseif ($upper -match "^PSD[0-9].*|^PSD4[0-9].*|^PVS[0-9].*") { $mfr = "Patriot" }',
  '    # PNY',
  '    elseif ($upper -match "^MD[0-9].*|^MN[0-9].*") { $mfr = "PNY" }',
  '    # GeIL',
  '    elseif ($upper -match "^GEX[0-9].*|^GEL[0-9].*") { $mfr = "GeIL" }',
  '    # Lexar',
  '    elseif ($upper -match "^LD4[0-9].*|^LD5[0-9].*") { $mfr = "Lexar" }',
  '  }',
  '  $spd = if ($_.Speed -is [int] -and $_.Speed -gt 0) { [int]$_.Speed } else { 0 };',
  '  @{ size = [double]$_.Capacity; type = $type; speed = $spd; manufacturer = $mfr; partNum = $part; bankLabel = if ($_.BankLabel) { $_.BankLabel } else { "" } }',
  '}) } catch { $result.memLayout = $null }',
  // Output as Base64 to avoid encoding issues
  '$json = ConvertTo-Json $result -Compress -Depth 3',
  '[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))'
].join('\n')

// ============================================================================
// Cache for static data
// ============================================================================
let staticData: any = null
let staticDataPromise: Promise<any> | null = null

async function fetchStaticData(): Promise<any> {
  if (staticData) return staticData
  if (staticDataPromise) return staticDataPromise

  staticDataPromise = new Promise(async (resolve) => {
    try {
      debug('[static] Fetching static system data...')
      const json = await execPowerShell(PS_STATIC_SCRIPT)
      staticData = JSON.parse(json)
      debug('[static] Done. Disks:', staticData.diskLayout?.length, 'GPU:', staticData.gpu?.length)
      resolve(staticData)
    } catch (err) {
      debug('[static] Error:', err)
      staticData = {}
      resolve(staticData)
    }
  })

  return staticDataPromise
}

// ============================================================================
// Single PowerShell executor — THE CORE PERFORMANCE FIX
// ============================================================================
function execPowerShell(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      'powershell.exe',
      ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', script],
      {
        timeout: 30000,
        maxBuffer: 10 * 1024 * 1024,
        windowsHide: true,
      },
      (err, stdout, stderr) => {
        if (err) {
          debug('[ps] Error:', err.message)
          reject(err)
          return
        }
        // Output is Base64-encoded UTF-8 to avoid encoding issues
        const raw = stdout.trim()
        try {
          const json = Buffer.from(raw, 'base64').toString('utf-8')
          resolve(json)
        } catch (e) {
          // Fallback: try direct parse (e.g., for errors that aren't Base64)
          debug('[ps] Base64 decode failed, trying raw output')
          resolve(raw)
        }
      }
    )
  })
}

// ============================================================================
// LHM GPU Sensor Reader (built-in, no external install needed)
// ============================================================================
// In dev mode, files are in electron/lib/. In production, they're in extraResources.
function getLhmLibPath(): string {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  if (isDev) {
    return path.resolve(process.cwd(), 'electron', 'lib', 'LibreHardwareMonitorLib.dll')
  }
  // Production: extraResources copies to resources/lhm/
  return path.resolve(process.resourcesPath, 'lhm', 'LibreHardwareMonitorLib.dll')
}

function getLhmScriptPath(): string {
  const isDev = !!process.env.VITE_DEV_SERVER_URL
  if (isDev) {
    return path.resolve(process.cwd(), 'electron', 'lhm_gpu.ps1')
  }
  return path.resolve(process.resourcesPath, 'lhm', 'lhm_gpu.ps1')
}

let lhmSensorsCache: any = null
let lhmSensorsCacheTime = 0

// Internal: call LHM PowerShell once, cache full result for 2 seconds
async function getLhmSensors(): Promise<any> {
  const now = Date.now()
  if (lhmSensorsCache && now - lhmSensorsCacheTime < 2000) return lhmSensorsCache
  try {
    const psScript = getLhmScriptPath()
    const dllPath = getLhmLibPath()
    const cmd = '& "' + psScript.replace(/\\/g, '\\\\') + '" -LibPath "' + dllPath.replace(/\\/g, '\\\\') + '"'
    const json = await execPowerShell(cmd)
    const data = JSON.parse(json)
    lhmSensorsCache = data
    lhmSensorsCacheTime = now
    return data
  } catch {
    return null
  }
}

async function getLhmGpuSensors(): Promise<any> {
  const data = await getLhmSensors()
  if (!data) return null
  // Return only GPU fields
  return {
    gpuTemp: data.gpuTemp,
    gpuLoad: data.gpuLoad,
    gpuFan: data.gpuFan,
    gpuMemUsed: data.gpuMemUsed,
    gpuMemTotal: data.gpuMemTotal,
    gpuPower: data.gpuPower,
    source: data.source,
  }
}

async function getLhmCpuSensors(): Promise<any> {
  const data = await getLhmSensors()
  if (!data) return null
  return {
    cpuTemp: data.cpuTemp,
    cpuCores: data.cpuCores || [],
    cpuLoad: data.cpuLoad,
    cpuCoreLoads: data.cpuCoreLoads || [],
    cpuClock: data.cpuClock,
    cpuPower: data.cpuPower,
    cpuVoltage: data.cpuVoltage,
    cpuFan: data.cpuFan,
    cpuMaxClock: data.cpuMaxClock,
    cpuBusClock: data.cpuBusClock,
    source: data.source,
  }
}

async function getLhmMemorySensors(): Promise<any> {
  const data = await getLhmSensors()
  if (!data) return null
  return {
    memUsed: data.memUsed,         // GB
    memAvailable: data.memAvailable, // GB
    memLoad: data.memLoad,          // %
    source: data.source,
  }
}

async function getLhmDiskSensors(): Promise<any[]> {
  const data = await getLhmSensors()
  if (!data || !data.storageSensors || data.storageSensors.length === 0) return []
  return data.storageSensors.map((s: any) => ({
    model: s.model || '',
    temperature: s.temperature,
    percentageUsed: s.percentageUsed,
    availableSpare: s.availableSpare,
    dataRead: s.dataRead,
    dataWritten: s.dataWritten,
    readSpeed: s.readSpeed,   // bytes/sec from LHM Throughput sensor
    writeSpeed: s.writeSpeed, // bytes/sec from LHM Throughput sensor
  }))
}

async function getLhmMotherboardSensors(): Promise<any> {
  const data = await getLhmSensors()
  if (!data) return null
  return {
    cpuFan: data.mbCpuFan,          // RPM
    systemFan: data.mbSystemFan,     // RPM
    vcore: data.mbVcore,             // V
    v12: data.mb12V,                 // +12V
    v5: data.mb5V,                   // +5V
    v3: data.mb3V,                   // +3.3V
    vcoreSoc: data.mbVcoreSoc,       // Vcore SoC (AMD)
    cpuTemp: data.mbCpuTemp,         // CPU socket temp
    systemTemp: data.mbSystemTemp,   // System/chassis temp
    chipsetTemp: data.mbChipsetTemp, // Chipset temp
    vrmTemp: data.mbVrmTemp,         // VRM temp
  }
}

// ============================================================================
// Pre-warm (single call, batched)
// ============================================================================
export async function preWarm() {
  debug('[prewarm] Fetching static data + first dynamic frame...')
  await fetchStaticData()
  debug('[prewarm] Done')
}

// ============================================================================
// Public Data Getters
// ============================================================================

export async function getSystemInfo(): Promise<any> {
  const data = await fetchStaticData()
  const sys = data.system || {}
  // uptime is now a number (seconds since boot)
  const upSec = typeof sys.uptime === 'number' && isFinite(sys.uptime) ? sys.uptime : 0
  const d = Math.floor(upSec / 86400)
  const h = Math.floor((upSec % 86400) / 3600)
  const m = Math.floor((upSec % 3600) / 60)

  return {
    os: sys.osName || 'Windows',
    hostname: sys.hostname || '',
    platform: 'win32',
    arch: sys.osArch || '',
    kernel: 'NT ' + (sys.osBuild || ''),
    cpuBrand: (sys.cpuBrand || '').replace(/\s+/g, ' ').trim(),
    cpuCores: sys.cpuThreads || 0,
    cpuPhysicalCores: sys.cpuCores || 0,
    cpuSpeed: `${sys.cpuSpeed || 0} GHz`,
    cpuVoltage: sys.cpuVoltage ?? null,
    l2Cache: sys.l2Cache || 0,
    l3Cache: sys.l3Cache || 0,
    extClock: sys.extClock || 0,
    maxClock: sys.maxClock || 0,
    systemUptime: d > 0 ? `${d}d ${h}h ${m}m` : h > 0 ? `${h}h ${m}m` : `${m}m`,
  }
}

export async function getCpuLoadData(): Promise<any> {
  try {
    // Get WMI dynamic data (load, processes, threads)
    const json = await execPowerShell(PS_DYNAMIC_SCRIPT)
    const data = JSON.parse(json)
    const cpu = data.cpu || { currentLoad: 0, avgLoad: 0, cores: [] }
    const temp = data.cpuTemp || {}
    const counters = data.sysCounters || {}

    // Try LHM for enhanced CPU sensor data (temperature, clock, power, fan, voltage)
    const lhm = await getLhmCpuSensors()
    // CPU fan is on the motherboard (SuperIO), not the CPU hardware
    const mobo = await getLhmMotherboardSensors()

    // LHM provides real DTS CPU temperature (much more accurate than ACPI zone)
    // Falls back to WMI ACPI thermal zone if LHM unavailable
    const tempMain = lhm?.cpuTemp ?? temp.main ?? 0
    // LHM clock is in MHz, convert to GHz for consistency
    const speedAvg = lhm?.cpuClock ? Math.round((lhm.cpuClock / 1000) * 100) / 100 : (data.cpuFreq ?? 0)

    return {
      currentLoad: cpu.currentLoad ?? 0,
      avgLoad: cpu.avgLoad ?? 0,
      tempMain,
      tempMax: tempMain,
      cores: cpu.cores ?? [],
      speedAvg,
      fanSpeed: mobo?.cpuFan ?? lhm?.cpuFan ?? 0,
      powerDraw: lhm?.cpuPower ?? 0,
      processes: counters.processes ?? 0,
      threads: counters.threads ?? 0,
    }
  } catch (err) {
    debug('[cpu] Error:', err)
    return { currentLoad: 0, avgLoad: 0, tempMain: 0, tempMax: 0, cores: [], speedAvg: 0, fanSpeed: 0, powerDraw: 0, processes: 0, threads: 0 }
  }
}

export async function getGpuInfoData(): Promise<any> {
  try {
    // Get static GPU info (model, vendor, vram)
    const static_ = await fetchStaticData()
    const gpuList = static_.gpu || []

    // Get dynamic GPU data from WMI (no LHM needed)
    const json = await execPowerShell(PS_DYNAMIC_SCRIPT)
    const dynamic = JSON.parse(json)
    const gpuUtil = dynamic.gpuUtil || []
    const gpuSensorTemp = dynamic.gpuSensorTemp
    const gpuSensorFan = dynamic.gpuSensorFan

    // Compute overall GPU utilization from engine performance counters
    const totalUtil = gpuUtil.length > 0
      ? Math.round(gpuUtil.reduce((s: number, e: any) => s + e.utilPct, 0) / gpuUtil.length)
      : 0

    // Try LHM for enhanced sensor data
    const lhm = await getLhmGpuSensors()

    const controllers = gpuList.map((g: any, i: number) => {
      // Memory from static data (Win32_VideoController.AdapterRAM)
      const gpuMemTotalBytes = (g.vram || 0);
      // LHM gives more accurate VRAM if available
      const memTotalLhm = lhm?.gpuMemTotal ? lhm.gpuMemTotal * 1024 * 1024 : 0;
      const memUsedLhm = lhm?.gpuMemUsed ? lhm.gpuMemUsed * 1024 * 1024 : 0;
      const finalMemTotal = memTotalLhm || gpuMemTotalBytes;

      // Priority: LHM > WMI sensor > fallback
      const tempLhm = (i === 0 && lhm?.gpuTemp) ? lhm.gpuTemp : null;
      const fanLhm = (i === 0 && lhm?.gpuFan) ? lhm.gpuFan : null;
      const loadLhm = (i === 0 && lhm?.gpuLoad) ? lhm.gpuLoad : null;
      const powerLhm = (i === 0 && lhm?.gpuPower) ? lhm.gpuPower : null;

      return {
        model: g.name || 'Unknown GPU',
        vendor: g.vendor || '',
        temperature: tempLhm ?? (i === 0 && gpuSensorTemp ? gpuSensorTemp : 0),
        utilizationGpu: loadLhm ?? totalUtil,
        utilizationMemory: lhm?.gpuMemTotal ? Math.round((memUsedLhm / finalMemTotal) * 100) : 0,
        memoryTotal: finalMemTotal,
        memoryUsed: memUsedLhm,
        memoryFree: finalMemTotal - memUsedLhm,
        fanSpeed: fanLhm ?? (i === 0 && gpuSensorFan ? gpuSensorFan : 0),
        powerDraw: powerLhm ?? 0,
      }
    })

    const display = gpuList.length > 0 ? {
      width: parseInt(gpuList[0].resolution?.split('x')[0]) || 0,
      height: parseInt(gpuList[0].resolution?.split('x')[1]) || 0,
      depth: gpuList[0].bitDepth || 32,
      refreshRate: gpuList[0].refreshRate || 60,
    } : { width: 0, height: 0, depth: 32, refreshRate: 60 }

    return { controllers, display }
  } catch (err) {
    debug('[gpu] Error:', err)
    return { controllers: [], display: { width: 0, height: 0, depth: 32, refreshRate: 60 } }
  }
}

export async function getMemoryInfoData(): Promise<any> {
  try {
    const json = await execPowerShell(PS_DYNAMIC_SCRIPT)
    const data = JSON.parse(json)
    const mem = data.mem || {}

    const static_ = await fetchStaticData()
    const memLayout = (static_.memLayout || []).map((m: any) => ({
      size: m.size || 0,
      type: m.type || 'Unknown',
      speed: m.speed ? `${m.speed} MHz` : 'N/A',
      manufacturer: m.manufacturer || 'Unknown',
      partNum: m.partNum || '',
      serialNum: '',
      formFactor: '',
      clockSpeed: m.speed || 0,
      voltageConfigured: 0,
    }))

    // Try LHM for more precise memory data (GB → bytes)
    const lhm = await getLhmMemorySensors()
    const total = mem.total || 0
    let used = mem.used || 0
    let available = mem.available || 0
    let usagePercent = mem.percent ?? 0

    if (lhm?.memLoad != null) {
      // LHM provides memory load % directly — more accurate
      usagePercent = lhm.memLoad
      if (lhm.memUsed != null) {
        used = Math.round(lhm.memUsed * 1024 * 1024 * 1024)  // GB → bytes
      }
      if (lhm.memAvailable != null) {
        available = Math.round(lhm.memAvailable * 1024 * 1024 * 1024)  // GB → bytes
      }
    }

    return {
      total,
      free: available,
      used,
      swapTotal: 0,
      swapUsed: 0,
      swapFree: 0,
      usagePercent,
      available,
      layouts: memLayout,
    }
  } catch (err) {
    debug('[mem] Error:', err)
    return { total: 0, free: 0, used: 0, swapTotal: 0, swapUsed: 0, swapFree: 0, usagePercent: 0, available: 0, layouts: [] }
  }
}

export async function getDiskInfoData(): Promise<any[]> {
  try {
    const static_ = await fetchStaticData()
    const diskLayout = static_.diskLayout || []

    const json = await execPowerShell(PS_DYNAMIC_SCRIPT)
    const data = JSON.parse(json)
    const volumes = data.volumes || []
    const disksIO = data.disksIO || []

    if (diskLayout.length === 0) return []

    // Get LHM disk sensors (temperature, health) — matched by model name
    const lhmDisks = await getLhmDiskSensors()
    const lhmDiskMap = new Map<string, any>()
    for (const ds of lhmDisks) {
      // Normalize model name: strip whitespace, lowercase for matching
      const key = (ds.model || '').replace(/\s+/g, ' ').trim().toLowerCase()
      lhmDiskMap.set(key, ds)
    }

    // Sort disks by size descending for biggest-first matching
    const sortedDisks = [...diskLayout].sort((a: any, b: any) => (b.size || 0) - (a.size || 0))
    // Sort volumes by size descending to match biggest partitions to biggest disks
    const sortedVolumes = [...volumes].sort((a: any, b: any) => (b.size || 0) - (a.size || 0))

    // Track remaining capacity
    const remaining = sortedDisks.map((d: any) => d.size || 0)

    const matched = sortedVolumes.map((vol: any) => {
      const volSize = vol.size || 0
      let idx = -1
      for (let i = 0; i < remaining.length; i++) {
        if (remaining[i] >= volSize * 0.95) { // allow 5% tolerance
          idx = i
          break
        }
      }
      if (idx === -1) idx = 0 // fallback
      remaining[idx] -= volSize
      return { vol, disk: sortedDisks[idx] }
    })

    // Remap back to original volume order for display
    const volDiskMap = new Map(matched.map(m => [m.vol.drive, m.disk]))

    const result = matchDiskIoWithVolumes(volumes, disksIO, volDiskMap, lhmDiskMap)

    debug('[disk] Volumes:', result.length, 'Disks:', diskLayout.length)
    return result
  } catch (err) {
    debug('[disk] Error:', err)
    return []
  }
}

// Network interface config (static)
let netConfigCache: any = null
let sessionRxBytes = 0
let sessionTxBytes = 0

export async function getNetworkInfoData(): Promise<any> {
  try {
    const json = await execPowerShell(PS_DYNAMIC_SCRIPT)
    const data = JSON.parse(json)
    const netList = data.network || []
    const netCumulative = data.netCumulative || []

    // Get primary interface (non-virtual, non-VPN)
    const primary = netList.find((n: any) =>
      n.iface &&
      !n.iface.includes('Loopback') &&
      !n.iface.includes('Virtual') &&
      !n.iface.includes('VPN') &&
      !n.iface.includes('Tunnel') &&
      !n.iface.includes('Bluetooth') &&
      !n.iface.includes('Pseudo')
    ) || netList[0] || null

    if (!primary) {
      return { iface: 'N/A', ip4: '', ip6: '', mac: '', rxSec: 0, txSec: 0, rxBytes: 0, txBytes: 0, rxTotal: 0, txTotal: 0, vpnConnected: false, vpnName: '', vpnIp: '' }
    }

    // Find cumulative totals for primary interface
    const cumul = netCumulative.find((n: any) => n.iface === primary.iface)

    // Detect VPN interfaces
    const vpnIface = netList.find((n: any) =>
      n.iface?.toLowerCase().includes('vpn') ||
      n.iface?.toLowerCase().includes('tap') ||
      n.iface?.toLowerCase().includes('tun') ||
      n.iface?.toLowerCase().includes('openvpn') ||
      n.iface?.toLowerCase().includes('wireguard')
    )

    // Get IP config (static from cache)
    if (!netConfigCache) {
      try {
        const configJson = await execPowerShell([
          '$ErrorActionPreference = "Stop"',
          '$adapter = Get-CimInstance Win32_NetworkAdapterConfiguration | Where-Object { $_.IPEnabled -and $_.Description -notlike "*Virtual*" -and $_.Description -notlike "*Bluetooth*" } | Select-Object -First 1',
          'if ($adapter) { $json = ConvertTo-Json @{ ip4 = $adapter.IPAddress[0]; ip6 = $adapter.IPAddress[1]; mac = $adapter.MACAddress } -Compress; [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json)) }',
          'else { [Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes("{}")) }'
        ].join('\n'))
        netConfigCache = JSON.parse(configJson)
      } catch {
        netConfigCache = { ip4: '', ip6: '', mac: '' }
      }
    }

    return {
      iface: primary.iface,
      ip4: netConfigCache.ip4 || '',
      ip6: netConfigCache.ip6 || '',
      mac: netConfigCache.mac || '',
      rxSec: primary.rxBytesPerSec || 0,
      txSec: primary.txBytesPerSec || 0,
      rxBytes: (sessionRxBytes += primary.rxBytesPerSec || 0),
      txBytes: (sessionTxBytes += primary.txBytesPerSec || 0),
      rxTotal: cumul?.rxTotal || 0,  // cumulative since boot
      txTotal: cumul?.txTotal || 0,  // cumulative since boot
      vpnConnected: !!vpnIface,
      vpnName: vpnIface?.iface || '',
      vpnIp: '',
    }
  } catch (err) {
    debug('[net] Error:', err)
    return { iface: 'N/A', ip4: '', ip6: '', mac: '', rxSec: 0, txSec: 0, rxBytes: 0, txBytes: 0, rxTotal: 0, txTotal: 0, vpnConnected: false, vpnName: '', vpnIp: '' }
  }
}

export async function getVoltageInfoData(): Promise<any> {
  try {
    const json = await execPowerShell(PS_DYNAMIC_SCRIPT)
    const data = JSON.parse(json)
    const bat = data.battery || { hasBattery: false }

    // Get motherboard SuperIO voltage data
    const mobo = await getLhmMotherboardSensors()

    return {
      battery: {
        hasBattery: bat.hasBattery ?? false,
        percent: bat.percent ?? 0,
        isCharging: bat.isCharging ?? false,
        voltage: bat.voltage ?? 0,
        designCapacity: 0,
        currentCapacity: 0,
        timeRemaining: bat.timeRemaining ?? -1,
      },
      voltage: bat.voltage ?? 0,
      // Motherboard rail voltages (from SuperIO)
      moboVcore: mobo?.vcore ?? null,
      mobo12V: mobo?.v12 ?? null,
      mobo5V: mobo?.v5 ?? null,
      mobo3V: mobo?.v3 ?? null,
      moboVcoreSoc: mobo?.vcoreSoc ?? null,
      // Temperatures from motherboard sensors
      moboCpuSocketTemp: mobo?.cpuTemp ?? null,
      moboChipsetTemp: mobo?.chipsetTemp ?? null,
      moboSystemTemp: mobo?.systemTemp ?? null,
      moboVrmTemp: mobo?.vrmTemp ?? null,
      // Fan speeds from motherboard
      moboCpuFan: mobo?.cpuFan ?? null,
      moboSystemFan: mobo?.systemFan ?? null,
    }
  } catch (err) {
    debug('[voltage] Error:', err)
    return { battery: { hasBattery: false, percent: 0, isCharging: false, voltage: 0, designCapacity: 0, currentCapacity: 0, timeRemaining: -1 }, voltage: 0 }
  }
}

export async function getProcessInfoData(): Promise<any[]> {
  try {
    const json = await execPowerShell(PS_DYNAMIC_SCRIPT)
    const data = JSON.parse(json)
    return (data.processes || []).map((p: any) => ({
      pid: p.pid || 0,
      name: p.name || '',
      cpu: p.cpu ?? 0,
      memory: 0,
      memoryRss: 0,
      state: 'running',
    }))
  } catch (err) {
    debug('[process] Error:', err)
    return []
  }
}

/**
 * Estimate total system power consumption.
 * CPU + GPU power from LHM + ~30W estimated overhead for motherboard, RAM, fans, storage.
 */
export async function getTotalPowerEstimate(): Promise<number> {
  try {
    const lhm = await getLhmSensors()
    if (!lhm) return 0

    const cpuPower = lhm.cpuPower ?? 0
    const gpuPower = lhm.gpuPower ?? 0
    const otherPower = 30  // estimated: mobo + RAM + fans + storage

    return Math.round((cpuPower + gpuPower + otherPower) * 10) / 10
  } catch {
    return 0
  }
}

/**
 * Pure function: match disk IO stats to volumes by disk index.
 * PhysicalDisk names are "0", "1" etc. matching diskLayout[index].
 * Exported for unit testing.
 */
export function matchDiskIoWithVolumes(
  volumes: any[],
  disksIO: any[],
  volDiskMap: Map<string, any>,
  lhmDiskMap?: Map<string, any>
): any[] {
  // Map PhysicalDisk name (index) to IO stats
  const ioMap: Record<string, any> = {}
  for (const io of disksIO) {
    ioMap[io.name] = io
  }

  return volumes.map((vol: any) => {
    const matchedDisk = volDiskMap.get(vol.drive)
    // Match IO stats by disk index (PhysicalDisk name = "0", "1", etc.)
    const diskIdx = matchedDisk?.index ?? ''
    const volIo = ioMap[String(diskIdx)]
    let ioRead = volIo?.readBytesPerSec || 0
    let ioWrite = volIo?.writeBytesPerSec || 0

    // Look up LHM disk sensor data by model name
    let diskTemp = 0
    let diskHealthPercent = 100
    let diskTotalWritten = 0
    if (lhmDiskMap && matchedDisk?.model) {
      const modelKey = (matchedDisk.model || '').replace(/\s+/g, ' ').trim().toLowerCase()
      const lhmData = lhmDiskMap.get(modelKey)
      if (lhmData) {
        diskTemp = lhmData.temperature ?? 0
        // percentageUsed is SSD wear: 0=brand new, 100=end of life
        diskHealthPercent = lhmData.percentageUsed != null ? Math.max(0, 100 - lhmData.percentageUsed) : 100
        diskTotalWritten = lhmData.dataWritten ?? 0
        // Fallback: use LHM Throughput if WMI returns 0
        if (ioRead === 0 && lhmData.readSpeed != null) ioRead = lhmData.readSpeed
        if (ioWrite === 0 && lhmData.writeSpeed != null) ioWrite = lhmData.writeSpeed
      }
    }

    return {
      fs: vol.drive,
      size: vol.size || 0,
      used: vol.used || 0,
      available: vol.free || 0,
      usePercent: vol.usedPct ?? 0,
      mount: vol.drive || '',
      type: vol.fsType || 'NTFS',
      ioReadSpeed: ioRead,
      ioWriteSpeed: ioWrite,
      isSSD: matchedDisk ? (matchedDisk.mediaType === 'SSD' || matchedDisk.interfaceType === 'NVMe' || (matchedDisk.model || '').includes('SSD')) : false,
      healthStatus: matchedDisk?.status === 'OK' ? 'Good' : matchedDisk?.status || 'Unknown',
      diskName: matchedDisk?.model || '',
      diskVendor: matchedDisk?.model?.split(' ')[0] || '',
      interfaceType: matchedDisk?.interfaceType || '',
      diskTemp,
      diskHealthPercent,
      diskTotalWritten,
    }
  })
}
