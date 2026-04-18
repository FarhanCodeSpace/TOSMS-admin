import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Notifications",
  description: "View all important alerts and updates",
};

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
