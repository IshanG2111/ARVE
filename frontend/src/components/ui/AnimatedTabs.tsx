import React from 'react';
import { motion } from 'framer-motion';

export interface TabItem<T extends string = string> {
  id: T;
  label: string;
  icon?: React.ReactNode;
  count?: number;
}

interface AnimatedTabsProps<T extends string = string> {
  tabs: TabItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
  className?: string;
  layoutIdPrefix?: string;
}

export function AnimatedTabs<T extends string = string>({
  tabs,
  activeTab,
  onChange,
  className = '',
  layoutIdPrefix = 'tab-indicator',
}: AnimatedTabsProps<T>) {
  return (
    <div
      className={`inline-flex items-center gap-1 p-1 rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-xs ${className}`}
      role="tablist"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            id={`tab-${tab.id}`}
            className={`relative flex items-center gap-2 px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors duration-180 z-10 cursor-pointer select-none font-mono ${
              isActive
                ? 'text-[var(--primary)] font-semibold'
                : 'text-[var(--muted)] hover:text-[var(--primary)]'
            }`}
          >
            {isActive && (
              <motion.div
                layoutId={`${layoutIdPrefix}-pill`}
                className="absolute inset-0 bg-[var(--elevated)] border border-[var(--border)] rounded-md shadow-xs -z-10"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
              />
            )}
            {tab.icon && (
              <span className="flex items-center text-[var(--muted)]">
                {tab.icon}
              </span>
            )}
            <span>{tab.label}</span>
            {typeof tab.count === 'number' && (
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-xs font-mono ${
                  isActive
                    ? 'bg-[var(--surface)] text-[var(--primary)] border border-[var(--border)]'
                    : 'bg-[var(--elevated)] text-[var(--muted)]'
                }`}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
