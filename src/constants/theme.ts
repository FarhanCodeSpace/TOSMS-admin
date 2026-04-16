// Must match mobile app color theme exactly
export const COLORS = {
  primary: "#1A3C5E",
  accent: "#F5A623",
  background: "#F4EFE6",
  surface: "#FFFFFF",
  error: "#F44336",
  success: "#4CAF50",
  text: "#212121",
  textSecondary: "#757575",
} as const;

// Tailwind utility classes for the theme colors
export const TW = {
  primaryBg: "bg-[#1A3C5E]",
  primaryText: "text-[#1A3C5E]",
  primaryBorder: "border-[#1A3C5E]",
  primaryHover: "hover:bg-[#152f4a]",
  accentBg: "bg-[#F5A623]",
  accentText: "text-[#F5A623]",
  accentHover: "hover:bg-[#e09520]",
} as const;
