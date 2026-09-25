import { spawnSync } from 'node:child_process';
import path from 'node:path';

const testFiles = [
    'tests/calendar.test.ts',
    'tests/export-import.test.ts',
    'tests/tags.test.ts',
    'tests/timezone.test.ts',
];
const tsxCli = path.join(process.cwd(), 'node_modules', 'tsx', 'dist', 'cli.mjs');

for (const testFile of testFiles) {
    const result = spawnSync(process.execPath, [tsxCli, '--test', testFile], {
        cwd: process.cwd(),
        env: process.env,
        stdio: 'inherit',
    });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status ?? 1);
}