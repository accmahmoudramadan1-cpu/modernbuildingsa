#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 سكربت مزامنة عمليات نظام أونكس برو (Onyx Pro ERP / OraNT) مع منصة البناء الحديث
 Modern Building - Onyx Pro / OraNT Multi-Template Synchronizer
=============================================================================
يدعم استيراد القوالب والعمليات التالية:
1. الفواتير النقدية (cash_invoice)
2. الفواتير الآجلة (credit_invoice) مع الرصيد المتبقي
3. سندات القبض (receipt_voucher) مع طريقة الدفع والرصيد المتبقي
4. كشوف حساب العملاء (account_statement) - شاشة ALRTT002
5. عروض الأسعار (price_quotation)
6. طلبات الشراء للموردين (purchase_order)
7. إشعارات خصم العملاء (customer_discount_notice) - شاشة ARST045
8. التنبيهات والرسائل المباشرة (direct_alert) - شاشة ALRTT002

الأوامر المتاحة:
  python sync_orant_invoices.py --discover   (اكتشاف أسماء الجداول في أونكس)
  python sync_orant_invoices.py --mock       (توليد وإرسال عينات لجميع القوالب الـ 8)
  python sync_orant_invoices.py --loop 60    (تشغيل مستمر كل 60 ثانية)
=============================================================================
"""

import sys
import os
import time
import glob
import sqlite3
import argparse
import re
from datetime import datetime

# ضمان عدم حدوث UnicodeEncodeError عند توجيه المخرجات في Windows CMD أو ملفات السجل
for _stream_name in ("stdout", "stderr"):
    _stream = getattr(sys, _stream_name, None)
    if _stream is not None and hasattr(_stream, "reconfigure"):
        try:
            _stream.reconfigure(encoding="utf-8", errors="replace")
        except Exception:
            pass

try:
    import requests
except ImportError:
    print("[تحذير] مكتبة requests غير مثبتة. يرجى تثبيتها بالأمر: pip install requests")
    sys.exit(1)

# =============================================================================
# الإعدادات الافتراضية (جاهزة للعمل على جهاز العميل - يمكن تجاوزها بمتغيرات البيئة)
# =============================================================================
API_ENDPOINT = os.getenv("MODERN_BUILDING_API_URL", "https://www.modernbuildingsa.com/api/oracle-orders")
API_KEY = os.getenv("ORACLE_SYNC_API_KEY", "modern_building_orant_sync_secret_2026")

# إعدادات اتصال أوراكل (مطابقة لملف tnsnames.ora في OraNT وبيانات العميل)
ORACLE_HOST = os.getenv("ORACLE_HOST", "onyxserver")
ORACLE_PORT = int(os.getenv("ORACLE_PORT", "1521"))
ORACLE_SID = os.getenv("ORACLE_SID", "orcl")
ORACLE_USER = os.getenv("ORACLE_USER", "ONYX_READONLY")
ORACLE_PASS = os.getenv("ORACLE_PASS", "ModernSync_2026")
ORACLE_SCHEMA = os.getenv("ORACLE_SCHEMA", "IAS20261")  # سكيما السنة المالية النشطة (2026 / وحدة 1)
SYNC_DAYS_BACK = int(os.getenv("SYNC_DAYS_BACK", "14"))  # عدد أيام البحث للخلف في قاعدة البيانات

TRACKER_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "invoices_tracker.db")

_THICK_MODE_INITIALIZED = False
_RESOLVED_CREDENTIAL = None
_RESOLVED_SCHEMA = None


# =============================================================================
# استعلامات SQL لكل شاشة ونوع مستند في Onyx Pro ERP
# مبنية على أسماء الجداول والأعمدة الفعلية المستخرجة من ملفات النظام (RDF/OraNT)
# مع استعلامات بديلة (Fallback) تدعم اختلاف إصدارات أونكس برو تلقائياً.
# =============================================================================
ONYX_QUERIES = {
    # 1 & 2. الفواتير النقدية والآجلة (IAS_BILL_MST + IAS_BILL_DTL + CUSTOMER + IAS_CASH_CUSTMR + EX_RATE)
    "sales_invoices": {
        "enabled": True,
        "sql_candidates": [
            f"""
            SELECT
                TO_CHAR(M.BILL_NO) AS DOC_NO,
                CASE WHEN NVL(M.BILL_DOC_TYPE, 1) = 1 THEN 'cash_invoice' ELSE 'credit_invoice' END AS DOC_TYPE,
                TO_CHAR(NVL(M.C_CODE, M.C_CODE_CSH)) AS CUST_CODE,
                COALESCE(C.C_A_NAME, M.C_NAME, TRIM(CC.CUST_F_NM || ' ' || CC.CUST_L_NM), 'عميل') AS CUST_NAME,
                COALESCE(C.C_MOBILE, C.C_PHONE, CC.MOBILE_NO, CC.TEL_NO, M.C_TEL) AS PHONE,
                TO_CHAR(M.BILL_DATE, 'YYYY-MM-DD') AS DOC_DATE,
                ROUND(
                    NVL((
                        SELECT SUM(
                            (NVL(D.I_QTY, 0) * (NVL(D.I_PRICE, 0) - NVL(D.DIS_AMT, 0)))
                            + (NVL(D.I_QTY, 0) * NVL(D.VAT_AMT, 0))
                        )
                        FROM IAS_BILL_DTL D
                        WHERE D.BILL_SER = M.BILL_SER
                    ), 0) - NVL(M.DISC_AMT, 0) + NVL(M.OTHR_AMT, 0),
                    2
                ) AS AMOUNT,
                DECODE(UPPER(TRIM(TO_CHAR(M.BILL_CURRENCY))), 'SAR', 'ر.س', NVL(E.CUR_NAME, NVL(TO_CHAR(M.BILL_CURRENCY), 'ر.س'))) AS CURRENCY,
                NULL AS REMAINING_BALANCE,
                CASE WHEN NVL(M.BILL_DOC_TYPE, 1) = 1 THEN 'نقداً' ELSE 'آجل' END AS PAYMENT_METHOD,
                'SI' AS FORM_CODE,
                M.A_DESC AS DETAILS
            FROM IAS_BILL_MST M
            LEFT JOIN CUSTOMER C ON C.C_CODE = M.C_CODE
            LEFT JOIN IAS_CASH_CUSTMR CC ON CC.CUST_CODE = M.C_CODE_CSH
            LEFT JOIN EX_RATE E ON TO_CHAR(E.CUR_CODE) = TO_CHAR(M.BILL_CURRENCY)
            WHERE M.BILL_DATE >= TRUNC(SYSDATE) - {SYNC_DAYS_BACK}
            ORDER BY M.BILL_DATE DESC, M.BILL_NO DESC
            """,
            f"""
            SELECT
                TO_CHAR(M.BILL_NO) AS DOC_NO,
                CASE WHEN NVL(M.BILL_DOC_TYPE, 1) = 1 THEN 'cash_invoice' ELSE 'credit_invoice' END AS DOC_TYPE,
                TO_CHAR(M.C_CODE) AS CUST_CODE,
                NVL(C.C_A_NAME, M.C_NAME) AS CUST_NAME,
                COALESCE(C.C_MOBILE, C.C_PHONE, M.C_TEL) AS PHONE,
                TO_CHAR(M.BILL_DATE, 'YYYY-MM-DD') AS DOC_DATE,
                ROUND(
                    NVL((
                        SELECT SUM(
                            (NVL(D.I_QTY, 0) * (NVL(D.I_PRICE, 0) - NVL(D.DIS_AMT, 0)))
                            + (NVL(D.I_QTY, 0) * NVL(D.VAT_AMT, 0))
                        )
                        FROM IAS_BILL_DTL D
                        WHERE D.BILL_SER = M.BILL_SER
                    ), 0) - NVL(M.DISC_AMT, 0) + NVL(M.OTHR_AMT, 0),
                    2
                ) AS AMOUNT,
                DECODE(UPPER(TRIM(TO_CHAR(M.BILL_CURRENCY))), 'SAR', 'ر.س', NVL(E.CUR_NAME, NVL(TO_CHAR(M.BILL_CURRENCY), 'ر.س'))) AS CURRENCY,
                NULL AS REMAINING_BALANCE,
                CASE WHEN NVL(M.BILL_DOC_TYPE, 1) = 1 THEN 'نقداً' ELSE 'آجل' END AS PAYMENT_METHOD,
                'SI' AS FORM_CODE,
                M.A_DESC AS DETAILS
            FROM IAS_BILL_MST M
            LEFT JOIN CUSTOMER C ON C.C_CODE = M.C_CODE
            LEFT JOIN EX_RATE E ON TO_CHAR(E.CUR_CODE) = TO_CHAR(M.BILL_CURRENCY)
            WHERE M.BILL_DATE >= TRUNC(SYSDATE) - {SYNC_DAYS_BACK}
            ORDER BY M.BILL_DATE DESC, M.BILL_NO DESC
            """,
        ],
    },
    # 3. سندات القبض (VOUCHERS + VOUCHER_DETAIL + CUSTOMER + EX_RATE)
    "receipt_vouchers": {
        "enabled": True,
        "sql_candidates": [
            f"""
            SELECT
                'RV-' || TO_CHAR(V.VOUCHER_NO) || '-' || TO_CHAR(C.C_CODE) AS DOC_NO,
                'receipt_voucher' AS DOC_TYPE,
                TO_CHAR(C.C_CODE) AS CUST_CODE,
                COALESCE(C.C_A_NAME, V.REC_NAME, V.REF_NAME, 'عميل') AS CUST_NAME,
                NVL(C.C_MOBILE, C.C_PHONE) AS PHONE,
                TO_CHAR(V.VOUCHER_DATE, 'YYYY-MM-DD') AS DOC_DATE,
                ROUND(NVL(SUM(NVL(VD.AC_AMT, 0)), NVL(MAX(V.CASH_AMT), 0)), 2) AS AMOUNT,
                DECODE(UPPER(TRIM(TO_CHAR(V.A_CY))), 'SAR', 'ر.س', NVL(E.CUR_NAME, NVL(TO_CHAR(V.A_CY), 'ر.س'))) AS CURRENCY,
                NULL AS REMAINING_BALANCE,
                CASE NVL(V.VOUCHER_PAY_TYPE, 1)
                    WHEN 1 THEN 'نقداً'
                    WHEN 2 THEN 'شيك'
                    WHEN 3 THEN 'تحويل بنكي'
                    ELSE 'نقداً / تحويل بنكي'
                END AS PAYMENT_METHOD,
                'RV' AS FORM_CODE,
                NVL(MAX(VD.AC_DESC), V.A_DESC) AS DETAILS
            FROM VOUCHERS V
            JOIN VOUCHER_DETAIL VD ON VD.V_SER = V.V_SER AND VD.VOUCHER_TYPE = V.VOUCHER_TYPE
            JOIN CUSTOMER C ON C.C_CODE = COALESCE(VD.C_CODE, VD.AC_CODE_DTL)
            LEFT JOIN EX_RATE E ON TO_CHAR(E.CUR_CODE) = TO_CHAR(V.A_CY)
            WHERE V.VOUCHER_TYPE = 1
              AND V.VOUCHER_DATE >= TRUNC(SYSDATE) - {SYNC_DAYS_BACK}
            GROUP BY
                V.VOUCHER_NO, C.C_CODE, C.C_A_NAME, C.C_MOBILE, C.C_PHONE,
                V.REC_NAME, V.REF_NAME, V.VOUCHER_DATE, V.VOUCHER_PAY_TYPE,
                V.A_CY, E.CUR_NAME, V.A_DESC
            ORDER BY V.VOUCHER_DATE DESC, V.VOUCHER_NO DESC
            """,
        ],
    },
    # 4 & 8. شاشة الرسائل المباشرة وكشوف المطابقة ALRTT002 (IAS_MSG_SMS + IAS_MSG_SMS_DTL)
    "direct_alerts_alrtt002": {
        "enabled": True,
        "sql_candidates": [
            f"""
            SELECT
                'ALRT-' || TO_CHAR(H.MSG_NO) || '-' || TO_CHAR(NVL(D.RCVR_CODE, TO_CHAR(D.RCRD_NO))) AS DOC_NO,
                CASE WHEN D.ATTCH_EMAIL_FILE IS NOT NULL THEN 'account_statement' ELSE 'direct_alert' END AS DOC_TYPE,
                TO_CHAR(D.RCVR_CODE) AS CUST_CODE,
                COALESCE(D.RCVR_NM, C.C_A_NAME, 'عميل') AS CUST_NAME,
                COALESCE(D.MOBILE_NO, H.MOBILE_NO, C.C_MOBILE, C.C_PHONE) AS PHONE,
                TO_CHAR(NVL(H.AD_DATE, SYSDATE), 'YYYY-MM-DD') AS DOC_DATE,
                TO_CHAR(D.BLNC_MSG) AS AMOUNT,
                'ر.س' AS CURRENCY,
                TO_CHAR(D.BLNC_MSG) AS REMAINING_BALANCE,
                NULL AS PAYMENT_METHOD,
                'ALRTT002' AS FORM_CODE,
                H.MSG_TXT AS DETAILS
            FROM IAS_MSG_SMS H
            JOIN IAS_MSG_SMS_DTL D ON D.MSG_NO = H.MSG_NO
            LEFT JOIN CUSTOMER C ON C.C_CODE = D.RCVR_CODE
            WHERE NVL(H.AD_DATE, SYSDATE) >= TRUNC(SYSDATE) - {SYNC_DAYS_BACK}
            ORDER BY H.MSG_NO DESC, D.RCRD_NO ASC
            """,
        ],
    },
    # 5. عروض الأسعار (QUOTATION + QUOTATION_DETAIL + CUSTOMER + IAS_CASH_CUSTMR)
    "price_quotations": {
        "enabled": True,
        "sql_candidates": [
            f"""
            SELECT
                'QT-' || TO_CHAR(Q.QUOT_NO) AS DOC_NO,
                'price_quotation' AS DOC_TYPE,
                TO_CHAR(NVL(Q.C_CODE, Q.C_CODE_CSH)) AS CUST_CODE,
                COALESCE(C.C_A_NAME, Q.C_NAME, TRIM(CC.CUST_F_NM || ' ' || CC.CUST_L_NM), 'عميل') AS CUST_NAME,
                COALESCE(Q.MOBILE_NO, C.C_MOBILE, C.C_PHONE, CC.MOBILE_NO, CC.TEL_NO) AS PHONE,
                TO_CHAR(Q.QUOT_DATE, 'YYYY-MM-DD') AS DOC_DATE,
                ROUND(
                    NVL(
                        NULLIF(Q.QUOT_AMT, 0),
                        NVL((
                            SELECT SUM(
                                (NVL(QD.I_QTY, 0) * (NVL(QD.I_PRICE, 0) - NVL(QD.DIS_AMT, 0)))
                                + (NVL(QD.I_QTY, 0) * NVL(QD.VAT_AMT, 0))
                            )
                            FROM QUOTATION_DETAIL QD
                            WHERE QD.QUOT_SER = Q.QUOT_SER
                        ), 0) - NVL(Q.DISC_AMT, 0) + NVL(Q.VAT_AMT, 0) + NVL(Q.OTHR_AMT, 0)
                    ),
                    2
                ) AS AMOUNT,
                DECODE(UPPER(TRIM(TO_CHAR(Q.QUOT_CUR))), 'SAR', 'ر.س', NVL(E.CUR_NAME, NVL(TO_CHAR(Q.QUOT_CUR), 'ر.س'))) AS CURRENCY,
                NULL AS REMAINING_BALANCE,
                NULL AS PAYMENT_METHOD,
                'QT' AS FORM_CODE,
                Q.A_DESC AS DETAILS
            FROM QUOTATION Q
            LEFT JOIN CUSTOMER C ON C.C_CODE = Q.C_CODE
            LEFT JOIN IAS_CASH_CUSTMR CC ON CC.CUST_CODE = Q.C_CODE_CSH
            LEFT JOIN EX_RATE E ON TO_CHAR(E.CUR_CODE) = TO_CHAR(Q.QUOT_CUR)
            WHERE Q.QUOT_DATE >= TRUNC(SYSDATE) - {SYNC_DAYS_BACK}
            ORDER BY Q.QUOT_DATE DESC, Q.QUOT_NO DESC
            """,
        ],
    },
    # 6. طلبات الشراء للموردين (P_ORDER + P_ORDER_DETAIL + V_DETAILS + EX_RATE)
    "purchase_orders": {
        "enabled": True,
        "sql_candidates": [
            f"""
            SELECT
                'PO-' || TO_CHAR(P.PO_NO) AS DOC_NO,
                'purchase_order' AS DOC_TYPE,
                TO_CHAR(P.V_CODE) AS CUST_CODE,
                NVL(V.V_A_NAME, P.V_NAME) AS CUST_NAME,
                NVL(V.V_MOBILE, V.V_PHONE) AS PHONE,
                TO_CHAR(P.PO_DATE, 'YYYY-MM-DD') AS DOC_DATE,
                ROUND(
                    NVL(
                        NULLIF(P.PO_AMT, 0),
                        NVL((
                            SELECT SUM(
                                (NVL(PD.I_QTY, 0) * (NVL(PD.I_PRICE, 0) - NVL(PD.DIS_AMT, 0)))
                                + (NVL(PD.I_QTY, 0) * NVL(PD.VAT_AMT, 0))
                            )
                            FROM P_ORDER_DETAIL PD
                            WHERE PD.PO_SER = P.PO_SER
                        ), 0) - NVL(P.DISC_AMT, 0) + NVL(P.VAT_AMT, 0) + NVL(P.OTHR_AMT, 0)
                    ),
                    2
                ) AS AMOUNT,
                DECODE(UPPER(TRIM(TO_CHAR(P.CUR_CODE))), 'SAR', 'ر.س', NVL(E.CUR_NAME, NVL(TO_CHAR(P.CUR_CODE), 'ر.س'))) AS CURRENCY,
                NULL AS REMAINING_BALANCE,
                NULL AS PAYMENT_METHOD,
                'PO' AS FORM_CODE,
                P.PO_DESC AS DETAILS
            FROM P_ORDER P
            LEFT JOIN V_DETAILS V ON V.V_CODE = P.V_CODE
            LEFT JOIN EX_RATE E ON TO_CHAR(E.CUR_CODE) = TO_CHAR(P.CUR_CODE)
            WHERE P.PO_DATE >= TRUNC(SYSDATE) - {SYNC_DAYS_BACK}
            ORDER BY P.PO_DATE DESC, P.PO_NO DESC
            """,
        ],
    },
    # 7. إشعارات خصم العملاء المتعدد شاشة ARST045 (IAS_BILL_MST_ADD_DISC + IAS_BILL_ADD_DISC_BILLS)
    "customer_discount_notices_arst045": {
        "enabled": True,
        "sql_candidates": [
            f"""
            SELECT
                'ARST-' || TO_CHAR(N.DOC_NO) || '-' || TO_CHAR(COALESCE(N.C_CODE, B.C_CODE, N.C_CODE_CSH, '0')) AS DOC_NO,
                'customer_discount_notice' AS DOC_TYPE,
                TO_CHAR(COALESCE(N.C_CODE, B.C_CODE, N.C_CODE_CSH)) AS CUST_CODE,
                COALESCE(C.C_A_NAME, TRIM(CC.CUST_F_NM || ' ' || CC.CUST_L_NM), 'عميل') AS CUST_NAME,
                COALESCE(C.C_MOBILE, C.C_PHONE, CC.MOBILE_NO, CC.TEL_NO) AS PHONE,
                TO_CHAR(N.DOC_DATE, 'YYYY-MM-DD') AS DOC_DATE,
                CASE
                    WHEN N.C_CODE IS NOT NULL OR N.C_CODE_CSH IS NOT NULL
                        THEN ROUND(NVL(N.ADD_DISCOUNT, 0) + NVL(N.ADD_VAT_AMT, 0), 2)
                    ELSE ROUND(SUM(NVL(B.ADD_DISCOUNT, 0) + NVL(B.ADD_VAT_AMT, 0)), 2)
                END AS AMOUNT,
                DECODE(UPPER(TRIM(TO_CHAR(N.A_CY))), 'SAR', 'ر.س', NVL(E.CUR_NAME, NVL(TO_CHAR(N.A_CY), 'ر.س'))) AS CURRENCY,
                NULL AS REMAINING_BALANCE,
                NVL(N.DOC_DESC, 'خصم سداد') AS PAYMENT_METHOD,
                'ARST045' AS FORM_CODE,
                N.DOC_DESC AS DETAILS
            FROM IAS_BILL_MST_ADD_DISC N
            LEFT JOIN IAS_BILL_ADD_DISC_BILLS B ON B.DOC_SER = N.DOC_SER
            LEFT JOIN CUSTOMER C ON C.C_CODE = COALESCE(N.C_CODE, B.C_CODE)
            LEFT JOIN IAS_CASH_CUSTMR CC ON CC.CUST_CODE = N.C_CODE_CSH
            LEFT JOIN EX_RATE E ON TO_CHAR(E.CUR_CODE) = TO_CHAR(N.A_CY)
            WHERE N.DOC_DATE >= TRUNC(SYSDATE) - {SYNC_DAYS_BACK}
            GROUP BY
                N.DOC_NO, N.DOC_DATE, N.A_CY, E.CUR_NAME, N.C_CODE, B.C_CODE, N.C_CODE_CSH,
                C.C_A_NAME, C.C_MOBILE, C.C_PHONE, CC.CUST_F_NM, CC.CUST_L_NM,
                CC.MOBILE_NO, CC.TEL_NO, N.ADD_DISCOUNT, N.ADD_VAT_AMT, N.DOC_DESC
            ORDER BY N.DOC_DATE DESC, N.DOC_NO DESC
            """,
        ],
    },
}


def init_tracker_db():
    """تهيئة قاعدة بيانات SQLite محلية لتتبع المستندات المرسلة ومنع التكرار"""
    conn = sqlite3.connect(TRACKER_DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sent_invoices (
            invoice_number TEXT PRIMARY KEY,
            doc_type TEXT DEFAULT 'cash_invoice',
            customer_name TEXT,
            phone TEXT,
            amount REAL,
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    # إضافة عمود doc_type بأمان إذا كانت القاعدة منشأة سابقاً
    try:
        cur.execute("ALTER TABLE sent_invoices ADD COLUMN doc_type TEXT DEFAULT 'cash_invoice'")
    except sqlite3.OperationalError:
        pass
    conn.commit()
    conn.close()


def is_invoice_synced(invoice_number: str) -> bool:
    """التحقق مما إذا كان المستند قد تم رفعه للموقع سابقاً"""
    conn = sqlite3.connect(TRACKER_DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM sent_invoices WHERE invoice_number = ?", (str(invoice_number).strip(),))
    row = cur.fetchone()
    conn.close()
    return row is not None


def mark_invoice_as_synced(invoice_number: str, doc_type: str, customer_name: str, phone: str, amount: float):
    """تسجيل المستند كمزامن بنجاح"""
    conn = sqlite3.connect(TRACKER_DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO sent_invoices (invoice_number, doc_type, customer_name, phone, amount)
        VALUES (?, ?, ?, ?, ?)
    """, (str(invoice_number).strip(), str(doc_type), customer_name, phone, float(amount or 0)))
    conn.commit()
    conn.close()


def clean_phone_number(raw_phone: str) -> str:
    """تنظيف وتوحيد رقم الجوال بالصيغة الدولية المناسبة للواتساب"""
    if not raw_phone:
        return ""
    digits = re.sub(r"\D", "", str(raw_phone))
    if digits.startswith("00"):
        digits = digits[2:]
    if digits.startswith("05") and len(digits) == 10:
        digits = "966" + digits[1:]
    elif digits.startswith("5") and len(digits) == 9:
        digits = "966" + digits
    elif digits.startswith("01") and len(digits) == 11:
        digits = "20" + digits[1:]
    return digits


def _init_thick_mode(oracledb, silent_if_missing: bool = False) -> bool:
    """تفعيل Thick Mode في مكتبة oracledb عند الاتصال بقواعد بيانات Oracle 11g أو كلمة مرور قديمة (DPY-3010 / DPY-3015)"""
    global _THICK_MODE_INITIALIZED
    if _THICK_MODE_INITIALIZED:
        return True
    if not hasattr(oracledb, "init_oracle_client"):
        return False

    script_dir = os.path.dirname(os.path.abspath(__file__))
    candidates = []
    if os.getenv("ORACLE_CLIENT_LIB_DIR"):
        candidates.append(os.getenv("ORACLE_CLIENT_LIB_DIR"))

    for pattern in (
        r"C:\oracle\instantclient*\instantclient*",
        r"C:\oracle\instantclient*",
        r"C:\oracle",
        r"D:\oracle\instantclient*",
        r"C:\instantclient*",
        os.path.join(script_dir, "instantclient*"),
        r"C:\app\*\product\*\client*\bin",
    ):
        candidates.extend(sorted(glob.glob(pattern), reverse=True))

    candidates.extend([r"C:\OraNT\BIN", r"D:\OraNT\BIN", None])

    saw_oci_dll = False
    last_load_error = None

    for lib_dir in candidates:
        if lib_dir is not None:
            if not os.path.isdir(lib_dir):
                continue
            if not os.path.isfile(os.path.join(lib_dir, "oci.dll")):
                continue
            saw_oci_dll = True
        elif silent_if_missing:
            continue

        try:
            if lib_dir:
                oracledb.init_oracle_client(lib_dir=lib_dir)
                print(f"[✓] تم تفعيل وضع الاتصال المتوافق (Thick Mode) من: {lib_dir}")
            else:
                oracledb.init_oracle_client()
                print("[✓] تم تفعيل وضع الاتصال المتوافق (Thick Mode) من مسار النظام (PATH).")
            _THICK_MODE_INITIALIZED = True
            return True
        except Exception as init_err:
            err_msg = str(init_err)
            if "already been initialized" in err_msg.lower() or "already initialized" in err_msg.lower():
                _THICK_MODE_INITIALIZED = True
                return True
            last_load_error = f"{lib_dir}: {err_msg}"
            continue

    if not silent_if_missing:
        if saw_oci_dll and last_load_error:
            print(f"\n[خطأ هام] تم العثور على oci.dll لكن تعذر تحميله (غالباً لنقص Visual C++ x64): {last_load_error}")
            print("  الحل: ثبّت حزمة Visual C++ Redistributable x64 من الرابط: https://aka.ms/vs/17/release/vc_redist.x64.exe\n")
        else:
            print("\n[خطأ هام] خادم أوراكل يتطلب Oracle Instant Client 64-bit لتشغيل Thick Mode (DPY-3010 / DPY-3015)!")
            print("  الحل: حمّل حزمة Basic x64 وفك ضغطها في: C:\\oracle\\instantclient_19_26\n")
    return False


def _detect_and_set_schema(conn, connected_user: str):
    """اكتشاف السكيما المالكة لجداول أونكس (IAS20261 / IAS20251) وضبط CURRENT_SCHEMA تلقائياً"""
    global _RESOLVED_SCHEMA
    target_schema = (ORACLE_SCHEMA or _RESOLVED_SCHEMA or "").strip()

    try:
        cur = conn.cursor()
        if not target_schema:
            cur.execute("""
                SELECT OWNER
                FROM ALL_TABLES
                WHERE TABLE_NAME IN ('IAS_BILL_MST', 'CUSTOMER')
                  AND OWNER NOT IN ('SYS', 'SYSTEM', 'OUTLN', 'DBSNMP')
                ORDER BY DECODE(OWNER, USER, 0, 'IAS20261', 1, 'IAS20251', 2, 3), OWNER DESC
            """)
            row = cur.fetchone()
            if row and row[0]:
                target_schema = str(row[0]).strip()
                _RESOLVED_SCHEMA = target_schema

        if target_schema and re.match(r"^[A-Za-z0-9_$#]+$", target_schema):
            clean_connected = connected_user.strip('"').upper()
            if target_schema.upper() != clean_connected:
                cur.execute(f"ALTER SESSION SET CURRENT_SCHEMA = {target_schema}")
                print(f"[✓] تم ضبط السكيما النشطة تلقائياً إلى: {target_schema}")
        cur.close()
    except Exception as schema_err:
        print(f"[!] تنبيه أثناء تحديد السكيما التلقائية: {schema_err}")


def get_oracle_connection():
    """فتح اتصال مع قاعدة بيانات أوراكل مع دعم التحويل التلقائي لحساب السكيما وThick Mode"""
    global _RESOLVED_CREDENTIAL
    try:
        import oracledb
    except ImportError:
        try:
            import cx_Oracle as oracledb
        except ImportError:
            print("[خطأ] مكتبة أوراكل غير مثبتة. قم بتثبيتها بالأمر:")
            print("       pip install oracledb")
            return None

    dsn = oracledb.makedsn(ORACLE_HOST, ORACLE_PORT, sid=ORACLE_SID)

    # تفعيل Thick Mode استباقياً في حال وجود Instant Client محلياً (لحل DPY-3010 و DPY-3015)
    _init_thick_mode(oracledb, silent_if_missing=True)

    raw_candidates = []
    if _RESOLVED_CREDENTIAL:
        raw_candidates.append(_RESOLVED_CREDENTIAL)

    raw_candidates.extend([
        (ORACLE_USER, ORACLE_PASS),
        (f'"{ORACLE_USER}"', ORACLE_PASS) if ORACLE_USER.isdigit() else None,
        ("IAS20261", ORACLE_PASS),
        ("IAS20261", "IAS20261"),
        ("IAS20251", ORACLE_PASS),
        ("IAS20251", "IAS20251"),
        ("IAS_SYS", ORACLE_PASS),
        ("IAS_SYS", "IAS_SYS"),
        ("IAS", ORACLE_PASS),
        ("IAS", "IAS"),
    ])

    candidates = []
    seen = set()
    for item in raw_candidates:
        if item and item not in seen:
            seen.add(item)
            candidates.append(item)

    idx = 0
    while idx < len(candidates):
        user, pwd = candidates[idx]
        try:
            conn = oracledb.connect(user=user, password=pwd, dsn=dsn)
            _RESOLVED_CREDENTIAL = (user, pwd)
            print(f"[✓] تم الاتصال بقاعدة بيانات أوراكل بنجاح بالمستخدم: {user}")
            _detect_and_set_schema(conn, user)
            return conn
        except Exception as err:
            err_str = str(err)
            # دعم اتصال Oracle 11g/10g وكلمات المرور القديمة (DPY-3010 / DPY-3015) عبر Thick Mode تلقائياً
            if any(code in err_str for code in ("DPY-3010", "DPY-3015", "DPY-3016", "in thin mode")):
                if _init_thick_mode(oracledb, silent_if_missing=False):
                    continue
                return None
            # خطأ في اسم المستخدم/كلمة المرور -> جرب السكيما التالية
            if "ORA-01017" in err_str:
                print(f"  [!] الحساب ({user}) لم يقبل الدخول (ORA-01017)، جاري تجربة السكيما التالية...")
                idx += 1
                continue
            print(f"[خطأ اتصال بأوراكل] ({user}): {err_str}")
            return None

    print("[خطأ] فشلت جميع محاولات تسجيل الدخول لقاعدة بيانات أوراكل (ORA-01017).")
    print("      يرجى التحقق من اسم مستخدم قاعدة البيانات أو تعيين ORACLE_USER و ORACLE_PASS.")
    return None


def discover_onyx_tables():
    """اكتشاف أسماء الجداول الفعلية لنظام أونكس داخل قاعدة بيانات أوراكل"""
    print(f"[*] جاري فحص الجداول على ({ORACLE_HOST}:{ORACLE_PORT}/{ORACLE_SID})...")
    conn = get_oracle_connection()
    if not conn:
        return

    try:
        cur = conn.cursor()
        patterns = [
            "IAS_BILL", "BILL", "INVC", "VOUCH", "VCHR", "RCPT", "CASH",
            "ALRT", "MSG", "QUOT", "QT_", "PO_", "PRCH", "PUR", "ORD", "NTCE", "DISC",
            "CUST", "V_DET", "VEND", "VNDR", "EX_RATE", "AR_",
        ]
        like_clauses = " OR ".join([f"UPPER(TABLE_NAME) LIKE '%{p}%'" for p in patterns])

        schema_name = ORACLE_SCHEMA or _RESOLVED_SCHEMA
        owner_filter = f"AND UPPER(OWNER) = UPPER('{schema_name}')" if schema_name else "AND OWNER NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP')"
        sql = f"""
            SELECT OWNER, TABLE_NAME, NUM_ROWS
            FROM ALL_TABLES
            WHERE ({like_clauses}) {owner_filter}
            ORDER BY OWNER, TABLE_NAME
        """
        cur.execute(sql)
        rows = cur.fetchall()
        print(f"\n[+] تم العثور على {len(rows)} جدول محتمل لنظام Onyx Pro:")
        print("-" * 70)
        for owner, table_name, num_rows in rows:
            print(f"  {owner}.{table_name:<35} (صفوف تقريبية: {num_rows})")
        print("-" * 70)

        target_tables = (
            "VOUCHERS", "VOUCHER_DETAIL", "QUOTATION", "QUOTATION_DETAIL",
            "IAS_MSG_SMS", "IAS_MSG_SMS_DTL", "S_ALRT_SYS_MST", "S_ALRT_SYS_DTL",
            "IAS_BILL_MST_ADD_DISC", "IAS_BILL_ADD_DISC_BILLS", "CUSTOMER_CURR",
            "IAS_CASH_CUSTMR", "IAS_PI_BILL_MST", "IAS_PR_BILL_MST",
        )
        po_tables = [t for _, t, cnt in rows if ("ORD" in t or "PUR" in t or "REQ" in t) and (cnt or 0) > 0]
        inspect_list = list(dict.fromkeys(list(target_tables) + po_tables))
        in_clause = ",".join([f"'{t}'" for t in inspect_list])
        col_owner = f"UPPER(OWNER) = UPPER('{schema_name}')" if schema_name else "OWNER NOT IN ('SYS','SYSTEM','OUTLN','DBSNMP')"
        cur.execute(f"""
            SELECT TABLE_NAME, COLUMN_NAME
            FROM ALL_TAB_COLUMNS
            WHERE {col_owner} AND TABLE_NAME IN ({in_clause})
            ORDER BY TABLE_NAME, COLUMN_ID
        """)
        cols_by_table = {}
        for tname, cname in cur.fetchall():
            cols_by_table.setdefault(tname, []).append(cname)

        if cols_by_table:
            print("\n[+] أعمدة الجداول المهمة:")
            for tname, cols in cols_by_table.items():
                print(f"  * {tname}: {', '.join(cols)}")
            print("-" * 70)

        print("[i] استخدم هذه الأسماء لتحديث قاموس ONYX_QUERIES داخل السكربت إذا اختلفت عن نسختك.")
        cur.close()
        conn.close()
    except Exception as e:
        print(f"[خطأ في فحص الجداول] {e}")


def _parse_amount(val, default=None):
    """تحويل المبالغ القادمة كأرقام أو كنصوص مثل 'الرصيد الحالي: 338.88' بأمان"""
    if val is None:
        return default
    try:
        return float(val)
    except (TypeError, ValueError):
        pass
    text = str(val).replace(",", "").strip()
    if not text:
        return default
    try:
        return float(text)
    except ValueError:
        match = re.search(r"-?\d+(?:\.\d+)?", text)
        if match:
            try:
                return float(match.group(0))
            except ValueError:
                pass
    return default


def fetch_documents_from_oracle():
    """الاتصال بقاعدة بيانات أوراكل واسترجاع كافة العمليات من الجداول المفعلة"""
    print(f"[*] جاري الاتصال بقاعدة بيانات أوراكل ({ORACLE_HOST}:{ORACLE_PORT}/{ORACLE_SID})...")
    conn = get_oracle_connection()
    if not conn:
        return []

    documents = []
    try:
        cursor = conn.cursor()

        for section_name, cfg in ONYX_QUERIES.items():
            if not cfg.get("enabled"):
                continue

            queries = cfg.get("sql_candidates") or ([cfg["sql"]] if cfg.get("sql") else [])
            section_succeeded = False
            last_schema_err = None

            for sql in queries:
                try:
                    cursor.execute(sql)
                    rows = cursor.fetchall()
                    valid_count = 0
                    for r in rows:
                        doc_no = str(r[0]).strip() if r[0] is not None else ""
                        phone = clean_phone_number(r[4])
                        if not doc_no or not phone:
                            continue
                        valid_count += 1
                        documents.append({
                            "invoice_number": doc_no,
                            "doc_type": str(r[1] or "cash_invoice").strip(),
                            "customer_code": str(r[2]).strip() if r[2] is not None else None,
                            "customer_name": str(r[3] or "عميل").strip(),
                            "phone": phone,
                            "invoice_date": str(r[5] or datetime.now().strftime("%Y-%m-%d")),
                            "amount": _parse_amount(r[6], 0.0),
                            "currency": str(r[7] or "ر.س").strip(),
                            "remaining_balance": _parse_amount(r[8], None),
                            "payment_method": str(r[9]).strip() if r[9] is not None else None,
                            "onyx_form_code": str(r[10]).strip() if r[10] is not None else None,
                            "details": str(r[11] or "").strip(),
                        })
                    print(f"  [✓] {section_name}: تم سحب {len(rows)} سجل ({valid_count} برقم جوال صالح).")
                    section_succeeded = True
                    break
                except Exception as q_err:
                    err_str = str(q_err)
                    if "ORA-00942" in err_str or "ORA-00904" in err_str:
                        last_schema_err = err_str
                        continue
                    print(f"  [!] تنبيه في استعلام ({section_name}): {err_str}")
                    section_succeeded = True
                    break

            if not section_succeeded and last_schema_err:
                print(f"  [i] تخطي ({section_name}) لعدم تطابق اسم الجدول/العمود ({last_schema_err.splitlines()[0]}) - شغّل --discover لعرض الأسماء الدقيقة.")

        cursor.close()
        conn.close()
    except Exception as db_err:
        print(f"[خطأ اتصال بأوراكل] {db_err}")

    return documents


def generate_mock_documents():
    """توليد بيانات تجريبية لجميع القوالب الـ 8 (بما فيها أمثلة ALRTT002 و ARST045)"""
    now_str = datetime.now().strftime("%Y-%m-%d")
    suffix = int(time.time()) % 10000
    return [
        {
            "invoice_number": f"SI-C-{suffix}",
            "doc_type": "cash_invoice",
            "customer_code": "1001",
            "customer_name": "مؤسسة البناء الحديث - نقدي",
            "phone": "0554303422",
            "invoice_date": now_str,
            "amount": 3456.66,
            "currency": "ر.س",
            "remaining_balance": 0.0,
            "payment_method": "نقداً",
            "onyx_form_code": "SI-CASH",
            "details": "فاتورة مبيعات نقدية تجريبية من OraNT",
        },
        {
            "invoice_number": f"SI-CR-{suffix}",
            "doc_type": "credit_invoice",
            "customer_code": "705",
            "customer_name": "يحيى عبدالله دكام الشريف",
            "phone": "0505726500",
            "invoice_date": now_str,
            "amount": 2026.09,
            "currency": "ر.س",
            "remaining_balance": 8951.57,
            "payment_method": "آجل",
            "onyx_form_code": "SI-CREDIT",
            "details": "فاتورة مبيعات آجلة تجريبية من OraNT",
        },
        {
            "invoice_number": f"RV-{suffix}",
            "doc_type": "receipt_voucher",
            "customer_code": "7023",
            "customer_name": "محمد العباسي",
            "phone": "0554783338",
            "invoice_date": now_str,
            "amount": 1500.00,
            "currency": "ر.س",
            "remaining_balance": 911.49,
            "payment_method": "تحويل بنكي",
            "onyx_form_code": "RV",
            "details": "سند قبض من الحساب الآجل",
        },
        {
            "invoice_number": f"ALRT-{suffix}-702",
            "doc_type": "account_statement",
            "customer_code": "702",
            "customer_name": "امين عيظة العكة",
            "phone": "0557653323",
            "invoice_date": now_str,
            "amount": 338.88,
            "currency": "ر.س",
            "remaining_balance": 338.88,
            "onyx_form_code": "ALRTT002",
            "details": "كشف حساب ومطابقة عميل - شاشة ALRTT002",
        },
        {
            "invoice_number": f"QT-{suffix}",
            "doc_type": "price_quotation",
            "customer_code": "7047",
            "customer_name": "عبدالله يحيى صوان",
            "phone": "0557993232",
            "invoice_date": now_str,
            "amount": 14500.00,
            "currency": "ر.س",
            "onyx_form_code": "QT",
            "details": "عرض سعر مواد بناء",
        },
        {
            "invoice_number": f"PO-{suffix}",
            "doc_type": "purchase_order",
            "customer_code": "SUP-204",
            "customer_name": "شركة مصانع الدهانات الوطنية",
            "phone": "0501960009",
            "invoice_date": now_str,
            "amount": 22400.00,
            "currency": "ر.س",
            "onyx_form_code": "PO",
            "details": "طلب شراء للمورد",
        },
        {
            "invoice_number": f"ARST-{suffix}",
            "doc_type": "customer_discount_notice",
            "customer_code": "70714",
            "customer_name": "قاسم حسن المؤيد",
            "phone": "0554303422",
            "invoice_date": now_str,
            "amount": 197.48,
            "currency": "ر.س",
            "remaining_balance": 3473.02,
            "payment_method": "خصم سداد",
            "onyx_form_code": "ARST045",
            "details": "خصم عميل (إشعارات العملاء المتعدد ARST045)",
        },
        {
            "invoice_number": f"ALRT-{suffix}-703",
            "doc_type": "direct_alert",
            "customer_code": "703",
            "customer_name": "مؤسسة المصباح المميز التجارية",
            "phone": "0550408666",
            "invoice_date": now_str,
            "amount": 5283.08,
            "currency": "ر.س",
            "remaining_balance": 5283.08,
            "onyx_form_code": "ALRTT002",
            "details": "برجاء سداد المبالغ المستحقة - البناء الحديث",
        },
    ]


def send_documents_to_portal(endpoint_url: str, docs_list: list, api_key: str = ""):
    """إرسال المستندات إلى منصة Modern Building عبر HTTP POST"""
    if not docs_list:
        print("[i] لا توجد مستندات جديدة للمزامنة.")
        return 0

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "OnyxPro-Sync-Agent/2.0",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    print(f"[*] جاري إرسال {len(docs_list)} مستند/عملية إلى: {endpoint_url}...")

    try:
        response = requests.post(endpoint_url, json={"invoices": docs_list}, headers=headers, timeout=25)
        if response.status_code == 200:
            result = response.json()
            print(f"[نجاح] استجابة الخادم: {result.get('message', 'تمت المزامنة بنجاح')}")
            auto_sent = int(result.get("autoSentCount", 0) or 0)
            auto_failed = int(result.get("autoFailedCount", 0) or 0)
            if auto_sent > 0:
                print(f"  [واتساب] تم الإرسال التلقائي عبر واتساب لـ {auto_sent} عملية.")
            if auto_failed > 0:
                print(f"  [واتساب - تنبيه] تعذر الإرسال التلقائي لـ {auto_failed} عملية (يمكن إعادة المحاولة من البوابة).")
            for doc in docs_list:
                mark_invoice_as_synced(
                    doc["invoice_number"],
                    doc.get("doc_type", "cash_invoice"),
                    doc["customer_name"],
                    doc["phone"],
                    doc["amount"],
                )
            return len(docs_list)
        else:
            print(f"[خطأ] فشل الإرسال إلى الخادم ({response.status_code}): {response.text}")
            return 0
    except Exception as req_err:
        print(f"[خطأ اتصال بالشبكة] {req_err}")
        return 0


def main():
    parser = argparse.ArgumentParser(description="Onyx Pro / OraNT Multi-Template Sync Tool")
    parser.add_argument("--discover", action="store_true", help="فحص وعرض أسماء الجداول الفعلية في قاعدة أوراكل")
    parser.add_argument("--mock", action="store_true", help="تشغيل وضع التجربة وإرسال عينات لجميع القوالب الـ 8")
    parser.add_argument("--url", default=API_ENDPOINT, help="رابط الخادم المستقبل للعمليات")
    parser.add_argument("--key", default=API_KEY, help="مفتاح المزامنة السري (API Key)")
    parser.add_argument("--loop", type=int, default=0, help="تشغيل دوري كل N ثانية (0 للتنفيذ مرة واحدة)")
    args = parser.parse_args()

    if args.discover:
        discover_onyx_tables()
        return

    init_tracker_db()
    print("=" * 70)
    print("  بدء تشغيل أداة مزامنة Onyx Pro / OraNT مع modernbuildingsa.com/whatsapp")
    print(f"  الوجهة: {args.url}")
    print("=" * 70)

    while True:
        if args.mock:
            print("[i] الوضع التجريبي مفعل (--mock): توليد عينات لجميع القوالب الـ 8.")
            all_docs = generate_mock_documents()
        else:
            all_docs = fetch_documents_from_oracle()

        new_docs = [doc for doc in all_docs if not is_invoice_synced(doc["invoice_number"])]

        if new_docs:
            print(f"[+] تم العثور على {len(new_docs)} عملية جديدة لم تُزامن بعد.")
            send_documents_to_portal(args.url, new_docs, args.key)
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] لا توجد عمليات جديدة.")

        if args.loop <= 0:
            break
        print(f"[*] الانتظار {args.loop} ثانية للدورة القادمة...\n")
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
