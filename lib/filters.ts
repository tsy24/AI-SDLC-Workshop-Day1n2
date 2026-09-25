import type { Priority } from '@/lib/db';
import { getSingaporeNow } from '@/lib/timezone';

export interface FilterableTodo {
    id: number;
    title: string;
    completed: boolean;
    due_date: string | null;
    priority: Priority;
    subtasks?: { title: string }[];
    tags?: { id: number }[];
}

export interface FilterState {
    search: string;
    priority: Priority | 'all';
    tagId: number | 'all';
    completion: 'all' | 'incomplete' | 'completed';
    dueDateFrom: string | null;
    dueDateTo: string | null;
}

export const DEFAULT_FILTER_STATE: FilterState = {
    search: '',
    priority: 'all',
    tagId: 'all',
    completion: 'all',
    dueDateFrom: null,
    dueDateTo: null,
};

export function hasActiveFilters(filters: FilterState): boolean {
    return (
        filters.search.trim() !== '' ||
        filters.priority !== 'all' ||
        filters.tagId !== 'all' ||
        filters.completion !== 'all' ||
        filters.dueDateFrom !== null ||
        filters.dueDateTo !== null
    );
}

// Filters combine with AND logic in this order: search -> priority -> tag -> completion -> date range.
export function applyFilters<T extends FilterableTodo>(todos: T[], filters: FilterState): T[] {
    let result = todos;

    const query = filters.search.trim().toLowerCase();
    if (query) {
        result = result.filter((todo) => {
            if (todo.title.toLowerCase().includes(query)) return true;
            return (todo.subtasks ?? []).some((subtask) => subtask.title.toLowerCase().includes(query));
        });
    }

    if (filters.priority !== 'all') {
        result = result.filter((todo) => todo.priority === filters.priority);
    }

    if (filters.tagId !== 'all') {
        result = result.filter((todo) => (todo.tags ?? []).some((tag) => tag.id === filters.tagId));
    }

    if (filters.completion === 'incomplete') {
        result = result.filter((todo) => !todo.completed);
    } else if (filters.completion === 'completed') {
        result = result.filter((todo) => todo.completed);
    }

    if (filters.dueDateFrom || filters.dueDateTo) {
        result = result.filter((todo) => {
            if (!todo.due_date) return false;
            const due = todo.due_date.slice(0, 10);
            if (filters.dueDateFrom && due < filters.dueDateFrom) return false;
            if (filters.dueDateTo && due > filters.dueDateTo) return false;
            return true;
        });
    }

    return result;
}

export interface FilterPreset {
    id: string;
    name: string;
    filters: FilterState;
    createdAt: string;
}

const PRESETS_KEY = 'todo-app:filter-presets';

export function loadPresets(): FilterPreset[] {
    try {
        const raw = localStorage.getItem(PRESETS_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.error('Failed to load filter presets:', error);
        return [];
    }
}

export function createPreset(name: string, filters: FilterState): FilterPreset {
    return {
        id: crypto.randomUUID(),
        name,
        filters,
        createdAt: getSingaporeNow().toISOString(),
    };
}

export function savePreset(preset: FilterPreset): FilterPreset[] {
    const presets = [...loadPresets(), preset];
    try {
        localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    } catch (error) {
        console.error('Failed to save filter preset:', error);
        throw new Error('Could not save preset — storage full');
    }
    return presets;
}

export function deletePreset(id: string): FilterPreset[] {
    const presets = loadPresets().filter((preset) => preset.id !== id);
    localStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
    return presets;
}
