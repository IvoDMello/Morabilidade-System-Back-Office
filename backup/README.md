# Backup do Morabilidade → Google Drive

Backup **completo e independente** do Supabase, guardado no Google Drive. Cobre o que o
plano Pro do Supabase **não** cobre sozinho.

## O que é salvo

| Item | Conteúdo | Coberto pelo backup do Pro? |
|------|----------|------------------------------|
| **Banco Postgres** (`banco.dump`) | Schemas `public` (clientes, imóveis, locações, fichas, autorizações, audit, analytics) e `auth` (logins) | ✅ daily 7d — aqui é redundância externa |
| **Storage** (pasta `storage/`) | Bucket `media`: fotos dos imóveis/perfil + **PDFs de fichas assinadas, contratos e anexos de locação** | ❌ **NÃO** — esse é o motivo principal deste backup |

> Firebase, Resend e Sentry **não** entram: Firebase está morto no projeto (só restam
> variáveis órfãs), e Resend/Sentry são serviços transacionais sem dado de negócio.

## Pré-requisitos (uma vez só)

1. **Google Drive para Desktop** instalado e logado. Crie a pasta `Backups Morabilidade`
   dentro do seu Drive. (O Drive sincroniza sozinho o que cair lá.)

2. **Cliente do PostgreSQL** (para o `pg_dump`). Baixe em
   <https://www.postgresql.org/download/windows/> — instale a versão **17** (mesma do
   Supabase). Anote o caminho do `pg_dump.exe`, normalmente
   `C:\Program Files\PostgreSQL\17\bin\pg_dump.exe`.

3. **Connection string do banco**: Supabase Dashboard → *Project Settings → Database →
   Connection string → aba **Session pooler*** (IPv4). Troque `[YOUR-PASSWORD]` pela senha
   do banco. Se esqueceu a senha, dá pra resetar nessa mesma tela.

## Configuração (uma vez só)

1. Copie `config.example.ps1` para `config.ps1` (mesma pasta).
2. Preencha em `config.ps1`:
   - `$PgConnString` — a connection string do Session pooler com a senha.
   - `$DriveFolder` — caminho da pasta no Drive, ex.: `G:\Meu Drive\Backups Morabilidade`.
   - `$PgDumpPath` — caminho do `pg_dump.exe` (ou deixe `pg_dump` se estiver no PATH).

O `config.ps1` **não vai para o Git** (está no `.gitignore`). As chaves do Supabase são
lidas automaticamente do `api/.env`.

## Rodar manualmente (teste o primeiro)

```powershell
cd "caminho\do\projeto\backup"
powershell -ExecutionPolicy Bypass -File .\backup-morabilidade.ps1
```

No fim, confira o `.zip` aparecendo na pasta do Drive e sincronizando.

## Agendar (semanal)

1. Abra o **Agendador de Tarefas** do Windows → *Criar Tarefa*.
2. **Geral**: marque *Executar estando o usuário conectado ou não* e *Executar com privilégios mais altos*.
3. **Disparadores**: novo → *Semanalmente*, escolha o dia/horário (ex.: domingo 03:00).
4. **Ações**: novo → *Iniciar um programa*:
   - Programa: `powershell.exe`
   - Argumentos: `-ExecutionPolicy Bypass -NoProfile -File "C:\caminho\completo\backup\backup-morabilidade.ps1"`
   - Iniciar em: `C:\caminho\completo\backup`
5. **Condições**: desmarque "iniciar só com energia AC" se for notebook; marque "ativar o
   computador para executar" se quiser.

> O PC precisa estar ligado no horário agendado. Se ele costuma ficar desligado, escolha um
> horário em que ele esteja ligado, ou rode manualmente quando lembrar.

## Restaurar (se precisar)

Dentro do `.zip` há um `LEIA-ME.txt` com os comandos. Resumo:

- **Banco**: `pg_restore --clean --if-exists --no-owner --no-privileges -d "<connection-string>" banco.dump`
- **Storage**: reenviar a pasta `storage/` para o bucket `media` mantendo a estrutura.

## Retenção

Mantém as **8 cópias** mais recentes na pasta do Drive (ajustável em `config.ps1`).
As mais antigas são apagadas automaticamente a cada execução.
