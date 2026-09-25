'use client';

import { useEffect, useMemo, useState } from 'react';

import { generateCalendarGrid, CalendarDay } from '@/lib/calendar';
import { formatSingaporeDate, getSingaporeNow } from '@/lib/timezone';

type Priority = 'high' | 'medium' | 'low';

interface CalendarTodo {
    id: number;
    title: string;
    due_date: string | null;
    priority: Priority;
    completed: boolean;
}

interface Holiday {
    id: number;
    date: string;
    name: string;
}

function currentMonthKey(): string {
    return formatSingaporeDate(getSingaporeNow(), 'yyyy-MM');
}

function parseMonthKey(value: string | null): string {
    if (value && /^\d{4}-\d{2}$/.test(value)) {
        const month = Number(value.slice(5));
        if (month >= 1 && month <= 12) return value;
    }
    return currentMonthKey();
}

function shiftMonth(monthKey: string, amount: number): string {
    const date = new Date(`${monthKey}-01T00:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + amount);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthKey: string): string {
    return new Intl.DateTimeFormat('en-SG', { month: 'long', year: 'numeric', timeZone: 'Asia/Singapore' })
        .format(new Date(`${monthKey}-01T00:00:00Z`));
}

function CalendarCell({
    day,
    todos,
    holiday,
    onSelect,
}: {
    day: CalendarDay;
    todos: CalendarTodo[];
    holiday?: Holiday;
    onSelect: (date: string) => void;
}) {
    const visibleTodos = todos.slice(0, 3);
    const overflow = todos.length - visibleTodos.length;

    return (
        <button
            type="button"
            className={`calendar-cell ${day.isCurrentMonth ? '' : 'outside-month'} ${day.isToday ? 'today' : ''} ${day.isPast ? 'past' : ''} ${day.isWeekend ? 'weekend' : ''}`}
            onClick={() => onSelect(day.date)}
        >
            <span className="calendar-date">{Number(day.date.slice(8))}</span>
            {holiday ? <span className="holiday-label">{holiday.name}</span> : null}
            <span className="calendar-todos">
                {visibleTodos.map((todo) => <span className={`calendar-todo priority-${todo.priority} ${todo.completed ? 'completed' : ''}`} key={todo.id}>{todo.title}</span>)}
            </span>
            {overflow > 0 ? <span className="calendar-overflow">+{overflow} more</span> : null}
        </button>
    );
}

export default function CalendarPage() {
    const [monthKey, setMonthKey] = useState(() => currentMonthKey());
    const [todos, setTodos] = useState<CalendarTodo[]>([]);
    const [holidays, setHolidays] = useState<Holiday[]>([]);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const [error, setError] = useState('');
    const [year, month] = monthKey.split('-').map(Number);
    const grid = useMemo(() => generateCalendarGrid(year, month), [year, month]);

    useEffect(() => {
        setMonthKey(parseMonthKey(new URLSearchParams(window.location.search).get('month')));
    }, []);

    useEffect(() => {
        let active = true;
        async function loadCalendar() {
            try {
                const [todoResponse, holidayResponse] = await Promise.all([
                    fetch('/api/todos'),
                    fetch(`/api/holidays?year=${year}&month=${month}`),
                ]);
                const todoPayload = await todoResponse.json();
                const holidayPayload = await holidayResponse.json();
                if (!todoResponse.ok) throw new Error(todoPayload.error ?? 'Unable to load calendar todos');
                if (!holidayResponse.ok) throw new Error(holidayPayload.error ?? 'Unable to load holidays');
                if (active) {
                    setTodos(todoPayload);
                    setHolidays(holidayPayload.holidays ?? []);
                }
            } catch (loadError) {
                if (active) setError(loadError instanceof Error ? loadError.message : 'Unable to load calendar');
            }
        }
        void loadCalendar();
        return () => { active = false; };
    }, [year, month]);

    useEffect(() => {
        if (!selectedDate) return;
        function handleEscape(event: KeyboardEvent) {
            if (event.key === 'Escape') setSelectedDate(null);
        }
        window.addEventListener('keydown', handleEscape);
        return () => window.removeEventListener('keydown', handleEscape);
    }, [selectedDate]);

    function navigate(nextMonthKey: string) {
        setSelectedDate(null);
        setMonthKey(nextMonthKey);
        window.history.replaceState({}, '', `/calendar?month=${nextMonthKey}`);
    }

    const todosByDate = new Map<string, CalendarTodo[]>();
    for (const todo of todos) {
        if (!todo.due_date) continue;
            const date = formatSingaporeDate(todo.due_date, 'yyyy-MM-dd');
        todosByDate.set(date, [...(todosByDate.get(date) ?? []), todo]);
    }
    const holidayByDate = new Map(holidays.map((holiday) => [holiday.date, holiday]));
    const selectedTodos = selectedDate ? (todosByDate.get(selectedDate) ?? []) : [];
    const selectedHoliday = selectedDate ? holidayByDate.get(selectedDate) : undefined;

    return (
        <main className="calendar-shell">
            <header className="calendar-header">
                <div>
                    <a className="back-link" href="/">Back to task list</a>
                    <p className="eyebrow">Plan the shape of your month</p>
                    <h1>{monthLabel(monthKey)}</h1>
                </div>
                <div className="calendar-nav">
                    <button type="button" onClick={() => navigate(shiftMonth(monthKey, -1))} aria-label="Previous month">Previous</button>
                    <button type="button" className="today-button" onClick={() => navigate(currentMonthKey())}>Today</button>
                    <button type="button" onClick={() => navigate(shiftMonth(monthKey, 1))} aria-label="Next month">Next</button>
                </div>
            </header>
            {error ? <p className="error-banner" role="alert">{error}</p> : null}
            <div className="calendar-board">
                <div className="weekday-row">{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => <span key={day}>{day}</span>)}</div>
                <div className="calendar-grid">
                    {grid.map((day) => <CalendarCell key={day.date} day={day} todos={todosByDate.get(day.date) ?? []} holiday={holidayByDate.get(day.date)} onSelect={setSelectedDate} />)}
                </div>
            </div>
            {selectedDate ? <div className="calendar-modal-backdrop" role="presentation" onClick={() => setSelectedDate(null)}>
                <section className="day-modal" role="dialog" aria-modal="true" aria-label={`Todos for ${selectedDate}`} onClick={(event) => event.stopPropagation()}>
                    <div className="day-modal-header"><div><span className="section-kicker">Day detail</span><h2>{selectedDate}</h2></div><button autoFocus type="button" className="ghost-button" onClick={() => setSelectedDate(null)} aria-label="Close day details">✕</button></div>
                    {selectedHoliday ? <p className="day-holiday">{selectedHoliday.name}</p> : null}
                    {selectedTodos.length > 0 ? <ul className="day-todo-list">{selectedTodos.map((todo) => <li key={todo.id}><span className={`calendar-todo priority-${todo.priority} ${todo.completed ? 'completed' : ''}`}>{todo.title}</span><span>{todo.completed ? 'Completed' : 'Open'}</span></li>)}</ul> : <p className="empty-day">Nothing due on this day.</p>}
                </section>
            </div> : null}
        </main>
    );
}
