import React, { useRef } from 'react';
import { motion, useInView, useScroll, useTransform } from 'framer-motion';
import '../styles/Calendar.css';

const CalendarShowcase = () => {
  const sectionRef = useRef(null);
  const isInView = useInView(sectionRef, { once: true, amount: 0.3 });
  const calendarRef = useRef(null);

  // Subtle parallax on scroll
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ["start end", "end start"]
  });
  const floatY = useTransform(scrollYProgress, [0, 0.5, 1], [20, -5, 20]);

  const gridDayHeaders = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

  // August 2024 calendar data (matches the existing calendar)
  const firstDay = 4; // Thursday (adjusted for Mon-start)
  const daysInMonth = 31;
  const selectedDay = 17;

  const appointments = {
    12: 'Doctor',
    17: 'Report, Review, Meeting',
    25: 'Dentist',
  };

  const renderGrid = () => {
    const cells = [];
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="grid-cell" style={{ opacity: 0.2 }} />);
    }
    for (let day = 1; day <= daysInMonth; day++) {
      const isSelected = day === selectedDay;
      const hasAppointment = appointments[day];
      cells.push(
        <motion.div
          key={day}
          className="grid-cell"
          initial={isInView ? { opacity: 0, y: 8 } : false}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.4, delay: 0.8 + day * 0.012, ease: "easeOut" }}
          style={{ position: 'relative' }}
        >
          <div
            className={`grid-number ${isSelected ? 'selected' : ''}`}
            style={isSelected ? {
              background: 'linear-gradient(135deg, var(--color1), var(--color2))',
              color: '#fff',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.85rem',
            } : {}}
          >
            {day}
          </div>
          {hasAppointment && (
            <motion.div
              initial={isInView ? { opacity: 0, scale: 0 } : false}
              animate={isInView ? { opacity: 1, scale: 1 } : {}}
              transition={{ duration: 0.4, delay: 1.8, ease: "easeOut" }}
              style={{
                marginTop: '4px',
                display: 'flex',
                gap: '3px',
                flexWrap: 'wrap',
              }}
            >
              {hasAppointment.split(', ').map((_, i) => (
                <div
                  key={i}
                  style={{
                    width: '5px',
                    height: '5px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, var(--color1), var(--color2))',
                  }}
                />
              ))}
            </motion.div>
          )}
        </motion.div>
      );
    }
    return cells;
  };

  return (
    <div ref={sectionRef} className="relative w-full flex justify-center py-8">
      {/* Ambient glow behind calendar */}
      <motion.div
        initial={isInView ? { opacity: 0 } : false}
        animate={isInView ? { opacity: 1 } : {}}
        transition={{ duration: 2, delay: 0.5 }}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: '70%',
          height: '70%',
          background: 'radial-gradient(ellipse, rgba(129,140,248,0.08) 0%, transparent 70%)',
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Floating confirmation card */}
      <motion.div
        initial={isInView ? { opacity: 0, y: 30, x: 20 } : false}
        animate={isInView ? { opacity: 1, y: 0, x: 0 } : {}}
        transition={{ duration: 1, delay: 2.2, ease: [0.19, 1, 0.22, 1] }}
        style={{
          position: 'absolute',
          top: '15%',
          right: '8%',
          zIndex: 20,
          background: 'rgba(30, 30, 30, 0.85)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '16px',
          padding: '20px 24px',
          minWidth: '220px',
          boxShadow: '0 20px 60px rgba(0,0,0,0.4), 0 0 40px rgba(129,140,248,0.06)',
        }}
      >
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '12px',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color1), var(--color2))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <span style={{
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'rgba(255,255,255,0.4)',
          }}>Confirmed</span>
        </div>
        <p style={{
          margin: 0,
          fontSize: '0.95rem',
          fontWeight: 600,
          color: '#fff',
        }}>Team Meeting</p>
        <p style={{
          margin: '4px 0 0',
          fontSize: '0.8rem',
          color: 'rgba(255,255,255,0.4)',
        }}>Aug 17 · 11:00 AM</p>
      </motion.div>

      {/* Calendar panel */}
      <motion.div
        ref={calendarRef}
        style={{ float: floatY }}
        initial={isInView ? { opacity: 0, y: 40, scale: 0.97 } : false}
        animate={isInView ? { opacity: 1, y: 0, scale: 1 } : {}}
        transition={{ duration: 1.2, delay: 0.3, ease: [0.19, 1, 0.22, 1] }}
      >
        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          style={{
            width: '100%',
            maxWidth: '860px',
            background: '#1e1e1e',
            borderRadius: '20px',
            border: '1px solid rgba(255,255,255,0.06)',
            borderTop: '3px solid var(--color1)',
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.5), 0 0 60px rgba(129,140,248,0.04)',
          }}
        >
          {/* Month header */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '32px 0 24px',
          }}>
            <span style={{
              fontSize: '1.8rem',
              fontWeight: 700,
              color: '#fff',
              letterSpacing: '-0.01em',
            }}>AUG 2024</span>
          </div>

          {/* Day headers */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            textAlign: 'center',
            padding: '0 24px',
            marginBottom: '8px',
          }}>
            {gridDayHeaders.map(day => (
              <div key={day} style={{
                fontSize: '0.65rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: 'rgba(255,255,255,0.3)',
              }}>{day}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: '4px',
            padding: '0 20px 32px',
          }}>
            {renderGrid()}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
};

export default CalendarShowcase;
