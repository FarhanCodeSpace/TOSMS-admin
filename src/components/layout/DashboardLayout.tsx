"use client";

import { useState, type ReactNode } from "react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const sidebarWidth = isSidebarCollapsed ? 80 : 256;

  return (
    <div className="min-h-screen bg-slate-50">
      <Sidebar
        collapsed={isSidebarCollapsed}
        onToggleCollapsed={() => setIsSidebarCollapsed((prev) => !prev)}
      />
      <div className="min-h-screen" style={{ marginLeft: sidebarWidth }}>
        <Header />
        <main className="min-h-[calc(100vh-4rem)] p-6">{children}</main>
      </div>
    </div>
  );
}
