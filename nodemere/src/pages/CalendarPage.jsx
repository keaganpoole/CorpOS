// src/pages/CalendarPage.jsx
import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheck, faPlus, faTimes, faChevronLeft, faChevronRight } from '@fortawesome/free-solid-svg-icons';
import { motion, AnimatePresence } from 'framer-motion';
import '../styles/Calendar.css';

// Mock data for appointments
const appointments = {
  "2024-08-12": [{ text: 'Doctor Appointment' }],
  "2024-08-17": [{ text: 'Submit monthly report', completed: true }, { text: 'Design review' }, { text: 'Team meeting at 11:00 AM' }],
  "2024-08-25": [{ text: 'Dentist Appointment' }, { text: 'Pick up prescription' }],
};

const NewAppointmentModal = ({ isOpen, onClose, onCreate }) => {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onCreate({ text: title, date, time, notes });
    onClose();
    setTitle('');
    setDate('');
    setTime('');
    setNotes('');
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal-content" initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}>
            <header className="modal-header">
              <h2>Add New Appointment</h2>
              <button onClick={onClose} className="close-btn"><FontAwesomeIcon icon={faTimes} /></button>
            </header>
            <form onSubmit={handleSubmit} className="modal-form">
              <input type="text" placeholder="Appointment Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
              <input type="time" placeholder="Time" value={time} onChange={(e) => setTime(e.target.value)} />
              <textarea placeholder="Notes (Optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
              <button type="submit" className="submit-btn">Create</button>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

const DayDetailsModal = ({ isOpen, onClose, date, events }) => {
  if (!isOpen) return null;

  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="modal-content" initial={{ y: -50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -50, opacity: 0 }}>
            <header className="modal-header">
              <h2>{dayNames[date.getDay()]}, {date.getDate()}</h2>
              <button onClick={onClose} className="close-btn"><FontAwesomeIcon icon={faTimes} /></button>
            </header>
            <div className="day-details-body">
              <ul className="event-list">
                {events.length > 0 ? events.map((event, index) => (
                  <li key={index} className={`event-item ${event.completed ? 'completed' : ''}`}>
                    <div className="status-icon">
                      {event.completed && <FontAwesomeIcon icon={faCheck} />}
                    </div>
                    <p>{event.text}</p>
                  </li>
                )) : <li className="event-item"><p>No events scheduled</p></li>}
              </ul>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};


const CalendarPage = () => {
  const [selectedDate, setSelectedDate] = useState(new Date(2024, 7, 17));
  const [currentMonth, setCurrentMonth] = useState(7);
  const [currentYear, setCurrentYear] = useState(2024);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth <= 768);

  const monthAbbreviations = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
  const dayNames = ["SUNDAY", "MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY"];
  const gridDayHeaders = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
  const years = Array.from({ length: 7 }, (_, i) => 2022 + i);

  const handleDateClick = (day) => {
    setSelectedDate(new Date(currentYear, currentMonth, day));
    if (isMobile) {
      setIsDetailsModalOpen(true);
    }
  };

  const handleCreateAppointment = (appointment) => {
    // This is where you would typically update your state or make an API call
    console.log("New appointment created:", appointment);
  };

  const goToNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const goToPrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const renderCalendarGrid = () => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1).getDay();
    const adjustedFirstDay = (firstDayOfMonth === 0) ? 6 : firstDayOfMonth - 1;
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

    const grid = [];
    for (let i = 0; i < adjustedFirstDay; i++) {
      grid.push(<div key={`prev-${i}`} className="grid-cell other-month"></div>);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const dayAppointments = appointments[dateStr] || [];
      const isSelected = selectedDate.getDate() === day && selectedDate.getMonth() === currentMonth && selectedDate.getFullYear() === currentYear;

      grid.push(
        <div key={day} className="grid-cell" onClick={() => handleDateClick(day)}>
          <div className={`grid-number ${isSelected ? 'selected' : ''}`}>{day}</div>
          <div className="appointment-indicators">
            {isMobile ? (
              dayAppointments.length > 0 && <div className="appointment-dot-mobile"></div>
            ) : (
              dayAppointments.slice(0, 2).map((app, index) => (
                null
              ))
            )}
          </div>
        </div>
      );
    }
    return grid;
  };

  const selectedDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDate.getDate()).padStart(2, '0')}`;
  const selectedDayEvents = appointments[selectedDateStr] || [];

  return (
    <div className="calendar-page-container">
      <div className="calendar-container">
        <div className="left-panel">
          <div className="date-number">{selectedDate.getDate()}</div>
          <div className="day-of-week">{dayNames[selectedDate.getDay()]}</div>
          <button className="add-appointment-btn" onClick={() => setIsModalOpen(true)}>
            <FontAwesomeIcon icon={faPlus} /> New Appointment
          </button>
          <ul className="event-list">
            {selectedDayEvents.length > 0 ? selectedDayEvents.map((event, index) => (
              <li key={index} className={`event-item ${event.completed ? 'completed' : ''}`}>
                <div className="status-icon">
                  {event.completed && <FontAwesomeIcon icon={faCheck} />}
                </div>
                <p>{event.text}</p>
              </li>
            )) : <li className="event-item"><p>No events scheduled</p></li>}
          </ul>
        </div>

        <div className="center-panel">
          <div className="month-header">
            <div className="month-nav-group">
              <button className="nav-arrow" onClick={goToPrevMonth}><FontAwesomeIcon icon={faChevronLeft} /></button>
              <div className="month-name">{monthAbbreviations[currentMonth]} {currentYear}</div>
              <button className="nav-arrow" onClick={goToNextMonth}><FontAwesomeIcon icon={faChevronRight} /></button>
            </div>
            {isMobile && (
              <button className="add-appointment-btn-mobile" onClick={() => setIsModalOpen(true)}>
                <FontAwesomeIcon icon={faPlus} />
                <span>New appointment</span>
              </button>
            )}
          </div>
          <div className="calendar-grid-headers">
            {gridDayHeaders.map(day => <div key={day}>{day}</div>)}
          </div>
          <div className="calendar-grid">{renderCalendarGrid()}</div>
        </div>

        <div className="right-panel">
          <ul className="year-selector">
            {years.map(year => (
              <li key={year} className={currentYear === year ? 'active' : ''} onClick={() => setCurrentYear(year)}>
                {year}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <NewAppointmentModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateAppointment}
      />
      <DayDetailsModal
        isOpen={isDetailsModalOpen}
        onClose={() => setIsDetailsModalOpen(false)}
        date={selectedDate}
        events={selectedDayEvents}
      />
    </div>
  );
};

export default CalendarPage;