import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{js,ts,jsx,tsx,mdx}", "./components/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: { ink: "#1C2321", clay: "#B5563C", sand: "#F6F2EC", sage: "#5C7A6E", line: "#E4DED2" },
      fontFamily: { display: ["var(--font-display)"], body: ["var(--font-body)"] },
    },
  },
  plugins: [],
};
export default config;
