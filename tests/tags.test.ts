import test from 'node:test';
import assert from 'node:assert/strict';

import { tagDB, todoDB, userDB } from '../lib/db';

test('tags can be created and attached to a todo', () => {
    const user = userDB.create(`tag-user-${Date.now()}`);
    const todo = todoDB.create({
        user_id: user.id,
        title: 'Ship feature',
        priority: 'high',
        due_date: '2099-01-02T10:00:00+08:00',
    });

    const tag = tagDB.create(user.id, { name: 'work', color: '#FF0000' });
    tagDB.attachToTodo(todo.id, tag.id, user.id);

    const found = tagDB.findByTodoId(todo.id, user.id);
    assert.equal(found.length, 1);
    assert.equal(found[0].id, tag.id);
    assert.equal(found[0].name, 'work');
});
