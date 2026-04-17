import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Live Tracking",
};

export default function LiveTrackingLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
