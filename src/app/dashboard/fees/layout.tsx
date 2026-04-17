import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Fees",
};

export default function FeesLayout({ children }: { children: ReactNode }) {
  return children;
}
