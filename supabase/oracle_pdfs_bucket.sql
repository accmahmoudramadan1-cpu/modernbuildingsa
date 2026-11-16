-- =========================================================================
-- إنشاء Bucket عام في Supabase Storage لاستضافة ملفات PDF الأصلية من أونكس برو
-- ملاحظة: التخزين هنا يستخدم مساحة Storage المجانية (1 GB) ولا يستهلك من حد قاعدة البيانات (500 MB)
-- =========================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('oracle-pdfs', 'oracle-pdfs', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Allow public read for oracle-pdfs'
    ) THEN
        CREATE POLICY "Allow public read for oracle-pdfs"
            ON storage.objects
            FOR SELECT
            USING (bucket_id = 'oracle-pdfs');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Allow insert and update for oracle-pdfs'
    ) THEN
        CREATE POLICY "Allow insert and update for oracle-pdfs"
            ON storage.objects
            FOR INSERT
            WITH CHECK (bucket_id = 'oracle-pdfs');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Allow update for oracle-pdfs'
    ) THEN
        CREATE POLICY "Allow update for oracle-pdfs"
            ON storage.objects
            FOR UPDATE
            USING (bucket_id = 'oracle-pdfs')
            WITH CHECK (bucket_id = 'oracle-pdfs');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'storage'
          AND tablename = 'objects'
          AND policyname = 'Allow delete for oracle-pdfs'
    ) THEN
        CREATE POLICY "Allow delete for oracle-pdfs"
            ON storage.objects
            FOR DELETE
            USING (bucket_id = 'oracle-pdfs');
    END IF;
END $$;
