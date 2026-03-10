import Database from 'better-sqlite3';
import { env } from './env.js';

const db: Database.Database = new Database(env.DB_PATH);

// Set pragmas for better performance and safety
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS services (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    domain TEXT NOT NULL,
    repositoryUrl TEXT NOT NULL,
    branch TEXT NOT NULL,
    deployMode TEXT NOT NULL,
    selectedCommit TEXT,
    containerName TEXT NOT NULL,
    port TEXT, -- Store as JSON string
    volumeName TEXT NOT NULL,
    autoBackup INTEGER NOT NULL DEFAULT 1, -- Store as 0 or 1
    enabled INTEGER NOT NULL DEFAULT 1     -- Store as 0 or 1
  );

  CREATE TABLE IF NOT EXISTS deploy_history (
    id TEXT PRIMARY KEY,
    serviceId TEXT NOT NULL,
    commitHash TEXT NOT NULL,
    timestamp TEXT NOT NULL,
    result TEXT NOT NULL,
    logs TEXT,
    FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS backup_history (
    id TEXT PRIMARY KEY,
    serviceId TEXT NOT NULL,
    file TEXT NOT NULL,
    createdAt TEXT NOT NULL,
    size INTEGER NOT NULL,
    FOREIGN KEY (serviceId) REFERENCES services(id) ON DELETE CASCADE
  );
`);

export default db;
