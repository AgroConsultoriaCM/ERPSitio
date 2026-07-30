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

$ErrorActionPreference = "Stop"

function Escrever($texto, $cor = "White") {
  Write-Host "[$(Get-Date -Format 'HH:mm:ss')] $texto" -ForegroundColor $cor
}

# --- verificações iniciais ---------------------------------------------------

if (-not (Get-Command oci -ErrorAction SilentlyContinue)) {
  Write-Host ""
  Write-Host "A ferramenta 'oci' não está instalada." -ForegroundColor Red
  Write-Host "Instale com:" -ForegroundColor Yellow
  Write-Host '  winget install Oracle.OCI-CLI' -ForegroundColor Cyan
  Write-Host "Depois feche e reabra o PowerShell." -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

if (-not (Test-Path "$HOME\.oci\config")) {
  Write-Host ""
  Write-Host "Falta configurar o acesso à Oracle (arquivo ~\.oci\config)." -ForegroundColor Red
  Write-Host "Veja o passo a passo em infra\oracle\README.md, seção" -ForegroundColor Yellow
  Write-Host "'Script de tentativa automática'." -ForegroundColor Yellow
  Write-Host ""
  exit 1
}

Escrever "verificando acesso à Oracle..." "Gray"
try {
  oci resource-manager stack get --stack-id $StackId --query "data.\`"display-name\`"" --raw-output | Out-Null
} catch {
  Write-Host "Não consegui ler o stack. Confira o StackId e o arquivo ~\.oci\config." -ForegroundColor Red
  exit 1
}

Write-Host ""
Write-Host "=======================================================" -ForegroundColor Green
Write-Host " Tentando criar a instância ARM na Oracle" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
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

  $jobId = $null
  try {
    $jobId = oci resource-manager job create-apply-job `
      --stack-id $StackId `
      --execution-plan-strategy AUTO_APPROVED `
      --query "data.id" --raw-output 2>$null
  } catch {
    Escrever "não consegui disparar o job, tentando de novo mais tarde" "Yellow"
  }

  if ($jobId) {
    # acompanha o job até terminar
    $estado = "ACCEPTED"
    $espera = 0
    while ($estado -in @("ACCEPTED", "IN_PROGRESS") -and $espera -lt 300) {
      Start-Sleep -Seconds 10
      $espera += 10
      try {
        $estado = oci resource-manager job get --job-id $jobId --query "data.\`"lifecycle-state\`"" --raw-output 2>$null
      } catch { }
    }

    if ($estado -eq "SUCCEEDED") {
      Write-Host ""
      Write-Host "=======================================================" -ForegroundColor Green
      Write-Host " CONSEGUIU! A instância foi criada." -ForegroundColor Green
      Write-Host "=======================================================" -ForegroundColor Green
      Write-Host " Tentativas: $tentativa"
      Write-Host " Tempo total: $([int]((Get-Date) - $inicio).TotalMinutes) minutos"
      Write-Host ""
      Write-Host " Pegue o IP público em: Compute -> Instances" -ForegroundColor Cyan
      Write-Host ""
      # apito para chamar atenção se você estiver longe da tela
      for ($i = 0; $i -lt 5; $i++) { [console]::beep(880, 400); Start-Sleep -Milliseconds 200 }
      exit 0
    }

    # Falhou: distingue falta de capacidade (normal, seguir tentando) de
    # erro de configuração (parar, porque tentar de novo não resolve).
    $logs = ""
    try {
      $logs = oci resource-manager job get-job-logs --job-id $jobId --query "data[*].message" --raw-output 2>$null
    } catch { }

    if ($logs -match "Out of host capacity|Out of capacity") {
      Escrever "sem capacidade agora - nova tentativa em $IntervaloSegundos s" "DarkYellow"
    } else {
      Write-Host ""
      Escrever "o job falhou por um motivo diferente de capacidade:" "Red"
      Write-Host $logs -ForegroundColor Red
      Write-Host ""
      Escrever "corrija a configuração do stack antes de tentar de novo." "Yellow"
      exit 3
    }
  }

  Start-Sleep -Seconds $IntervaloSegundos
}
