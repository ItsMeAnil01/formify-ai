/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#1A1D24",
          light: "#2B2F3A",
        },
        paper: "#EEF0F2",
        panel: "#FFFFFF",
        ember: {
          DEFAULT: "#EF5F3B",
          dark: "#D14A28",
          light: "#FDE8E1",
        },
        steel: {
          DEFAULT: "#3A6EA5",
          dark: "#2A5480",
          light: "#E4ECF6",
        },
        success: "#2F9E6E",
        warn: "#D9A441",
      },
      fontFamily: {
        display: ["'Space Grotesk'", "sans-serif"],
        body: ["'Inter'", "sans-serif"],
        mono: ["'IBM Plex Mono'", "monospace"],
      },
      boxShadow: {
        rivet: "0 1px 0 rgba(26,29,36,0.06), 0 1px 3px rgba(26,29,36,0.08)",
        panel: "0 4px 20px rgba(26,29,36,0.08)",
      },
      backgroundImage: {
        blueprint:
          "linear-gradient(rgba(58,110,165,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(58,110,165,0.06) 1px, transparent 1px)",
      },
      backgroundSize: {
        grid: "24px 24px",
      },
    },
  },
  plugins: [],
};
