export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        lava: {
          50:  "#FFF1F4",
          100: "#FFE0E8",
          200: "#FFC2D2",
          300: "#FF94B0",
          400: "#FF5C85",
          500: "#FF0047",
          600: "#D10039",
          700: "#A8002E",
          800: "#7A0021",
          900: "#4D0015",
        },
        ink:   "#14141B",
        muted: "#7A7A8C",
        canvas:"#F5F6FA",
      },
      boxShadow: {
        lava:    "0 10px 30px -12px rgba(255,0,71,0.45)",
        card:    "0 1px 2px rgba(20,20,27,0.04), 0 8px 24px -16px rgba(20,20,27,0.25)",
        cardHover:"0 2px 6px rgba(20,20,27,0.06), 0 18px 40px -20px rgba(255,0,71,0.35)",
      },
      backgroundImage: {
        "lava-grad": "linear-gradient(135deg,#FF0047 0%,#D10039 100%)",
        "lava-soft": "linear-gradient(135deg,#FFF1F4 0%,#F5F6FA 55%,#FFE4EA 100%)",
      },
      keyframes: {
        "fade-up": { "0%": { opacity: 0, transform: "translateY(8px)" }, "100%": { opacity: 1, transform: "translateY(0)" } },
        "pop-in":  { "0%": { opacity: 0, transform: "scale(.96)" },      "100%": { opacity: 1, transform: "scale(1)" } },
        shimmer:   { "0%": { backgroundPosition: "-200% 0" },            "100%": { backgroundPosition: "200% 0" } },
      },
      animation: {
        "fade-up": "fade-up .28s ease-out both",
        "pop-in":  "pop-in .18s ease-out both",
        shimmer:   "shimmer 1.6s linear infinite",
      },
    },
  },
  plugins: [],
};
