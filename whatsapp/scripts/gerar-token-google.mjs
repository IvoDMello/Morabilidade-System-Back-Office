/**
 * Gera o GOOGLE_CALENDAR_REFRESH_TOKEN usado pelo espelho da visita na Google
 * Agenda (services/google-calendar.service.ts).
 *
 *   npm run token:google
 *
 * Roda um servidor de loopback, abre o consentimento do Google no navegador e
 * troca o código pelo refresh token, que é impresso pronto pra colar no
 * .env.local E no ambiente de produção.
 *
 * Precisa ser rodado de novo quando o token expira ou é revogado. Se o app
 * OAuth estiver com status "Em teste" no Google Auth Platform, o Google expira
 * o refresh token em 7 dias — publique o app ("Em produção") antes de gerar,
 * senão isto vira tarefa semanal.
 */
import { createServer } from "node:http";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { google } from "googleapis";

const PORTA = 53682;
const REDIRECT_URI = `http://localhost:${PORTA}`;
const ESCOPO = "https://www.googleapis.com/auth/calendar.events";

const raizApp = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Lê o .env.local na mão: este script roda fora do Next, que é quem
 * normalmente carrega esse arquivo. Variáveis já exportadas no ambiente
 * ganham do arquivo (útil pra gerar o token de outro projeto sem editar nada).
 */
function lerEnvLocal() {
  let conteudo;
  try {
    conteudo = readFileSync(path.join(raizApp, ".env.local"), "utf8");
  } catch {
    return {};
  }
  const vars = {};
  for (const linha of conteudo.split(/\r?\n/)) {
    const match = /^\s*([A-Z0-9_]+)\s*=(.*)$/.exec(linha);
    if (!match) continue;
    vars[match[1]] = match[2].trim().replace(/^["']|["']$/g, "");
  }
  return vars;
}

/**
 * Abre a URL no navegador padrão SEM passar por shell. No Windows a rota
 * óbvia (`cmd /c start <url>`) não serve: o `cmd` trata `&` como separador de
 * comandos e entrega ao navegador só o trecho até o primeiro parâmetro, o que
 * derruba o `response_type` e o Google responde "Acesso bloqueado:
 * invalid_request". `rundll32` recebe a URL como um argv só, sem interpretar
 * nada.
 */
function abrirNavegador(url) {
  const [comando, args] =
    process.platform === "win32"
      ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    spawn(comando, args, { stdio: "ignore", detached: true }).unref();
  } catch {
    // Sem navegador disponível (WSL, servidor): o link impresso resolve.
  }
}

const PAGINA_OK =
  "<!doctype html><meta charset=utf-8><title>Autorizado</title>" +
  "<body style=\"font-family:system-ui;padding:3rem;text-align:center\">" +
  "<h1>Autorizado</h1><p>Pode fechar esta aba e voltar ao terminal.</p>";

const PAGINA_ERRO =
  "<!doctype html><meta charset=utf-8><title>Falhou</title>" +
  "<body style=\"font-family:system-ui;padding:3rem;text-align:center\">" +
  "<h1>Autorização não concluída</h1><p>Veja o motivo no terminal.</p>";

/** Sobe o loopback e resolve com o `code` que o Google devolve no redirect. */
function esperarCodigo() {
  return new Promise((resolve, reject) => {
    const servidor = createServer((req, res) => {
      const url = new URL(req.url, REDIRECT_URI);
      // O navegador pede /favicon.ico junto; ignorar pra não encerrar cedo.
      if (url.pathname !== "/") {
        res.writeHead(404).end();
        return;
      }
      const code = url.searchParams.get("code");
      const erro = url.searchParams.get("error");
      res.writeHead(code ? 200 : 400, { "content-type": "text/html; charset=utf-8" });
      res.end(code ? PAGINA_OK : PAGINA_ERRO);
      servidor.close();
      if (code) resolve(code);
      else reject(new Error(`o Google recusou a autorização: ${erro ?? "sem código no retorno"}`));
    });
    servidor.on("error", (err) => {
      reject(
        err.code === "EADDRINUSE"
          ? new Error(`a porta ${PORTA} está ocupada — feche o processo que a usa e rode de novo`)
          : err,
      );
    });
    servidor.listen(PORTA);
  });
}

async function main() {
  const env = { ...lerEnvLocal(), ...process.env };
  const clientId = env.GOOGLE_CALENDAR_CLIENT_ID;
  const clientSecret = env.GOOGLE_CALENDAR_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "faltam GOOGLE_CALENDAR_CLIENT_ID/GOOGLE_CALENDAR_CLIENT_SECRET no .env.local " +
        "(pegue em Google Auth Platform → Clientes)",
    );
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
  // prompt=consent é o que garante refresh_token novo: sem ele, uma conta que
  // já autorizou antes recebe só o access_token e o script não teria o que
  // imprimir. access_type=offline é o que emite refresh_token.
  const urlConsentimento = oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: [ESCOPO],
  });

  console.log(`\nRedirect em uso: ${REDIRECT_URI}`);
  console.log("(cliente OAuth do tipo \"App para computador\" aceita esse loopback sozinho;");
  console.log(" se o cliente for do tipo \"Aplicativo da Web\", cadastre essa URL nele antes)\n");
  console.log("Autorize na conta Google dona da Agenda:\n");
  console.log(`  ${urlConsentimento}\n`);
  console.log("Aguardando o retorno do Google...");

  abrirNavegador(urlConsentimento);

  const code = await esperarCodigo();
  const { tokens } = await oauth2.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "o Google não devolveu refresh_token — revogue o acesso do app em " +
        "myaccount.google.com/permissions e rode de novo",
    );
  }

  // Confirma em qual conta o token caiu: autorizar com o Google errado logado
  // é o engano mais fácil aqui, e ele só apareceria dias depois, com a visita
  // agendada indo parar numa agenda que ninguém abre.
  // Precisa ser events.list: o escopo calendar.events não dá acesso a
  // calendarList/calendars.get (respondem 403 insufficient scopes mesmo com o
  // token bom). O `summary` que vem aqui é o nome da agenda primária, que numa
  // conta pessoal é o próprio e-mail.
  oauth2.setCredentials(tokens);
  let conta = "(não foi possível ler a agenda)";
  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2 });
    const { data } = await calendar.events.list({ calendarId: "primary", maxResults: 1 });
    conta = data.summary ?? conta;
  } catch (err) {
    console.error("\nAviso: token gerado, mas a leitura da agenda falhou:", err.message);
  }

  console.log(`\nAgenda autorizada: ${conta}`);
  console.log("\nCole no .env.local e no ambiente de produção:\n");
  console.log(`GOOGLE_CALENDAR_REFRESH_TOKEN=${tokens.refresh_token}\n`);
}

main().catch((err) => {
  console.error(`\nFalhou: ${err.message}\n`);
  process.exit(1);
});
