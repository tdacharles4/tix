'use client';

import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type DateRangePickerProps = {
  startDate: string;
  endDate: string;
  onStartChange: (date: string) => void;
  onEndChange: (date: string) => void;
  className?: string;
};

function monthGrid(year: number, month: number) {
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  return [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ] as (number | null)[];
}

function RangeCalendarGrid({
  startDate, endDate, onStartChange, onEndChange,
}: {
  startDate: string; endDate: string;
  onStartChange: (d: string) => void; onEndChange: (d: string) => void;
}) {
  const initial = startDate ? new Date(startDate + 'T00:00:00') : new Date();
  const [viewDate, setViewDate] = useState(new Date(initial.getFullYear(), initial.getMonth(), 1));

  const leftYear  = viewDate.getFullYear();
  const leftMonth = viewDate.getMonth();
  const rightDate  = new Date(leftYear, leftMonth + 1, 1);
  const rightYear  = rightDate.getFullYear();
  const rightMonth = rightDate.getMonth();

  const leftName  = viewDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const rightName = rightDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });

  function handleClick(dateStr: string) {
    if (!startDate || (startDate && endDate)) {
      onStartChange(dateStr);
      onEndChange('');
    } else {
      if (dateStr < startDate) {
        onStartChange(dateStr);
        onEndChange(startDate);
      } else {
        onEndChange(dateStr);
      }
    }
  }

  function dayCls(dateStr: string) {
    const isStart = dateStr === startDate;
    const isEnd   = dateStr === endDate;
    const inRange = startDate && endDate && dateStr > startDate && dateStr < endDate;
    if (isStart || isEnd) return 'bg-indigo-600 text-white';
    if (inRange)          return 'bg-indigo-100 text-indigo-800';
    return 'text-gray-700 hover:bg-gray-100';
  }

  function renderMonth(year: number, month: number, cells: (number | null)[]) {
    return (
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
          return (
            <button key={i} type="button" onClick={() => handleClick(dateStr)}
              className={`text-xs py-1.5 rounded ${dayCls(dateStr)}`}>
              {day}
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="flex gap-4 p-3">
      {/* Left month */}
      <div className="w-56">
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => setViewDate(new Date(leftYear, leftMonth - 1, 1))}
            className="p-1 text-gray-500 hover:bg-gray-100 rounded text-lg leading-none">‹</button>
          <span className="text-sm font-medium capitalize">{leftName}</span>
          <span className="w-6" />
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
          {['D','L','M','X','J','V','S'].map((d) => <span key={d}>{d}</span>)}
        </div>
        {renderMonth(leftYear, leftMonth, monthGrid(leftYear, leftMonth))}
      </div>

      <div className="w-px bg-gray-100" />

      {/* Right month */}
      <div className="w-56">
        <div className="flex items-center justify-between mb-3">
          <span className="w-6" />
          <span className="text-sm font-medium capitalize">{rightName}</span>
          <button type="button" onClick={() => setViewDate(new Date(leftYear, leftMonth + 1, 1))}
            className="p-1 text-gray-500 hover:bg-gray-100 rounded text-lg leading-none">›</button>
        </div>
        <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
          {['D','L','M','X','J','V','S'].map((d) => <span key={d}>{d}</span>)}
        </div>
        {renderMonth(rightYear, rightMonth, monthGrid(rightYear, rightMonth))}
      </div>
    </div>
  );
}

export function DateRangePicker({ startDate, endDate, onStartChange, onEndChange, className = '' }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  const fmt = (d: string) => new Date(d + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric' });
  const label = startDate
    ? endDate ? `${fmt(startDate)} – ${fmt(endDate)}` : fmt(startDate)
    : null;

  function handleEndChange(d: string) {
    onEndChange(d);
    if (d) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-between font-normal', !label && 'text-muted-foreground', className)}>
          {label ?? 'Selecciona un rango de fechas'}
          <ChevronDownIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white shadow-lg" align="start">
        <RangeCalendarGrid
          startDate={startDate} endDate={endDate}
          onStartChange={onStartChange} onEndChange={handleEndChange}
        />
      </PopoverContent>
    </Popover>
  );
}
