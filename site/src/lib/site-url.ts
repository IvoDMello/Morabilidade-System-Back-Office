/**
 * URL pública do site.
 *
 * O domínio .com.br foi descontinuado na migração para .com, mas a env
 * NEXT_PUBLIC_SITE_URL pode ainda apontar para ele em algum ambiente — o que
 * vazaria para links de compartilhamento, canonical e sitemap. Normalizamos
 * aqui para que o .com seja sempre a única versão que sai do site.
 */
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://morabilidade.com"
)
  .replace(/morabilidade\.com\.br/i, "morabilidade.com")
  .replace(/\/+$/, "");
