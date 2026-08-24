import "@testing-library/jest-dom";

/**
 * Lacunas do jsdom que os componentes do Radix esperam encontrar no navegador.
 *
 * O Select do Radix usa Pointer Capture para não perder o arrasto quando o
 * ponteiro sai do item, e chama `scrollIntoView` ao abrir para trazer a opção
 * marcada à vista. O jsdom não implementa nenhum dos dois, então abrir um
 * `<FiltroSelect>` num teste estoura com "hasPointerCapture is not a function"
 * — falha do ambiente, não do componente.
 *
 * Ficam aqui, e não em cada arquivo, porque a alternativa é lembrar de stubar
 * em todo teste novo que abra um select.
 */
if (typeof Element !== "undefined") {
  Element.prototype.hasPointerCapture ??= () => false;
  Element.prototype.setPointerCapture ??= () => {};
  Element.prototype.releasePointerCapture ??= () => {};
  Element.prototype.scrollIntoView ??= () => {};
}
