'use client';

import { useState, useEffect, useCallback } from 'react';

interface CalendarEvent {
  id: string;
  summary: string;
  start: { dateTime?: string; date?: string };
  end: { dateTime?: string; date?: string };
  description?: string;
  location?: string;
}

interface Props {
  onEventsChange: (events: CalendarEvent[]) => void;
}

export default function CalendarView({ onEventsChange }: Props) {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [errorCount, setErrorCount] = useState(0);
  const [editingCalendarId, setEditingCalendarId] = useState(false);

  const [daysBack, setDaysBack] = useState(30);
  const [daysForward, setDaysForward] = useState(30);

  const getCalendarId = useCallback(() => {
    try {
      return localStorage.getItem('cloudhelper.api-key.google-calendar-id') || '';
    } catch {
      return '';
    }
  }, []);

  const [calendarId, setCalendarId] = useState('');

  useEffect(() => {
    setCalendarId(getCalendarId());
  }, [getCalendarId]);

  // Load saved settings from localStorage on mount (client-side only)
  useEffect(() => {
    const savedDaysBack = localStorage.getItem('calendarDaysBack');
    const savedDaysForward = localStorage.getItem('calendarDaysForward');
    if (savedDaysBack) setDaysBack(parseInt(savedDaysBack));
    if (savedDaysForward) setDaysForward(parseInt(savedDaysForward));
  }, []);

  // Save settings to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('calendarDaysBack', daysBack.toString());
    localStorage.setItem('calendarDaysForward', daysForward.toString());
  }, [daysBack, daysForward]);

  useEffect(() => {
    if (calendarId) loadEvents();
  }, [daysBack, daysForward, calendarId]);

  const loadEvents = async () => {
    if (loading || !calendarId) return;
    if (errorCount >= 3) {
      console.log('Calendar fetch error limit reached, stopping retries');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?calendarId=${encodeURIComponent(calendarId)}&daysBack=${daysBack}&daysForward=${daysForward}`);

      if (!res.ok) {
        const text = await res.text();
        console.error('Calendar API error response:', text.substring(0, 200));
        setErrorCount(prev => prev + 1);
        throw new Error(`API returned ${res.status}: ${text.substring(0, 100)}`);
      }

      const data = await res.json();

      if (data.error) {
        console.error('Calendar error:', data.error);
        setErrorCount(prev => prev + 1);
      } else if (data.events) {
        setEvents(data.events);
        onEventsChange(data.events);
        setErrorCount(0);
      }
    } catch (error: any) {
      console.error('Failed to load calendar:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveCalendarId = (id: string) => {
    try {
      localStorage.setItem('cloudhelper.api-key.google-calendar-id', id);
      setCalendarId(id);
    } catch {
      // ignore
    }
  };

  const formatDate = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date;
    if (!start) return '';
    
    const date = new Date(start);
    return date.toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  };

  const getDateKey = (event: CalendarEvent) => {
    const start = event.start.dateTime || event.start.date;
    if (!start) return '';
    const date = new Date(start);
    return date.toDateString();
  };

  const groupEventsByDay = () => {
    const grouped: { [key: string]: CalendarEvent[] } = {};
    events.forEach(event => {
      const key = getDateKey(event);
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(event);
    });
    return Object.entries(grouped).sort((a, b) => new Date(a[0]).getTime() - new Date(b[0]).getTime());
  };

  const formatTime = (event: CalendarEvent) => {
    if (event.start.date) return 'All day';
    if (!event.start.dateTime) return '';
    
    const start = new Date(event.start.dateTime);
    const end = event.end.dateTime ? new Date(event.end.dateTime) : null;
    
    const startTime = start.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' });
    const endTime = end ? end.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) : '';
    
    return endTime ? `${startTime} - ${endTime}` : startTime;
  };

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-gray-900">
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-white">📅 CloudHelper Calendar</h2>
          <div className="flex items-center gap-2">
            {calendarId && (
              <button
                onClick={loadEvents}
                disabled={loading}
                className="text-xs bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:bg-gray-600 cursor-pointer"
              >
                {loading ? 'Loading...' : '🔄 Refresh'}
              </button>
            )}
            <button
              onClick={() => setEditingCalendarId(!editingCalendarId)}
              className="text-xs bg-gray-700 text-gray-300 px-3 py-2 rounded hover:bg-gray-600 cursor-pointer"
            >
              ⚙ Calendar ID
            </button>
          </div>
        </div>

        {!calendarId && !editingCalendarId && (
          <div className="mb-3 rounded bg-amber-500/20 px-4 py-3 text-sm text-amber-300">
            No Google Calendar ID configured. Click "⚙ Calendar ID" to add yours.
          </div>
        )}

        {editingCalendarId && (
          <div className="mb-3 flex gap-2">
            <input
              value={calendarId}
              onChange={(e) => setCalendarId(e.target.value)}
              placeholder="Paste your Google Calendar ID"
              className="flex-1 rounded border border-gray-700 bg-gray-950 px-3 py-2 text-sm text-white outline-none placeholder:text-gray-600"
            />
            <button
              onClick={() => { saveCalendarId(calendarId); setEditingCalendarId(false); }}
              className="rounded bg-indigo-600 px-3 py-2 text-sm font-medium text-white hover:bg-indigo-500"
            >
              Save
            </button>
          </div>
        )}

        <div className="flex items-center gap-3 text-sm">
          <div className="flex items-center gap-2">
            <label className="text-gray-300">Days back:</label>
            <input
              type="number"
              value={daysBack}
              onChange={(e) => setDaysBack(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-gray-300">Days forward:</label>
            <input
              type="number"
              value={daysForward}
              onChange={(e) => setDaysForward(Math.max(0, parseInt(e.target.value) || 0))}
              className="w-16 px-2 py-1 bg-gray-700 text-white rounded border border-gray-600"
            />
          </div>
          <button
            onClick={() => { setDaysBack(daysBack + 30); }}
            className="text-xs bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 cursor-pointer"
          >
            Load 30 more back
          </button>
          <button
            onClick={() => { setDaysForward(daysForward + 30); }}
            className="text-xs bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600 cursor-pointer"
          >
            Load 30 more forward
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {events.length === 0 && !loading && (
          <div className="text-center text-gray-500 mt-8">
            <p>No events found</p>
          </div>
        )}

        {groupEventsByDay().map(([dateKey, dayEvents]) => {
          const date = new Date(dateKey);
          const now = new Date();
          const isToday = date.toDateString() === now.toDateString();
          const isPast = date < now && !isToday;

          return (
            <div key={dateKey} className="mb-6">
              <h3 className={`text-sm font-semibold mb-3 px-2 py-1 rounded ${
                isToday ? 'bg-blue-900/30 text-blue-300' : isPast ? 'bg-gray-800 text-gray-400' : 'bg-gray-800 text-gray-300'
              }`}>
                {isToday ? '🔵 Today - ' : ''}{date.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
              </h3>
              <div className="space-y-3">
                {dayEvents.map(event => (
                  <div key={event.id} className={`bg-gray-800 rounded-lg p-4 border ${
                    isPast ? 'border-gray-700 opacity-60' : 'border-gray-700'
                  }`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h3 className="text-white font-medium">{event.summary}</h3>
                        <div className="flex items-center gap-3 mt-2 text-sm text-gray-400">
                          <span>🕐 {formatTime(event)}</span>
                        </div>
                        {event.location && (
                          <div className="text-sm text-gray-400 mt-1">
                            📍 {event.location}
                          </div>
                        )}
                        {event.description && (
                          <div className="text-sm text-gray-300 mt-2">
                            {event.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
