import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Rides",
};

export default function RidesLayout({ children }: { children: ReactNode }) {
  return children;
}
