import React from 'react';

/**
 * Shared UI primitives — a lightweight design system so the dashboard, admin,
 * layout studio, and portals render with consistent buttons, cards, badges,
 * section headers, and empty states. Adopt these in new surfaces and migrate
 * existing ones incrementally.
 */

type Tone = 'default' | 'primary' | 'success' | 'warning' | 'danger';

const toneBtn: Record<Tone, string> = {
  default: 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50',
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700',
  success: 'bg-emerald-600 text-white hover:bg-emerald-700',
  warning: 'bg-amber-500 text-white hover:bg-amber-600',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

export function Button({
  tone = 'default',
  size = 'md',
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'px-3 py-1.5 text-sm' : 'px-4 py-2 text-sm font-medium';
  return (
    <button
      {...props}
      className={`rounded-lg transition-colors disabled:opacity-50 ${toneBtn[tone]} ${sz} ${className}`}
    />
  );
}

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl bg-white border border-gray-200 shadow-sm ${className}`}>{children}</div>
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
  primary: 'bg-indigo-100 text-indigo-700',
  success: 'bg-emerald-100 text-emerald-700',
  warning: 'bg-amber-100 text-amber-700',
  danger: 'bg-red-100 text-red-700',
};

export function Badge({ tone = 'default', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${toneBadge[tone]}`}>
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

export const inputCls = 'px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 w-full';
