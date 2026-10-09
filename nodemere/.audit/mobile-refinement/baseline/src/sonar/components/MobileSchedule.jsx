import React from 'react';
import { ChevronDown, Copy } from 'lucide-react';

const quarterHours = Array.from({ length: 97 }, (_, index) => index / 4);
const timeLabel = (hour) => hour === 24 ? '12:00 AM (end)' : `${Math.floor(hour) % 12 || 12}:${String(Math.round(hour % 1 * 60)).padStart(2, '0')} ${hour >= 12 ? 'PM' : 'AM'}`;

// Presentation only. Parent callbacks retain the existing schedule validation,
// warning dialogs, plan restrictions, and persistence behavior.
export default function MobileSchedule({ days, tracksFor, onToggleDay, onToggleTrack, onRange, onCopy, totals }) {
  return <div className="mobile-schedule">
    {days.map((day, index) => {
      const tracks = tracksFor(day);
      const enabled = tracks.some((track) => track.enabled);
      return <details key={day} open={index === 0}>
        <summary><span>{day}<small>{enabled ? tracks.filter((track) => track.enabled).map((track) => track.label).join(' · ') : 'Closed'}</small></span><ChevronDown size={18} /></summary>
        <div className="mobile-schedule-day">
          <div className="mobile-schedule-actions"><button type="button" onClick={() => onToggleDay(day)} aria-pressed={enabled}>{enabled ? 'Disable day' : 'Enable day'}</button><button type="button" onClick={() => onCopy(day)} aria-label={`Copy ${day} schedule to all days`}><Copy size={15} />Copy to all</button></div>
          {tracks.map((track) => {
            const options = [...new Set([...quarterHours, track.start, track.end])].sort((a, b) => a - b);
            return <div key={track.id} className="mobile-schedule-track">
              <button type="button" onClick={() => onToggleTrack(day, track.id)} aria-pressed={track.enabled}><i style={{ backgroundColor: track.color }} /><span>{track.label}</span><small>{track.enabled ? 'On' : 'Off'}</small></button>
              <div className="mobile-schedule-times">
                <label>From<select aria-label={`${day} ${track.label} start`} disabled={!track.enabled || track.locked} value={track.start} onChange={(event) => onRange(day, track.id, Number(event.target.value), track.end)}>{options.filter((hour) => hour < track.end).map((hour) => <option key={hour} value={hour}>{timeLabel(hour)}</option>)}</select></label>
                <label>Until<select aria-label={`${day} ${track.label} end`} disabled={!track.enabled || track.locked} value={track.end} onChange={(event) => onRange(day, track.id, track.start, Number(event.target.value))}>{options.filter((hour) => hour > track.start).map((hour) => <option key={hour} value={hour}>{timeLabel(hour)}</option>)}</select></label>
              </div>
            </div>;
          })}
        </div>
      </details>;
    })}
    <p className="mobile-schedule-totals">{totals}</p>
  </div>;
}
