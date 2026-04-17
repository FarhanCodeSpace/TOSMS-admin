import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Availability",
};

export default function AvailabilityLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
