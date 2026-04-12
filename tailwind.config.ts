import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx}", "./app/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        tosms: {
          dark: "#1A3C5E",
          accent: "#F5A623",
        },
      },
    },
  },
  plugins: [],
};

export default config;
