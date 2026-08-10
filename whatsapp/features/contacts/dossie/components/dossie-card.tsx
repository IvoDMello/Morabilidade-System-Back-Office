import { Building2, CircleAlert, CircleCheck, FileText, Footprints } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { rotuloDocumento } from "@/constants/documentos-imovel";
import { formatDate } from "@/lib/utils";
import type { DossieCliente } from "@/lib/backoffice-api";

/**
 * O que o sistema principal sabe sobre este cliente, dentro da conversa.
 *
 * Quem atende no chat enxergava só o que foi digitado no próprio chat: que o
 * cliente já visitou dois imóveis, que a ficha de um deles nunca foi assinada
 * ou que ele é dono do MB-00042 sem a matrícula anexada ficava a três telas de
 * distância, em outro sistema. É o tipo de fato que muda a próxima frase.
 *
 * O cartão só existe quando há o que dizer: sem visita e sem imóvel próprio,
 * ele não é renderizado (ver `temConteudo`) — a tela já estava cheia demais, e
 * uma seção vazia é exatamente o tipo de coisa que a deixou assim.
 */
export function temConteudo(dossie: DossieCliente | null): dossie is DossieCliente {
  return (
    dossie !== null &&
    (dossie.visitas.length > 0 || dossie.imoveisProprietario.length > 0)
  );
}

function Pendente({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-gold">
      <CircleAlert className="h-3 w-3 shrink-0" />
      {children}
    </span>
  );
}

function Feito({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 text-jade-soft">
      <CircleCheck className="h-3 w-3 shrink-0" />
      {children}
    </span>
  );
}

export function DossieCard({ dossie }: { dossie: DossieCliente }) {
  const { visitas, imoveisProprietario } = dossie;

  return (
    <Card>
      <CardHeader>
        <CardTitle>No sistema</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {imoveisProprietario.length > 0 && (
          <section className="flex flex-col gap-2">
            <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              <Building2 className="h-3.5 w-3.5" />
              Proprietário de
            </h3>
            <ul className="flex flex-col gap-2.5">
              {imoveisProprietario.map((imovel) => (
                <li key={imovel.imovelId} className="flex flex-col gap-1 text-sm">
                  <p className="font-medium">
                    {imovel.codigo ?? "Imóvel"}
                    {imovel.titulo && (
                      <span className="font-normal text-muted-foreground"> · {imovel.titulo}</span>
                    )}
                    {imovel.bairro && (
                      <span className="font-normal text-muted-foreground"> · {imovel.bairro}</span>
                    )}
                  </p>

                  <p className="text-xs">
                    {imovel.autorizacao === null ? (
                      <Pendente>Sem autorização de intermediação</Pendente>
                    ) : imovel.autorizacao.assinadaEm ? (
                      <Feito>
                        Autorização assinada em {formatDate(imovel.autorizacao.assinadaEm)}
                      </Feito>
                    ) : (
                      <Pendente>Autorização emitida, sem assinatura</Pendente>
                    )}
                  </p>

                  <p className="flex flex-wrap items-center gap-1 text-xs">
                    {imovel.documentos.length === 0 ? (
                      <Pendente>Nenhum documento anexado</Pendente>
                    ) : (
                      <>
                        <FileText className="h-3 w-3 shrink-0 text-muted-foreground" />
                        <span className="text-muted-foreground">
                          {imovel.documentos.map((d) => rotuloDocumento(d.tipo)).join(", ")}
                        </span>
                      </>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {visitas.length > 0 && (
          <section
            className={`flex flex-col gap-2 ${imoveisProprietario.length > 0 ? "border-t pt-4" : ""}`}
          >
            <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-[0.08em] text-muted-foreground uppercase">
              <Footprints className="h-3.5 w-3.5" />
              Já visitou
            </h3>
            <ul className="flex flex-col gap-2">
              {visitas.map((visita) => (
                <li key={visita.fichaId} className="flex flex-col gap-0.5 text-sm">
                  <p className="font-medium">
                    {visita.imovelCodigo ?? "Imóvel"}
                    {visita.imovelEndereco && (
                      <span className="font-normal text-muted-foreground">
                        {" "}
                        · {visita.imovelEndereco}
                      </span>
                    )}
                  </p>
                  <p className="text-xs">
                    {visita.assinadaEm ? (
                      <Feito>Ficha assinada em {formatDate(visita.assinadaEm)}</Feito>
                    ) : visita.status === "cancelada" ? (
                      <span className="text-muted-foreground">Ficha cancelada</span>
                    ) : (
                      <Pendente>Ficha de visita pendente de assinatura</Pendente>
                    )}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </CardContent>
    </Card>
  );
}
