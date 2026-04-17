import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Reviews & Ratings",
};

export default function ReviewsLayout({ children }: { children: ReactNode }) {
  return children;
}
