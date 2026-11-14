import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Lock } from 'lucide-react';
import type { BookingRules, BookingRequest } from '../types/studio';

interface MonthlyScheduleCalendarProps {
  rules: BookingRules;
  onUpdateRules: (partial: Partial<BookingRules>) => Promise<void>;
  bookings?: BookingRequest[];
}

const MONTH_NAMES = [
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
  'Juillet',
  'Août',
  'Septembre',
  'Octobre',
  'Novembre',
  'Décembre',
];

const WEEKDAY_NAMES = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];

export const MonthlyScheduleCalendar: React.FC<MonthlyScheduleCalendarProps> = ({
  rules,
  onUpdateRules,
  bookings = [],
}) => {
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth()); // 0-indexed

  const blockedDatesSet = new Set(rules.blockedDates || []);
  const closedWeekdaysSet = new Set(rules.closedWeekdays || []);
  const sundayOpen = rules.sundayEnabled && !closedWeekdaysSet.has(0);

  // Month navigation
  const prevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const nextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const goToToday = () => {
    setCurrentYear(today.getFullYear());
    setCurrentMonth(today.getMonth());
  };

  // Build grid for currentMonth/currentYear
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // Day of week for 1st of month: 0=Sun, 1=Mon... -> convert to Monday=0
  const firstDayWeekday = (firstDayOfMonth.getDay() + 6) % 7;

  const days: Array<{
    dayNumber: number;
    isoDate: string;
    isCurrentMonth: boolean;
    isPast: boolean;
    isClosedByWeekday: boolean;
    isBlockedSpecifically: boolean;
    isClosed: boolean;
    bookingsCount: number;
  }> = [];

  // Padding days from previous month
  const prevMonthLastDay = new Date(currentYear, currentMonth, 0).getDate();
  for (let i = firstDayWeekday - 1; i >= 0; i--) {
    const dNum = prevMonthLastDay - i;
    const prevMonthIdx = currentMonth === 0 ? 11 : currentMonth - 1;
    const prevYear = currentMonth === 0 ? currentYear - 1 : currentYear;
    const isoDate = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(dNum).padStart(2, '0')}`;
    days.push({
      dayNumber: dNum,
      isoDate,
      isCurrentMonth: false,
      isPast: true,
      isClosedByWeekday: false,
      isBlockedSpecifically: false,
      isClosed: false,
      bookingsCount: 0,
    });
  }

  // Days in current month
  for (let d = 1; d <= daysInMonth; d++) {
    const isoDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    const dayDate = new Date(currentYear, currentMonth, d);
    const dayOfWeek = dayDate.getDay(); // 0=Sun, 1=Mon...

    const isClosedByWeekday =
      dayOfWeek === 0 ? !sundayOpen : closedWeekdaysSet.has(dayOfWeek);
    const isBlockedSpecifically = blockedDatesSet.has(isoDate);
    const isClosed = isClosedByWeekday || isBlockedSpecifically;

    const todayIso = today.toISOString().split('T')[0];
    const isPast = isoDate < todayIso;

    const dayBookings = bookings.filter(
      (b) => b.preferredDate === isoDate && b.status !== 'cancelled'
    ).length;

    days.push({
      dayNumber: d,
      isoDate,
      isCurrentMonth: true,
      isPast,
      isClosedByWeekday,
      isBlockedSpecifically,
      isClosed,
      bookingsCount: dayBookings,
    });
  }

  // Toggle single date
  const handleToggleDate = async (isoDate: string, isClosed: boolean) => {
    const nextBlocked = new Set(rules.blockedDates || []);
    if (isClosed) {
      nextBlocked.delete(isoDate);
    } else {
      nextBlocked.add(isoDate);
    }
    await onUpdateRules({ blockedDates: Array.from(nextBlocked).sort() });
  };

  // Close / open all days of this month
  const handleCloseEntireMonth = async () => {
    const nextBlocked = new Set(rules.blockedDates || []);
    for (let d = 1; d <= daysInMonth; d++) {
      const isoDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      nextBlocked.add(isoDate);
    }
    await onUpdateRules({ blockedDates: Array.from(nextBlocked).sort() });
  };

  const handleOpenEntireMonth = async () => {
    const nextBlocked = new Set(rules.blockedDates || []);
    for (let d = 1; d <= daysInMonth; d++) {
      const isoDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      nextBlocked.delete(isoDate);
    }
    await onUpdateRules({ blockedDates: Array.from(nextBlocked).sort() });
  };

  return (
    <div className="border border-stone/60 bg-white p-4 sm:p-6">
      {/* HEADER: MONTH & YEAR CONTROLS */}
      <div className="flex flex-col gap-4 border-b border-stone/40 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-charcoal/80" aria-hidden="true" />
          <h4 className="font-serif text-2xl text-charcoal sm:text-3xl">
            {MONTH_NAMES[currentMonth]} {currentYear}
          </h4>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={goToToday}
            className="border border-stone px-3 py-1.5 text-xs font-medium uppercase tracking-wider text-charcoal hover:border-charcoal cursor-pointer"
          >
            Aujourd’hui
          </button>

          <select
            value={currentMonth}
            onChange={(e) => setCurrentMonth(Number(e.target.value))}
            className="border border-stone bg-white px-2.5 py-1.5 text-xs font-medium text-charcoal"
          >
            {MONTH_NAMES.map((name, idx) => (
              <option key={name} value={idx}>
                {name}
              </option>
            ))}
          </select>

          <select
            value={currentYear}
            onChange={(e) => setCurrentYear(Number(e.target.value))}
            className="border border-stone bg-white px-2.5 py-1.5 text-xs font-medium text-charcoal"
          >
            {[2026, 2027, 2028].map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>

          <div className="flex items-center border border-stone">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Mois précédent"
              className="p-1.5 hover:bg-stone/20 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4 text-charcoal" />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              aria-label="Mois suivant"
              className="border-l border-stone p-1.5 hover:bg-stone/20 cursor-pointer"
            >
              <ChevronRight className="h-4 w-4 text-charcoal" />
            </button>
          </div>
        </div>
      </div>

      {/* QUICK BATCH ACTIONS */}
      <div className="mt-3 mb-4 flex flex-wrap items-center justify-between gap-2 text-xs">
        <p className="text-taupe text-[11px]">
          Cliquez sur une date pour basculer son statut en 1 clic.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCloseEntireMonth}
            className="border border-red-300 bg-red-50/60 px-2.5 py-1 text-[11px] font-medium text-red-900 hover:bg-red-100 cursor-pointer"
          >
            Fermer tout le mois
          </button>
          <button
            type="button"
            onClick={handleOpenEntireMonth}
            className="border border-stone bg-white px-2.5 py-1 text-[11px] font-medium text-charcoal hover:border-charcoal cursor-pointer"
          >
            Réouvrir tout le mois
          </button>
        </div>
      </div>

      {/* CALENDAR GRID */}
      <div className="grid grid-cols-7 gap-1 sm:gap-2">
        {WEEKDAY_NAMES.map((name) => (
          <div
            key={name}
            className="py-1.5 text-center text-[10px] font-semibold uppercase tracking-wider text-taupe border-b border-stone/30"
          >
            {name}
          </div>
        ))}

        {days.map((d, index) => {
          if (!d.isCurrentMonth) {
            return (
              <div
                key={`padding-${index}`}
                className="min-h-[58px] sm:min-h-[72px] border border-stone/15 bg-stone/5 p-1 text-[11px] text-stone/40"
              >
                <span>{d.dayNumber}</span>
              </div>
            );
          }

          return (
            <button
              key={d.isoDate}
              type="button"
              onClick={() => handleToggleDate(d.isoDate, d.isClosed)}
              title={
                d.isClosed
                  ? `${d.isoDate} : FERMÉ (Cliquez pour réouvrir)`
                  : `${d.isoDate} : OUVERT (Cliquez pour fermer)`
              }
              className={`min-h-[58px] sm:min-h-[72px] border p-1 sm:p-2 text-left transition-colors cursor-pointer flex flex-col justify-between ${
                d.isClosed
                  ? 'border-red-300 bg-red-50/80 text-red-950 hover:bg-red-100'
                  : 'border-stone/40 bg-white text-charcoal hover:border-charcoal hover:bg-ivory/40'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-serif text-sm sm:text-base font-semibold">
                  {d.dayNumber}
                </span>
                {d.isClosed ? (
                  <Lock className="h-3 w-3 text-red-700 shrink-0" aria-hidden="true" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 shrink-0" />
                )}
              </div>

              <div className="mt-1 flex items-center justify-between text-[10px]">
                <span className={d.isClosed ? 'font-semibold uppercase tracking-wider text-red-800' : 'text-taupe'}>
                  {d.isClosed ? 'Fermé' : 'Ouvert'}
                </span>
                {d.bookingsCount > 0 && (
                  <span className="rounded-full bg-charcoal px-1.5 py-0.5 text-[9px] text-ivory">
                    {d.bookingsCount} RDV
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* LEGEND */}
      <div className="mt-4 flex flex-wrap items-center gap-4 border-t border-stone/30 pt-3 text-[11px] text-taupe">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-600" />
          <span>Journée ouverte à la réservation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-red-600" />
          <span>Journée fermée (bloquée)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="rounded-full bg-charcoal px-1.5 py-0.2 text-[9px] text-ivory">1 RDV</span>
          <span>Réservations enregistrées</span>
        </div>
      </div>
    </div>
  );
};
