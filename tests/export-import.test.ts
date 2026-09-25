import assert from 'node:assert/strict';
import test from 'node:test';

import { db, tagDB, todoDB, userDB } from '../lib/db';
import { importSchema, toCsv, toExportItem } from '../lib/export-import';

const validItem = {
    title: 'Ship export',
    completed: true,
    due_date: '2099-01-02T10:00:00+08:00',
    priority: 'high' as const,
    is_recurring: true,
    recurrence_pattern: 'weekly' as const,
    reminder_minutes: 60 as const,
    created_at: '2099-01-01T10:00:00+08:00',
    subtasks: [
        { title: 'Write tests', completed: true, position: 8 },
        { title: 'Ship code', completed: false, position: 8 },
    ],
    tags: [{ name: 'Work', color: '#FF0000' }],
};

test('toCsv emits the fixed columns and RFC 4180 escaped values', () => {
    const csv = toCsv([{
        id: 42,
        title: 'Buy milk, eggs, "bread"\nToday',
        completed: false,
        due_date: null,
        priority: 'medium',
        is_recurring: false,
        recurrence_pattern: null,
        reminder_minutes: null,
    }]);

    assert.equal(
        csv,
        'ID,Title,Completed,Due Date,Priority,Recurring,Pattern,Reminder\r\n' +
        '42,"Buy milk, eggs, ""bread""\nToday",false,,medium,false,,',
    );
});

test('importSchema accepts an export envelope and rejects invalid fields', () => {
    const payload = { version: 1, exported_at: '2099-01-01T02:00:00.000Z', todos: [validItem] };
    assert.equal(importSchema.safeParse(payload).success, true);

    for (const invalid of [
        { ...payload, version: 2 },
        { ...payload, todos: [{ ...validItem, priority: 'urgent' }] },
        { ...payload, todos: [{ ...validItem, completed: 'yes' }] },
        { ...payload, todos: [{ ...validItem, reminder_minutes: 20 }] },
        { ...payload, todos: [{ ...validItem, subtasks: undefined }] },
        { ...payload, todos: [{ ...validItem, due_date: 'not-a-date' }] },
        { ...payload, todos: [{ ...validItem, due_date: '1' }] },
        { ...payload, todos: [{ ...validItem, due_date: '2024-02-30T10:00:00+08:00' }] },
        { ...payload, todos: [{ ...validItem, due_date: '2024-02-29T10:00:00+99:99' }] },
        { ...payload, todos: [{ ...validItem, due_date: null }] },
        { ...payload, todos: [{ ...validItem, is_recurring: false }] },
        { ...payload, todos: [{ ...validItem, reminder_minutes: 60, due_date: null, is_recurring: false, recurrence_pattern: null }] },
        { ...payload, exported_at: 'yesterday' },
    ]) {
        assert.equal(importSchema.safeParse(invalid).success, false);
    }
});

test('importAll remaps relationships, normalizes positions, and reuses tags case-insensitively', (context) => {
    const user = userDB.create(`import-user-${Date.now()}-${Math.random()}`);
    context.after(() => db.prepare('DELETE FROM users WHERE id = ?').run(user.id));

    const existingTag = tagDB.create(user.id, { name: 'WORK', color: '#00FF00' });
    const result = todoDB.importAll(user.id, [
        {
            ...validItem,
            tags: [
                { name: 'work', color: '#FF0000' },
                { name: 'Personal', color: '#0000FF' },
            ],
        },
    ]);

    assert.deepEqual(result, { imported: 1, tagsCreated: 1, tagsReused: 1 });
    const [todo] = todoDB.findAllByUser(user.id);
    assert.equal(todo.title, validItem.title);
    assert.equal(todo.completed, true);
    assert.notEqual(todo.id, 0);

    const subtasks = db.prepare('SELECT todo_id, title, completed, position FROM subtasks WHERE todo_id = ? ORDER BY position').all(todo.id) as Array<{
        todo_id: number;
        title: string;
        completed: number;
        position: number;
    }>;
    assert.deepEqual(subtasks.map((subtask) => subtask.position), [0, 1]);
    assert.ok(subtasks.every((subtask) => subtask.todo_id === todo.id));

    const tags = tagDB.findByTodoId(todo.id, user.id);
    assert.equal(tags.length, 2);
    assert.equal(tags.find((tag) => tag.name === 'WORK')?.id, existingTag.id);
    assert.equal(tags.find((tag) => tag.name === 'WORK')?.color, '#00FF00');
});

test('findAllWithRelations exports only the requested user and omits database IDs from JSON items', (context) => {
    const user = userDB.create(`export-user-${Date.now()}-${Math.random()}`);
    const otherUser = userDB.create(`other-export-user-${Date.now()}-${Math.random()}`);
    context.after(() => db.prepare('DELETE FROM users WHERE id IN (?, ?)').run(user.id, otherUser.id));

    todoDB.importAll(user.id, [validItem]);
    todoDB.importAll(otherUser.id, [{ ...validItem, title: 'Private to another user' }]);

    const exported = todoDB.findAllWithRelations(user.id);
    assert.equal(exported.length, 1);
    assert.equal(exported[0].title, validItem.title);
    assert.equal(exported[0].subtasks.length, 2);
    assert.equal(exported[0].tags.length, 1);

    const item = toExportItem(exported[0]);
    assert.equal('id' in item, false);
    assert.equal('user_id' in item, false);
    assert.equal('id' in item.subtasks[0], false);
    assert.equal('id' in item.tags[0], false);
});

test('importAll rolls back every relation when an association fails', (context) => {
    const user = userDB.create(`rollback-user-${Date.now()}-${Math.random()}`);
    context.after(() => db.prepare('DELETE FROM users WHERE id = ?').run(user.id));
    context.after(() => db.exec('DROP TRIGGER IF EXISTS reject_blocked_import_tag'));

    db.exec(`
        CREATE TRIGGER reject_blocked_import_tag
        BEFORE INSERT ON todo_tags
        WHEN (SELECT name FROM tags WHERE id = NEW.tag_id) = 'Blocked'
        BEGIN
            SELECT RAISE(ABORT, 'blocked test tag');
        END
    `);

    assert.throws(() => todoDB.importAll(user.id, [{
        ...validItem,
        tags: [{ name: 'Blocked', color: '#123456' }],
    }]));

    assert.equal(todoDB.findAllByUser(user.id).length, 0);
    assert.equal(tagDB.findAllByUser(user.id).length, 0);
});