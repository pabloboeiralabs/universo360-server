
INSERT INTO storage.buckets (id, name, public) VALUES ('email-assets', 'email-assets', true);
CREATE POLICY "Public read email-assets" ON storage.objects FOR SELECT USING (bucket_id = 'email-assets');
