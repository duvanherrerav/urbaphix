/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: 'var(--color-primary)',
          secondary: 'var(--color-secondary)',
          tertiary: 'var(--color-tertiary)'
        },
        app: {
          bg: 'var(--color-bg)',
          'bg-alt': 'var(--color-bg-alt)',
          'text-primary': 'var(--color-text-primary)',
          'text-secondary': 'var(--color-text-secondary)',
          border: 'var(--color-border)'
        },
        state: {
          success: 'var(--color-success)',
          error: 'var(--color-error)',
          warning: 'var(--color-warning)',
          info: 'var(--color-info)'
        }
      },
      boxShadow: {
        app: '0 10px 30px rgba(2, 6, 23, 0.35)'
      }
    }
  },
  plugins: []
}
