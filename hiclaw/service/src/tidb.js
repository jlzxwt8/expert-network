import mysql from "mysql2/promise";

const pool = mysql.createPool({
  uri: process.env.TIDB_DATABASE_URL,
  waitForConnections: true,
  connectionLimit: 10,
  ssl: { rejectUnauthorized: true },
});

export async function checkExpertStatus(expertId) {
  const [rows] = await pool.execute(
    "SELECT is_online, last_seen FROM expert_status WHERE expert_id = ?",
    [expertId]
  );
  if (rows.length === 0) return { isOnline: false, lastSeen: null };
  return { isOnline: !!rows[0].is_online, lastSeen: rows[0].last_seen };
}

export async function updateExpertStatus(expertId, isOnline) {
  await pool.execute(
    `INSERT INTO expert_status (expert_id, is_online, last_seen)
     VALUES (?, ?, NOW())
     ON DUPLICATE KEY UPDATE is_online = VALUES(is_online), last_seen = NOW()`,
    [expertId, isOnline]
  );
}

export async function createSession({ id, expertId, menteeId, query }) {
  await pool.execute(
    `INSERT INTO sessions (id, expert_id, mentee_id, query, status, created_at)
     VALUES (?, ?, ?, ?, 'pending', NOW())`,
    [id, expertId, menteeId, query]
  );
}

export async function updateSession(sessionId, data) {
  const sets = [];
  const values = [];
  for (const [key, value] of Object.entries(data)) {
    const col = key.replace(/([A-Z])/g, "_$1").toLowerCase();
    sets.push(`${col} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return;
  values.push(sessionId);
  await pool.execute(
    `UPDATE sessions SET ${sets.join(", ")} WHERE id = ?`,
    values
  );
}

export async function getSessionsByExpert(expertId, status) {
  const [rows] = await pool.execute(
    "SELECT * FROM sessions WHERE expert_id = ? AND status = ? ORDER BY created_at DESC",
    [expertId, status]
  );
  return rows;
}

export { pool };
