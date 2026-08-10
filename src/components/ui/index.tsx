import React from 'react';
import { useBrandingConfig } from '../../config';

/**
 * Shared UI primitives — a lightweight design system so the dashboard, admin,
 * layout studio, and portals render with consistent buttons, cards, badges,
 * section headers, and empty states. Adopt these in new surfaces and migrate
 * existing ones incrementally.
 */

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

const toneBtn: Record<Tone, string> = {
  default: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  primary: 'bg-[#4A1942] text-white hover:bg-[#3b1435]',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  warning: 'bg-amber-500 text-white hover:bg-amber-600',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

export function Button({
  tone = 'default',
  size = 'md',
  className = '',
  style,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: 'sm' | 'md' }) {
  const config = useBrandingConfig();
  const sz = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm font-medium';
  const primaryStyle = tone === 'primary' ? {
    backgroundColor: config.primaryColor || '#4A1942',
    ...style,
  } : style;
  return (
    <button
      {...props}
      style={primaryStyle}
      className={`rounded-lg transition-colors disabled:opacity-50 ${tone === 'primary' ? 'btn-primary ' : ''}${toneBtn[tone]} ${sz} ${className}`}
    />
  );
}

export function Card({ className = '', style, children }: { className?: string; style?: React.CSSProperties; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl bg-white border border-gray-200 shadow-sm ${className}`} style={style}>{children}</div>
  );
}

export function SectionHeader({ icon, title, subtitle, action }: { icon?: string; title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="font-semibold text-gray-800">{icon ? `${icon} ${title}` : title}</h2>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

const toneBadge: Record<Tone, string> = {
  default: 'bg-gray-100 text-gray-700',
  primary: 'bg-[#4A1942]/10 text-[#4A1942]',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
};

export function Badge({
  tone = 'default',
  style,
  className = '',
  children,
  ...props
}: React.HTMLAttributes<HTMLSpanElement> & { tone?: Tone; style?: React.CSSProperties; children: React.ReactNode }) {
  const config = useBrandingConfig();
  const primaryStyle = tone === 'primary' ? {
    backgroundColor: `${config.primaryColor || '#4A1942'}1A`,
    color: config.primaryColor || '#4A1942',
    ...style,
  } : style;
  return (
    <span
      {...props}
      style={primaryStyle}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneBadge[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function EmptyState({ icon = '📭', title, hint, action }: { icon?: string; title: string; hint?: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center space-y-2">
      <div className="text-4xl">{icon}</div>
      <div className="font-medium text-gray-700">{title}</div>
      {hint && <div className="text-sm text-gray-500 max-w-sm">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

export const inputCls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#4A1942]/20 focus:border-[#4A1942] w-full';
