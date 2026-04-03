'use client';

import { useState, useEffect } from 'react';

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
  const [daysBack, setDaysBack] = useState(30);
  const [daysForward, setDaysForward] = useState(30);
  const calendarId = 'cb6cdb21570e9e868a7d76f47035cb71be5eb96eca6c9a47763093a587e106e7@group.calendar.google.com';

  useEffect(() => {
    loadEvents();
  }, [daysBack, daysForward]);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/calendar?calendarId=${encodeURIComponent(calendarId)}&daysBack=${daysBack}&daysForward=${daysForward}`);
      const data = await res.json();
      
      if (data.error) {
        console.error('Calendar error:', data.error);
      } else if (data.events) {
        setEvents(data.events);
        onEventsChange(data.events);
      }
    } catch (error: any) {
      console.error('Failed to load calendar:', error);
    }
    setLoading(false);
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
          <button
            onClick={loadEvents}
            disabled={loading}
            className="text-xs bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 disabled:bg-gray-600"
          >
            {loading ? 'Loading...' : '🔄 Refresh'}
          </button>
        </div>
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
            className="text-xs bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600"
          >
            Load 30 more back
          </button>
          <button
            onClick={() => { setDaysForward(daysForward + 30); }}
            className="text-xs bg-gray-700 text-white px-3 py-1 rounded hover:bg-gray-600"
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
