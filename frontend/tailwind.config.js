/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        slack: {
          purple: '#4A154B',
          sidebar: '#3F0E40',
          hover: '#350D36',
          active: '#1164A3',
          green: '#007A5A',
          presence: '#2BAC76',
          text: '#1D1C1D',
          border: '#DDDDDD',
          bg: '#F8F8F8',
        }
      },
      fontSize: {
        '2xs': '0.625rem',
      }
    },
  },
  plugins: [],
}

