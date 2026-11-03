# MoraMetrica: agenda a importacao semanal do ITBI no Agendador de Tarefas do Windows.
#
# Roda num PC no Brasil porque o firewall da Prefeitura responde "Requisicao
# Negada" aos servidores do GitHub Actions. Toda segunda as 10h; se o PC estiver
# desligado nesse horario, roda assim que ligar. Sem janela (pythonw). O log
# fica em api/logs/radar_importacao.log e o resultado de cada execucao tambem
# vai para a tabela radar_importacoes.
#
# A tarefa usa o codigo que estiver nesta copia do repositorio, na branch atual.
# Rodar o script de novo recria a tarefa (por exemplo, se a pasta mudar).
#
# Uso, de qualquer pasta:
#   powershell -ExecutionPolicy Bypass -File api\scripts\radar_agendar_windows.ps1
# Rodar agora, fora do horario:
#   Start-ScheduledTask -TaskName "MoraMetrica - importacao ITBI"
# Remover:
#   Unregister-ScheduledTask -TaskName "MoraMetrica - importacao ITBI"

$ErrorActionPreference = "Stop"

$nome = "MoraMetrica - importacao ITBI"
$api = Split-Path -Parent $PSScriptRoot
$python = @("venv", ".venv") |
    ForEach-Object { Join-Path $api "$_\Scripts\pythonw.exe" } |
    Where-Object { Test-Path $_ } |
    Select-Object -First 1
if (-not $python) { throw "Nao achei venv\Scripts\pythonw.exe em $api. Crie o venv da API antes." }

$acao = New-ScheduledTaskAction -Execute $python `
    -Argument "scripts\radar_importar.py --log logs\radar_importacao.log" `
    -WorkingDirectory $api
$gatilho = New-ScheduledTaskTrigger -Weekly -DaysOfWeek Monday -At "10:00"
$config = New-ScheduledTaskSettingsSet -StartWhenAvailable -RunOnlyIfNetworkAvailable `
    -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan -Hours 2)

Register-ScheduledTask -TaskName $nome -Action $acao -Trigger $gatilho -Settings $config -Force `
    -Description "Baixa as planilhas de ITBI da Prefeitura do Rio e atualiza a MoraMetrica (api/scripts/radar_importar.py)." |
    Out-Null

$proxima = (Get-ScheduledTaskInfo -TaskName $nome).NextRunTime
Write-Output "Tarefa '$nome' criada. Proxima execucao: $proxima"
Write-Output "Log: $(Join-Path $api 'logs\radar_importacao.log')"
