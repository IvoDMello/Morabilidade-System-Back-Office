-- =====================================================================
-- Bucket privado "captacoes" (fotos, thumbs e documentos)
-- Privado: tudo servido por signed URL. Vídeos não entram aqui (URL externa).
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'captacoes',
  'captacoes',
  false,                                   -- privado
  10485760,                                -- 10 MB por arquivo
  array[
    'image/webp','image/jpeg','image/png',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  ]
)
on conflict (id) do nothing;

-- Qualquer usuário autenticado pode ler/escrever objetos do bucket.
create policy "captacoes auth read" on storage.objects
  for select to authenticated using (bucket_id = 'captacoes');
create policy "captacoes auth insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'captacoes');
create policy "captacoes auth update" on storage.objects
  for update to authenticated using (bucket_id = 'captacoes');
create policy "captacoes auth delete" on storage.objects
  for delete to authenticated using (bucket_id = 'captacoes');
