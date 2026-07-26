// Atalhos ergonômicos sobre os tipos gerados do OpenAPI da API (fonte única de
// verdade dos contratos HTTP). NÃO edite api-schema.d.ts à mão — regenere com
// `npm run gen:api` depois de rodar, na API, `python scripts/export_openapi.py`.
//
// Uso típico:
//   import type { Schemas } from "@/lib/api-types";
//   type Imovel = Schemas["ImovelOut"];
//
// Se um campo mudar no Pydantic e o schema for regenerado, os call sites que
// dependem dele param de COMPILAR — que é o objetivo (fim do drift silencioso
// entre API e painel).
import type { components, paths, operations } from "./api-schema";

export type { components, paths, operations };

/** Todos os models do Pydantic, indexados pelo nome. Ex.: Schemas["ClienteOut"]. */
export type Schemas = components["schemas"];
