'use client';

import { useState, useEffect } from 'react';

interface Calendar {
  id: string;
  summary: string;
  description?: string;
  primary?: boolean;
}

interface CalendarEvent {
  id: string;
  summary: string;
  description?: string;
  start: any;
  end: any;
  location?: string;
}

interface Props {
  onCalendarLoad: (events: CalendarEvent[]) => void;
}

export default function CalendarManager({ onCalendarLoad }: Props) {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [selectedCalendar, setSelectedCalendar] = useState<string>('primary');
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [newEvent, setNewEvent] = useState({
    summary: '',
    description: '',
    start: new Date().toISOString().split('T')[0],
    end: new Date(Date.now() + 60 * 60 * 1000).toISOString().split('T')[0],
    location: ''
  });

  // Load calendars on mount
  useEffect(() => {
    const loadCalendars = async () => {
      try {
        const res = await fetch('/api/calendar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getCalendars' })
        });
        const data = await res.json();
        
        if (data.calendars) {
          setCalendars(data.calendars);
          // Auto-select primary calendar if available
          const primaryCal = data.calendars.find((cal: Calendar) => cal.primary);
          if (primaryCal) {
            setSelectedCalendar(primaryCal.id);
          }
        }
      } catch (error) {
        console.error('Failed to load calendars:', error);
      }
    };
    
    loadCalendars();
  }, []);

  const loadCalendarEvents = async (calendarId: string = selectedCalendar) => {
    setLoading(true);
    try {
      const now = new Date();
      const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
      
      const res = await fetch(
        `/api/calendar?calendarId=${encodeURIComponent(calendarId)}&timeMin=${now.toISOString()}&timeMax=${thirtyDaysLater.toISOString()}`
      );
      const data = await res.json();
      
      if (data.events) {
        setEvents(data.events);
        onCalendarLoad(data.events);
        console.log(`Loaded ${data.events.length} events from CloudHelper calendar`);
      }
    } catch (error: any) {
      console.error(`Failed to load calendar: ${error.message}`);
    }
    setLoading(false);
  };

  const addEvent = async () => {
    if (!newEvent.summary) {
      alert('Event title is required');
      return;
    }

    try {
      const res = await fetch('/api/calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'createEvent',
          calendarId: selectedCalendar,
          event: {
            summary: newEvent.summary,
            description: newEvent.description,
            location: newEvent.location,
            start: { dateTime: new Date(newEvent.start).toISOString() },
            end: { dateTime: new Date(newEvent.end).toISOString() }
          }
        })
      });

      const data = await res.json();
      
      if (data.success) {
        alert('✓ Event created successfully');
        setNewEvent({
          summary: '',
          description: '',
          start: new Date().toISOString().split('T')[0],
          end: new Date(Date.now() + 60 * 60 * 1000).toISOString().split('T')[0],
          location: ''
        });
        setShowAdd(false);
        // Reload events
        loadCalendarEvents(selectedCalendar);
      } else {
        alert(`Error: ${data.error}`);
      }
    } catch (error: any) {
      alert(`Failed to create event: ${error.message}`);
    }
  };

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-medium text-gray-300">📅 CloudHelper Calendar</h2>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-xs bg-green-600 text-white px-3 py-1 rounded hover:bg-green-700"
        >
          + Add Event
        </button>
      </div>

      {/* Calendar selector */}
      {calendars.length > 0 && (
        <div className="mb-3">
          <select
            value={selectedCalendar}
            onChange={(e) => {
              setSelectedCalendar(e.target.value);
              loadCalendarEvents(e.target.value);
            }}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
          >
            {calendars.map(cal => (
              <option key={cal.id} value={cal.id}>
                {cal.summary} {cal.primary ? '(Primary)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Add event form */}
      {showAdd && (
        <div className="mb-3 p-3 bg-gray-700 rounded space-y-2">
          <input
            type="text"
            placeholder="Event title"
            value={newEvent.summary}
            onChange={(e) => setNewEvent({ ...newEvent, summary: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
          />
          
          <textarea
            placeholder="Description"
            value={newEvent.description}
            onChange={(e) => setNewEvent({ ...newEvent, description: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
            rows={2}
          />

          <input
            type="text"
            placeholder="Location (optional)"
            value={newEvent.location}
            onChange={(e) => setNewEvent({ ...newEvent, location: e.target.value })}
            className="w-full px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
          />

          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={newEvent.start}
              onChange={(e) => setNewEvent({ ...newEvent, start: e.target.value })}
              className="px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
            />
            <input
              type="date"
              value={newEvent.end}
              onChange={(e) => setNewEvent({ ...newEvent, end: e.target.value })}
              className="px-2 py-1 text-sm border border-gray-600 bg-gray-900 text-white rounded"
            />
          </div>

          <div className="flex gap-2">
            <button
              onClick={addEvent}
              disabled={loading}
              className="flex-1 bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-gray-600"
            >
              {loading ? 'Creating...' : 'Create Event'}
            </button>
            <button
              onClick={() => setShowAdd(false)}
              className="flex-1 bg-gray-600 text-white px-3 py-1 rounded text-sm hover:bg-gray-700"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Load button */}
      {!showAdd && (
        <button
          onClick={() => loadCalendarEvents()}
          disabled={loading}
          className="w-full bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 disabled:bg-gray-600"
        >
          {loading ? 'Loading...' : 'Load Events'}
        </button>
      )}

      {/* Events list */}
      {events.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-xs text-gray-400 font-semibold">Recent Events:</div>
          {events.slice(0, 5).map(event => (
            <div key={event.id} className="text-xs text-blue-300 bg-gray-700 p-1 rounded">
              <div>{event.summary}</div>
              {event.start && (
                <div className="text-gray-400">
                  {new Date(event.start.dateTime || event.start.date).toLocaleDateString()}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
