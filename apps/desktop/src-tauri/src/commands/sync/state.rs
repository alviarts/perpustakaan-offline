//! `sync_state` and `sync_log` helpers for FEAT-26 Sheets sync (PR G v1.0.8).
//!
//! `sync_state`: per-table cursor (last successful push/pull at + content
//! hash). `last_push_hash` lets us short-circuit pushes when the local data
//! has not changed since the last successful push — saving Sheets API quota.
//!
//! `sync_log`: append-only audit trail rendered in the Sinkronisasi page so
//! the operator can see what happened on the last cycle (push of `anggota`
//! at 14:32, 17 rows, ok). Capped to the last 100 rows in `prune_log`.

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};

use crate::error::AppResult;

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SyncStateRow {
    pub table_name: String,
    pub last_push_at: Option<String>,
    pub last_pull_at: Option<String>,
    pub last_push_hash: Option<String>,
    pub last_pull_hash: Option<String>,
    pub rows_pushed: i64,
    pub rows_pulled: i64,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SyncLogEntry {
    pub id: i64,
    pub ts: String,
    pub direction: String,
    pub table_name: String,
    pub status: String,
    pub rows_changed: i64,
    pub message: Option<String>,
}

/// Insert-or-update one `sync_state` row. Touches `updated_at`.
pub fn upsert_state(conn: &Connection, row: &SyncStateRow) -> AppResult<()> {
    conn.execute(
        "INSERT INTO sync_state (
            table_name, last_push_at, last_pull_at,
            last_push_hash, last_pull_hash, rows_pushed, rows_pulled, updated_at
         ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
         ON CONFLICT(table_name) DO UPDATE SET
            last_push_at   = excluded.last_push_at,
            last_pull_at   = excluded.last_pull_at,
            last_push_hash = excluded.last_push_hash,
            last_pull_hash = excluded.last_pull_hash,
            rows_pushed    = excluded.rows_pushed,
            rows_pulled    = excluded.rows_pulled,
            updated_at     = datetime('now')",
        rusqlite::params![
            row.table_name,
            row.last_push_at,
            row.last_pull_at,
            row.last_push_hash,
            row.last_pull_hash,
            row.rows_pushed,
            row.rows_pulled,
        ],
    )?;
    Ok(())
}

pub fn get_state(conn: &Connection, table_name: &str) -> AppResult<Option<SyncStateRow>> {
    let mut stmt = conn.prepare(
        "SELECT table_name, last_push_at, last_pull_at,
                last_push_hash, last_pull_hash, rows_pushed, rows_pulled, updated_at
           FROM sync_state
          WHERE table_name = ?1",
    )?;
    let row = stmt
        .query_row(rusqlite::params![table_name], |row| {
            Ok(SyncStateRow {
                table_name: row.get(0)?,
                last_push_at: row.get(1)?,
                last_pull_at: row.get(2)?,
                last_push_hash: row.get(3)?,
                last_pull_hash: row.get(4)?,
                rows_pushed: row.get(5)?,
                rows_pulled: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })
        .ok();
    Ok(row)
}

pub fn list_states(conn: &Connection) -> AppResult<Vec<SyncStateRow>> {
    let mut stmt = conn.prepare(
        "SELECT table_name, last_push_at, last_pull_at,
                last_push_hash, last_pull_hash, rows_pushed, rows_pulled, updated_at
           FROM sync_state
          ORDER BY table_name ASC",
    )?;
    let rows = stmt
        .query_map([], |row| {
            Ok(SyncStateRow {
                table_name: row.get(0)?,
                last_push_at: row.get(1)?,
                last_pull_at: row.get(2)?,
                last_push_hash: row.get(3)?,
                last_pull_hash: row.get(4)?,
                rows_pushed: row.get(5)?,
                rows_pulled: row.get(6)?,
                updated_at: row.get(7)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

pub fn append_log(
    conn: &Connection,
    direction: &str,
    table_name: &str,
    status: &str,
    rows_changed: i64,
    message: Option<&str>,
) -> AppResult<()> {
    conn.execute(
        "INSERT INTO sync_log (direction, table_name, status, rows_changed, message)
         VALUES (?1, ?2, ?3, ?4, ?5)",
        rusqlite::params![direction, table_name, status, rows_changed, message],
    )?;
    prune_log(conn)?;
    Ok(())
}

pub fn list_log(conn: &Connection, limit: i64) -> AppResult<Vec<SyncLogEntry>> {
    let mut stmt = conn.prepare(
        "SELECT id, ts, direction, table_name, status, rows_changed, message
           FROM sync_log
          ORDER BY id DESC
          LIMIT ?1",
    )?;
    let rows = stmt
        .query_map(rusqlite::params![limit], |row| {
            Ok(SyncLogEntry {
                id: row.get(0)?,
                ts: row.get(1)?,
                direction: row.get(2)?,
                table_name: row.get(3)?,
                status: row.get(4)?,
                rows_changed: row.get(5)?,
                message: row.get(6)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(rows)
}

/// Trim `sync_log` to the most recent 100 entries. Cheap because we run it
/// after every insert; the table never grows unbounded.
pub fn prune_log(conn: &Connection) -> AppResult<()> {
    conn.execute(
        "DELETE FROM sync_log
          WHERE id NOT IN (
             SELECT id FROM sync_log ORDER BY id DESC LIMIT 100
          )",
        [],
    )?;
    Ok(())
}

/// Stable content-hash for a list of rows. Used as the `last_push_hash` so a
/// second push with no local changes can short-circuit (status='noop',
/// no API call). SHA-256 hex; the leading-12-chars suffix is what we
/// expose in logs for human eyeballing.
pub fn rows_hash(rows: &[Vec<String>]) -> String {
    let mut hasher = Sha256::new();
    for row in rows {
        for cell in row {
            hasher.update(cell.as_bytes());
            hasher.update([0u8]);
        }
        hasher.update([0xffu8]);
    }
    let digest = hasher.finalize();
    hex::encode(digest)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn open_conn_with_sync_tables() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE sync_state (
                table_name      TEXT PRIMARY KEY,
                last_push_at    TEXT,
                last_pull_at    TEXT,
                last_push_hash  TEXT,
                last_pull_hash  TEXT,
                rows_pushed     INTEGER NOT NULL DEFAULT 0,
                rows_pulled     INTEGER NOT NULL DEFAULT 0,
                updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE sync_log (
                id           INTEGER PRIMARY KEY AUTOINCREMENT,
                ts           TEXT NOT NULL DEFAULT (datetime('now')),
                direction    TEXT NOT NULL CHECK (direction IN ('push','pull','test')),
                table_name   TEXT NOT NULL,
                status       TEXT NOT NULL CHECK (status IN ('ok','error','skipped','noop')),
                rows_changed INTEGER NOT NULL DEFAULT 0,
                message      TEXT
            );
            "#,
        )
        .unwrap();
        conn
    }

    #[test]
    fn upsert_state_inserts_then_updates() {
        let conn = open_conn_with_sync_tables();
        let row = SyncStateRow {
            table_name: "anggota".into(),
            last_push_at: Some("2025-01-01 00:00:00".into()),
            last_pull_at: None,
            last_push_hash: Some("abc".into()),
            last_pull_hash: None,
            rows_pushed: 5,
            rows_pulled: 0,
            updated_at: String::new(),
        };
        upsert_state(&conn, &row).unwrap();
        let got = get_state(&conn, "anggota").unwrap().unwrap();
        assert_eq!(got.last_push_hash.as_deref(), Some("abc"));
        assert_eq!(got.rows_pushed, 5);

        let row2 = SyncStateRow {
            last_push_hash: Some("def".into()),
            rows_pushed: 7,
            ..row
        };
        upsert_state(&conn, &row2).unwrap();
        let got2 = get_state(&conn, "anggota").unwrap().unwrap();
        assert_eq!(got2.last_push_hash.as_deref(), Some("def"));
        assert_eq!(got2.rows_pushed, 7);
    }

    #[test]
    fn list_states_returns_alphabetical_order() {
        let conn = open_conn_with_sync_tables();
        for tbl in &["buku", "anggota", "eksemplar"] {
            upsert_state(
                &conn,
                &SyncStateRow {
                    table_name: tbl.to_string(),
                    last_push_at: None,
                    last_pull_at: None,
                    last_push_hash: None,
                    last_pull_hash: None,
                    rows_pushed: 0,
                    rows_pulled: 0,
                    updated_at: String::new(),
                },
            )
            .unwrap();
        }
        let states = list_states(&conn).unwrap();
        assert_eq!(states.len(), 3);
        assert_eq!(states[0].table_name, "anggota");
        assert_eq!(states[1].table_name, "buku");
        assert_eq!(states[2].table_name, "eksemplar");
    }

    #[test]
    fn append_log_inserts_with_default_ts() {
        let conn = open_conn_with_sync_tables();
        append_log(&conn, "push", "anggota", "ok", 17, Some("ok msg")).unwrap();
        let rows = list_log(&conn, 10).unwrap();
        assert_eq!(rows.len(), 1);
        assert_eq!(rows[0].direction, "push");
        assert_eq!(rows[0].rows_changed, 17);
        assert_eq!(rows[0].message.as_deref(), Some("ok msg"));
        assert!(!rows[0].ts.is_empty());
    }

    #[test]
    fn append_log_caps_at_100_entries() {
        let conn = open_conn_with_sync_tables();
        for i in 0..105 {
            append_log(
                &conn,
                "push",
                "anggota",
                "ok",
                i,
                Some(&format!("entry {i}")),
            )
            .unwrap();
        }
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sync_log", [], |row| row.get(0))
            .unwrap();
        assert_eq!(count, 100);
        // most recent should still be present
        let rows = list_log(&conn, 1).unwrap();
        assert_eq!(rows[0].rows_changed, 104);
    }

    #[test]
    fn list_log_orders_newest_first() {
        let conn = open_conn_with_sync_tables();
        append_log(&conn, "push", "anggota", "ok", 1, Some("first")).unwrap();
        append_log(&conn, "push", "anggota", "ok", 2, Some("second")).unwrap();
        append_log(&conn, "push", "anggota", "ok", 3, Some("third")).unwrap();
        let rows = list_log(&conn, 10).unwrap();
        assert_eq!(rows.len(), 3);
        assert_eq!(rows[0].rows_changed, 3);
        assert_eq!(rows[2].rows_changed, 1);
    }

    #[test]
    fn rows_hash_is_deterministic() {
        let r1 = vec![
            vec!["A0001".to_string(), "Budi".to_string()],
            vec!["A0002".to_string(), "Sari".to_string()],
        ];
        let r2 = r1.clone();
        assert_eq!(rows_hash(&r1), rows_hash(&r2));
    }

    #[test]
    fn rows_hash_is_sensitive_to_changes() {
        let r1 = vec![vec!["A0001".to_string(), "Budi".to_string()]];
        let r2 = vec![vec!["A0001".to_string(), "Budi (changed)".to_string()]];
        assert_ne!(rows_hash(&r1), rows_hash(&r2));
    }

    #[test]
    fn rows_hash_distinguishes_row_boundary() {
        let r1 = vec![
            vec!["A".to_string(), "B".to_string()],
            vec!["C".to_string()],
        ];
        let r2 = vec![
            vec!["A".to_string()],
            vec!["B".to_string(), "C".to_string()],
        ];
        assert_ne!(rows_hash(&r1), rows_hash(&r2));
    }
}
