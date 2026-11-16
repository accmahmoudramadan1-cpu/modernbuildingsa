import mysql, { type Pool, type RowDataPacket, type ResultSetHeader } from "mysql2/promise";

declare global {
  var __mbMysqlPool: Pool | undefined;
  var __mbMysqlSchemaReady: Promise<void> | undefined;
}

export function isMysqlConfigured(): boolean {
  return Boolean(
    process.env.MYSQL_DATABASE &&
      process.env.MYSQL_USER &&
      process.env.MYSQL_PASSWORD
  );
}

export function getMysqlPool(): Pool {
  if (!isMysqlConfigured()) {
    throw new Error("MySQL environment variables (MYSQL_DATABASE, MYSQL_USER, MYSQL_PASSWORD) are not configured.");
  }

  if (!globalThis.__mbMysqlPool) {
    globalThis.__mbMysqlPool = mysql.createPool({
      host: process.env.MYSQL_HOST || "127.0.0.1",
      port: Number(process.env.MYSQL_PORT || "3306"),
      database: process.env.MYSQL_DATABASE,
      user: process.env.MYSQL_USER,
      password: process.env.MYSQL_PASSWORD,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
      charset: "utf8mb4",
      dateStrings: true,
    });
  }

  return globalThis.__mbMysqlPool;
}

export async function ensureMysqlSchema(): Promise<void> {
  if (!isMysqlConfigured()) return;
  if (!globalThis.__mbMysqlSchemaReady) {
    const pool = getMysqlPool();
    globalThis.__mbMysqlSchemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS site_settings (
          id INT PRIMARY KEY,
          company_name VARCHAR(255) NULL,
          phone_1 VARCHAR(50) NULL,
          phone_2 VARCHAR(50) NULL,
          landline VARCHAR(50) NULL,
          whatsapp VARCHAR(50) NULL,
          address TEXT NULL,
          description TEXT NULL,
          maps_url TEXT NULL,
          whatsapp_business VARCHAR(255) NULL,
          instagram_url VARCHAR(255) NULL,
          email VARCHAR(255) NULL,
          updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id CHAR(36) PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          description TEXT NULL,
          image_url TEXT NULL,
          created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS products (
          id CHAR(36) PRIMARY KEY,
          category_id CHAR(36) NULL,
          name VARCHAR(255) NOT NULL,
          description TEXT NULL,
          price DECIMAL(15, 2) NULL,
          currency VARCHAR(20) NULL,
          show_price TINYINT(1) DEFAULT 0,
          image_url TEXT NULL,
          available TINYINT(1) DEFAULT 1,
          created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS product_images (
          id CHAR(36) PRIMARY KEY,
          product_id CHAR(36) NOT NULL,
          image_url TEXT NOT NULL,
          created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id CHAR(36) PRIMARY KEY,
          customer_name VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          whatsapp VARCHAR(50) NULL,
          address TEXT NOT NULL,
          notes TEXT NULL,
          status VARCHAR(50) DEFAULT 'new',
          created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS order_items (
          id CHAR(36) PRIMARY KEY,
          order_id CHAR(36) NOT NULL,
          product_name VARCHAR(255) NOT NULL,
          quantity INT DEFAULT 1,
          price DECIMAL(15, 2) NULL,
          currency VARCHAR(20) NULL
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS oracle_invoices (
          id CHAR(36) PRIMARY KEY,
          invoice_number VARCHAR(100) NOT NULL UNIQUE,
          doc_type VARCHAR(50) NOT NULL DEFAULT 'cash_invoice',
          customer_code VARCHAR(80) NULL,
          customer_name VARCHAR(255) NOT NULL,
          phone VARCHAR(50) NOT NULL,
          invoice_date VARCHAR(20) NOT NULL,
          amount DECIMAL(15, 2) NOT NULL DEFAULT 0.00,
          currency VARCHAR(20) DEFAULT 'ر.س',
          remaining_balance DECIMAL(15, 2) NULL,
          payment_method VARCHAR(100) NULL,
          attachment_url TEXT NULL,
          onyx_form_code VARCHAR(50) NULL,
          details TEXT NULL,
          status VARCHAR(30) DEFAULT 'pending',
          whatsapp_message_id VARCHAR(255) NULL,
          sent_at VARCHAR(40) NULL,
          created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS oracle_pdfs (
          invoice_number VARCHAR(100) PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) DEFAULT 'application/pdf',
          pdf_data LONGBLOB NOT NULL,
          size_bytes INT NOT NULL,
          created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS media_files (
          id CHAR(36) PRIMARY KEY,
          filename VARCHAR(255) NOT NULL,
          mime_type VARCHAR(100) NOT NULL,
          file_data LONGBLOB NOT NULL,
          size_bytes INT NOT NULL,
          created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_conversations (
          phone VARCHAR(50) PRIMARY KEY,
          customer_name VARCHAR(255) NULL,
          last_message_text TEXT NULL,
          last_message_type VARCHAR(30) DEFAULT 'text',
          last_message_direction VARCHAR(10) DEFAULT 'out',
          last_message_status VARCHAR(20) DEFAULT 'sent',
          last_message_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          last_inbound_at DATETIME(3) NULL,
          unread_count INT NOT NULL DEFAULT 0,
          created_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
          INDEX idx_wconv_last_at (last_message_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS whatsapp_messages (
          id CHAR(36) PRIMARY KEY,
          phone VARCHAR(50) NOT NULL,
          wa_message_id VARCHAR(255) NULL UNIQUE,
          direction VARCHAR(10) NOT NULL,
          msg_type VARCHAR(30) NOT NULL DEFAULT 'text',
          body TEXT NULL,
          media_id VARCHAR(255) NULL,
          media_url TEXT NULL,
          media_mime VARCHAR(120) NULL,
          media_filename VARCHAR(255) NULL,
          reply_to_wa_id VARCHAR(255) NULL,
          reply_preview TEXT NULL,
          template_name VARCHAR(120) NULL,
          status VARCHAR(20) NOT NULL DEFAULT 'sent',
          error_text TEXT NULL,
          created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
          updated_at DATETIME(3) DEFAULT CURRENT_TIMESTAMP(3),
          INDEX idx_wm_phone_time (phone, created_at)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
      `);
    })().catch((err) => {
      globalThis.__mbMysqlSchemaReady = undefined;
      throw err;
    });
  }

  await globalThis.__mbMysqlSchemaReady;
}

export async function queryRows<T extends RowDataPacket = RowDataPacket>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  await ensureMysqlSchema();
  const [rows] = await getMysqlPool().query<T[]>(sql, params);
  return rows;
}

export async function executeSql(
  sql: string,
  params: any[] = []
): Promise<ResultSetHeader> {
  await ensureMysqlSchema();
  const [result] = await getMysqlPool().execute<ResultSetHeader>(sql, params);
  return result;
}
