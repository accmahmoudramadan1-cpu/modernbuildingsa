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
import base64
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
UPLOAD_PDF_ENDPOINT = os.getenv(
    "MODERN_BUILDING_UPLOAD_PDF_URL",
    "https://www.modernbuildingsa.com/api/oracle-orders/upload-pdf",
)
API_KEY = os.getenv("ORACLE_SYNC_API_KEY", "modern_building_orant_sync_secret_2026")
PDF_EXPORT_DIR = os.getenv("ORACLE_PDF_EXPORT_DIR", "").strip()
PDF_WAIT_SECONDS = int(os.getenv("ORACLE_PDF_WAIT_SECONDS", "75"))

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
                COALESCE(C.C_WHATSAPP_NO, C.C_MOBILE, C.C_PHONE, CC.MOBILE_NO, CC.TEL_NO, M.C_TEL) AS PHONE,
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
                M.A_DESC AS DETAILS,
                NULL AS ATTCH_PATH,
                TO_CHAR(M.BILL_SER) AS DOC_SRL,
                TO_CHAR(M.AD_DATE, 'YYYY-MM-DD"T"HH24:MI:SS') AS AD_TS,
                TO_CHAR(M.AD_U_ID) AS AD_UID
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
                M.A_DESC AS DETAILS,
                NULL AS ATTCH_PATH,
                TO_CHAR(M.BILL_SER) AS DOC_SRL,
                NULL AS AD_TS,
                NULL AS AD_UID
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
                COALESCE(C.C_WHATSAPP_NO, C.C_MOBILE, C.C_PHONE) AS PHONE,
                TO_CHAR(V.VOUCHER_DATE, 'YYYY-MM-DD') AS DOC_DATE,
                ROUND(NVL(SUM(NVL(VD.AC_AMT, 0)), NVL(MAX(V.CASH_AMT), 0)), 2) AS AMOUNT,
                DECODE(UPPER(TRIM(TO_CHAR(V.A_CY))), 'SAR', 'ر.س', NVL(E.CUR_NAME, NVL(TO_CHAR(V.A_CY), 'ر.س'))) AS CURRENCY,
                NULL AS REMAINING_BALANCE,
                CASE NVL(V.VOUCHER_PAY_TYPE, 1)
                    WHEN 1 THEN 'نقداً'
                    WHEN 2 THEN 'حوالة'
                    WHEN 3 THEN 'تحويل بنكي'
                    ELSE 'نقداً / تحويل بنكي'
                END AS PAYMENT_METHOD,
                'RV' AS FORM_CODE,
                NVL(MAX(VD.AC_DESC), V.A_DESC) AS DETAILS,
                NULL AS ATTCH_PATH,
                TO_CHAR(MAX(V.V_SER)) AS DOC_SRL,
                TO_CHAR(MAX(V.AD_DATE), 'YYYY-MM-DD"T"HH24:MI:SS') AS AD_TS,
                TO_CHAR(MAX(V.AD_U_ID)) AS AD_UID
            FROM VOUCHERS V
            JOIN VOUCHER_DETAIL VD ON VD.V_SER = V.V_SER AND VD.VOUCHER_TYPE = V.VOUCHER_TYPE
            JOIN CUSTOMER C ON C.C_CODE = COALESCE(VD.C_CODE, VD.AC_CODE_DTL)
            LEFT JOIN EX_RATE E ON TO_CHAR(E.CUR_CODE) = TO_CHAR(V.A_CY)
            WHERE V.VOUCHER_TYPE = 1
              AND V.VOUCHER_DATE >= TRUNC(SYSDATE) - {SYNC_DAYS_BACK}
            GROUP BY
                V.VOUCHER_NO, C.C_CODE, C.C_A_NAME, C.C_WHATSAPP_NO, C.C_MOBILE, C.C_PHONE,
                V.REC_NAME, V.REF_NAME, V.VOUCHER_DATE, V.VOUCHER_PAY_TYPE,
                V.A_CY, E.CUR_NAME, V.A_DESC
            ORDER BY V.VOUCHER_DATE DESC, V.VOUCHER_NO DESC
            """,
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
                    WHEN 2 THEN 'حوالة'
                    WHEN 3 THEN 'تحويل بنكي'
                    ELSE 'نقداً / تحويل بنكي'
                END AS PAYMENT_METHOD,
                'RV' AS FORM_CODE,
                NVL(MAX(VD.AC_DESC), V.A_DESC) AS DETAILS,
                NULL AS ATTCH_PATH,
                TO_CHAR(MAX(V.V_SER)) AS DOC_SRL,
                NULL AS AD_TS,
                NULL AS AD_UID
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
                COALESCE(D.MOBILE_NO, H.MOBILE_NO, C.C_WHATSAPP_NO, C.C_MOBILE, C.C_PHONE) AS PHONE,
                TO_CHAR(NVL(H.AD_DATE, SYSDATE), 'YYYY-MM-DD') AS DOC_DATE,
                TO_CHAR(D.BLNC_MSG) AS AMOUNT,
                'ر.س' AS CURRENCY,
                TO_CHAR(D.BLNC_MSG) AS REMAINING_BALANCE,
                NULL AS PAYMENT_METHOD,
                'ALRTT002' AS FORM_CODE,
                H.MSG_TXT AS DETAILS,
                D.ATTCH_EMAIL_FILE AS ATTCH_PATH,
                TO_CHAR(H.MSG_NO) AS DOC_SRL,
                TO_CHAR(H.AD_DATE, 'YYYY-MM-DD"T"HH24:MI:SS') AS AD_TS,
                TO_CHAR(H.AD_U_ID) AS AD_UID
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
                COALESCE(Q.MOBILE_NO, C.C_WHATSAPP_NO, C.C_MOBILE, C.C_PHONE, CC.MOBILE_NO, CC.TEL_NO) AS PHONE,
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
                Q.A_DESC AS DETAILS,
                NULL AS ATTCH_PATH,
                TO_CHAR(Q.QUOT_SER) AS DOC_SRL,
                TO_CHAR(NVL(Q.APRV_DATE, Q.AD_DATE), 'YYYY-MM-DD"T"HH24:MI:SS') AS AD_TS,
                TO_CHAR(Q.AD_U_ID) AS AD_UID
            FROM QUOTATION Q
            LEFT JOIN CUSTOMER C ON C.C_CODE = Q.C_CODE
            LEFT JOIN IAS_CASH_CUSTMR CC ON CC.CUST_CODE = Q.C_CODE_CSH
            LEFT JOIN EX_RATE E ON TO_CHAR(E.CUR_CODE) = TO_CHAR(Q.QUOT_CUR)
            WHERE Q.QUOT_DATE >= TRUNC(SYSDATE) - {SYNC_DAYS_BACK}
              AND NVL(TO_CHAR(Q.APPROVED), '0') IN ('1', 'Y', 'y')
              AND NVL(TO_CHAR(Q.INACTIVE), '0') NOT IN ('1', 'Y', 'y')
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
                P.PO_DESC AS DETAILS,
                NULL AS ATTCH_PATH,
                TO_CHAR(P.PO_SER) AS DOC_SRL,
                TO_CHAR(P.AD_DATE, 'YYYY-MM-DD"T"HH24:MI:SS') AS AD_TS,
                TO_CHAR(P.AD_U_ID) AS AD_UID
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
                COALESCE(C.C_WHATSAPP_NO, C.C_MOBILE, C.C_PHONE, CC.MOBILE_NO, CC.TEL_NO) AS PHONE,
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
                N.DOC_DESC AS DETAILS,
                NULL AS ATTCH_PATH,
                TO_CHAR(MAX(N.DOC_SER)) AS DOC_SRL,
                TO_CHAR(MAX(N.AD_DATE), 'YYYY-MM-DD"T"HH24:MI:SS') AS AD_TS,
                TO_CHAR(MAX(N.AD_U_ID)) AS AD_UID
            FROM IAS_BILL_MST_ADD_DISC N
            LEFT JOIN IAS_BILL_ADD_DISC_BILLS B ON B.DOC_SER = N.DOC_SER
            LEFT JOIN CUSTOMER C ON C.C_CODE = COALESCE(N.C_CODE, B.C_CODE)
            LEFT JOIN IAS_CASH_CUSTMR CC ON CC.CUST_CODE = N.C_CODE_CSH
            LEFT JOIN EX_RATE E ON TO_CHAR(E.CUR_CODE) = TO_CHAR(N.A_CY)
            WHERE N.DOC_DATE >= TRUNC(SYSDATE) - {SYNC_DAYS_BACK}
            GROUP BY
                N.DOC_NO, N.DOC_DATE, N.A_CY, E.CUR_NAME, N.C_CODE, B.C_CODE, N.C_CODE_CSH,
                C.C_A_NAME, C.C_WHATSAPP_NO, C.C_MOBILE, C.C_PHONE, CC.CUST_F_NM, CC.CUST_L_NM,
                CC.MOBILE_NO, CC.TEL_NO, N.ADD_DISCOUNT, N.ADD_VAT_AMT, N.DOC_DESC
            ORDER BY N.DOC_DATE DESC, N.DOC_NO DESC
            """,
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
                N.DOC_DESC AS DETAILS,
                NULL AS ATTCH_PATH,
                TO_CHAR(MAX(N.DOC_SER)) AS DOC_SRL,
                NULL AS AD_TS,
                NULL AS AD_UID
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
            pdf_uploaded INTEGER DEFAULT 0,
            pdf_path TEXT,
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    for alter_sql in (
        "ALTER TABLE sent_invoices ADD COLUMN doc_type TEXT DEFAULT 'cash_invoice'",
        "ALTER TABLE sent_invoices ADD COLUMN pdf_uploaded INTEGER DEFAULT 0",
        "ALTER TABLE sent_invoices ADD COLUMN pdf_path TEXT",
    ):
        try:
            cur.execute(alter_sql)
        except sqlite3.OperationalError:
            pass
    conn.commit()
    conn.close()


def get_tracker_row(invoice_number: str):
    """جلب حالة مزامنة المستند وحالة رفع ملف الـ PDF الأصلي الخاص به"""
    conn = sqlite3.connect(TRACKER_DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "SELECT COALESCE(pdf_uploaded, 0), pdf_path FROM sent_invoices WHERE invoice_number = ?",
        (str(invoice_number).strip(),),
    )
    row = cur.fetchone()
    conn.close()
    return row


def is_invoice_synced(invoice_number: str) -> bool:
    """التحقق مما إذا كان المستند قد تم رفعه للموقع سابقاً"""
    return get_tracker_row(invoice_number) is not None


def mark_invoice_as_synced(
    invoice_number: str,
    doc_type: str,
    customer_name: str,
    phone: str,
    amount: float,
    pdf_uploaded: int = 0,
    pdf_path: str = None,
):
    """تسجيل المستند كمزامن بنجاح"""
    conn = sqlite3.connect(TRACKER_DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO sent_invoices (
            invoice_number, doc_type, customer_name, phone, amount, pdf_uploaded, pdf_path
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
    """, (
        str(invoice_number).strip(),
        str(doc_type),
        customer_name,
        phone,
        float(amount or 0),
        int(pdf_uploaded or 0),
        pdf_path,
    ))
    conn.commit()
    conn.close()


def mark_pdf_as_uploaded(invoice_number: str, pdf_path: str):
    """تحديث سجل المستند بعد رفع ملف PDF متأخر من أونكس"""
    conn = sqlite3.connect(TRACKER_DB_PATH)
    cur = conn.cursor()
    cur.execute(
        "UPDATE sent_invoices SET pdf_uploaded = 1, pdf_path = ? WHERE invoice_number = ?",
        (pdf_path, str(invoice_number).strip()),
    )
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


def check_extra_onyx_info():
    """فحص حالة اعتماد عروض الأسعار (APPROVED) ومسارات ملفات PDF في أونكس"""
    print("=" * 70)
    print("  فحص حالة عروض الأسعار ومسارات ملفات PDF في Onyx Pro")
    print("=" * 70)

    active_dirs = _auto_detect_default_pdf_dirs()
    if active_dirs:
        idx = _build_pdf_index(active_dirs)
        print(f"[✓] مجلدات PDF ({active_dirs}): تم العثور على {len(idx)} ملف PDF.")
        for entry in idx[:5]:
            print(f"    - {entry[1]}")
    else:
        print("[i] متغير ORACLE_PDF_EXPORT_DIR غير محدد حالياً.")

    conn = get_oracle_connection()
    if not conn:
        return

    try:
        cur = conn.cursor()
        print("\n[+] آخر 10 عروض أسعار (QUOTATION) وحالة اعتمادها (APPROVED):")
        cur.execute("""
            SELECT QUOT_NO, TO_CHAR(QUOT_DATE, 'YYYY-MM-DD'), APPROVED, TO_CHAR(APRV_DATE, 'YYYY-MM-DD'), INACTIVE
            FROM (
                SELECT QUOT_NO, QUOT_DATE, APPROVED, APRV_DATE, INACTIVE
                FROM QUOTATION
                ORDER BY QUOT_DATE DESC, QUOT_NO DESC
            )
            WHERE ROWNUM <= 10
        """)
        for row in cur.fetchall():
            print(f"  - عرض #{row[0]} | تاريخ: {row[1]} | APPROVED={row[2]} | APRV_DATE={row[3]} | INACTIVE={row[4]}")

        print("\n[+] آخر 10 مرفقات في عرض الرسائل التلقائي (S_V_MSG_MOBILE_AUTO.ATTCH_EMAIL_FILE):")
        try:
            cur.execute("""
                SELECT SR_NO, DOC_TYP, DOC_SRL, MOBILE_NO, ATTCH_EMAIL_FILE
                FROM (
                    SELECT SR_NO, DOC_TYP, DOC_SRL, MOBILE_NO, ATTCH_EMAIL_FILE
                    FROM S_V_MSG_MOBILE_AUTO
                    WHERE ATTCH_EMAIL_FILE IS NOT NULL
                    ORDER BY SR_NO DESC
                )
                WHERE ROWNUM <= 10
            """)
            v_rows = cur.fetchall()
            if v_rows:
                for row in v_rows:
                    print(f"  - SR#{row[0]} | DOC_TYP={row[1]} | DOC_SRL={row[2]} | جوال={row[3]} | الملف={row[4]}")
            else:
                print("  (لا توجد مسارات مسجلة في S_V_MSG_MOBILE_AUTO)")
        except Exception as v_err:
            print(f"  [!] تعذر قراءة S_V_MSG_MOBILE_AUTO: {v_err}")

        print("\n[+] آخر 10 مرفقات في شاشة التنبيهات (IAS_MSG_SMS_DTL.ATTCH_EMAIL_FILE):")
        cur.execute("""
            SELECT MSG_NO, RCVR_CODE, ATTCH_EMAIL_FILE
            FROM (
                SELECT MSG_NO, RCVR_CODE, ATTCH_EMAIL_FILE
                FROM IAS_MSG_SMS_DTL
                WHERE ATTCH_EMAIL_FILE IS NOT NULL
                ORDER BY MSG_NO DESC, RCRD_NO DESC
            )
            WHERE ROWNUM <= 10
        """)
        attch_rows = cur.fetchall()
        if attch_rows:
            for row in attch_rows:
                print(f"  - MSG#{row[0]} | عميل={row[1]} | الملف={row[2]}")
        else:
            print("  (لا توجد مسارات مسجلة في ATTCH_EMAIL_FILE)")

        cur.close()
        conn.close()
    except Exception as err:
        print(f"[!] خطأ أثناء الفحص الإضافي: {err}")


def find_onyx_pdf_locations():
    """البحث الذكي عبر السيرفر وقاعدة بيانات أوراكل لاكتشاف مجلد تصدير ملفات PDF من أونكس"""
    print("=" * 70)
    print("  جاري البحث التلقائي عن مكان تصدير ملفات PDF الصادرة من Onyx Pro")
    print("=" * 70)

    sample_doc_nos = set()
    attch_dirs = set()

    conn = get_oracle_connection()
    if conn:
        try:
            cur = conn.cursor()
            cur.execute("SELECT TO_CHAR(BILL_NO) FROM (SELECT BILL_NO FROM IAS_BILL_MST ORDER BY BILL_DATE DESC, BILL_NO DESC) WHERE ROWNUM <= 30")
            for (bno,) in cur.fetchall():
                if bno and len(str(bno).strip()) >= 4:
                    sample_doc_nos.add(str(bno).strip().lower())

            cur.execute("SELECT TO_CHAR(QUOT_NO) FROM (SELECT QUOT_NO FROM QUOTATION ORDER BY QUOT_DATE DESC, QUOT_NO DESC) WHERE ROWNUM <= 20")
            for (qno,) in cur.fetchall():
                if qno and len(str(qno).strip()) >= 3:
                    sample_doc_nos.add(str(qno).strip().lower())

            for view_sql in (
                "SELECT ATTCH_EMAIL_FILE FROM (SELECT ATTCH_EMAIL_FILE FROM S_V_MSG_MOBILE_AUTO WHERE ATTCH_EMAIL_FILE IS NOT NULL ORDER BY SR_NO DESC) WHERE ROWNUM <= 20",
                "SELECT ATTCH_EMAIL_FILE FROM (SELECT ATTCH_EMAIL_FILE FROM IAS_MSG_SMS_DTL WHERE ATTCH_EMAIL_FILE IS NOT NULL ORDER BY MSG_NO DESC) WHERE ROWNUM <= 20",
            ):
                try:
                    cur.execute(view_sql)
                    for (apath,) in cur.fetchall():
                        if apath:
                            p = str(apath).strip().strip('"')
                            print(f"  [Oracle ATTCH_EMAIL_FILE] {p}")
                            parent = os.path.dirname(p)
                            if parent:
                                attch_dirs.add(parent)
                except Exception:
                    pass
            cur.close()
            conn.close()
        except Exception as err:
            print(f"  [!] تنبيه أثناء جلب أرقام العينات من أوراكل: {err}")

    skip_dir_names = {
        "windows", "program files", "program files (x86)", "programdata", "$recycle.bin",
        "system volume information", "appdata", "node_modules", ".git", "recovery", "perflogs",
    }
    search_roots = []
    for drv in ("C:\\", "D:\\", "E:\\", "F:\\"):
        if os.path.isdir(drv):
            search_roots.append(drv)
    for home_sub in ("Documents", "Desktop", "Downloads"):
        hp = os.path.join(os.path.expanduser("~"), home_sub)
        if os.path.isdir(hp):
            search_roots.append(hp)

    matched_folders = {}
    recent_pdf_folders = {}
    cutoff_ts = time.time() - (30 * 86400)

    print(f"[*] فحص المجلدات في: {', '.join(search_roots)} ...")
    for root_base in search_roots:
        base_depth = root_base.rstrip("\\/").count(os.sep)
        for root, dirs, files in os.walk(root_base):
            dirs[:] = [
                d for d in dirs
                if d.lower() not in skip_dir_names and not d.startswith(".")
            ]
            if root.rstrip("\\/").count(os.sep) - base_depth >= 4:
                dirs[:] = []

            folder_low = root.lower()
            is_onyx_named = any(k in folder_low for k in ("onyx", "orant", "ys_", "yemensoft", "bill", "invoice", "quot", "pdf", "attch"))

            for fname in files:
                if not fname.lower().endswith(".pdf"):
                    continue
                full_p = os.path.join(root, fname)
                stem = os.path.splitext(fname)[0].lower()
                try:
                    mtime = os.path.getmtime(full_p)
                except OSError:
                    mtime = 0

                if any(tok in stem for tok in sample_doc_nos if len(tok) >= 5):
                    matched_folders.setdefault(root, []).append(fname)
                elif mtime >= cutoff_ts or is_onyx_named:
                    recent_pdf_folders.setdefault(root, 0)
                    recent_pdf_folders[root] += 1

    print("\n" + "=" * 70)
    if attch_dirs:
        print("[+] مجلدات مسجلة داخل جدول المرفقات في أوراكل (ATTCH_EMAIL_FILE):")
        for d in sorted(attch_dirs):
            print(f"    -> {d}")

    if matched_folders:
        print("\n[✓] تم العثور على مجلدات تحتوي بالفعل على ملفات PDF تطابق أرقام فواتير/عروض أونكس!")
        best_dirs = sorted(matched_folders.keys(), key=lambda k: len(matched_folders[k]), reverse=True)
        for d in best_dirs[:8]:
            samples = ", ".join(matched_folders[d][:3])
            print(f"    * {d}  ({len(matched_folders[d])} ملف مطابق، مثال: {samples})")
        print("\n[+] انسخ هذا السطر وضعه داخل ملف run_sync_service.bat:")
        print(f"    set ORACLE_PDF_EXPORT_DIR={best_dirs[0]}")
    elif recent_pdf_folders:
        print("\n[i] مجلدات تحتوي على ملفات PDF حديثة أو مرتبطة بأسماء أونكس:")
        top_recent = sorted(recent_pdf_folders.items(), key=lambda kv: kv[1], reverse=True)[:10]
        for d, cnt in top_recent:
            print(f"    * {d}  ({cnt} ملف PDF)")
    else:
        print("[i] لم يتم العثور على ملفات PDF حديثة على الأقراص المحلية؛ غالباً تحفظ في مجلد شبكة مثل \\\\onyxserver\\...")
    print("=" * 70)


def _auto_detect_default_pdf_dirs() -> str:
    """محاولة تلقائية سريعة لاكتشاف مجلد تصدير PDF المحلي إذا لم يُحدد ORACLE_PDF_EXPORT_DIR"""
    if PDF_EXPORT_DIR:
        return PDF_EXPORT_DIR
    candidates = []
    for path_guess in (
        r"D:\MSG\IAS1\PDF", r"D:\MSG\IAS\PDF", r"C:\MSG\IAS1\PDF",
        r"D:\DOPDF", r"C:\DOPDF",
        r"C:\OnyxPDF", r"D:\OnyxPDF", r"C:\PDF", r"D:\PDF",
        r"C:\OnyxPro\PDF", r"D:\OnyxPro\PDF", r"C:\YemenSoft\PDF", r"D:\YemenSoft\PDF",
        r"\\onyxserver\OnyxPDF", r"\\onyxserver\PDF",
    ):
        if os.path.isdir(path_guess):
            candidates.append(path_guess)
    return ";".join(candidates)


_ONYX_PDF_NAME_RE = re.compile(r"^pdf(\d{5})(\d{5})(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})$")

_EXPECTED_FORMS_BY_DOC_TYPE = {
    "cash_invoice": {158},
    "credit_invoice": {158},
    "customer_discount_notice": {875},
    "price_quotation": {155, 158},
    "receipt_voucher": {23, 21},
    "account_statement": {274},
}


def _parse_onyx_pdf_stem(stem: str):
    """تحليل أسماء ملفات أونكس القياسية مثل PDF001580000916112026110215 -> (form_no, u_id, datetime)"""
    m = _ONYX_PDF_NAME_RE.match(stem)
    if not m:
        return None
    try:
        form_no = int(m.group(1))
        uid = int(m.group(2))
        day, mon, yr = int(m.group(3)), int(m.group(4)), int(m.group(5))
        hh, mm, ss = int(m.group(6)), int(m.group(7)), int(m.group(8))
        return (form_no, uid, datetime(yr, mon, day, hh, mm, ss))
    except ValueError:
        return None


def _is_ready_pdf(file_path: str) -> bool:
    """التأكد أن ملف الـ PDF مكتمل الكتابة (ليس فارغاً ويبدأ بـ %PDF- وينتهي بـ %%EOF)"""
    try:
        size_bytes = os.path.getsize(file_path)
        if size_bytes < 100 or size_bytes > 10 * 1024 * 1024:
            return False
        with open(file_path, "rb") as f:
            head = f.read(64)
            if b"%PDF-" not in head:
                return False
            if size_bytes > 1024:
                f.seek(size_bytes - 1024)
            else:
                f.seek(0)
            tail = f.read()
        return b"%%EOF" in tail
    except OSError:
        return False


def _build_pdf_index(export_dirs_str: str) -> list:
    """فهرسة سريعة لملفات PDF باستخدام os.scandir() (بعمق أقصى 3 مجلدات، مرتبة من الأحدث للأقدم)"""
    entries = []
    if not export_dirs_str:
        return entries

    def _scan(dir_path: str, depth: int):
        try:
            with os.scandir(dir_path) as it:
                for entry in it:
                    if entry.is_dir(follow_symlinks=False):
                        if depth < 3:
                            _scan(entry.path, depth + 1)
                    elif entry.is_file(follow_symlinks=False) and entry.name.lower().endswith(".pdf"):
                        try:
                            mtime = entry.stat().st_mtime
                        except OSError:
                            mtime = 0
                        stem = os.path.splitext(entry.name)[0].lower()
                        parsed_meta = _parse_onyx_pdf_stem(stem)
                        entries.append((stem, entry.path, mtime, parsed_meta))
        except OSError:
            pass

    for raw_dir in export_dirs_str.split(";"):
        base_dir = raw_dir.strip().strip('"')
        if base_dir and os.path.isdir(base_dir):
            _scan(base_dir, 0)

    entries.sort(key=lambda item: item[2], reverse=True)
    return entries


def _candidate_doc_tokens(doc_no: str) -> list:
    raw = str(doc_no or "").strip().lower()
    tokens = []
    if raw:
        tokens.append(raw)
    # Extract core doc identifier for prefixed IDs like QT-104, PO-552, RV-412-702, ALRT-10-702
    parts = [p for p in raw.split("-") if p]
    if len(parts) >= 2 and parts[0] in ("qt", "po", "rv", "alrt", "arst"):
        core = parts[1]
        if len(core) >= 4 and core not in tokens:
            tokens.append(core)
        joined_rest = "-".join(parts[1:])
        if len(joined_rest) >= 4 and joined_rest not in tokens:
            tokens.append(joined_rest)
    return tokens


def _find_local_onyx_pdf(doc: dict, pdf_index: list, used_paths: set = None):
    """البحث الذكي عن ملف PDF الأصلي من أونكس عبر مسار أوراكل (S_V_MSG_MOBILE_AUTO/ATTCH_EMAIL_FILE) أو توقيت+مستخدم الملف"""
    if used_paths is None:
        used_paths = set()

    doc_no = doc.get("invoice_number", "")
    attch_path = doc.get("_attch_path")
    doc_type = doc.get("doc_type", "cash_invoice")
    ad_ts = doc.get("_ad_ts")
    ad_uid_raw = doc.get("_ad_uid")

    # 1. Exact attachment path from Oracle (S_V_MSG_MOBILE_AUTO.ATTCH_EMAIL_FILE or IAS_MSG_SMS_DTL)
    if attch_path:
        cleaned = str(attch_path).strip().strip('"')
        if os.path.isfile(cleaned) and cleaned.lower().endswith(".pdf") and _is_ready_pdf(cleaned):
            return cleaned
        base_name = os.path.basename(cleaned).lower()
        if base_name.endswith(".pdf"):
            base_stem = os.path.splitext(base_name)[0]
            for stem, full_path, _, _ in pdf_index:
                if stem == base_stem and _is_ready_pdf(full_path):
                    return full_path

    if not pdf_index:
        return None

    # 2. Correlation via Onyx naming scheme PDF<5d FORM_NO><5d U_ID><DDMMYYYYHHMMSS>.pdf
    #    Match against BOTH creator (AD_U_ID, AD_DATE) AND actual print/export events in IAS_AUD_PRNT_REP
    candidate_anchors = []
    expected_forms = _EXPECTED_FORMS_BY_DOC_TYPE.get(doc_type, set())

    for p_form, p_uid, p_dt in (doc.get("_print_events") or []):
        candidate_anchors.append((p_dt, p_uid, {p_form} if p_form else expected_forms))

    if ad_ts and ad_uid_raw is not None and str(ad_uid_raw).strip().isdigit():
        try:
            candidate_anchors.append((datetime.fromisoformat(str(ad_ts)), int(str(ad_uid_raw).strip()), expected_forms))
        except ValueError:
            pass

    if candidate_anchors:
        best_candidate = None
        best_score = None

        for target_dt, target_uid, anchor_forms in candidate_anchors:
            for _, full_path, _, parsed_meta in pdf_index:
                if not parsed_meta or full_path in used_paths:
                    continue
                form_no, file_uid, pdf_dt = parsed_meta
                if file_uid != target_uid:
                    continue
                if anchor_forms and form_no not in anchor_forms:
                    continue
                delta = (pdf_dt - target_dt).total_seconds()
                if -15 <= delta <= 180:
                    # Prefer PDFs created shortly AFTER document/print timestamp, smallest delta first
                    score = (0 if delta >= 0 else 1, abs(delta))
                    if best_score is None or score < best_score:
                        if _is_ready_pdf(full_path):
                            best_score = score
                            best_candidate = full_path

        if best_candidate:
            return best_candidate

    # 3. Direct filename token match (if user manually exports named PDFs)
    tokens = _candidate_doc_tokens(doc_no)
    for token in tokens:
        for stem, full_path, _, _ in pdf_index:
            if stem == token and full_path not in used_paths and _is_ready_pdf(full_path):
                return full_path

    for token in tokens:
        pattern = re.compile(rf"(?<![0-9a-z]){re.escape(token)}(?![0-9a-z])")
        for stem, full_path, _, _ in pdf_index:
            if pattern.search(stem) and full_path not in used_paths and _is_ready_pdf(full_path):
                return full_path

    return None


def upload_pdf_to_portal(upload_url: str, doc_no: str, pdf_path: str, api_key: str = ""):
    """رفع ملف PDF الفعلي من جهاز السيرفر إلى البوابة والحصول على رابط HTTPS عام"""
    try:
        size_bytes = os.path.getsize(pdf_path)
        if size_bytes <= 0 or size_bytes > 10 * 1024 * 1024:
            print(f"  [!] تخطي رفع {pdf_path}: الحجم غير صالح ({size_bytes} bytes).")
            return None

        with open(pdf_path, "rb") as f:
            raw_bytes = f.read()

        if b"%PDF-" not in raw_bytes[:64]:
            print(f"  [!] تخطي رفع {pdf_path}: الملف ليس PDF صالح.")
            return None

        headers = {
            "Content-Type": "application/json",
            "User-Agent": "OnyxPro-Sync-Agent/2.0",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        payload = {
            "invoiceNumber": doc_no,
            "filename": os.path.basename(pdf_path),
            "contentBase64": base64.b64encode(raw_bytes).decode("ascii"),
        }
        resp = requests.post(upload_url, json=payload, headers=headers, timeout=25)
        if resp.status_code == 200:
            data = resp.json()
            url = data.get("url")
            if url:
                print(f"  [PDF] تم رفع فاتورة أونكس الأصلية ({os.path.basename(pdf_path)}) لعملية {doc_no}.")
                return url
        else:
            print(f"  [!] تعذر رفع PDF ({doc_no}) - HTTP {resp.status_code}: {resp.text[:180]}")
    except Exception as err:
        print(f"  [!] خطأ أثناء رفع ملف PDF ({doc_no}): {err}")
    return None


def _load_auto_msg_pdf_map(cursor):
    """جلب خريطة مسارات PDF الفعلية من عرض أونكس التلقائي S_V_MSG_MOBILE_AUTO"""
    by_srl_phone = {}
    by_srl = {}
    oracle_now_dt = datetime.now()

    try:
        cursor.execute("""SELECT TO_CHAR(SYSDATE, 'YYYY-MM-DD"T"HH24:MI:SS') FROM DUAL""")
        now_row = cursor.fetchone()
        if now_row and now_row[0]:
            oracle_now_dt = datetime.fromisoformat(str(now_row[0]).strip())
    except Exception:
        pass

    try:
        cursor.execute(
            """
            SELECT TO_CHAR(DOC_SRL), MOBILE_NO, ATTCH_EMAIL_FILE
            FROM (
                SELECT DOC_SRL, MOBILE_NO, ATTCH_EMAIL_FILE
                FROM S_V_MSG_MOBILE_AUTO
                WHERE ATTCH_EMAIL_FILE IS NOT NULL
                  AND NVL(AD_DATE, MSG_DATE) >= TRUNC(SYSDATE) - :days_back
                ORDER BY SR_NO DESC
            )
            """,
            {"days_back": SYNC_DAYS_BACK + 2},
        )
        for doc_srl_val, mob_val, attch_val in cursor.fetchall():
            if not doc_srl_val or not attch_val:
                continue
            srl_key = str(doc_srl_val).strip()
            attch_str = str(attch_val).strip().strip('"')
            c_phone = clean_phone_number(mob_val)
            if c_phone and (srl_key, c_phone) not in by_srl_phone:
                by_srl_phone[(srl_key, c_phone)] = attch_str
            if srl_key not in by_srl:
                by_srl[srl_key] = attch_str
        if by_srl:
            print(f"  [✓] S_V_MSG_MOBILE_AUTO: تم ربط {len(by_srl)} مسار PDF صادر من أونكس.")
    except Exception:
        pass

    return by_srl_phone, by_srl, oracle_now_dt


def _load_print_audit_map(cursor):
    """جلب سجل أحداث الطباعة/التصدير من جدول IAS_AUD_PRNT_REP لربط ملفات PDF المطبوعة لاحقاً أو بمستخدم آخر"""
    events_by_key = {}
    try:
        cursor.execute(
            """
            SELECT FORM_NO, AUD_U_ID, TO_CHAR(AUD_DATE, 'YYYY-MM-DD"T"HH24:MI:SS'),
                   TO_CHAR(DOC_NO), TO_CHAR(DOC_SRL)
            FROM IAS_AUD_PRNT_REP
            WHERE AUD_DATE >= TRUNC(SYSDATE) - :days_back
              AND AUD_DATE IS NOT NULL
            ORDER BY AUD_DATE DESC
            """,
            {"days_back": SYNC_DAYS_BACK + 1},
        )
        for form_val, uid_val, dt_val, doc_no_val, doc_srl_val in cursor.fetchall():
            if not dt_val or uid_val is None:
                continue
            try:
                form_no = int(str(form_val).strip()) if form_val is not None else 0
                uid = int(str(uid_val).strip())
                aud_dt = datetime.fromisoformat(str(dt_val).strip())
            except ValueError:
                continue

            entry = (form_no, uid, aud_dt)
            for raw_k in (doc_no_val, doc_srl_val):
                k = str(raw_k or "").strip().lower()
                if k:
                    events_by_key.setdefault(k, []).append(entry)
    except Exception:
        pass
    return events_by_key


def fetch_documents_from_oracle():
    """الاتصال بقاعدة بيانات أوراكل واسترجاع كافة العمليات من الجداول المفعلة"""
    print(f"[*] جاري الاتصال بقاعدة بيانات أوراكل ({ORACLE_HOST}:{ORACLE_PORT}/{ORACLE_SID})...")
    conn = get_oracle_connection()
    if not conn:
        return []

    documents = []
    try:
        cursor = conn.cursor()
        by_srl_phone, by_srl, oracle_now_dt = _load_auto_msg_pdf_map(cursor)
        print_events_map = _load_print_audit_map(cursor)

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
                        attch_path = str(r[12]).strip() if len(r) > 12 and r[12] is not None else None
                        doc_srl = str(r[13]).strip() if len(r) > 13 and r[13] is not None else None
                        ad_ts = str(r[14]).strip() if len(r) > 14 and r[14] is not None else None
                        ad_uid = str(r[15]).strip() if len(r) > 15 and r[15] is not None else None

                        if not attch_path:
                            for lookup_key in list(dict.fromkeys([k for k in [doc_srl, doc_no] + _candidate_doc_tokens(doc_no) if k])):
                                attch_path = by_srl_phone.get((lookup_key, phone)) or by_srl.get(lookup_key)
                                if attch_path:
                                    break

                        age_seconds = None
                        if ad_ts:
                            try:
                                age_seconds = (oracle_now_dt - datetime.fromisoformat(ad_ts)).total_seconds()
                            except ValueError:
                                age_seconds = None

                        doc_print_events = []
                        for pkey in list(dict.fromkeys([k.lower() for k in [doc_srl, doc_no] + _candidate_doc_tokens(doc_no) if k])):
                            doc_print_events.extend(print_events_map.get(pkey, []))

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
                            "_attch_path": attch_path,
                            "_doc_srl": doc_srl,
                            "_ad_ts": ad_ts,
                            "_ad_uid": ad_uid,
                            "_print_events": doc_print_events,
                            "_age_seconds": age_seconds,
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

    clean_docs = [
        {k: v for k, v in doc.items() if not str(k).startswith("_")}
        for doc in docs_list
    ]

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "OnyxPro-Sync-Agent/2.0",
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    print(f"[*] جاري إرسال {len(clean_docs)} مستند/عملية إلى: {endpoint_url}...")

    try:
        response = requests.post(endpoint_url, json={"invoices": clean_docs}, headers=headers, timeout=25)
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
                    pdf_uploaded=1 if doc.get("_local_pdf_path") else 0,
                    pdf_path=doc.get("_local_pdf_path"),
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
    parser.add_argument("--check-extra", action="store_true", help="فحص اعتماد عروض الأسعار ومسارات ملفات PDF")
    parser.add_argument("--find-pdfs", action="store_true", help="البحث التلقائي على الأقراص وأوراكل لاكتشاف مجلد تصدير PDF")
    parser.add_argument("--mock", action="store_true", help="تشغيل وضع التجربة وإرسال عينات لجميع القوالب الـ 8")
    parser.add_argument("--url", default=API_ENDPOINT, help="رابط الخادم المستقبل للعمليات")
    parser.add_argument("--upload-pdf-url", default=UPLOAD_PDF_ENDPOINT, help="رابط رفع ملفات PDF الأصلية من أونكس")
    parser.add_argument("--key", default=API_KEY, help="مفتاح المزامنة السري (API Key)")
    parser.add_argument("--loop", type=int, default=0, help="تشغيل دوري كل N ثانية (0 للتنفيذ مرة واحدة)")
    args = parser.parse_args()

    if args.discover:
        discover_onyx_tables()
        return

    if args.check_extra:
        check_extra_onyx_info()
        return

    if args.find_pdfs:
        find_onyx_pdf_locations()
        return

    active_pdf_dirs = _auto_detect_default_pdf_dirs()

    init_tracker_db()
    print("=" * 70)
    print("  بدء تشغيل أداة مزامنة Onyx Pro / OraNT مع modernbuildingsa.com/whatsapp")
    print(f"  الوجهة: {args.url}")
    if active_pdf_dirs:
        print(f"  مجلد PDF: {active_pdf_dirs}")
    print("=" * 70)

    while True:
        if args.mock:
            print("[i] الوضع التجريبي مفعل (--mock): توليد عينات لجميع القوالب الـ 8.")
            all_docs = generate_mock_documents()
            new_docs = [doc for doc in all_docs if not is_invoice_synced(doc["invoice_number"])]
            if new_docs:
                send_documents_to_portal(args.url, new_docs, args.key)
            else:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] لا توجد عمليات جديدة.")
        else:
            all_docs = fetch_documents_from_oracle()
            pending_new_docs = []
            recent_missing_pdf_docs = []

            for doc in all_docs:
                row = get_tracker_row(doc["invoice_number"])
                if row is None:
                    pending_new_docs.append(doc)
                else:
                    pdf_uploaded = row[0]
                    age_sec = doc.get("_age_seconds")
                    if not pdf_uploaded and age_sec is not None and -60 <= age_sec <= 86400:
                        recent_missing_pdf_docs.append(doc)

            need_pdf_index = bool(pending_new_docs or recent_missing_pdf_docs) and (
                bool(active_pdf_dirs)
                or any(doc.get("_attch_path") for doc in pending_new_docs + recent_missing_pdf_docs)
            )
            pdf_index = _build_pdf_index(active_pdf_dirs) if need_pdf_index else []
            used_pdf_paths = set()

            ready_docs = []
            deferred_count = 0

            for doc in pending_new_docs:
                local_pdf = _find_local_onyx_pdf(doc, pdf_index, used_pdf_paths)
                if local_pdf:
                    used_pdf_paths.add(local_pdf)
                    uploaded_url = upload_pdf_to_portal(
                        args.upload_pdf_url, doc["invoice_number"], local_pdf, args.key
                    )
                    if uploaded_url:
                        doc["attachment_url"] = uploaded_url
                        doc["_local_pdf_path"] = local_pdf
                    ready_docs.append(doc)
                else:
                    age_sec = doc.get("_age_seconds")
                    doc_type = doc.get("doc_type", "cash_invoice")
                    expects_pdf = doc_type in (
                        "cash_invoice",
                        "credit_invoice",
                        "price_quotation",
                        "customer_discount_notice",
                        "account_statement",
                        "receipt_voucher",
                    )
                    if (
                        args.loop > 0
                        and PDF_WAIT_SECONDS > 0
                        and expects_pdf
                        and age_sec is not None
                        and -15 <= age_sec < PDF_WAIT_SECONDS
                    ):
                        deferred_count += 1
                        print(
                            f"  [*] بانتظار تصدير PDF من أونكس لعملية {doc['invoice_number']} "
                            f"({int(max(0, age_sec))}ث / {PDF_WAIT_SECONDS}ث)..."
                        )
                        continue
                    ready_docs.append(doc)

            if ready_docs:
                print(f"[+] تم العثور على {len(ready_docs)} عملية جديدة للمزامنة.")
                send_documents_to_portal(args.url, ready_docs, args.key)
            elif deferred_count == 0:
                print(f"[{datetime.now().strftime('%H:%M:%S')}] لا توجد عمليات جديدة.")

            late_uploaded = 0
            for doc in recent_missing_pdf_docs:
                if late_uploaded >= 5:
                    break
                local_pdf = _find_local_onyx_pdf(doc, pdf_index, used_pdf_paths)
                if local_pdf:
                    used_pdf_paths.add(local_pdf)
                    uploaded_url = upload_pdf_to_portal(
                        args.upload_pdf_url, doc["invoice_number"], local_pdf, args.key
                    )
                    if uploaded_url:
                        mark_pdf_as_uploaded(doc["invoice_number"], local_pdf)
                        late_uploaded += 1

        if args.loop <= 0:
            break
        print(f"[*] الانتظار {args.loop} ثانية للدورة القادمة...\n")
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
