// Pure helper, kept out of lib/db.ts so it can be imported from client components without pulling in better-sqlite3.
export interface ProgressSummary {
    completed: number;
    total: number;
    percent: number;
}

export function calculateProgress(subtasks: { completed: boolean }[]): ProgressSummary {
    const total = subtasks.length;
    const completed = subtasks.filter((subtask) => subtask.completed).length;
    const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
    return { completed, total, percent };
}
