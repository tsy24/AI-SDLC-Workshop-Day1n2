import test from 'node:test';
import assert from 'node:assert/strict';

import { formatSingaporeDate, getSingaporeNow } from '../lib/timezone';

test('timezone helpers produce Singapore-local values', () => {
    const now = getSingaporeNow();
    assert.ok(now instanceof Date);

    const formatted = formatSingaporeDate(now, 'yyyy-MM-dd');
    assert.match(formatted, /^\d{4}-\d{2}-\d{2}$/);
});
