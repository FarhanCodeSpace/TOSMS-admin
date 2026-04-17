import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Routes",
};

export default function RoutesLayout({ children }: { children: ReactNode }) {
  return children;
}
