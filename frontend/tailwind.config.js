/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        mono:    ['"JetBrains Mono"', '"Courier New"', 'monospace'],
        display: ['"Orbitron"', '"Arial Black"', 'sans-serif'],
        ui:      ['"Rajdhani"', '"Arial"', 'sans-serif'],
      },
      colors: {
        brand: {
          bg:      '#07070f',
          panel:   '#0c0c1a',
          border:  '#18183a',
          green:   '#00ff88',
          red:     '#ff3355',
          cyan:    '#00d4ff',
          gold:    '#ffd700',
          text:    '#b8b8d8',
          dim:     '#50507a',
          bright:  '#e8e8ff',
        },
      },
      animation: {
        'pulse-slow': 'pulse 3s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
