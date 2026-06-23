# =====================================================================
# Backup do bucket "captacoes" do Supabase Storage.
# O daily backup do Supabase Pro cobre o BANCO, mas NÃO o Storage.
# Requer Supabase CLI autenticado (supabase login) ou as variáveis abaixo.
#
# Uso:
#   ./backup-captacoes.ps1 -Destino "G:\Meu Drive\Backups\captacoes"
# =====================================================================
param(
  [Parameter(Mandatory = $true)] [string] $Destino,
  [string] $Bucket = "captacoes"
)

$ErrorActionPreference = "Stop"

$data = Get-Date -Format "yyyy-MM-dd"
$pasta = Join-Path $Destino $data
New-Item -ItemType Directory -Force -Path $pasta | Out-Null

Write-Host "Baixando bucket '$Bucket' para $pasta ..."

# Requer Supabase CLI. Ajuste para rclone/aws s3 se preferir egress direto.
supabase storage cp --recursive "ss://$Bucket" "$pasta"

Write-Host "Backup concluído em $pasta"
