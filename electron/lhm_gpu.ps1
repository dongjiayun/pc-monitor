# LibreHardwareMonitor Sensor Reader - CPU + GPU + Memory + Storage + Motherboard
# CPU sensors need kernel driver for some sensors, but DTS temperature
# and some power/clock sensors work via user-mode SMU/MSR access.
# GPU sensors work without kernel driver (NVAPI/ADL via user-mode DLL)
# Usage: .\lhm_gpu.ps1 -LibPath "C:\path\to\LibreHardwareMonitorLib.dll"
param([string]$LibPath)

$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8

$result = @{
    # GPU
    gpuTemp = $null; gpuLoad = $null; gpuFan = $null
    gpuMemUsed = $null; gpuMemTotal = $null; gpuPower = $null
    # CPU
    cpuTemp = $null; cpuCores = @(); cpuLoad = $null
    cpuCoreLoads = @(); cpuClock = $null; cpuPower = $null
    cpuVoltage = $null; cpuFan = $null; cpuMaxClock = $null; cpuBusClock = $null
    # Memory
    memUsed = $null; memAvailable = $null; memLoad = $null
    # Storage
    storageSensors = @()
    # Motherboard
    mbCpuFan = $null; mbSystemFan = $null; mbVcore = $null
    mb12V = $null; mb5V = $null; mb3V = $null; mbVcoreSoc = $null
    mbCpuTemp = $null; mbSystemTemp = $null; mbChipsetTemp = $null; mbVrmTemp = $null
    source = 'none'
}

try {
    if ($LibPath -and (Test-Path $LibPath)) {
        $asm = [System.Reflection.Assembly]::LoadFrom($LibPath)
        $computerType = $asm.GetType('LibreHardwareMonitor.Hardware.Computer')
        $computer = [Activator]::CreateInstance($computerType)

        $computerType.GetProperty('IsCpuEnabled').SetValue($computer, $true)
        $computerType.GetProperty('IsGpuEnabled').SetValue($computer, $true)
        $computerType.GetProperty('IsMemoryEnabled').SetValue($computer, $true)
        $computerType.GetProperty('IsMotherboardEnabled').SetValue($computer, $true)
        $computerType.GetProperty('IsStorageEnabled').SetValue($computer, $true)

        $computerType.GetMethod('Open').Invoke($computer, $null)
        $hardwareList = $computerType.GetProperty('Hardware').GetValue($computer)

        foreach ($hw in $hardwareList) {
            $hwType = $hw.GetType()
            $hwType.GetMethod('Update').Invoke($hw, $null)
            $hwTypeName = "$($hwType.GetProperty('HardwareType').GetValue($hw))"
            $hwName = "$($hwType.GetProperty('Name').GetValue($hw))"
            $sensors = $hwType.GetProperty('Sensors').GetValue($hw)

            # --- GPU ---
            if ($hwTypeName -eq 'GpuNvidia' -or $hwTypeName -eq 'GpuAmd') {
                foreach ($sensor in $sensors) {
                    $st = $sensor.GetType()
                    $name = "$($st.GetProperty('Name').GetValue($sensor))"
                    $sType = "$($st.GetProperty('SensorType').GetValue($sensor))"
                    $val = $st.GetProperty('Value').GetValue($sensor)
                    if ($val -eq $null -or $val -eq 0) { continue }

                    if ($sType -eq 'Temperature' -and $name -eq 'GPU Core') { $result.gpuTemp = [math]::Round([double]$val, 1) }
                    elseif ($sType -eq 'Load' -and $name -eq 'GPU Core') { $result.gpuLoad = [math]::Round([double]$val, 1) }
                    elseif ($sType -eq 'Fan' -and $name -match 'GPU Fan') { $result.gpuFan = [math]::Round([double]$val, 0) }
                    elseif ($sType -eq 'SmallData' -and $name -eq 'GPU Memory Used') { $result.gpuMemUsed = [math]::Round([double]$val, 0) }
                    elseif ($sType -eq 'SmallData' -and $name -eq 'GPU Memory Total') { $result.gpuMemTotal = [math]::Round([double]$val, 0) }
                    elseif ($sType -eq 'Power' -and $name -eq 'GPU Package') { $result.gpuPower = [math]::Round([double]$val, 1) }
                }
                continue
            }

            # --- CPU ---
            if ($hwTypeName -eq 'Cpu') {
                $cpuTempVal = $null; $cpuTempCores = @(); $cpuLoadTotal = $null
                $cpuCoreLoadsArr = @(); $cpuClockVal = $null; $cpuPowerVal = $null
                $cpuVoltageVal = $null; $cpuFanVal = $null; $cpuMaxClockVal = $null; $cpuBusClockVal = $null

                foreach ($sensor in $sensors) {
                    $st = $sensor.GetType()
                    $name = "$($st.GetProperty('Name').GetValue($sensor))"
                    $sType = "$($st.GetProperty('SensorType').GetValue($sensor))"
                    $val = $st.GetProperty('Value').GetValue($sensor)
                    if ($val -eq $null) { continue }

                    # Temperature
                    if ($sType -eq 'Temperature') {
                        if ($name -eq 'CPU Package' -or $name -eq 'Package') { $cpuTempVal = [math]::Round([double]$val, 1) }
                        elseif ($name -eq 'Core (Tctl/Tdie)' -or $name -eq 'Core (Tdie)') { if ($cpuTempVal -eq $null) { $cpuTempVal = [math]::Round([double]$val, 1) } }
                        elseif ($name -match '^Core\s+#\d+') { $cpuTempCores += [math]::Round([double]$val, 1); if ($cpuTempVal -eq $null) { $cpuTempVal = [math]::Round([double]$val, 1) } }
                    }
                    # Load
                    if ($sType -eq 'Load') {
                        if ($name -eq 'CPU Total') { $cpuLoadTotal = [math]::Round([double]$val, 1) }
                        elseif ($name -match '^CPU Core\s+#\d+' -or $name -match '^Core\s+#\d+') { $cpuCoreLoadsArr += [math]::Round([double]$val, 1) }
                    }
                    # Clock
                    if ($sType -eq 'Clock') {
                        if ($name -eq 'CPU Clock' -or $name -eq 'Core #1' -or $name -eq 'Core 1') { $cpuClockVal = [math]::Round([double]$val, 0) }
                        elseif ($name -eq 'Bus Speed' -or $name -eq 'Bus Clock') { $cpuBusClockVal = [math]::Round([double]$val, 0) }
                    }
                    # Power
                    if ($sType -eq 'Power' -and ($name -eq 'CPU Package' -or $name -eq 'Package')) { $cpuPowerVal = [math]::Round([double]$val, 2) }
                    # Voltage
                    if ($sType -eq 'Voltage') {
                        if ($name -eq 'CPU Core' -or $name -eq 'Core' -or $name -eq 'VID') { $cpuVoltageVal = [math]::Round([double]$val, 3) }
                        elseif ($name -eq 'Vcore' -and $cpuVoltageVal -eq $null) { $cpuVoltageVal = [math]::Round([double]$val, 3) }
                    }
                    # Fan
                    if ($sType -eq 'Fan' -and $name -match 'CPU Fan') { $cpuFanVal = [math]::Round([double]$val, 0) }
                    # Max clock
                    if ($sType -eq 'Clock') {
                        if ($name -eq 'CPU Max Clock' -or $name -eq 'Max Clock') { $cpuMaxClockVal = [math]::Round([double]$val, 0) }
                    }
                }

                $result.cpuTemp = $cpuTempVal; $result.cpuCores = $cpuTempCores
                $result.cpuLoad = $cpuLoadTotal; $result.cpuCoreLoads = $cpuCoreLoadsArr
                $result.cpuClock = $cpuClockVal; $result.cpuPower = $cpuPowerVal
                $result.cpuVoltage = $cpuVoltageVal; $result.cpuFan = $cpuFanVal
                $result.cpuMaxClock = $cpuMaxClockVal; $result.cpuBusClock = $cpuBusClockVal

                # Sub-hardware (per-core sensors)
                $subHw = $hwType.GetProperty('SubHardware').GetValue($hw)
                if ($subHw -and $subHw.Count -gt 0) {
                    foreach ($sub in $subHw) {
                        $subType = $sub.GetType()
                        $subType.GetMethod('Update').Invoke($sub, $null)
                        $subSensors = $subType.GetProperty('Sensors').GetValue($sub)
                        if (-not $subSensors) { continue }
                        foreach ($ss in $subSensors) {
                            $ssT = $ss.GetType()
                            $ssName = "$($ssT.GetProperty('Name').GetValue($ss))"
                            $ssSt = "$($ssT.GetProperty('SensorType').GetValue($ss))"
                            $ssVal = $ssT.GetProperty('Value').GetValue($ss)
                            if ($ssVal -eq $null) { continue }
                            if ($ssSt -eq 'Temperature' -and $ssName -match '^Core\s+#\d+') { $result.cpuCores += [math]::Round([double]$ssVal, 1) }
                            if ($ssSt -eq 'Load' -and $ssName -match '^Core\s+#\d+') { $result.cpuCoreLoads += [math]::Round([double]$ssVal, 1) }
                            if ($ssSt -eq 'Clock' -and $ssName -match '^Core\s+#\d+') { if ($result.cpuClock -eq $null -or $result.cpuClock -eq 0) { $result.cpuClock = [math]::Round([double]$ssVal, 0) } }
                        }
                    }
                }
                continue
            }

            # --- Memory ---
            if ($hwTypeName -eq 'Memory') {
                foreach ($sensor in $sensors) {
                    $st = $sensor.GetType()
                    $name = "$($st.GetProperty('Name').GetValue($sensor))"
                    $sType = "$($st.GetProperty('SensorType').GetValue($sensor))"
                    $val = $st.GetProperty('Value').GetValue($sensor)
                    if ($val -eq $null) { continue }
                    if ($sType -eq 'Data' -and $name -eq 'Memory Used') { $result.memUsed = [math]::Round([double]$val, 2) }
                    elseif ($sType -eq 'Data' -and $name -eq 'Memory Available') { $result.memAvailable = [math]::Round([double]$val, 2) }
                    elseif ($sType -eq 'Load' -and $name -eq 'Memory') { $result.memLoad = [math]::Round([double]$val, 1) }
                }
                continue
            }

            # --- Storage ---
            if ($hwTypeName -eq 'Storage') {
                $diskSensors = @{ model = $hwName; temperature = $null; percentageUsed = $null; availableSpare = $null; dataRead = $null; dataWritten = $null; readSpeed = $null; writeSpeed = $null }
                foreach ($sensor in $sensors) {
                    $st = $sensor.GetType()
                    $name = "$($st.GetProperty('Name').GetValue($sensor))"
                    $sType = "$($st.GetProperty('SensorType').GetValue($sensor))"
                    $val = $st.GetProperty('Value').GetValue($sensor)
                    if ($val -eq $null) { continue }
                    if ($sType -eq 'Temperature' -and $name -eq 'Temperature') { $diskSensors.temperature = [math]::Round([double]$val, 0) }
                    elseif ($sType -eq 'Level' -and $name -eq 'Percentage Used') { $diskSensors.percentageUsed = [math]::Round([double]$val, 0) }
                    elseif ($sType -eq 'Level' -and $name -eq 'Available Spare') { $diskSensors.availableSpare = [math]::Round([double]$val, 0) }
                    elseif ($sType -eq 'Data' -and $name -eq 'Data Read') { $diskSensors.dataRead = [math]::Round([double]$val, 0) }
                    elseif ($sType -eq 'Data' -and $name -eq 'Data Written') { $diskSensors.dataWritten = [math]::Round([double]$val, 0) }
                    elseif ($sType -eq 'Throughput' -and $name -eq 'Total Read Speed') { $diskSensors.readSpeed = [math]::Round([double]$val, 0) }
                    elseif ($sType -eq 'Throughput' -and $name -eq 'Total Write Speed') { $diskSensors.writeSpeed = [math]::Round([double]$val, 0) }
                }
                $result.storageSensors += $diskSensors
                continue
            }

            # --- Motherboard ---
            if ($hwTypeName -eq 'Motherboard') {
                $subHw = $hwType.GetProperty('SubHardware').GetValue($hw)
                if ($subHw -and $subHw.Count -gt 0) {
                    foreach ($sub in $subHw) {
                        $subType = $sub.GetType()
                        $subType.GetMethod('Update').Invoke($sub, $null)
                        $subSensors = $subType.GetProperty('Sensors').GetValue($sub)
                        if (-not $subSensors) { continue }
                        foreach ($ss in $subSensors) {
                            $ssT = $ss.GetType()
                            $ssName = "$($ssT.GetProperty('Name').GetValue($ss))"
                            $ssSt = "$($ssT.GetProperty('SensorType').GetValue($ss))"
                            $ssVal = $ssT.GetProperty('Value').GetValue($ss)
                            if ($ssVal -eq $null) { continue }
                            if ($ssSt -eq 'Fan' -and $ssName -eq 'CPU Fan') { $result.mbCpuFan = [math]::Round([double]$ssVal, 0) }
                            elseif ($ssSt -eq 'Fan' -and $ssName -eq 'System Fan') { $result.mbSystemFan = [math]::Round([double]$ssVal, 0) }
                            elseif ($ssSt -eq 'Voltage' -and $ssName -eq 'Vcore') { $result.mbVcore = [math]::Round([double]$ssVal, 3) }
                            elseif ($ssSt -eq 'Voltage' -and $ssName -eq '+12V') { $result.mb12V = [math]::Round([double]$ssVal, 2) }
                            elseif ($ssSt -eq 'Voltage' -and $ssName -eq '+5V') { $result.mb5V = [math]::Round([double]$ssVal, 2) }
                            elseif ($ssSt -eq 'Voltage' -and $ssName -eq '+3.3V') { $result.mb3V = [math]::Round([double]$ssVal, 3) }
                            elseif ($ssSt -eq 'Voltage' -and $ssName -eq 'Vcore SoC') { $result.mbVcoreSoc = [math]::Round([double]$ssVal, 3) }
                            elseif ($ssSt -eq 'Temperature' -and $ssName -eq 'CPU') { $result.mbCpuTemp = [math]::Round([double]$ssVal, 0) }
                            elseif ($ssSt -eq 'Temperature' -and $ssName -eq 'System') { $result.mbSystemTemp = [math]::Round([double]$ssVal, 0) }
                            elseif ($ssSt -eq 'Temperature' -and $ssName -eq 'Chipset') { $result.mbChipsetTemp = [math]::Round([double]$ssVal, 0) }
                            elseif ($ssSt -eq 'Temperature' -and $ssName -eq 'VRM MOS') { $result.mbVrmTemp = [math]::Round([double]$ssVal, 0) }
                            elseif ($ssSt -eq 'Temperature' -and $ssName -eq 'VSoC MOS' -and $result.mbVrmTemp -eq $null) { $result.mbVrmTemp = [math]::Round([double]$ssVal, 0) }
                        }
                    }
                }
                continue
            }
        }

        $computerType.GetMethod('Close').Invoke($computer, $null)
        $result.source = 'dll'
    }
} catch {
    $result.source = 'error'
}

$json = ConvertTo-Json $result -Compress -Depth 3
[Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes($json))
