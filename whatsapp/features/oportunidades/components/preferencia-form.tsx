"use client";

import { useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  TIPOS_IMOVEL_PREFERENCIA,
  TIPO_IMOVEL_LABELS,
  TIPOS_NEGOCIO,
  TIPO_NEGOCIO_LABELS,
} from "@/constants/oportunidades";
import { salvarPreferenciaAction } from "@/app/oportunidades/actions";
import type { ID } from "@/types/common";
import type { PreferenciaBusca } from "@/types/oportunidade";

const QUALQUER = "qualquer";

interface PreferenciaFormProps {
  contactId: ID;
  preferencia: PreferenciaBusca | null;
  onSalvo: () => void;
  onCancelar: () => void;
}

/**
 * O que o cliente procura, editável ao lado da conversa.
 *
 * É a peça que decide se a aba tem conteúdo: o perfil de busca só existia no
 * formulário do back-office, e quem descobre o que a pessoa quer é quem está
 * conversando com ela. Sem isso a lista de oportunidades nasce vazia — que é
 * exatamente o que acontecia no painel web.
 *
 * Nenhum campo é obrigatório de propósito: meio perfil já filtra o catálogo, e
 * exigir preenchimento completo faria alguém inventar número só para salvar.
 */
export function PreferenciaForm({
  contactId,
  preferencia,
  onSalvo,
  onCancelar,
}: PreferenciaFormProps) {
  const [isSalvando, startSalvar] = useTransition();
  const [tipoNegocio, setTipoNegocio] = useState(preferencia?.tipoNegocio ?? QUALQUER);
  const [tipoImovel, setTipoImovel] = useState(preferencia?.tipoImovel ?? QUALQUER);
  const [cidade, setCidade] = useState(preferencia?.cidade ?? "");
  const [bairros, setBairros] = useState((preferencia?.bairros ?? []).join(", "));
  const [valorMin, setValorMin] = useState(preferencia?.valorMin?.toString() ?? "");
  const [valorMax, setValorMax] = useState(preferencia?.valorMax?.toString() ?? "");
  const [dormitorios, setDormitorios] = useState(preferencia?.dormitoriosMin?.toString() ?? "");
  const [vagas, setVagas] = useState(preferencia?.vagasGaragemMin?.toString() ?? "");
  const [observacoes, setObservacoes] = useState(preferencia?.observacoes ?? "");

  function salvar() {
    startSalvar(async () => {
      const resultado = await salvarPreferenciaAction(contactId, {
        tipoNegocio: tipoNegocio === QUALQUER ? null : tipoNegocio,
        tipoImovel: tipoImovel === QUALQUER ? null : tipoImovel,
        cidade,
        bairros,
        valorMin,
        valorMax,
        dormitoriosMin: dormitorios,
        vagasGaragemMin: vagas,
        observacoes,
      });

      if (!resultado.ok) {
        toast.error(resultado.erro ?? "Não foi possível salvar.");
        return;
      }
      toast.success(resultado.aviso ?? "Perfil de busca salvo.");
      onSalvo();
    });
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-veil/8 bg-well/40 p-3">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`negocio-${contactId}`}>Negócio</Label>
          <Select value={tipoNegocio} onValueChange={(v) => setTipoNegocio(v ?? QUALQUER)}>
            <SelectTrigger id={`negocio-${contactId}`} className="w-full">
              <SelectValue placeholder="Tanto faz">
                {(v: string) => (v === QUALQUER ? "Tanto faz" : TIPO_NEGOCIO_LABELS[v] ?? v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={QUALQUER}>Tanto faz</SelectItem>
              {TIPOS_NEGOCIO.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`tipo-${contactId}`}>Tipo de imóvel</Label>
          <Select value={tipoImovel} onValueChange={(v) => setTipoImovel(v ?? QUALQUER)}>
            <SelectTrigger id={`tipo-${contactId}`} className="w-full">
              <SelectValue placeholder="Tanto faz">
                {(v: string) => (v === QUALQUER ? "Tanto faz" : TIPO_IMOVEL_LABELS[v] ?? v)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={QUALQUER}>Tanto faz</SelectItem>
              {TIPOS_IMOVEL_PREFERENCIA.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`cidade-${contactId}`}>Cidade</Label>
          <Input
            id={`cidade-${contactId}`}
            value={cidade}
            onChange={(e) => setCidade(e.target.value)}
            placeholder="Rio de Janeiro"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`bairros-${contactId}`}>Bairros</Label>
          <Input
            id={`bairros-${contactId}`}
            value={bairros}
            onChange={(e) => setBairros(e.target.value)}
            placeholder="Ipanema, Leblon"
          />
          <p className="text-[11.5px] text-ink-dim">Separe por vírgula. Basta um bater.</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`valor-min-${contactId}`}>Valor mínimo (R$)</Label>
          <Input
            id={`valor-min-${contactId}`}
            inputMode="numeric"
            value={valorMin}
            onChange={(e) => setValorMin(e.target.value)}
            placeholder="Sem mínimo"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`valor-max-${contactId}`}>Valor máximo (R$)</Label>
          <Input
            id={`valor-max-${contactId}`}
            inputMode="numeric"
            value={valorMax}
            onChange={(e) => setValorMax(e.target.value)}
            placeholder="Sem teto"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`dorm-${contactId}`}>Dormitórios (mínimo)</Label>
          <Input
            id={`dorm-${contactId}`}
            inputMode="numeric"
            value={dormitorios}
            onChange={(e) => setDormitorios(e.target.value)}
            placeholder="Tanto faz"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor={`vagas-${contactId}`}>Vagas (mínimo)</Label>
          <Input
            id={`vagas-${contactId}`}
            inputMode="numeric"
            value={vagas}
            onChange={(e) => setVagas(e.target.value)}
            placeholder="Tanto faz"
          />
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <Label htmlFor={`obs-${contactId}`}>Observações</Label>
        <Textarea
          id={`obs-${contactId}`}
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="O que não cabe nos campos: andar alto, aceita reforma, prazo…"
          rows={2}
        />
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancelar} disabled={isSalvando}>
          Cancelar
        </Button>
        <Button type="button" size="sm" onClick={salvar} disabled={isSalvando}>
          {isSalvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          Salvar perfil
        </Button>
      </div>
    </div>
  );
}
