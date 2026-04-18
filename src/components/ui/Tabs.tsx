"use client";

import { cn } from "@/lib/utils";
import { ReactNode, useState } from "react";

interface Tab {
  id: string;
  label: string;
  content: ReactNode;
  badge?: number | string;
}

interface TabsProps {
  tabs: Tab[];
  defaultTabId?: string;
  onChange?: (tabId: string) => void;
  className?: string;
}

export function Tabs({ tabs, defaultTabId, onChange, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTabId || tabs[0]?.id || "");

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    onChange?.(tabId);
  };

  const activeTabData = tabs.find((tab) => tab.id === activeTab);

  return (
    <div className={cn("w-full", className)}>
      {/* Tab buttons */}
      <div className="flex items-center gap-8 border-b border-[var(--border)] overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => handleTabChange(tab.id)}
            className={cn(
              "flex items-center gap-2 pb-3 px-1 text-sm font-medium",
              "transition-colors duration-200",
              "whitespace-nowrap",
              "relative",
              activeTab === tab.id
                ? "text-[var(--primary)]"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]",
            )}
          >
            {tab.label}
            {tab.badge !== undefined && (
              <span className="bg-[var(--primary)]/20 text-[var(--primary)] text-xs font-semibold px-2 py-0.5 rounded-full">
                {tab.badge}
              </span>
            )}
            {activeTab === tab.id && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--accent)] rounded-full" />
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTabData && (
        <div className="pt-4 animate-fade-in">{activeTabData.content}</div>
      )}
    </div>
  );
}
