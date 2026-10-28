-- =========================================================================
-- جدول فواتير نظام أوراكل (OraNT / OnyxPro) لمنصة modernbuildingsa.com/whatsapp
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.oracle_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(20) DEFAULT 'ر.س',
    details TEXT,
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    whatsapp_message_id VARCHAR(255),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- فهارس لتحسين سرعة البحث
CREATE INDEX IF NOT EXISTS idx_oracle_invoices_num ON public.oracle_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_oracle_invoices_phone ON public.oracle_invoices(phone);
CREATE INDEX IF NOT EXISTS idx_oracle_invoices_status ON public.oracle_invoices(status);
CREATE INDEX IF NOT EXISTS idx_oracle_invoices_created ON public.oracle_invoices(created_at DESC);

-- تفعيل سياسات الأمان على مستوى الصفوف (Row Level Security)
ALTER TABLE public.oracle_invoices ENABLE ROW LEVEL SECURITY;

-- سياسة السماح بالقراءة والكتابة
CREATE POLICY "Allow public read and write for oracle_invoices"
    ON public.oracle_invoices
    FOR ALL
    USING (true)
    WITH CHECK (true);

COMMENT ON TABLE public.oracle_invoices IS 'فواتير نظام أوراكل المستوردة لإرسال إشعارات الواتساب الرسمية';
