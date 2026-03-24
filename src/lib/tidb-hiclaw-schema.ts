/**
 * TiDB / MySQL DDL for HiClaw agent service (expert_status, sessions, waiting_room).
 * Applied via POST /api/admin/tidb from Vercel when local mysql client times out.
 */
export const HICLAW_TIDB_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS expert_status (
  expert_id VARCHAR(255) PRIMARY KEY,
  is_online BOOLEAN DEFAULT FALSE,
  last_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)`,
  `CREATE TABLE IF NOT EXISTS sessions (
  id VARCHAR(255) PRIMARY KEY,
  expert_id VARCHAR(255) NOT NULL,
  mentee_id VARCHAR(255) NOT NULL,
  query TEXT,
  status ENUM('pending', 'in_review', 'completed', 'cancelled') DEFAULT 'pending',
  on_chain_verified BOOLEAN DEFAULT FALSE,
  eas_attestation_uid VARCHAR(66) NULL,
  tx_hash VARCHAR(255),
  session_hash VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP NULL,
  INDEX idx_expert (expert_id),
  INDEX idx_mentee (mentee_id),
  INDEX idx_status (status)
)`,
  `ALTER TABLE sessions ADD COLUMN eas_attestation_uid VARCHAR(66) NULL`,
  `CREATE TABLE IF NOT EXISTS waiting_room (
  id VARCHAR(255) PRIMARY KEY,
  expert_id VARCHAR(255) NOT NULL,
  mentee_id VARCHAR(255) NOT NULL,
  session_id VARCHAR(255),
  draft TEXT,
  edited_response TEXT,
  status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_expert_status (expert_id, status)
)`,
] as const;
