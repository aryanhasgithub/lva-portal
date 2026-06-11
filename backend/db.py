"""Database module for LVA Portal."""

import sqlite3

DB_NAME = "lva_logs.db"


def init_db():
    """Initializes the SQLite database and creates the logs table if it doesn't exist."""
    conn = sqlite3.connect(DB_NAME)
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            timestamp TEXT,
            service TEXT,
            message TEXT,
            PRIMARY KEY (timestamp, service)
        )
    """)
    conn.commit()
    conn.close()


def sync_save_log(timestamp: str, service: str, message: str):
    """Saves a log entry to the SQLite database."""
    try:
        conn = sqlite3.connect(DB_NAME)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO logs (timestamp, service, message) VALUES (?, ?, ?)",
            (timestamp, service, message),
        )
        conn.commit()
        conn.close()
    except sqlite3.IntegrityError:
        pass
    except Exception as e:  # pylint: disable=broad-exception-caught
        print(f"[DB ERROR] {e}")
