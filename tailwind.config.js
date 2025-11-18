/** @type {import('tailwindcss').Config} */
export default {
  content: ["./views/**/*.ejs", "./public/**/*.js"],
  theme: {
    extend: {
      colors: {
        hot: {
          bg: "#0b1220",
          card: "#0f172a",
          primary: "#60a5fa",
          accent: "#22d3ee",
        },
      },
    },
  },
  plugins: [],
};
