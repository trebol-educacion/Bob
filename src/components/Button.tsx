import React from 'react';
import { cn } from '@/lib/utils';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    'inline-flex items-center justify-center rounded-sm font-bold transition-all active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none';

  const variants = {
    primary:
      'bg-trebol-primary text-white hover:bg-trebol-primary-dark',
    secondary:
      'bg-white text-trebol-primary border-2 border-trebol-primary hover:bg-trebol-primary hover:text-white transition-colors',
    danger:
      'bg-red-500 text-white hover:bg-red-600',
    outline:
      'bg-white text-trebol-text border-2 border-trebol-border hover:bg-gray-50',
    ghost:
      'bg-transparent text-gray-500 hover:bg-gray-100 active:scale-100',
  };

  const sizes = {
    sm: 'px-4 py-2 text-sm',
    md: 'px-6 py-3 text-base',
    lg: 'px-8 py-4 text-lg',
    icon: 'p-3',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      {...props}
    >
      {children}
    </button>
  );
}
