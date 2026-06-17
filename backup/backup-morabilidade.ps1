<#
.SYNOPSIS
    Backup completo do Morabilidade (banco Postgres + Storage do Supabase) para
    uma pasta do Google Drive para Desktop.

.DESCRIPTION
    1. Faz pg_dump dos schemas `public` (dados de negocio) e `auth` (logins).
    2. Baixa TODOS os arquivos do bucket de Storage "media" (fotos + PDFs/contratos).
    3. Empacota tudo em um .zip datado.
    4. Copia o .zip para a pasta sincronizada do Google Drive.
    5. Mantem apenas as N copias mais recentes (rotacao).

    Le SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY do api/.env automaticamente.
    Le a connection string do banco e a pasta do Drive do config.ps1 (nao versionado).

.NOTES
    Rode manualmente:  powershell -ExecutionPolicy Bypass -File backup-morabilidade.ps1
    Ou agende no Agendador de Tarefas do Windows (ver README.md).
#>

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

function Log($msg) {
    $ts = Get-Date -Format "HH:mm:ss"
    Write-Host "[$ts] $msg"
}

# ── 1. Carrega configuracao local (nao versionada) ───────────────────────────
$ConfigPath = Join-Path $ScriptDir "config.ps1"
if (-not (Test-Path $ConfigPath)) {
    throw "config.ps1 nao encontrado. Copie config.example.ps1 para config.ps1 e preencha. Veja README.md."
}
. $ConfigPath

if (-not $DbPassword)    { throw "config.ps1: `$DbPassword nao definido." }
if (-not $DbHost)        { throw "config.ps1: `$DbHost nao definido." }
if (-not $DbUser)        { throw "config.ps1: `$DbUser nao definido." }
if (-not $DbPort)        { $DbPort = "5432" }
if (-not $DbName)        { $DbName = "postgres" }
if (-not $DriveFolder)   { throw "config.ps1: `$DriveFolder nao definido." }
if (-not $RetentionCount) { $RetentionCount = 8 }
if (-not $PgDumpPath)     { $PgDumpPath = "pg_dump" }  # assume no PATH se nao informado

# ── 2. Le credenciais do Supabase do api/.env ─────────────────────────────────
$EnvPath = Join-Path $ScriptDir "..\api\.env"
if (-not (Test-Path $EnvPath)) { throw "api/.env nao encontrado em $EnvPath" }

$SupabaseUrl = $null
$ServiceKey  = $null
foreach ($line in Get-Content $EnvPath) {
    if ($line -match '^\s*SUPABASE_URL\s*=\s*(.+?)\s*$')              { $SupabaseUrl = $matches[1].Trim("'`"") }
    if ($line -match '^\s*SUPABASE_SERVICE_ROLE_KEY\s*=\s*(.+?)\s*$') { $ServiceKey  = $matches[1].Trim("'`"") }
}
if (-not $SupabaseUrl) { throw "SUPABASE_URL nao encontrado no api/.env" }
if (-not $ServiceKey)  { throw "SUPABASE_SERVICE_ROLE_KEY nao encontrado no api/.env" }

$Bucket = "media"
$Stamp  = Get-Date -Format "yyyy-MM-dd_HHmm"
$WorkDir = Join-Path $env:TEMP "morabilidade-backup-$Stamp"
$StorageDir = Join-Path $WorkDir "storage"
New-Item -ItemType Directory -Force -Path $StorageDir | Out-Null

Log "Iniciando backup ($Stamp)"
Log "Supabase: $SupabaseUrl"

# ── 3. Dump do banco (public + auth) ──────────────────────────────────────────
$DumpFile = Join-Path $WorkDir "banco.dump"
Log "pg_dump (schemas public + auth)..."
# Senha via PGPASSWORD evita problemas de encoding (@, :, / etc) numa URL.
$env:PGPASSWORD = $DbPassword
try {
    & $PgDumpPath `
        -h $DbHost -p $DbPort -U $DbUser -d $DbName `
        --schema=public --schema=auth `
        --no-owner --no-privileges `
        --clean --if-exists `
        -Fc -f $DumpFile
    if ($LASTEXITCODE -ne 0) { throw "pg_dump falhou (exit $LASTEXITCODE)." }
} finally {
    Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue
}
$dumpMB = [math]::Round((Get-Item $DumpFile).Length / 1MB, 2)
Log "Banco salvo: banco.dump ($dumpMB MB)"

# ── 4. Download do Storage (bucket media, recursivo) ──────────────────────────
$headers = @{ apikey = $ServiceKey; Authorization = "Bearer $ServiceKey" }
$listUrl = "$SupabaseUrl/storage/v1/object/list/$Bucket"
$script:fileCount = 0
$script:byteCount = 0
$script:falhas    = @()

function Download-Prefix($prefix) {
    $offset = 0
    $limit  = 100
    do {
        $body = @{
            prefix = $prefix
            limit  = $limit
            offset = $offset
            sortBy = @{ column = "name"; order = "asc" }
        } | ConvertTo-Json
        $items = Invoke-RestMethod -Method Post -Uri $listUrl -Headers $headers `
                    -ContentType "application/json" -Body $body
        $batch = @($items)
        foreach ($it in $batch) {
            $name = $it.name
            if ([string]::IsNullOrEmpty($name)) { continue }
            $fullPath = if ($prefix) { "$prefix$name" } else { $name }
            if ($null -eq $it.id) {
                # Pasta — desce um nivel
                Download-Prefix "$fullPath/"
            } else {
                # Arquivo — baixa (com retry para 504/timeout transitorio do Supabase)
                $dlUrl  = "$SupabaseUrl/storage/v1/object/$Bucket/$fullPath"
                $target = Join-Path $StorageDir ($fullPath -replace '/', '\')
                $dir    = Split-Path -Parent $target
                if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
                $maxTentativas = 4
                $ok = $false
                for ($tentativa = 1; $tentativa -le $maxTentativas -and -not $ok; $tentativa++) {
                    try {
                        Invoke-WebRequest -Uri $dlUrl -Headers $headers -OutFile $target | Out-Null
                        $script:fileCount++
                        $script:byteCount += (Get-Item $target).Length
                        $ok = $true
                    } catch {
                        if ($tentativa -lt $maxTentativas) {
                            Start-Sleep -Seconds ($tentativa * 3)  # backoff: 3s, 6s, 9s
                        } else {
                            Log "  AVISO: falha ao baixar (apos $maxTentativas tentativas) $fullPath : $_"
                            $script:falhas += $fullPath
                        }
                    }
                }
            }
        }
        $offset += $limit
    } while ($batch.Count -eq $limit)
}

Log "Baixando Storage (bucket '$Bucket')..."
Download-Prefix ""
$storageMB = [math]::Round($script:byteCount / 1MB, 2)
Log "Storage salvo: $($script:fileCount) arquivos ($storageMB MB)"
if ($script:falhas.Count -gt 0) {
    Log "ATENCAO: $($script:falhas.Count) arquivo(s) NAO baixados apos as tentativas:"
    $script:falhas | ForEach-Object { Log "    - $_" }
}

# ── 5. Manifesto ──────────────────────────────────────────────────────────────
$manifest = @"
Backup Morabilidade
Data/hora.......: $(Get-Date -Format "yyyy-MM-dd HH:mm:ss")
Supabase........: $SupabaseUrl
Banco (dump)....: banco.dump ($dumpMB MB) — schemas public + auth, formato custom (pg_restore)
Storage.........: $($script:fileCount) arquivos ($storageMB MB) na pasta storage/
Falhas..........: $($script:falhas.Count) arquivo(s) nao baixado(s)$(if ($script:falhas.Count) { "`n  " + ($script:falhas -join "`n  ") })

Restaurar o banco:
  pg_restore --clean --if-exists --no-owner --no-privileges -d "<connection-string>" banco.dump

Restaurar o Storage:
  Reenviar a pasta storage/ para o bucket 'media' (mesma estrutura de pastas).
"@
$manifest | Out-File -FilePath (Join-Path $WorkDir "LEIA-ME.txt") -Encoding utf8

# ── 6. Zip ────────────────────────────────────────────────────────────────────
if (-not (Test-Path $DriveFolder)) { throw "Pasta do Drive nao existe: $DriveFolder" }
$ZipPath = Join-Path $DriveFolder "morabilidade-backup-$Stamp.zip"
Log "Compactando para $ZipPath ..."
Compress-Archive -Path (Join-Path $WorkDir "*") -DestinationPath $ZipPath -Force
$zipMB = [math]::Round((Get-Item $ZipPath).Length / 1MB, 2)
Log "Zip criado ($zipMB MB)."

# ── 7. Limpa temporario ───────────────────────────────────────────────────────
Remove-Item -Recurse -Force $WorkDir

# ── 8. Rotacao — mantem as N copias mais recentes ─────────────────────────────
$zips = Get-ChildItem -Path $DriveFolder -Filter "morabilidade-backup-*.zip" |
        Sort-Object LastWriteTime -Descending
if ($zips.Count -gt $RetentionCount) {
    $zips | Select-Object -Skip $RetentionCount | ForEach-Object {
        Log "Removendo backup antigo: $($_.Name)"
        Remove-Item $_.FullName -Force
    }
}

Log "Backup concluido com sucesso. ($($zips.Count) copia(s) na pasta, retencao=$RetentionCount)"
