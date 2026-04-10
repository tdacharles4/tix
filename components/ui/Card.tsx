import type { HTMLAttributes } from 'react';

type CardProps = HTMLAttributes<HTMLDivElement>;

export function Card({ className = '', children, ...props }: CardProps) {
  return (
    <div
      {...props}
      className={`border border-gray-200 rounded-xl p-5 bg-white ${className}`}
    >
      {children}
    </div>
  );
}
