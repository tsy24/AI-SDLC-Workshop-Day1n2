import fs from 'node:fs';
import path from 'node:path';

import Database from 'better-sqlite3';

const dbPath = path.join(process.cwd(), 'todos.db');

if (!fs.existsSync(dbPath)) {
    fs.writeFileSync(dbPath, '');
}

export const db = new Database(dbPath);
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS authenticators (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    credential_id TEXT UNIQUE NOT NULL,
    credential_public_key BLOB NOT NULL,
    counter INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS auth_challenges (
    username TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('registration', 'authentication')),
    challenge TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    PRIMARY KEY (username, kind)
  );

  CREATE TABLE IF NOT EXISTS todos (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    due_date TEXT,
    priority TEXT NOT NULL DEFAULT 'medium',
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    reminder_minutes INTEGER,
    last_notification_sent TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT
  );

  CREATE TABLE IF NOT EXISTS subtasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    completed INTEGER NOT NULL DEFAULT 0,
    position INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    color TEXT NOT NULL DEFAULT '#3B82F6',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_id, name)
  );

  CREATE TABLE IF NOT EXISTS todo_tags (
    todo_id INTEGER NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (todo_id, tag_id)
  );

  CREATE TABLE IF NOT EXISTS templates (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    category TEXT,
    title_template TEXT NOT NULL,
    priority TEXT NOT NULL DEFAULT 'medium',
    is_recurring INTEGER NOT NULL DEFAULT 0,
    recurrence_pattern TEXT,
    reminder_minutes INTEGER,
    due_date_offset_minutes INTEGER,
    subtasks_json TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS holidays (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    date TEXT NOT NULL,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE UNIQUE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);
  CREATE INDEX IF NOT EXISTS idx_authenticators_user_id ON authenticators(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_user_id ON todos(user_id);
  CREATE INDEX IF NOT EXISTS idx_todos_due_date ON todos(due_date);
  CREATE INDEX IF NOT EXISTS idx_subtasks_todo_id ON subtasks(todo_id);
  CREATE INDEX IF NOT EXISTS idx_tags_user_id ON tags(user_id);
  CREATE INDEX IF NOT EXISTS idx_todo_tags_tag_id ON todo_tags(tag_id);
  CREATE INDEX IF NOT EXISTS idx_templates_user_id ON templates(user_id);
`);

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';

export const PRIORITY_VALUES: Priority[] = ['high', 'medium', 'low'];
export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

export interface User {
    id: number;
    username: string;
    created_at: string;
}

export interface Authenticator {
    id: number;
    user_id: number;
    credential_id: string;
    credential_public_key: Buffer;
    counter: number;
    created_at: string;
}

export interface AuthChallenge {
    username: string;
    kind: 'registration' | 'authentication';
    challenge: string;
    expires_at: number;
}

export interface Todo {
    id: number;
    user_id: number;
    title: string;
    completed: boolean;
    due_date: string | null;
    priority: Priority;
    is_recurring: boolean;
    recurrence_pattern: RecurrencePattern | null;
    reminder_minutes: number | null;
    last_notification_sent: string | null;
    created_at: string;
    updated_at: string | null;
}

export interface CreateTodoInput {
    user_id: number;
    title: string;
    due_date?: string | null;
    priority?: Priority;
}

export interface UpdateTodoInput {
    title?: string;
    due_date?: string | null;
    priority?: Priority;
    completed?: boolean;
}

export interface Subtask {
    id: number;
    todo_id: number;
    title: string;
    completed: boolean;
    position: number;
    created_at: string;
}

export interface Tag {
    id: number;
    user_id: number;
    name: string;
    color: string;
    created_at: string;
}

export interface Template {
    id: number;
    user_id: number;
    name: string;
    description: string | null;
    category: string | null;
    title_template: string;
    priority: Priority;
    is_recurring: boolean;
    recurrence_pattern: RecurrencePattern | null;
    reminder_minutes: number | null;
    due_date_offset_minutes: number | null;
    subtasks_json: string | null;
    created_at: string;
}

export interface Holiday {
    id: number;
    date: string;
    name: string;
}

export const userDB = {
    create(username: string) {
        const stmt = db.prepare('INSERT INTO users (username) VALUES (?)');
        const info = stmt.run(username.trim());
        return db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid) as User;
    },
    findByUsername(username: string) {
        return db
            .prepare('SELECT * FROM users WHERE username = ?')
            .get(username) as User | undefined;
    },
    findById(id: number) {
        return db.prepare('SELECT * FROM users WHERE id = ?').get(id) as User | undefined;
    },
};

export const authenticatorDB = {
    create(userId: number, credentialId: string, credentialPublicKey: Buffer, counter: number) {
        const stmt = db.prepare(
            'INSERT INTO authenticators (user_id, credential_id, credential_public_key, counter) VALUES (?, ?, ?, ?)',
        );
        const info = stmt.run(userId, credentialId, credentialPublicKey, counter ?? 0);
        return db.prepare('SELECT * FROM authenticators WHERE id = ?').get(info.lastInsertRowid) as Authenticator;
    },
    findByCredentialId(credentialId: string) {
        return db
            .prepare('SELECT * FROM authenticators WHERE credential_id = ?')
            .get(credentialId) as Authenticator | undefined;
    },
    updateCounter(id: number, counter: number) {
        db.prepare('UPDATE authenticators SET counter = ? WHERE id = ?').run(counter, id);
    },
    findByUserId(userId: number) {
        return db
            .prepare('SELECT * FROM authenticators WHERE user_id = ? ORDER BY id')
            .all(userId) as Authenticator[];
    },
};

export const challengeDB = {
    save(username: string, kind: AuthChallenge['kind'], challenge: string, expiresAt: number) {
        db.prepare(`
      INSERT INTO auth_challenges (username, kind, challenge, expires_at)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(username, kind) DO UPDATE SET
        challenge = excluded.challenge,
        expires_at = excluded.expires_at
    `).run(username, kind, challenge, expiresAt);
    },
    find(username: string, kind: AuthChallenge['kind']) {
        const challenge = db
            .prepare('SELECT * FROM auth_challenges WHERE username = ? AND kind = ?')
            .get(username, kind) as AuthChallenge | undefined;
        if (!challenge || challenge.expires_at < Date.now()) {
            return null;
        }
        return challenge.challenge;
    },
    delete(username: string, kind: AuthChallenge['kind']) {
        db.prepare('DELETE FROM auth_challenges WHERE username = ? AND kind = ?').run(username, kind);
    },
};

function mapTodo(row: Record<string, unknown>): Todo {
    return {
        ...(row as Omit<Todo, 'completed'>),
        completed: Boolean(row.completed),
    } as Todo;
}

export const todoDB = {
    create(input: CreateTodoInput) {
        const result = db.prepare(`
      INSERT INTO todos (user_id, title, due_date, priority)
      VALUES (@user_id, @title, @due_date, @priority)
    `).run({
            user_id: input.user_id,
            title: input.title,
            due_date: input.due_date ?? null,
            priority: input.priority ?? 'medium',
        });
        return this.findById(Number(result.lastInsertRowid)) as Todo;
    },
    findAllByUser(userId: number, priority?: Priority) {
        const query = priority
            ? `SELECT * FROM todos WHERE user_id = ? AND priority = ?
               ORDER BY completed ASC,
                 CASE WHEN completed = 0 THEN CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ELSE 0 END ASC,
                 CASE WHEN completed = 0 THEN due_date IS NULL ELSE 0 END ASC,
                 CASE WHEN completed = 0 THEN due_date END ASC,
                 created_at DESC`
            : `SELECT * FROM todos WHERE user_id = ?
               ORDER BY completed ASC,
                 CASE WHEN completed = 0 THEN CASE priority WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END ELSE 0 END ASC,
                 CASE WHEN completed = 0 THEN due_date IS NULL ELSE 0 END ASC,
                 CASE WHEN completed = 0 THEN due_date END ASC,
                 created_at DESC`;
        const rows = (priority ? db.prepare(query).all(userId, priority) : db.prepare(query).all(userId)) as Record<string, unknown>[];
        return rows.map(mapTodo);
    },
    findById(id: number) {
        const row = db.prepare('SELECT * FROM todos WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        return row ? mapTodo(row) : undefined;
    },
    update(id: number, input: UpdateTodoInput) {
        const fields: string[] = [];
        const values: Record<string, string | number | null> = { id };
        if (input.title !== undefined) { fields.push('title = @title'); values.title = input.title; }
        if (input.due_date !== undefined) { fields.push('due_date = @due_date'); values.due_date = input.due_date; }
        if (input.priority !== undefined) { fields.push('priority = @priority'); values.priority = input.priority; }
        if (input.completed !== undefined) { fields.push('completed = @completed'); values.completed = input.completed ? 1 : 0; }
        if (fields.length === 0) return this.findById(id);
        fields.push("updated_at = datetime('now')");
        db.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = @id`).run(values);
        return this.findById(id);
    },
    delete(id: number) {
        db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    },
};

export function ensureDatabaseReady() {
    return db;
}
