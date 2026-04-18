import "./globals.css";
import "leaflet/dist/leaflet.css";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AuthProvider } from "@/context/AuthContext";
import { ThemeProvider } from "next-themes";
import { Toaster } from "react-hot-toast";

export const metadata: Metadata = {
  title: "TOSMS Admin Dashboard",
  description:
    "Transport Operations and Safety Management System admin portal.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            {children}
            <Toaster
              position="bottom-right"
              toastOptions={{
                style: {
                  background: "var(--surface)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: "10px",
                  fontSize: "14px",
                },
                success: {
                  iconTheme: { primary: "#16A34A", secondary: "white" },
                },
                error: {
                  iconTheme: { primary: "#DC2626", secondary: "white" },
                },
              }}
            />
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
