param(
  [string]$Path = "public\genesis\summon-prior.json"
)
$last = 0
while ($true) {
  if (Test-Path $Path) {
    $json = Get-Content $Path -Raw | ConvertFrom-Json
    $n = $json.entries.Count
    if ($n -ne $last) {
      Clear-Host
      Write-Host "$n concepts done:" -ForegroundColor Cyan
      $json.entries | ForEach-Object { Write-Host (" - {0,-32} {1}" -f $_.prompt, $_.score) }
      $last = $n
    }
  }
  Start-Sleep -Seconds 3
}
