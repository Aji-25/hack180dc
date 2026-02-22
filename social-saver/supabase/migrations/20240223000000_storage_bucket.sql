-- Add a public storage bucket for WhatsApp media (images, audio)
insert into storage.buckets (id, name, public)
values ('whatsapp-media', 'whatsapp-media', true) on conflict (id) do nothing;
-- Allow all authenticated/anon users to read (since URLs are unguessable UUIDs)
create policy "Public Access" on storage.objects for
select to public using (bucket_id = 'whatsapp-media');
-- Allow the edge function (service role) to insert
create policy "Service Role Insert" on storage.objects for
insert to service_role with check (bucket_id = 'whatsapp-media');