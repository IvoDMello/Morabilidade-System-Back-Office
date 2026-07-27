/**
 * Normaliza um telefone para o formato canônico usado para casar com o
 * remetente do WhatsApp e para a restrição de unicidade em `contacts.phone`:
 * somente dígitos, sempre com o DDI 55 na frente.
 */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.startsWith("55") ? digits : `55${digits}`;
}

/**
 * Variantes com que o WhatsApp pode reportar um celular brasileiro: a Meta
 * envia o wa_id de muitos números BR sem o nono dígito, então o mesmo
 * telefone pode chegar como `55 DDD 9XXXXXXXX` ou `55 DDD XXXXXXXX`.
 * Retorna o número normalizado primeiro, seguido da variante alternativa.
 */
export function phoneMatchCandidates(phone: string): string[] {
  const canonical = normalizePhone(phone);
  // 55 + DDD + celular de 9 dígitos → variante sem o nono dígito
  if (/^55\d{2}9\d{8}$/.test(canonical)) {
    return [canonical, canonical.slice(0, 4) + canonical.slice(5)];
  }
  // 55 + DDD + celular antigo de 8 dígitos → variante com o nono dígito
  if (/^55\d{2}[6-9]\d{7}$/.test(canonical)) {
    return [canonical, `${canonical.slice(0, 4)}9${canonical.slice(4)}`];
  }
  return [canonical];
}
