-- =========================================================================
-- جدول مستندات وعمليات نظام أوراكل (OraNT / Onyx Pro ERP) لمنصة modernbuildingsa.com/whatsapp
-- يدعم كافة القوالب الـ 7 + شاشات التنبيهات وإشعارات العملاء (ALRTT002 / ARST045)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.oracle_invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    doc_type VARCHAR(50) NOT NULL DEFAULT 'cash_invoice', -- cash_invoice, credit_invoice, receipt_voucher, account_statement, price_quotation, purchase_order, customer_discount_notice, direct_alert
    customer_code VARCHAR(80),
    customer_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    invoice_date DATE NOT NULL DEFAULT CURRENT_DATE,
    amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    currency VARCHAR(20) DEFAULT 'ر.س',
    remaining_balance NUMERIC(15, 2),
    payment_method VARCHAR(100),
    attachment_url TEXT,
    onyx_form_code VARCHAR(50),
    details TEXT,
    status VARCHAR(30) DEFAULT 'pending', -- 'pending', 'sent', 'failed'
    whatsapp_message_id VARCHAR(255),
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- في حال تم إنشاء الجدول سابقاً، يتم إضافة الأعمدة الجديدة تلقائياً بأمان
ALTER TABLE public.oracle_invoices ADD COLUMN IF NOT EXISTS doc_type VARCHAR(50) NOT NULL DEFAULT 'cash_invoice';
ALTER TABLE public.oracle_invoices ADD COLUMN IF NOT EXISTS customer_code VARCHAR(80);
ALTER TABLE public.oracle_invoices ADD COLUMN IF NOT EXISTS remaining_balance NUMERIC(15, 2);
ALTER TABLE public.oracle_invoices ADD COLUMN IF NOT EXISTS payment_method VARCHAR(100);
ALTER TABLE public.oracle_invoices ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.oracle_invoices ADD COLUMN IF NOT EXISTS onyx_form_code VARCHAR(50);

-- فهارس لتحسين سرعة البحث
CREATE INDEX IF NOT EXISTS idx_oracle_invoices_num ON public.oracle_invoices(invoice_number);
CREATE INDEX IF NOT EXISTS idx_oracle_invoices_type ON public.oracle_invoices(doc_type);
CREATE INDEX IF NOT EXISTS idx_oracle_invoices_cust_code ON public.oracle_invoices(customer_code);
CREATE INDEX IF NOT EXISTS idx_oracle_invoices_phone ON public.oracle_invoices(phone);
CREATE INDEX IF NOT EXISTS idx_oracle_invoices_status ON public.oracle_invoices(status);
CREATE INDEX IF NOT EXISTS idx_oracle_invoices_created ON public.oracle_invoices(created_at DESC);

-- تفعيل سياسات الأمان على مستوى الصفوف (Row Level Security)
ALTER TABLE public.oracle_invoices ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE schemaname = 'public'
          AND tablename = 'oracle_invoices'
          AND policyname = 'Allow public read and write for oracle_invoices'
    ) THEN
        CREATE POLICY "Allow public read and write for oracle_invoices"
            ON public.oracle_invoices
            FOR ALL
            USING (true)
            WITH CHECK (true);
    END IF;
END $$;

COMMENT ON TABLE public.oracle_invoices IS 'مستندات وفواتير وإشعارات نظام أونكس برو المستوردة لإرسال إشعارات الواتساب الرسمية';
