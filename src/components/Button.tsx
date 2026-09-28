import React from 'react';
import { Button as ShadcnButton } from '@/components/ui/button';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'outline';
  size?: 'sm' | 'md' | 'lg' | 'icon';
}

const variantMap: Record<NonNullable<ButtonProps['variant']>, 'default' | 'secondary' | 'destructive' | 'ghost' | 'outline'> = {
  primary: 'default',
  secondary: 'secondary',
  danger: 'destructive',
  ghost: 'ghost',
  outline: 'outline',
};

const sizeMap: Record<NonNullable<ButtonProps['size']>, 'sm' | 'default' | 'lg' | 'icon'> = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
  icon: 'icon',
};

export function Button({
  className,
  variant = 'primary',
  size = 'md',
  children,
  ...props
}: ButtonProps) {
  return (
    <ShadcnButton
      variant={variantMap[variant]}
      size={sizeMap[size]}
      className={className}
      {...props}
    >
      {children}
    </ShadcnButton>
  );
}
