/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        basalt: {
          900: '#15181b',
          800: '#1C2024',
          700: '#20242B',
          600: '#2c323a',
          500: '#3a414b',
        },
        sandstone: {
          50: '#F9F8F6',
          100: '#E8E4DC',
          200: '#D5CEC4',
          300: '#B0A79B',
        },
        copper: {
          400: '#4FB0A1',
          500: '#2C9A8B',
          600: '#1F7A6E',
        }
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['Fira Code', 'monospace'],
        editorial: ['"Playfair Display"', 'serif'],
      },
      boxShadow: {
        'strata': '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -1px rgba(0, 0, 0, 0.25)',
      },
      animation: {
        'marquee': 'marquee 30s linear infinite',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        }
      }
    },
  },
  plugins: [],
}
