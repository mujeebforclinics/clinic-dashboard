import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: "#0B2636",
        clay: "#E4604C",
        sand: "#F4F7F6",
        sage: "#5C7A6E",
        line: "#DFE6E8",
        teal: "#0EAA98",
        violet: "#2F7BE8",
        rose: "#2F7BE8",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
      },
    },
  },
  plugins: [],
};
export default config;
