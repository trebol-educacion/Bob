
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('bob-images', 'bob-images', true, 10485760, array['image/png','image/jpeg','image/webp'])
on conflict (id) do nothing;

create policy "bob_images_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'bob-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "bob_images_select"
  on storage.objects for select
  using (bucket_id = 'bob-images');

create policy "bob_images_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'bob-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
