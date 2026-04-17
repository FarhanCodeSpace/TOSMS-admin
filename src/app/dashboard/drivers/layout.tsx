import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Drivers",
};

export default function DriversLayout({ children }: { children: ReactNode }) {
  return children;
}
