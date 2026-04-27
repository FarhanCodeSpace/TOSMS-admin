import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Notifications",
  description: "View all important alerts and updates",
};

export default function NotificationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return <>{children}</>;
}
