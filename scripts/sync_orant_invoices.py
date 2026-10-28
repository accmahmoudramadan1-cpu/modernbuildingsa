#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
 سكربت مزامنة فواتير نظام أوراكل (OraNT / OnyxPro) مع منصة البناء الحديث
 Modern Building - OraNT Oracle Invoices Synchronizer
=============================================================================
الوظيفة:
1. الاتصال بقاعدة بيانات أوراكل (OraNT / OnyxPro) بحساب صلاحية قراءة.
2. استخراج الفواتير والطلبات الحديثة مع أرقام هواتف العملاء والمبالغ.
3. منع التكرار باستخدام قاعدة بيانات محلية مصغرة (SQLite).
4. إرسال الفواتير إلى الموقع: https://modernbuildingsa.com/api/oracle-orders
   لتظهر في صفحة modernbuildingsa.com/whatsapp لإرسالها بالواتساب مباشرة.
=============================================================================
"""

import sys
import os
import time
import sqlite3
import argparse
import json
import re
from datetime import datetime

try:
    import requests
except ImportError:
    print("[تحذير] مكتبة requests غير مثبتة. يرجى تثبيتها بالأمر: pip install requests")
    sys.exit(1)

# ==========================================
# الإعدادات الافتراضية (يمكن تعديلها أو تمريرها)
# ==========================================
API_ENDPOINT = os.getenv("MODERN_BUILDING_API_URL", "https://modernbuildingsa.com/api/oracle-orders")
API_KEY = os.getenv("ORACLE_SYNC_API_KEY", "")

# إعدادات أوراكل (مطابقة لملف tnsnames.ora في OraNT)
ORACLE_HOST = os.getenv("ORACLE_HOST", "onyxserver")
ORACLE_PORT = int(os.getenv("ORACLE_PORT", "1521"))
ORACLE_SID = os.getenv("ORACLE_SID", "orcl")
ORACLE_USER = os.getenv("ORACLE_USER", "ONYX_READONLY")
ORACLE_PASS = os.getenv("ORACLE_PASS", "")

TRACKER_DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "invoices_tracker.db")


def init_tracker_db():
    """تهيئة قاعدة بيانات SQLite محلية لتتبع الفواتير المرسلة ومنع التكرار"""
    conn = sqlite3.connect(TRACKER_DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        CREATE TABLE IF NOT EXISTS sent_invoices (
            invoice_number TEXT PRIMARY KEY,
            customer_name TEXT,
            phone TEXT,
            amount REAL,
            synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()


def is_invoice_synced(invoice_number: str) -> bool:
    """التحقق مما إذا كانت الفاتورة قد تم رفعها للموقع سابقاً"""
    conn = sqlite3.connect(TRACKER_DB_PATH)
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM sent_invoices WHERE invoice_number = ?", (str(invoice_number).strip(),))
    row = cur.fetchone()
    conn.close()
    return row is not None


def mark_invoice_as_synced(invoice_number: str, customer_name: str, phone: str, amount: float):
    """تسجيل الفاتورة كمزامنة بنجاح"""
    conn = sqlite3.connect(TRACKER_DB_PATH)
    cur = conn.cursor()
    cur.execute("""
        INSERT OR REPLACE INTO sent_invoices (invoice_number, customer_name, phone, amount)
        VALUES (?, ?, ?, ?)
    """, (str(invoice_number).strip(), customer_name, phone, amount))
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


def fetch_invoices_from_oracle():
    """
    الاتصال بقاعدة بيانات أوراكل واسترجاع الفواتير الجديدة
    يتطلب تثبيت: pip install oracledb
    """
    try:
        import oracledb
    except ImportError:
        try:
            import cx_Oracle as oracledb
        except ImportError:
            print("[خطأ] مكتبة أوراكل غير مثبتة. قم بتثبيت oracledb:")
            print("       pip install oracledb")
            return []

    print(f"[*] جاري الاتصال بقاعدة بيانات أوراكل ({ORACLE_HOST}:{ORACLE_PORT}/{ORACLE_SID})...")
    
    invoices = []
    try:
        dsn = oracledb.makedsn(ORACLE_HOST, ORACLE_PORT, sid=ORACLE_SID)
        connection = oracledb.connect(user=ORACLE_USER, password=ORACLE_PASS, dsn=dsn)
        cursor = connection.cursor()

        # استعلام الفواتير (يمكن تعديل أسماء الجداول بحسب تخصيص نظام أونكس لديكم)
        # مثال افتراضي لجداول فواتير المبيعات الشائعة في Onyx:
        query = """
            SELECT 
                DOC_NO AS INVOICE_NO,
                CUST_NAME AS CUSTOMER_NAME,
                NVL(CUST_TEL, CUST_MOBILE) AS PHONE,
                TO_CHAR(DOC_DATE, 'YYYY-MM-DD') AS INVOICE_DATE,
                NVL(NET_VAL, TOTAL_VAL) AS TOTAL_AMOUNT,
                CURR_NAME AS CURRENCY,
                DOC_NOTES AS DETAILS
            FROM 
                SALES_INVOICE_HEADER
            WHERE 
                DOC_DATE >= TRUNC(SYSDATE) - 3
            ORDER BY 
                DOC_DATE DESC, DOC_NO DESC
        """

        try:
            cursor.execute(query)
            rows = cursor.fetchall()
            for r in rows:
                inv_no = str(r[0]).strip()
                invoices.append({
                    "invoice_number": inv_no,
                    "customer_name": str(r[1] or "عميل").strip(),
                    "phone": clean_phone_number(r[2]),
                    "invoice_date": str(r[3]),
                    "amount": float(r[4] or 0),
                    "currency": str(r[5] or "ر.س").strip(),
                    "details": str(r[6] or "").strip(),
                })
        except Exception as q_err:
            print(f"[!] تنبيه في استعلام الجداول: {q_err}")
            print("[i] قد تختلف أسماء الجداول في نسختك من أونكس. يرجى تعديل الـ Query في السكربت.")
        
        cursor.close()
        connection.close()
    except Exception as db_err:
        print(f"[خطأ اتصال بأوراكل] {db_err}")

    return invoices


def generate_mock_invoices():
    """توليد فواتير تجريبية لاختبار دورة المزامنة بدون قاعدة بيانات حية"""
    now_str = datetime.now().strftime("%Y-%m-%d")
    return [
        {
            "invoice_number": f"INV-ORA-{int(time.time()) % 10000}",
            "customer_name": "مؤسسة البناء الحديث - تجريبي",
            "phone": "0554303422",
            "invoice_date": now_str,
            "amount": 5420.00,
            "currency": "ر.س",
            "details": "فاتورة اختبار مزامنة من جهاز أوراكل OraNT",
        },
        {
            "invoice_number": f"INV-ORA-{int(time.time() + 1) % 10000}",
            "customer_name": "سعد بن إبراهيم الحارثي",
            "phone": "0558689100",
            "invoice_date": now_str,
            "amount": 1980.50,
            "currency": "ر.س",
            "details": "شراء حديد تسليح ومستلزمات تشييد",
        }
    ]


def send_invoices_to_portal(endpoint_url: str, invoices_list: list, api_key: str = ""):
    """إرسال الفواتير إلى منصة Modern Building عبر HTTP POST"""
    if not invoices_list:
        print("[i] لا توجد فواتير جديدة للمزامنة.")
        return 0

    headers = {
        "Content-Type": "application/json",
        "User-Agent": "OraNT-Sync-Agent/1.0"
    }
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"

    print(f"[*] جاري إرسال {len(invoices_list)} فاتورة إلى: {endpoint_url}...")

    try:
        response = requests.post(endpoint_url, json={"invoices": invoices_list}, headers=headers, timeout=20)
        if response.status_code == 200:
            result = response.json()
            print(f"[نجاح] استجابة الخادم: {result.get('message', 'تمت المزامنة بنجاح')}")
            for inv in invoices_list:
                mark_invoice_as_synced(
                    inv["invoice_number"],
                    inv["customer_name"],
                    inv["phone"],
                    inv["amount"]
                )
            return len(invoices_list)
        else:
            print(f"[خطأ] فشل الإرسال إلى الخادم ({response.status_code}): {response.text}")
            return 0
    except Exception as req_err:
        print(f"[خطأ اتصال بالشبكة] {req_err}")
        return 0


def main():
    parser = argparse.ArgumentParser(description="OraNT Oracle Invoices Sync Tool")
    parser.add_argument("--mock", action="store_true", help="تشغيل وضع التجربة وتوليد فواتير وهمية لاختبار المنظومة")
    parser.add_argument("--url", default=API_ENDPOINT, help="رابط الخادم المستقبل للفواتير")
    parser.add_argument("--key", default=API_KEY, help="مفتاح المزامنة السري (API Key)")
    parser.add_argument("--loop", type=int, default=0, help="تشغيل دوري كل N ثانية (0 للتنفيذ مرة واحدة)")
    args = parser.parse_args()

    init_tracker_db()
    print("=" * 65)
    print("  بدء تشغيل أداة مزامنة فواتير OraNT مع موقع modernbuildingsa.com")
    print(f"  الوجهة: {args.url}")
    print("=" * 65)

    while True:
        if args.mock:
            print("[i] الوضع التجريبي مفعل (--mock).")
            all_invoices = generate_mock_invoices()
        else:
            all_invoices = fetch_invoices_from_oracle()

        # تصفية الفواتير التي لم تُرسل بعد
        new_invoices = []
        for inv in all_invoices:
            if not is_invoice_synced(inv["invoice_number"]):
                new_invoices.append(inv)
            else:
                # الفاتورة تم إرسالها مسبقاً
                pass

        if new_invoices:
            print(f"[+] تم العثور على {len(new_invoices)} فاتورة جديدة لم تُزامن بعد.")
            send_invoices_to_portal(args.url, new_invoices, args.key)
        else:
            print(f"[{datetime.now().strftime('%H:%M:%S')}] لا توجد فواتير جديدة.")

        if args.loop <= 0:
            break
        print(f"[*] الانتظار {args.loop} ثانية للدورة القادمة...\n")
        time.sleep(args.loop)


if __name__ == "__main__":
    main()
