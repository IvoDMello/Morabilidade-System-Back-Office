-- Integração ao Supabase principal: tudo deste arquivo vive no schema whatsapp (ver 0000_schema.sql).
set search_path to whatsapp, public;

-- Suporte a mídia recebida (foto/áudio/vídeo/documento/figurinha). Antes, o
-- webhook guardava qualquer não-texto como 'unsupported'; agora o tipo real é
-- persistido e os bytes ficam num bucket privado do Storage (ver services/
-- whatsapp.service.ts → resolveIncomingMedia e app/api/whatsapp/media).

-- Amplia o CHECK de message_type (o antigo permitia só 'text'/'unsupported').
-- O nome do constraint é o padrão do Postgres para CHECK inline de coluna.
alter table whatsapp_messages drop constraint if exists whatsapp_messages_message_type_check;
alter table whatsapp_messages add constraint whatsapp_messages_message_type_check
  check (message_type in ('text', 'image', 'audio', 'video', 'document', 'sticker', 'unsupported'));

-- Referência à mídia: caminho no bucket (cloud-api) ou URL absoluta (simulação).
alter table whatsapp_messages add column if not exists media_url text;
alter table whatsapp_messages add column if not exists media_mime_type text;
alter table whatsapp_messages add column if not exists media_filename text;

-- Bucket PRIVADO das mídias. Acesso só pelo servidor (service_role ignora RLS),
-- servido ao navegador pelo proxy autenticado /api/whatsapp/media. Sem políticas
-- de storage.objects: nada é público nem acessível pela anon key.
insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', false)
on conflict (id) do nothing;
