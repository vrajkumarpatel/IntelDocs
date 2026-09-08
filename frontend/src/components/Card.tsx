import type { HTMLAttributes, ReactNode } from 'react'

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode
}

export function Card({ children, className = '', ...rest }: CardProps) {
  return (
    <div
      className={`rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-[var(--shadow-card)] ${className}`}
      {...rest}
    >
      {children}
    </div>
  )
}
