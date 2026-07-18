<#
    Copie este arquivo para "config.ps1" (na mesma pasta) e preencha os valores.
    O config.ps1 NAO vai para o Git (contem segredos), ja esta no .gitignore.
#>

# Connection string do banco, pegue em:
#   Supabase Dashboard -> Project Settings -> Database -> Connection string
#   Use a aba "Session pooler" (IPv4, funciona em qualquer rede). Troque [YOUR-PASSWORD]
#   pela senha do banco. Exemplo do formato:
$PgConnString = "postgresql://postgres.udkahpqjqznwdqmbazho:SUA-SENHA-AQUI@aws-0-sa-east-1.pooler.supabase.com:5432/postgres"

# Pasta sincronizada do Google Drive para Desktop onde os .zip serao salvos.
# Crie uma pasta "Backups Morabilidade" dentro do seu Google Drive e aponte aqui.
# Ex.: "G:\Meu Drive\Backups Morabilidade"  ou  "G:\Drives compartilhados\..."
$DriveFolder = "G:\Meu Drive\Backups Morabilidade"

# Quantas copias manter (rotacao). Combinado: 8 (cerca de 2 meses no semanal).
$RetentionCount = 8

# Caminho do pg_dump.exe. Se o Postgres estiver no PATH, deixe "pg_dump".
# Senao, aponte o .exe, ex.: "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
$PgDumpPath = "pg_dump"
