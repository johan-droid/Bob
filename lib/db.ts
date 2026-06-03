import path from 'path';
import fs from 'fs';

let pgPool: any = null;
let sqliteDb: any = null;
let isPostgres = false;

function getDbConnection() {
  const dbUrl = process.env.DATABASE_URL || '';
  
  if (dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://')) {
    if (!pgPool) {
      const { Pool } = require('pg');
      // Set up pg connection pool
      pgPool = new Pool({
        connectionString: dbUrl,
        ssl: {
          rejectUnauthorized: false
        }
      });
      isPostgres = true;
    }
    return pgPool;
  } else {
    if (!sqliteDb) {
      const Database = require('better-sqlite3');
      // Resolve path for local SQLite db
      const dbPath = dbUrl.replace('sqlite:///', '') || path.join(process.cwd(), 'backend', 'bob.db');
      
      // Ensure the directory exists
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      sqliteDb = new Database(dbPath);
      sqliteDb.pragma('journal_mode = WAL');
      isPostgres = false;
    }
    return sqliteDb;
  }
}

// Convert PostgreSQL $1, $2 params to SQLite ? if needed
function prepareSql(sql: string): { sql: string; isPg: boolean } {
  const dbUrl = process.env.DATABASE_URL || '';
  const isPg = dbUrl.startsWith('postgres://') || dbUrl.startsWith('postgresql://');
  if (isPg) {
    return { sql, isPg: true };
  } else {
    // Replace $1, $2, etc with ?
    const sqliteSql = sql.replace(/\$\d+/g, '?');
    return { sql: sqliteSql, isPg: false };
  }
}

export async function query<T = any>(sql: string, params: any[] = []): Promise<T[]> {
  const conn = getDbConnection();
  const { sql: prepared, isPg } = prepareSql(sql);
  
  if (isPg) {
    const res = await conn.query(prepared, params);
    return res.rows;
  } else {
    const stmt = conn.prepare(prepared);
    return stmt.all(params) as T[];
  }
}

export async function get<T = any>(sql: string, params: any[] = []): Promise<T | null> {
  const conn = getDbConnection();
  const { sql: prepared, isPg } = prepareSql(sql);
  
  if (isPg) {
    const res = await conn.query(prepared, params);
    return res.rows[0] || null;
  } else {
    const stmt = conn.prepare(prepared);
    return (stmt.get(params) as T) || null;
  }
}

export async function run(sql: string, params: any[] = []): Promise<{ lastInsertRowId?: number | string; changes: number }> {
  const conn = getDbConnection();
  const { sql: prepared, isPg } = prepareSql(sql);
  
  if (isPg) {
    // For PostgreSQL INSERTs, we append RETURNING id to get the insert ID if applicable
    const res = await conn.query(prepared, params);
    const lastInsertRowId = res.rows[0]?.id;
    return { lastInsertRowId, changes: res.rowCount || 0 };
  } else {
    const stmt = conn.prepare(prepared);
    const info = stmt.run(params);
    return { lastInsertRowId: info.lastInsertRowid, changes: info.changes };
  }
}

export async function initDatabase() {
  const conn = getDbConnection();
  
  const createUsersTable = `
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      github_id INTEGER UNIQUE NOT NULL,
      username VARCHAR(255) UNIQUE NOT NULL,
      avatar VARCHAR(500),
      name VARCHAR(255),
      email VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_login TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      access_token VARCHAR(255)
    );
  `;
  
  const createUserReposTable = `
    CREATE TABLE IF NOT EXISTS user_repos (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      full_name VARCHAR(500) NOT NULL,
      private BOOLEAN DEFAULT FALSE,
      url VARCHAR(500),
      language VARCHAR(100) DEFAULT 'Unknown',
      permissions_level VARCHAR(50) DEFAULT 'read',
      agent_permission VARCHAR(50) DEFAULT 'none',
      archived BOOLEAN DEFAULT FALSE,
      fork BOOLEAN DEFAULT FALSE,
      last_synced TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_user_repo UNIQUE (user_id, full_name)
    );
  `;
  
  const createPrIssuesTable = `
    CREATE TABLE IF NOT EXISTS pr_issues (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      repo VARCHAR(500) NOT NULL,
      issue_key VARCHAR(500) UNIQUE NOT NULL,
      title VARCHAR(1000),
      url VARCHAR(500),
      branch VARCHAR(500),
      pr_number INTEGER,
      run_id VARCHAR(100),
      issue_type VARCHAR(50),
      status VARCHAR(50) DEFAULT 'pending',
      author VARCHAR(255),
      comment_sent BOOLEAN DEFAULT FALSE,
      last_commented_at TIMESTAMP,
      comment_count INTEGER DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_user_issue UNIQUE (user_id, issue_key)
    );
  `;

  const createPrScanStateTable = `
    CREATE TABLE IF NOT EXISTS pr_scan_state (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      repo VARCHAR(500) NOT NULL,
      pr_number INTEGER NOT NULL,
      head_sha VARCHAR(100),
      last_scanned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_scan_reason VARCHAR(100) DEFAULT 'unknown',
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT uq_pr_scan_state UNIQUE (user_id, repo, pr_number)
    );
  `;
  
  const createUserSettingsTable = `
    CREATE TABLE IF NOT EXISTS user_settings (
      id SERIAL PRIMARY KEY,
      user_id INTEGER UNIQUE NOT NULL,
      scan_interval INTEGER DEFAULT 300,
      excluded_repos TEXT DEFAULT '',
      notify_in_app BOOLEAN DEFAULT TRUE,
      push_subscription TEXT,
      slack_webhook VARCHAR(500),
      discord_webhook VARCHAR(500),
      auto_label_conflict BOOLEAN DEFAULT TRUE,
      tag_author_on_fail BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  const createMergeContractsTable = `
    CREATE TABLE IF NOT EXISTS merge_contracts (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      repo VARCHAR(255) NOT NULL,
      pr_number INTEGER NOT NULL,
      checklist_json TEXT,
      approved_by TEXT,
      approved_at TIMESTAMP,
      merge_method VARCHAR(20) DEFAULT 'squash',
      merged BOOLEAN DEFAULT FALSE,
      merged_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(repo, pr_number)
    );
  `;

  const createMergeLogsTable = `
    CREATE TABLE IF NOT EXISTS merge_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      repo VARCHAR(255) NOT NULL,
      pr_number INTEGER NOT NULL,
      merge_sha VARCHAR(64),
      merged_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      merge_method VARCHAR(20) DEFAULT 'squash'
    );
  `;

  const createAiReviewLogsTable = `
    CREATE TABLE IF NOT EXISTS ai_review_logs (
      id SERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL,
      repo VARCHAR(255) NOT NULL,
      pr_number INTEGER,
      run_id BIGINT,
      summary_preview TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  if (isPostgres) {
    // pg-specific adjustments (replace SERIAL with autoincrement integer for serial primary keys)
    await conn.query(createUsersTable.replace(/SERIAL PRIMARY KEY/g, 'SERIAL PRIMARY KEY'));
    await conn.query(createUserReposTable.replace(/SERIAL PRIMARY KEY/g, 'SERIAL PRIMARY KEY'));
    await conn.query(createPrIssuesTable.replace(/SERIAL PRIMARY KEY/g, 'SERIAL PRIMARY KEY'));
    await conn.query(createPrScanStateTable.replace(/SERIAL PRIMARY KEY/g, 'SERIAL PRIMARY KEY'));
    await conn.query(createUserSettingsTable.replace(/SERIAL PRIMARY KEY/g, 'SERIAL PRIMARY KEY'));
    await conn.query(createMergeContractsTable.replace(/SERIAL PRIMARY KEY/g, 'SERIAL PRIMARY KEY'));
    await conn.query(createMergeLogsTable.replace(/SERIAL PRIMARY KEY/g, 'SERIAL PRIMARY KEY'));
    await conn.query(createAiReviewLogsTable.replace(/SERIAL PRIMARY KEY/g, 'SERIAL PRIMARY KEY'));
  } else {
    // sqlite-specific adjustments (replace SERIAL with INTEGER PRIMARY KEY AUTOINCREMENT)
    const toSqlite = (sql: string) => sql
      .replace(/SERIAL PRIMARY KEY/g, 'INTEGER PRIMARY KEY AUTOINCREMENT')
      .replace(/TIMESTAMP DEFAULT CURRENT_TIMESTAMP/g, 'DATETIME DEFAULT CURRENT_TIMESTAMP')
      .replace(/TIMESTAMP/g, 'DATETIME')
      .replace(/BOOLEAN DEFAULT FALSE/g, 'INTEGER DEFAULT 0')
      .replace(/BOOLEAN DEFAULT TRUE/g, 'INTEGER DEFAULT 1');
      
    conn.exec(toSqlite(createUsersTable));
    conn.exec(toSqlite(createUserReposTable));
    conn.exec(toSqlite(createPrIssuesTable));
    conn.exec(toSqlite(createPrScanStateTable));
    conn.exec(toSqlite(createUserSettingsTable));
    conn.exec(toSqlite(createMergeContractsTable));
    conn.exec(toSqlite(createMergeLogsTable));
    conn.exec(toSqlite(createAiReviewLogsTable));
  }
}
