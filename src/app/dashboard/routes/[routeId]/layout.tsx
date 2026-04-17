import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Route Details",
};

export default function RouteDetailLayout({
  children,
}: {
  children: ReactNode;
}) {
  return children;
}
