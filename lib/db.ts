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

const todoColumns = new Set(
    (db.prepare('PRAGMA table_info(todos)').all() as Array<{ name: string }>).map((column) => column.name),
);
const todoMigrations: Array<[string, string]> = [
    ['is_recurring', 'ALTER TABLE todos ADD COLUMN is_recurring INTEGER NOT NULL DEFAULT 0'],
    ['recurrence_pattern', 'ALTER TABLE todos ADD COLUMN recurrence_pattern TEXT'],
    ['reminder_minutes', 'ALTER TABLE todos ADD COLUMN reminder_minutes INTEGER'],
    ['last_notification_sent', 'ALTER TABLE todos ADD COLUMN last_notification_sent TEXT'],
];
for (const [column, statement] of todoMigrations) {
    if (!todoColumns.has(column)) db.exec(statement);
}

export type Priority = 'high' | 'medium' | 'low';
export type RecurrencePattern = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ReminderMinutes = 15 | 30 | 60 | 120 | 1440 | 2880 | 10080;

export const PRIORITY_VALUES: Priority[] = ['high', 'medium', 'low'];
export const PRIORITY_ORDER: Record<Priority, number> = { high: 0, medium: 1, low: 2 };
export const RECURRENCE_VALUES: RecurrencePattern[] = ['daily', 'weekly', 'monthly', 'yearly'];
export const REMINDER_VALUES: ReminderMinutes[] = [15, 30, 60, 120, 1440, 2880, 10080];
export const REMINDER_LABELS: Record<ReminderMinutes, string> = {
    15: '15m', 30: '30m', 60: '1h', 120: '2h', 1440: '1d', 2880: '2d', 10080: '1w',
};

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
    is_recurring?: boolean;
    recurrence_pattern?: RecurrencePattern | null;
    reminder_minutes?: ReminderMinutes | null;
}

export interface UpdateTodoInput {
    title?: string;
    due_date?: string | null;
    priority?: Priority;
    completed?: boolean;
    is_recurring?: boolean;
    recurrence_pattern?: RecurrencePattern | null;
    reminder_minutes?: ReminderMinutes | null;
    last_notification_sent?: string | null;
}

export interface Subtask {
    id: number;
    todo_id: number;
    title: string;
    completed: boolean;
    position: number;
    created_at: string;
}

export interface CreateSubtaskDto {
    title: string;
}

export interface UpdateSubtaskDto {
    title?: string;
    completed?: boolean;
}

export interface Tag {
    id: number;
    user_id: number;
    name: string;
    color: string;
    created_at: string;
}

export interface CreateTagInput {
    name: string;
    color?: string;
}

export interface UpdateTagInput {
    name?: string;
    color?: string;
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
    created_at?: string;
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
        is_recurring: Boolean(row.is_recurring),
    } as Todo;
}

export const todoDB = {
    create(input: CreateTodoInput) {
        const result = db.prepare(`
        INSERT INTO todos (user_id, title, due_date, priority, is_recurring, recurrence_pattern, reminder_minutes)
    VALUES (@user_id, @title, @due_date, @priority, @is_recurring, @recurrence_pattern, @reminder_minutes)
    `).run({
            user_id: input.user_id,
            title: input.title,
            due_date: input.due_date ?? null,
            priority: input.priority ?? 'medium',
            is_recurring: input.is_recurring ? 1 : 0,
            recurrence_pattern: input.recurrence_pattern ?? null,
            reminder_minutes: input.reminder_minutes ?? null,
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
        if (input.is_recurring !== undefined) { fields.push('is_recurring = @is_recurring'); values.is_recurring = input.is_recurring ? 1 : 0; }
        if (input.recurrence_pattern !== undefined) { fields.push('recurrence_pattern = @recurrence_pattern'); values.recurrence_pattern = input.recurrence_pattern; }
        if (input.reminder_minutes !== undefined) { fields.push('reminder_minutes = @reminder_minutes'); values.reminder_minutes = input.reminder_minutes; }
        if (input.last_notification_sent !== undefined) { fields.push('last_notification_sent = @last_notification_sent'); values.last_notification_sent = input.last_notification_sent; }
        if ((input.due_date !== undefined || input.reminder_minutes !== undefined) && input.last_notification_sent === undefined) {
            fields.push('last_notification_sent = NULL');
        }
        if (fields.length === 0) return this.findById(id);
        fields.push("updated_at = datetime('now')");
        db.prepare(`UPDATE todos SET ${fields.join(', ')} WHERE id = @id`).run(values);
        return this.findById(id);
    },
    delete(id: number) {
        db.prepare('DELETE FROM todos WHERE id = ?').run(id);
    },
    completeAndCreateNext(id: number, update: UpdateTodoInput, nextDueDate: string) {
        return db.transaction(() => {
            const updated = this.update(id, update);
            if (!updated) return null;
            const nextInstance = this.create({
                user_id: updated.user_id,
                title: updated.title,
                due_date: nextDueDate,
                priority: updated.priority,
                is_recurring: true,
                recurrence_pattern: updated.recurrence_pattern,
                reminder_minutes: updated.reminder_minutes as ReminderMinutes | null,
            });
            db.prepare(`
                INSERT INTO todo_tags (todo_id, tag_id)
                SELECT ?, tag_id FROM todo_tags WHERE todo_id = ?
            `).run(nextInstance.id, id);
            return { todo: updated, nextInstance };
        })();
    },
    findDueReminders(userId: number, now: string) {
        const rows = db.prepare(`
            SELECT * FROM todos
            WHERE user_id = ?
              AND completed = 0
              AND due_date IS NOT NULL
              AND reminder_minutes IS NOT NULL
              AND last_notification_sent IS NULL
              AND datetime(due_date, '-' || reminder_minutes || ' minutes') <= datetime(?)
              AND datetime(?) <= datetime(due_date)
          `).all(userId, now, now) as Record<string, unknown>[];
        return rows.map(mapTodo);
    },
    markNotificationSent(id: number, userId: number, timestamp: string) {
        return db.prepare(`
            UPDATE todos SET last_notification_sent = ?
            WHERE id = ? AND user_id = ? AND completed = 0 AND last_notification_sent IS NULL
        `).run(timestamp, id, userId).changes > 0;
    },
};

function mapSubtask(row: Record<string, unknown>): Subtask {
    return {
        ...(row as Omit<Subtask, 'completed'>),
        completed: Boolean(row.completed),
    } as Subtask;
}

export const subtaskDB = {
    findByTodoId(todoId: number) {
        const rows = db
            .prepare('SELECT * FROM subtasks WHERE todo_id = ? ORDER BY position ASC')
            .all(todoId) as Record<string, unknown>[];
        return rows.map(mapSubtask);
    },
    findById(id: number) {
        const row = db.prepare('SELECT * FROM subtasks WHERE id = ?').get(id) as Record<string, unknown> | undefined;
        return row ? mapSubtask(row) : undefined;
    },
    create(todoId: number, data: CreateSubtaskDto) {
        // gaps from deletes are fine; only the next position needs to be unique
        const { maxPosition } = db
            .prepare('SELECT COALESCE(MAX(position), -1) AS maxPosition FROM subtasks WHERE todo_id = ?')
            .get(todoId) as { maxPosition: number };
        const info = db
            .prepare('INSERT INTO subtasks (todo_id, title, position) VALUES (?, ?, ?)')
            .run(todoId, data.title, maxPosition + 1);
        return this.findById(Number(info.lastInsertRowid)) as Subtask;
    },
    update(id: number, data: UpdateSubtaskDto) {
        const fields: string[] = [];
        const values: Record<string, string | number | null> = { id };
        if (data.title !== undefined) { fields.push('title = @title'); values.title = data.title; }
        if (data.completed !== undefined) { fields.push('completed = @completed'); values.completed = data.completed ? 1 : 0; }
        if (fields.length === 0) return this.findById(id);
        db.prepare(`UPDATE subtasks SET ${fields.join(', ')} WHERE id = @id`).run(values);
        return this.findById(id);
    },
    delete(id: number) {
        db.prepare('DELETE FROM subtasks WHERE id = ?').run(id);
    },
};

export const tagDB = {
    findAllByUser(userId: number) {
        return db
            .prepare('SELECT * FROM tags WHERE user_id = ? ORDER BY name COLLATE NOCASE ASC')
            .all(userId) as Tag[];
    },
    findById(id: number, userId: number) {
        return db
            .prepare('SELECT * FROM tags WHERE id = ? AND user_id = ?')
            .get(id, userId) as Tag | undefined;
    },
    findByTodoId(todoId: number, userId: number) {
        return db
            .prepare(`
                SELECT tags.*
                FROM tags
                INNER JOIN todo_tags ON todo_tags.tag_id = tags.id
                WHERE todo_tags.todo_id = ? AND tags.user_id = ?
                ORDER BY tags.name COLLATE NOCASE ASC
            `)
            .all(todoId, userId) as Tag[];
    },
    getTagIdsForTodo(todoId: number) {
        return db
            .prepare('SELECT tag_id FROM todo_tags WHERE todo_id = ? ORDER BY tag_id ASC')
            .all(todoId) as Array<{ tag_id: number }>;
    },
    create(userId: number, input: CreateTagInput) {
        const name = input.name.trim();
        const color = /^#[0-9A-Fa-f]{6}$/.test(input.color ?? '#3B82F6') ? (input.color ?? '#3B82F6') : '#3B82F6';
        const info = db
            .prepare('INSERT INTO tags (user_id, name, color) VALUES (?, ?, ?)')
            .run(userId, name, color);
        return this.findById(Number(info.lastInsertRowid), userId) as Tag;
    },
    update(id: number, userId: number, input: UpdateTagInput) {
        const fields: string[] = [];
        const values: Record<string, string | number> = { id, user_id: userId };
        if (input.name !== undefined) { fields.push('name = @name'); values.name = input.name.trim(); }
        if (input.color !== undefined) { fields.push('color = @color'); values.color = /^#[0-9A-Fa-f]{6}$/.test(input.color) ? input.color : '#3B82F6'; }
        if (fields.length === 0) return this.findById(id, userId);
        db.prepare(`UPDATE tags SET ${fields.join(', ')} WHERE id = @id AND user_id = @user_id`).run(values);
        return this.findById(id, userId) as Tag | undefined;
    },
    delete(id: number, userId: number) {
        const tag = this.findById(id, userId);
        if (!tag) return false;
        db.prepare('DELETE FROM tags WHERE id = ? AND user_id = ?').run(id, userId);
        return true;
    },
    attachToTodo(todoId: number, tagId: number, userId: number) {
        const tag = this.findById(tagId, userId);
        if (!tag) return false;
        db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
        return true;
    },
    detachFromTodo(todoId: number, tagId: number, userId: number) {
        const tag = this.findById(tagId, userId);
        if (!tag) return false;
        db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
        return true;
    },
    replaceTodoTags(todoId: number, tagIds: number[], userId: number) {
        const existingIds = this.getTagIdsForTodo(todoId).map(({ tag_id }) => tag_id);
        const validIds = new Set(tagIds.filter((tagId) => this.findById(tagId, userId) !== undefined));
        const toRemove = existingIds.filter((tagId) => !validIds.has(tagId));
        for (const tagId of toRemove) {
            db.prepare('DELETE FROM todo_tags WHERE todo_id = ? AND tag_id = ?').run(todoId, tagId);
        }
        for (const tagId of [...validIds]) {
            db.prepare('INSERT OR IGNORE INTO todo_tags (todo_id, tag_id) VALUES (?, ?)').run(todoId, tagId);
        }
        return this.findByTodoId(todoId, userId);
    },
};

export const holidayDB = {
    findAll() {
        return db.prepare('SELECT * FROM holidays ORDER BY date ASC').all() as Holiday[];
    },
    findByMonth(year: number, month: number) {
        const start = `${year}-${String(month).padStart(2, '0')}-01`;
        return db.prepare(`
            SELECT * FROM holidays
            WHERE date >= date(?, '-7 days')
              AND date < date(?, '+1 month', '+14 days')
            ORDER BY date ASC
        `).all(start, start) as Holiday[];
    },
};

export function ensureDatabaseReady() {
    return db;
}
