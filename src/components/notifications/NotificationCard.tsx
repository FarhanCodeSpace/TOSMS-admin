"use client";

import React from "react";
import Link from "next/link";
import { Clock, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { cn } from "@/lib/utils";

interface NotificationCardProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  severity: "critical" | "warning" | "info";
  timestamp: Date;
  actionLink?: string;
  actionLabel?: string;
}

const getSeverityColor = (severity: string) => {
  switch (severity) {
    case "critical":
      return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
    case "warning":
      return "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800";
    case "info":
      return "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800";
    default:
      return "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800";
  }
};

const getSeverityIconColor = (severity: string) => {
  switch (severity) {
    case "critical":
      return "text-red-600 dark:text-red-400";
    case "warning":
      return "text-amber-600 dark:text-amber-400";
    case "info":
      return "text-blue-600 dark:text-blue-400";
    default:
      return "text-gray-600 dark:text-gray-400";
  }
};

const formatTimeAgo = (date: Date) => {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
  const intervals: { [key: string]: number } = {
    year: 31536000,
    month: 2592000,
    week: 604800,
    day: 86400,
    hour: 3600,
    minute: 60,
  };

  for (const [key, value] of Object.entries(intervals)) {
    const interval = Math.floor(seconds / value);
    if (interval >= 1) {
      return `${interval} ${key}${interval > 1 ? "s" : ""} ago`;
    }
  }
  return "Just now";
};

export default function NotificationCard({
  title,
  description,
  icon: IconComponent,
  severity,
  timestamp,
  actionLink,
  actionLabel,
}: NotificationCardProps) {
  return (
    <Card
      className={cn(
        "border-2 p-5 transition-all duration-200 hover:shadow-md",
        getSeverityColor(severity),
      )}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="flex-shrink-0 pt-1">
          <IconComponent
            className={cn("w-6 h-6", getSeverityIconColor(severity))}
          />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-[var(--text)]">{title}</h3>
            <Badge
              variant={
                severity === "critical"
                  ? "error"
                  : severity === "warning"
                    ? "warning"
                    : "default"
              }
            >
              {severity.charAt(0).toUpperCase() + severity.slice(1)}
            </Badge>
          </div>
          <p className="text-sm text-[var(--text-muted)] mb-3">{description}</p>
          <div className="flex items-center justify-between">
            <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {formatTimeAgo(timestamp)}
            </span>
            {actionLink && (
              <Link href={actionLink as any}>
                <Button size="sm" variant="ghost" className="gap-2">
                  {actionLabel}
                  <AlertCircle className="w-4 h-4" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
