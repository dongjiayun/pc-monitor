<#
.SYNOPSIS
    PC Monitor 自动打包脚本
.DESCRIPTION
    构建流程：
    1. 终止所有 Electron / PC Monitor 进程
    2. 尝试清理旧的 release/ 目录
    3. Vite 构建前端 + Electron 主进程
    4a. 释放模式：release/ 可删除 → 标准 electron-builder 完整构建
    4b. 锁定模式：release/ 被锁 → 输出到 release-<timestamp>/
        手动组装：asar pack + 重命名 electron.exe → PC Monitor.exe + 复制 LHM
        最后 electron-builder --prepackaged 生成 NSIS 安装包
    5. 输出构建结果

    锁定模式解决了 app.asar 被系统或其他进程占用导致构建失败的问题。
    即使 release/ 被完全锁定，也能生成完整的全新安装包。
.EXAMPLE
    .\scripts\build.ps1
    npm run build:pack
#>

$ErrorActionPreference = 'Continue'
$ProjectRoot = Resolve-Path "$PSScriptRoot\.."
$ReleaseDir = "$ProjectRoot\release"
$ElectronBuilder = "$ProjectRoot\node_modules\.bin\electron-builder.cmd"

# ===== 1. 终止进程 =====
Write-Host "[1/5] Killing Electron / PC Monitor processes..." -ForegroundColor Cyan
Get-Process | Where-Object { $_.ProcessName -match '^(electron|PC Monitor)$' } |
    Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 2
Write-Host "  [OK] processes stopped" -ForegroundColor Green

# ===== 2. 尝试清理旧 release/ =====
Write-Host "[2/5] Checking release directory..." -ForegroundColor Cyan
$cleanMode = $false

if (Test-Path $ReleaseDir) {
    Write-Host "  Trying to remove old release/..." -ForegroundColor Gray
    $retries = 3
    while ($retries -gt 0) {
        Remove-Item -Path $ReleaseDir -Recurse -Force -ErrorAction SilentlyContinue
        Start-Sleep 3
        if (-not (Test-Path $ReleaseDir)) { $cleanMode = $true; break }

        $renamed = $ReleaseDir + "-old-" + [DateTime]::Now.ToString('HHmmss')
        Rename-Item -Path $ReleaseDir -NewName (Split-Path $renamed -Leaf) -ErrorAction SilentlyContinue
        Start-Sleep 2
        Remove-Item -Path $renamed -Recurse -Force -ErrorAction SilentlyContinue
        Start-Sleep 2
        if (-not (Test-Path $ReleaseDir) -and -not (Test-Path $renamed)) { $cleanMode = $true; break }

        $retries--
        if ($retries -gt 0) { Start-Sleep 3 }
    }
}

# If we cleaned it, confirm it's gone
if ($cleanMode) {
    $cleanMode = -not (Test-Path $ReleaseDir)
}

$outputDir = $ReleaseDir
if (-not $cleanMode) {
    $timestamp = [DateTime]::Now.ToString('yyyyMMdd-HHmmss')
    $outputDir = "$ProjectRoot\release-$timestamp"
    Write-Host "  [WARN] release/ is locked, using alternative output:" -ForegroundColor Yellow
    Write-Host "         $outputDir" -ForegroundColor White
} else {
    Write-Host "  [OK] release/ cleaned" -ForegroundColor Green
}

$unpackedDir = "$outputDir\win-unpacked"
$resourcesDir = "$unpackedDir\resources"

# ===== 3. Vite Build =====
Write-Host "[3/5] Building frontend + Electron..." -ForegroundColor Cyan
Push-Location $ProjectRoot
npx vite build
if ($LASTEXITCODE -ne 0) { Pop-Location; Write-Host "  [ERROR] vite build failed" -ForegroundColor Red; exit 1 }
Pop-Location
Write-Host "  [OK] vite build" -ForegroundColor Green

# ===== 4. Build Installer =====
$setupExe = $null
$asarOk = $false
$lhmOk = $false
$manualMode = -not $cleanMode

if ($cleanMode) {
    # ---------- 4a. 标准完整构建 ----------
    Write-Host "[4/5] Running electron-builder (full build)..." -ForegroundColor Cyan
    Push-Location $ProjectRoot
    & $ElectronBuilder --config.directories.output="$outputDir"
    $exitCode = $LASTEXITCODE
    Pop-Location
    if ($exitCode -ne 0) {
        Write-Host "  [WARN] electron-builder full build failed (exit $exitCode)" -ForegroundColor Yellow
        Write-Host "  Switching to manual assembly mode..." -ForegroundColor Cyan
        $manualMode = $true
    } else {
        $setupExe = Get-ChildItem "$outputDir\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
        $asarOk = Test-Path "$resourcesDir\app.asar"
        $lhmOk = Test-Path "$resourcesDir\lhm\LibreHardwareMonitorLib.dll"
        Write-Host "  [OK] electron-builder full build" -ForegroundColor Green
    }
}

if ($manualMode) {
    # ---------- 4b. 手动组装模式（绕过文件锁） ----------
    Write-Host "[4/5] Manual assembly mode..." -ForegroundColor Cyan

    # Step b1: 用 electron-builder 提取 Electron 框架到输出目录
    #          （这一步会在 app.asar 上失败，但框架文件已就位）
    Write-Host "  [1/4] Extracting Electron framework..." -ForegroundColor Gray
    New-Item -ItemType Directory -Force -Path $outputDir | Out-Null
    # 先清空 outputDir 中可能残留的 win-unpacked，确保框架文件全新
    Remove-Item "$unpackedDir" -Recurse -Force -ErrorAction SilentlyContinue
    & $ElectronBuilder --config.directories.output="$outputDir" 2>&1 | Out-Null

    if (-not (Test-Path "$unpackedDir\electron.exe")) {
        Write-Host "  [ERROR] Failed to extract Electron framework" -ForegroundColor Red
        Write-Host "  [HINT] Check node_modules/.bin/electron-builder.cmd exists" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  [OK] Electron framework extracted" -ForegroundColor Green

    # Step b2: 打包 app.asar
    Write-Host "  [2/4] Creating app.asar..." -ForegroundColor Gray
    $staging = "$outputDir\app-staging"
    New-Item -ItemType Directory -Force -Path $staging | Out-Null
    Copy-Item "$ProjectRoot\package.json" -Destination $staging -Force
    Copy-Item "$ProjectRoot\dist" -Destination "$staging\dist" -Recurse -Force
    Copy-Item "$ProjectRoot\dist-electron" -Destination "$staging\dist-electron" -Recurse -Force

    Push-Location $ProjectRoot
    npx asar pack "$staging" "$resourcesDir\app.asar"
    Pop-Location
    Remove-Item $staging -Recurse -Force -ErrorAction SilentlyContinue
    $asarOk = Test-Path "$resourcesDir\app.asar"
    if (-not $asarOk) { Write-Host "  [ERROR] Failed to create app.asar" -ForegroundColor Red; exit 1 }
    Write-Host "  [OK] app.asar created" -ForegroundColor Green

    # Step b3: 重命名 electron.exe → PC Monitor.exe
    Write-Host "  [3/4] Renaming executable..." -ForegroundColor Gray
    if (Test-Path "$unpackedDir\electron.exe") {
        Remove-Item "$unpackedDir\PC Monitor.exe" -Force -ErrorAction SilentlyContinue
        Rename-Item "$unpackedDir\electron.exe" "PC Monitor.exe" -Force
        Write-Host "  [OK] electron.exe → PC Monitor.exe" -ForegroundColor Green
    } else {
        Write-Host "  [ERROR] electron.exe not found at $unpackedDir" -ForegroundColor Red
        exit 1
    }

    # Step b4: 复制 LHM 资源
    Write-Host "  [4/5] Copying LHM resources..." -ForegroundColor Gray
    $lhmDir = "$resourcesDir\lhm"
    New-Item -ItemType Directory -Force -Path $lhmDir | Out-Null
    Copy-Item "$ProjectRoot\electron\lib\LibreHardwareMonitorLib.dll" -Destination "$lhmDir\" -Force
    Copy-Item "$ProjectRoot\electron\lhm_gpu.ps1" -Destination "$lhmDir\" -Force
    $lhmOk = Test-Path "$lhmDir\LibreHardwareMonitorLib.dll"
    if (-not $lhmOk) { Write-Host "  [WARN] LHM DLL copy failed" -ForegroundColor Yellow }
    Write-Host "  [OK] LHM resources" -ForegroundColor Green

    # Step b5: 复制图标资源
    Write-Host "  [5/5] Copying icon resources..." -ForegroundColor Gray
    $iconsDir = "$resourcesDir\icons"
    New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null
    Copy-Item "$ProjectRoot\public\icon.png" -Destination "$iconsDir\" -Force
    Copy-Item "$ProjectRoot\public\icon-64.png" -Destination "$iconsDir\" -Force
    Copy-Item "$ProjectRoot\public\icon-32.png" -Destination "$iconsDir\" -Force
    Write-Host "  [OK] Icon resources" -ForegroundColor Green

    # Step b6: 删除旧的 NSIS 缓存文件
    Remove-Item "$outputDir\pc-monitor-*.nsis.7z" -Force -ErrorAction SilentlyContinue
    Remove-Item "$outputDir\resources" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$outputDir\.icon-ico" -Recurse -Force -ErrorAction SilentlyContinue
    Remove-Item "$outputDir\builder-*.yml" -Force -ErrorAction SilentlyContinue
    Remove-Item "$outputDir\*.blockmap" -Force -ErrorAction SilentlyContinue

    # Step b7: 用 --prepackaged 生成 NSIS 安装包
    Write-Host "  [BUILD] Generating NSIS installer (may take 1-2 min)..." -ForegroundColor Gray
    & $ElectronBuilder --win --prepackaged "$unpackedDir" --config.directories.output="$outputDir"
    $exitCode = $LASTEXITCODE
    if ($exitCode -ne 0) {
        Write-Host "  [ERROR] NSIS build failed (exit $exitCode)" -ForegroundColor Red
        exit 1
    }
    $setupExe = Get-ChildItem "$outputDir\*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    Write-Host "  [OK] NSIS installer created" -ForegroundColor Green
}

# ===== 5. 结果 =====
Write-Host ""
Write-Host "[5/5] Build Result:" -ForegroundColor Cyan
Write-Host ""

if ($manualMode) {
    Write-Host "  * Manual assembly mode (bypassed file locks) *" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host "  ---------------------------------------------------" -ForegroundColor Cyan

if ($setupExe) {
    $size = "{0:N0} KB" -f ($setupExe.Length / 1KB)
    Write-Host "  [OK] Setup:     $($setupExe.Name) ($size)" -ForegroundColor Green
    Write-Host "       $($setupExe.FullName)" -ForegroundColor White
} else {
    Write-Host "  [FAIL] Setup:   NOT FOUND" -ForegroundColor Red
}

if ($asarOk) {
    $s = "{0:N0} KB" -f ((Get-Item "$resourcesDir\app.asar").Length / 1KB)
    Write-Host "  [OK] app.asar:  $s" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] app.asar: NOT FOUND" -ForegroundColor Red
}

if ($lhmOk) {
    Write-Host "  [OK] LHM DLL:   present" -ForegroundColor Green
} else {
    Write-Host "  [FAIL] LHM DLL:  MISSING" -ForegroundColor Red
}

Write-Host "  ---------------------------------------------------" -ForegroundColor Cyan
Write-Host ""
Write-Host "  To rebuild: npm run build:pack" -ForegroundColor Gray
