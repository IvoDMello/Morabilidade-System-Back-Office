// Atalhos ergonômicos sobre os tipos gerados do OpenAPI da API (fonte única de
// verdade dos contratos HTTP). NÃO edite api-schema.d.ts à mão — regenere com
// `npm run gen:api` depois de rodar, na API, `python scripts/export_openapi.py`.
//
// No site, os tipos ainda vivem em `@/types` (curados à mão para a vitrine).
// Estes atalhos existem para novos consumos que queiram o contrato exato da API
// sem duplicar a definição.
import type { components, paths, operations } from "./api-schema";

export type { components, paths, operations };

/** Todos os models do Pydantic, indexados pelo nome. Ex.: Schemas["ImovelCardOut"]. */
export type Schemas = components["schemas"];
