# Avisa quando uma instancia ARM aparecer na conta.
#
# Nao cria nada: so observa. Serve de companheiro do tentar-instancia.ps1 -
# aquele insiste, este avisa que deu certo.
#
# Uso:  .\infra\oracle\vigiar-instancia.ps1

$ErrorActionPreference = "Continue"

$oci = "oci"
if (-not (Get-Command oci -ErrorAction SilentlyContinue)) {
  $candidatos = @(
    "C:\Program Files (x86)\Oracle\oci_cli\oci.exe",
    "C:\Program Files\Oracle\oci_cli\oci.exe",
    "$env:LOCALAPPDATA\Programs\Oracle\oci_cli\oci.exe"
  )
  $achado = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $achado) { Write-Host "oci nao encontrado"; exit 1 }
  $oci = $achado
}

$cfg = Get-Content "$HOME\.oci\config" -Raw
$tenancy = ([regex]::Match($cfg, 'tenancy\s*=\s*(\S+)')).Groups[1].Value

# Sem --query: escapar aspas no PowerShell 5.1 devolve vazio (ja custou caro).
function Oci($argumentos) {
  $saida = (& $oci @argumentos 2>&1 | Out-String)
  $i = $saida.IndexOf("{")
  if ($i -lt 0) { return $null }
  try { return $saida.Substring($i) | ConvertFrom-Json } catch { return $null }
}

$r = Oci @("compute", "instance", "list", "--compartment-id", $tenancy, "--all")
if (-not $r) { exit 0 }

$arm = $r.data | Where-Object {
  $_.shape -like "*A1.Flex*" -and $_.'lifecycle-state' -in @("RUNNING", "PROVISIONING", "STARTING")
}

if ($arm) {
  foreach ($i in $arm) {
    "INSTANCIA ARM ENCONTRADA: $($i.'display-name') | $($i.shape) | $($i.'shape-config'.ocpus) OCPU / $($i.'shape-config'.'memory-in-gbs') GB | $($i.'lifecycle-state')"
  }
  exit 7
}

exit 0
