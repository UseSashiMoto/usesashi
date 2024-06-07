/** @type {import('tailwindcss').Config} */
import { parkwindPlugin } from '@park-ui/tailwind-plugin'

module.exports = {
  content: ["./src/**/*.{html,js,jsx,ts,tsx}"],

  plugins: [parkwindPlugin],
  parkUI: {
    accentColor: 'crimson',
    grayColor: 'mauve',
    borderRadius: 'lg',
  },
  darkMode: ['class'],
  theme: {
    extend: {
      zIndex: {
        'max': 2147483647
      }
    },
  },
  plugins: [],
}