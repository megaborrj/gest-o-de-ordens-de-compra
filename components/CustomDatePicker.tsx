import React, { useState, useRef, useEffect } from 'react';
import { CalendarIcon } from './icons/CalendarIcon';

// Helper to parse DD/MM/YYYY string to a Date object in UTC
const parseDate = (dateString: string): Date | null => {
  if (!/^\d{2}\/\d{2}\/\d{4}$/.test(dateString)) return null;
  const [day, month, year] = dateString.split('/').map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  return new Date(Date.UTC(year, month - 1, day));
};

// Helper to format a Date object to DD/MM/YYYY string
const formatDate = (date: Date): string => {
  const day = String(date.getUTCDate()).padStart(2, '0');
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return `${day}/${month}/${year}`;
};

interface CustomDatePickerProps {
  value: string; // DD/MM/YYYY
  onChange: (value: string) => void;
}

const CustomDatePicker: React.FC<CustomDatePickerProps> = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const selectedDate = parseDate(value);
  
  // Initialize with UTC date to prevent timezone discrepancies
  const getTodayUTC = () => {
      const today = new Date();
      return new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate()));
  };
  const [viewDate, setViewDate] = useState(selectedDate || getTodayUTC());

  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [wrapperRef]);

  useEffect(() => {
    // When value changes from outside, update the viewDate
    const newSelectedDate = parseDate(value);
    if(newSelectedDate){
        setViewDate(newSelectedDate);
    } else {
        // If value becomes invalid or empty, reset view to today
        setViewDate(getTodayUTC());
    }
  }, [value]);


  const daysInMonth = (year: number, month: number) => new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const firstDayOfMonth = (year: number, month: number) => new Date(Date.UTC(year, month, 1)).getUTCDay();

  const changeMonth = (amount: number) => {
    setViewDate(prev => {
      const newDate = new Date(prev);
      newDate.setUTCMonth(newDate.getUTCMonth() + amount);
      return newDate;
    });
  };

  const handleDayClick = (day: number) => {
    const newDate = new Date(viewDate);
    newDate.setUTCDate(day);
    onChange(formatDate(newDate));
    setIsOpen(false);
  };

  const renderCalendar = () => {
    const year = viewDate.getUTCFullYear();
    const month = viewDate.getUTCMonth();
    
    const numDays = daysInMonth(year, month);
    const startDay = firstDayOfMonth(year, month);
    
    const blanks = Array(startDay).fill(null);
    const days = Array.from({ length: numDays }, (_, i) => i + 1);

    const weekDays = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

    return (
      <div className="absolute top-full mt-2 w-72 bg-white border border-slate-300 rounded-lg shadow-lg z-50 p-4">
        <div className="flex justify-between items-center mb-2">
          <button onClick={() => changeMonth(-1)} type="button" className="p-1 rounded-full hover:bg-slate-100">&lt;</button>
          <span className="font-semibold text-slate-800 capitalize">
            {/* FIX: Specify UTC timezone to prevent incorrect month display in certain timezones */}
            {new Date(Date.UTC(year, month)).toLocaleString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })}
          </span>
          <button onClick={() => changeMonth(1)} type="button" className="p-1 rounded-full hover:bg-slate-100">&gt;</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center">
          {weekDays.map((day, i) => (
            <div key={i} className="text-xs font-bold text-slate-500">{day}</div>
          ))}
          {blanks.map((_, i) => (
            <div key={`blank-${i}`}></div>
          ))}
          {days.map(day => {
            const isSelected = selectedDate &&
              selectedDate.getUTCDate() === day &&
              selectedDate.getUTCMonth() === month &&
              selectedDate.getUTCFullYear() === year;

            return (
              <button
                key={day}
                onClick={() => handleDayClick(day)}
                type="button"
                className={`w-9 h-9 flex items-center justify-center rounded-full text-sm transition-colors ${
                  isSelected 
                    ? 'bg-indigo-600 text-white font-bold' 
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
              >
                {day}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="relative" ref={wrapperRef}>
      <div className="relative">
          <input
            type="text"
            readOnly
            value={value}
            onClick={() => setIsOpen(prev => !prev)}
            placeholder="DD/MM/AAAA"
            className="mt-1 block w-full px-3 py-2 bg-white border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm cursor-pointer"
          />
          <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <CalendarIcon className="h-5 w-5 text-slate-400" />
          </div>
      </div>
      {isOpen && renderCalendar()}
    </div>
  );
};

export default CustomDatePicker;