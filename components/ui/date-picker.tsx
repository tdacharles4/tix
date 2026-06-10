'use client';

import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { buttonVariants } from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

type DatePickerProps = {
  value: string;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
};

function CalendarGrid({ selected, onSelect }: { selected: string; onSelect: (d: string) => void }) {
  const initial = selected ? new Date(selected + 'T00:00:00') : new Date();
  const [viewDate, setViewDate] = useState(initial);
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();
  const firstDay    = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName   = viewDate.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' });
  const cells: (number | null)[] = [
    ...Array(firstDay).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  return (
    <div className="p-3 w-64">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => setViewDate(new Date(year, month - 1, 1))}
          className="p-1 text-gray-500 hover:bg-gray-100 rounded text-lg leading-none">‹</button>
        <span className="text-sm font-medium capitalize">{monthName}</span>
        <button type="button" onClick={() => setViewDate(new Date(year, month + 1, 1))}
          className="p-1 text-gray-500 hover:bg-gray-100 rounded text-lg leading-none">›</button>
      </div>
      <div className="grid grid-cols-7 text-center text-xs text-gray-400 mb-1">
        {['D','L','M','X','J','V','S'].map((d) => <span key={d}>{d}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((day, i) => {
          if (!day) return <span key={i} />;
          const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          const isSelected = selected === dateStr;
          return (
            <button key={i} type="button" onClick={() => onSelect(dateStr)}
              className={`text-xs py-1.5 rounded ${isSelected ? 'bg-indigo-600 text-white' : 'text-gray-700 hover:bg-gray-100'}`}>
              {day}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function DatePicker({ value, onChange, placeholder = 'Selecciona una fecha', className = '' }: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const label = value
    ? new Date(value + 'T00:00:00').toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button"
          className={cn(buttonVariants({ variant: 'outline' }), 'w-full justify-between font-normal', !label && 'text-muted-foreground', className)}>
          {label ?? placeholder}
          <ChevronDownIcon className="size-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 bg-white shadow-lg" align="start">
        <CalendarGrid selected={value} onSelect={(d) => { onChange(d); setOpen(false); }} />
      </PopoverContent>
    </Popover>
  );
}
