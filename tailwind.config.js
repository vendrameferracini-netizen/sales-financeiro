export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "Arial", "Helvetica", "sans-serif"]
      },
      colors: {
        salesBlack: "#050505",
        salesRed: "#d0101b",
        salesWhite: "#ffffff"
      }
    }
  },
  plugins: []
};
