import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

/**
 * Suíte de usabilidade/acessibilidade que varre TODO o código de UI do projeto
 * (não só uma tela) e falha quando encontra anti-padrões que prejudicam o uso
 * — com prioridade para mobile. É análise estática (roda em Node, sem DOM),
 * então é rápida e determinística e serve de guarda contra regressões.
 *
 * Cada regra devolve uma lista de violações "arquivo:linha — motivo". Se algum
 * padrão novo for legítimo, ajuste a regra (ou o allowlist) conscientemente —
 * não silencie sem entender o impacto para o usuário.
 */

const ROOT = process.cwd();
const SCAN_DIRS = ["app", "components", "features", "hooks"];

// Primitivos do design system apenas repassam props (`{...props}`), então não
// carregam rótulo/id próprios — checá-los daria falso positivo.
const RULE_EXCLUDE_PREFIXES = [join("components", "ui") + sep];

interface SourceFile {
  path: string; // relativo à raiz do projeto
  text: string;
}

function walk(dir: string, acc: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === "node_modules" || entry === ".next" || entry.startsWith(".")) continue;
      walk(full, acc);
    } else if (entry.endsWith(".tsx") || entry.endsWith(".ts")) {
      if (entry.endsWith(".test.ts") || entry.endsWith(".spec.ts")) continue;
      acc.push(full);
    }
  }
  return acc;
}

const FILES: SourceFile[] = SCAN_DIRS.flatMap((d) =>
  walk(join(ROOT, d)).map((p) => ({
    path: relative(ROOT, p),
    text: readFileSync(p, "utf8"),
  })),
);

function lineOf(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function isExcluded(path: string): boolean {
  return RULE_EXCLUDE_PREFIXES.some((prefix) => path.startsWith(prefix));
}

/**
 * Extrai as tags de abertura de um elemento HTML nativo (nome minúsculo),
 * varrendo caractere a caractere para respeitar `{...}` (JSX) e strings — assim
 * um handler com arrow function (`onChange={(e) => …}`) não corta a tag no `>`
 * do `=>`. Devolve os atributos (tudo entre o nome e o `>` final).
 */
function* openTags(text: string, tag: string): Generator<{ attrs: string; index: number }> {
  const start = new RegExp(`<${tag}(?=[\\s/>])`, "g");
  let m: RegExpExecArray | null;
  while ((m = start.exec(text)) !== null) {
    let i = m.index + tag.length + 1;
    let depth = 0;
    let quote: string | null = null;
    for (; i < text.length; i++) {
      const ch = text[i];
      if (quote) {
        if (ch === quote) quote = null;
        continue;
      }
      if (ch === '"' || ch === "'" || ch === "`") quote = ch;
      else if (ch === "{") depth++;
      else if (ch === "}") depth--;
      else if (ch === ">" && depth === 0) break;
    }
    yield { attrs: text.slice(m.index + tag.length + 1, i), index: m.index };
  }
}

describe("usabilidade: o projeto foi carregado", () => {
  it("encontrou arquivos de UI para analisar", () => {
    expect(FILES.length).toBeGreaterThan(10);
  });
});

describe("acessibilidade mobile: zoom nunca é bloqueado", () => {
  it("nenhum viewport desativa o pinch-zoom", () => {
    const offenders: string[] = [];
    const patterns = [
      /userScalable\s*:\s*false/,
      /maximumScale\s*:\s*1(\.0)?\b/,
      /user-scalable\s*=\s*no/i,
      /maximum-scale\s*=\s*1(\.0)?\b/,
    ];
    for (const file of FILES) {
      for (const pattern of patterns) {
        const m = pattern.exec(file.text);
        if (m) offenders.push(`${file.path}:${lineOf(file.text, m.index)} — ${m[0]}`);
      }
    }
    expect(offenders, `Bloquear zoom fere WCAG 1.4.4:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("acessibilidade: imagens têm texto alternativo", () => {
  it("nenhum <img> cru sem alt=", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      for (const { attrs, index } of openTags(file.text, "img")) {
        if (!/\balt\s*=/.test(attrs)) {
          offenders.push(`${file.path}:${lineOf(file.text, index)}`);
        }
      }
    }
    expect(offenders, `<img> sem alt=:\n${offenders.join("\n")}`).toEqual([]);
  });
});

describe("acessibilidade por teclado: cliques ficam em elementos focáveis", () => {
  it("nenhum onClick em <div>/<span> sem role interativo", () => {
    const offenders: string[] = [];
    for (const file of FILES) {
      if (isExcluded(file.path)) continue;
      for (const tag of ["div", "span"]) {
        for (const { attrs, index } of openTags(file.text, tag)) {
          if (/\bonClick\s*=/.test(attrs) && !/\brole\s*=/.test(attrs)) {
            offenders.push(`${file.path}:${lineOf(file.text, index)} — <${tag} onClick> sem role`);
          }
        }
      }
    }
    expect(
      offenders,
      `Handlers de clique devem estar em <button>/<a> (ou ter role+tabIndex+teclado):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("formulários: todo input tem rótulo acessível", () => {
  it("todo <input> visível tem id, aria-label ou aria-labelledby", () => {
    const offenders: string[] = [];
    const NON_LABELABLE = /type\s*=\s*["'](hidden|checkbox|radio|submit|button|file|range|reset|image)["']/;
    for (const file of FILES) {
      if (isExcluded(file.path)) continue;
      for (const { attrs, index } of openTags(file.text, "input")) {
        if (NON_LABELABLE.test(attrs)) continue;
        const labeled = /\b(id|aria-label|aria-labelledby)\s*=/.test(attrs);
        if (!labeled) offenders.push(`${file.path}:${lineOf(file.text, index)}`);
      }
    }
    expect(
      offenders,
      `Inputs precisam de rótulo (id + <label htmlFor> ou aria-label):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("acessibilidade: botões só de ícone têm nome acessível", () => {
  it("nenhum <button> apenas com ícone (sem texto) fica sem aria-label/title", () => {
    const offenders: string[] = [];
    // Captura <button ...>conteúdo</button> (não self-closing).
    const re = /<button(\s[^>]*?)?>([\s\S]*?)<\/button>/g;
    for (const file of FILES) {
      if (isExcluded(file.path)) continue;
      let m: RegExpExecArray | null;
      while ((m = re.exec(file.text)) !== null) {
        const attrs = m[1] ?? "";
        const inner = m[2] ?? "";
        // Se o conteúdo tem uma expressão {…} pode haver texto dinâmico — não dá
        // para afirmar que é só ícone; ignoramos para evitar falso positivo.
        if (inner.includes("{")) continue;
        const visibleText = inner.replace(/<[^>]*>/g, "").trim();
        if (visibleText.length > 0) continue; // tem texto literal → ok
        const named = /\b(aria-label|aria-labelledby|title)\s*=/.test(attrs);
        if (!named) offenders.push(`${file.path}:${lineOf(file.text, m.index)}`);
      }
    }
    expect(
      offenders,
      `Botões só de ícone precisam de aria-label ou title (leitor de tela / tooltip):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("mobile: links só de ícone têm área de toque", () => {
  // Classes que garantem um alvo confortável — altura explícita, tamanho fixo,
  // padding generoso, ou o truque de padding com margem negativa (`-m-2 p-2`),
  // que amplia a área sem mexer no layout ao redor.
  const AREA_DE_TOQUE =
    /\b(h-(8|9|10|11|12|14)|size-(8|9|10|11|12)|min-h-(8|9|10|11|12)|p-(2|2\.5|3|4)|py-(2|2\.5|3|4)|-m-(1\.5|2))\b/;

  it("nenhum <Link>/<a> com um ícone solto fica sem dimensão ou padding", () => {
    const offenders: string[] = [];
    // <Link ...><Icon … /></Link> — conteúdo é um único componente auto-fechado.
    const re = /<(Link|a)(\s[^>]*?)?>([\s\S]*?)<\/\1>/g;
    for (const file of FILES) {
      if (isExcluded(file.path)) continue;
      let m: RegExpExecArray | null;
      while ((m = re.exec(file.text)) !== null) {
        const attrs = m[2] ?? "";
        const inner = (m[3] ?? "").trim();
        // Só interessa o caso "ícone sozinho": qualquer texto ou segundo
        // elemento já dá área de toque por conta própria.
        if (!/^<[A-Z][A-Za-z0-9]*\s[^>]*\/>$/.test(inner)) continue;
        const className = /className="([^"]*)"/.exec(attrs)?.[1] ?? "";
        if (AREA_DE_TOQUE.test(className)) continue;
        offenders.push(`${file.path}:${lineOf(file.text, m.index)}`);
      }
    }
    expect(
      offenders,
      `Um ícone de 16–20px é alvo pequeno demais para o polegar. Dê altura/padding ao link (ex.: "flex h-10 w-10 items-center justify-center" ou "-m-2 p-2"):\n${offenders.join("\n")}`,
    ).toEqual([]);
  });
});

describe("mobile: a tela de login não força rolagem vertical", () => {
  const login = FILES.find((f) => f.path === join("app", "login", "page.tsx"));

  it("existe a tela de login", () => {
    expect(login).toBeDefined();
  });

  it("usa altura dinâmica (100dvh), não 100vh fixo", () => {
    expect(login!.text).toMatch(/100dvh/);
    expect(login!.text).not.toMatch(/h-screen\b/);
  });

  it("não recria o overlay fixed que gerava barra fantasma", () => {
    expect(login!.text).not.toMatch(/fixed inset-0/);
  });
});
