'use client';

type TimePickerProps = {
  value: string;
  onChange: (time: string) => void;
  className?: string;
};

export function TimePicker({ value, onChange, className = '' }: TimePickerProps) {
  return (
    <input
      type="time"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`h-9 w-full rounded-lg border border-input bg-background px-3 text-sm text-foreground appearance-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [&::-webkit-calendar-picker-indicator]:hidden [&::-webkit-calendar-picker-indicator]:appearance-none ${className}`}
    />
  );
}
