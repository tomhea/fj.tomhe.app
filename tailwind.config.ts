import type { Config } from 'tailwindcss';

// We use Tailwind purely for utility layout/spacing classes (`flex`, `gap`,
// `truncate`, etc.). The IDE palette lives as CSS custom properties on
// `:root` in `app/globals.css` (search for `--ide-bg` etc.), which is the
// single source of truth. New code should reference those via
// `style={{ background: 'var(--ide-bg)' }}` rather than inline hex; older
// components still use hex for now and can migrate incrementally.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;