"use client";

import { useTransition } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  simulateMessageFormSchema,
  type SimulateMessageFormValues,
} from "@/lib/validations/simulate-message.schema";
import { simulateIncomingMessageAction } from "@/app/conversas/actions";

export function SimulateMessageForm() {
  const [isPending, startTransition] = useTransition();
  const form = useForm<SimulateMessageFormValues>({
    resolver: zodResolver(simulateMessageFormSchema),
    defaultValues: { phone: "", profileName: "", body: "" },
  });

  function handleSubmit(values: SimulateMessageFormValues) {
    startTransition(async () => {
      try {
        await simulateIncomingMessageAction(values);
        form.reset();
        toast.success("Mensagem simulada recebida.");
      } catch {
        toast.error("Não foi possível simular a mensagem.");
      }
    });
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            control={form.control}
            name="phone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone do remetente *</FormLabel>
                <FormControl>
                  <Input placeholder="(11) 98888-7777" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="profileName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome do perfil (opcional)</FormLabel>
                <FormControl>
                  <Input placeholder="Nome que aparece no WhatsApp" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="body"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Mensagem *</FormLabel>
              <FormControl>
                <Textarea rows={2} placeholder="Texto da mensagem recebida" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-center">
          <Button type="submit" loading={isPending} className="w-full sm:w-auto">
            {isPending ? "Enviando..." : "Simular mensagem recebida"}
          </Button>
        </div>
      </form>
    </Form>
  );
}
