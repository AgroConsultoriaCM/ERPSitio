# Tenta criar a instância ARM na Oracle repetidamente, até conseguir.
#
# A camada gratuita ARM vive esgotada nas regiões concorridas: a capacidade
# só aparece quando outra conta apaga uma instância. Este script fica
# disparando o "apply" do stack que você já salvou, e avisa quando entrar.
#
# Uso:
#   .\infra\oracle\tentar-instancia.ps1 -StackId "ocid1.ormstack.oc1..."
#
# Opcional:
#   -IntervaloSegundos 180    (padrão: 300 = 5 min)
#   -MaxTentativas 500        (padrão: 0 = infinito)
#
# Deixe rodando numa janela do PowerShell. Pode fechar o navegador.

param(
  [Parameter(Mandatory = $true)]
  [string]$StackId,

  [int]$IntervaloSegundos = 300,
  [int]$MaxTentativas = 0
)

# Nada de "Stop": o PowerShell 5.1 trata saída de programa externo em stderr
# como erro mesmo quando o comando funcionou, e isso abortaria o laço à toa.
$ErrorActionPreference = "Continue"

function Escrever($texto, $cor = "White") {
  Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $texto" -ForegroundColor $cor
}

# --- localizar a ferramenta --------------------------------------------------

$oci = "oci"
if (-not (Get-Command oci -ErrorAction SilentlyContinue)) {
  $candidatos = @(
    "C:\Program Files (x86)\Oracle\oci_cli\oci.exe",
    "C:\Program Files\Oracle\oci_cli\oci.exe",
    "$env:LOCALAPPDATA\Programs\Oracle\oci_cli\oci.exe"
  )
  $encontrado = $candidatos | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($encontrado) {
    $oci = $encontrado
  } else {
    Write-Host "`nA ferramenta 'oci' não foi encontrada." -ForegroundColor Red
    Write-Host "Instale com: winget install Oracle.OCI-CLI`n" -ForegroundColor Yellow
    exit 1
  }
}

if (-not (Test-Path "$HOME\.oci\config")) {
  Write-Host "`nFalta configurar o acesso à Oracle (~\.oci\config)." -ForegroundColor Red
  Write-Host "Veja infra\oracle\README.md, seção 'Script de tentativa automática'.`n" -ForegroundColor Yellow
  exit 1
}

# Chama a ferramenta e devolve o JSON já convertido em objeto.
# Sem --query e sem 2>$null de propósito: escapar aspas no PowerShell 5.1 é
# frágil, e o redirecionamento engolia a resposta inteira junto com o aviso.
function Invocar-Oci {
  param([string[]]$Argumentos)
  try {
    $saida = (& $oci @Argumentos 2>&1 | Out-String)
    # descarta avisos que a ferramenta imprime antes do JSON
    $inicioJson = $saida.IndexOf("{")
    if ($inicioJson -lt 0) { return $null }
    return $saida.Substring($inicioJson) | ConvertFrom-Json
  } catch {
    return $null
  }
}

# --- verificação de acesso ---------------------------------------------------

Escrever "verificando acesso à Oracle..." "Gray"
$stack = Invocar-Oci @("resource-manager", "stack", "get", "--stack-id", $StackId)
if (-not $stack) {
  Write-Host "Não consegui ler o stack. Confira o StackId e o ~\.oci\config." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host " Tentando criar a instância ARM na Oracle" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host " Stack: $($stack.data.'display-name')"
Write-Host " Intervalo entre tentativas: $IntervaloSegundos segundos"
Write-Host " Para parar: Ctrl+C"
Write-Host ""

# --- laço de tentativas ------------------------------------------------------

$tentativa = 0
$inicio = Get-Date

while ($true) {
  $tentativa++

  if ($MaxTentativas -gt 0 -and $tentativa -gt $MaxTentativas) {
    Escrever "limite de $MaxTentativas tentativas atingido, encerrando." "Yellow"
    exit 2
  }

  Escrever "tentativa $tentativa..." "Cyan"

  $job = Invocar-Oci @(
    "resource-manager", "job", "create-apply-job",
    "--stack-id", $StackId,
    "--execution-plan-strategy", "AUTO_APPROVED"
  )

  if (-not $job -or -not $job.data.id) {
    Escrever "não consegui disparar o job - nova tentativa em $IntervaloSegundos s" "Yellow"
    Start-Sleep -Seconds $IntervaloSegundos
    continue
  }

  $jobId = $job.data.id

  # acompanha até terminar (teto de 5 min por tentativa)
  $estado = "ACCEPTED"
  $espera = 0
  while ($estado -in @("ACCEPTED", "IN_PROGRESS") -and $espera -lt 300) {
    Start-Sleep -Seconds 10
    $espera += 10
    $detalhe = Invocar-Oci @("resource-manager", "job", "get", "--job-id", $jobId)
    if ($detalhe) { $estado = $detalhe.data.'lifecycle-state' }
  }

  if ($estado -eq "SUCCEEDED") {
    $minutos = [int]((Get-Date) - $inicio).TotalMinutes
    Write-Host ""
    Write-Host "=======================================================" -ForegroundColor Green
    Write-Host " CONSEGUIU! A instância foi criada." -ForegroundColor Green
    Write-Host "=======================================================" -ForegroundColor Green
    Write-Host " Tentativas: $tentativa"
    Write-Host " Tempo total: $minutos minutos"
    Write-Host ""
    Write-Host " Pegue o IP público em: Compute -> Instances" -ForegroundColor Cyan
    Write-Host ""
    for ($i = 0; $i -lt 5; $i++) { [console]::beep(880, 400); Start-Sleep -Milliseconds 200 }
    exit 0
  }

  # Falta de capacidade é o caso esperado: segue tentando. Qualquer outro
  # motivo interrompe, porque repetir uma configuração inválida não resolve.
  $logs = ""
  try {
    $logs = (& $oci resource-manager job get-job-logs --job-id $jobId --all 2>&1 | Out-String)
  } catch { }

  if ($logs -match "Out of host capacity|Out of capacity") {
    Escrever "sem capacidade agora - nova tentativa em $IntervaloSegundos s" "DarkYellow"
  }
  elseif ([string]::IsNullOrWhiteSpace($logs)) {
    Escrever "falhou sem log legível - tentando de novo em $IntervaloSegundos s" "DarkYellow"
  }
  else {
    $erro = ($logs -split "`n" | Where-Object { $_ -match "Error:" } | Select-Object -First 3) -join "`n"
    Write-Host ""
    Escrever "o job falhou por um motivo diferente de capacidade:" "Red"
    Write-Host $erro -ForegroundColor Red
    Write-Host ""
    Escrever "corrija a configuração do stack antes de tentar de novo." "Yellow"
    exit 3
  }

  Start-Sleep -Seconds $IntervaloSegundos
}
