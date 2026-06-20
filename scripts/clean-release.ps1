$retry = 5
while ($retry -gt 0) {
    try {
        Remove-Item -Recurse -Force "e:\workspace\trae\pc_monitor\release" -ErrorAction Stop
        Write-Host "Deleted release directory"
        break
    } catch {
        Write-Host "Retrying deletion... ($retry attempts left)"
        Start-Sleep 2
        $retry--
    }
}
