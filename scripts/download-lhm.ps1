# Download LibreHardwareMonitorLib NuGet package and extract DLL
$ErrorActionPreference = 'Stop'
$url = 'https://www.nuget.org/api/v2/package/LibreHardwareMonitorLib/0.9.4'
$out = [System.IO.Path]::GetTempPath() + 'lhm.nupkg'
Write-Host 'Downloading LibreHardwareMonitorLib...'
Invoke-WebRequest -Uri $url -OutFile $out -UseBasicParsing

$libDir = 'e:\workspace\trae\pc_monitor\electron\lib'
New-Item -ItemType Directory -Force -Path $libDir | Out-Null

Write-Host 'Extracting DLLs...'
Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($out)

$entries = $zip.Entries | Where-Object {
    $_.FullName -match 'lib/net472/LibreHardwareMonitorLib\.dll$' -or
    $_.FullName -match 'lib/net472/HidSharp\.dll$'
}

foreach ($entry in $entries) {
    $dest = Join-Path $libDir $entry.Name
    Write-Host "  Extracting: $dest"
    [System.IO.Compression.ZipFileExtensions]::ExtractToFile($entry, $dest, $true)
}

$zip.Dispose()
Remove-Item $out -Force

Write-Host ''
Write-Host 'Contents of electron/lib/:'
Get-ChildItem $libDir | ForEach-Object { Write-Host "  $($_.Name) ($($_.Length) bytes)" }
Write-Host ''
Write-Host 'Done!'
