import type { Config } from 'tailwindcss';

// We use Tailwind purely for utility layout/spacing classes (`flex`, `gap`,
// `truncate`, etc.). The IDE palette is intentionally hex-coded inline in
// the components matching VS Code's "Dark+" so what-you-see-in-source is
// what-you-see-on-screen. If a runtime-switchable theme ever lands, the
// cleanest migration is to emit CSS custom properties on `:root` in
// globals.css and swap the inline literals for `var(--ide-bg)` etc.
const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: { extend: {} },
  plugins: [],
};

export default config;