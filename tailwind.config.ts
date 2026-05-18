import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // VS Code-inspired dark theme
        ide: {
          bg: '#1e1e1e',
          sidebar: '#252526',
          tabs: '#2d2d2d',
          activetab: '#1e1e1e',
          border: '#3c3c3c',
          hover: '#2a2d2e',
          selected: '#04395e',
          text: '#cccccc',
          dimtext: '#969696',
          accent: '#0078d4',
          green: '#4ec9b0',
          red: '#f44747',
          yellow: '#cca700',
        },
      },
    },
  },
  plugins: [],
};

export default config;
