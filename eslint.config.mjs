import nextConfig from 'eslint-config-next';

// eslint-plugin-react@7.x uses context.getFilename() which was removed in
// ESLint 9+ flat config. Drop the react plugin and its rules from the Next.js
// preset until eslint-plugin-react ships a flat-config-compatible release.
// TypeScript, react-hooks, jsx-a11y, and @next/next rules are unaffected.
const REACT_RULES_PREFIX = 'react/';

const config = (Array.isArray(nextConfig) ? nextConfig : [nextConfig]).map((entry) => {
  if (!entry.plugins?.react) return entry;
  const { react: _react, ...plugins } = entry.plugins;
  const rules = Object.fromEntries(
    Object.entries(entry.rules ?? {}).filter(([k]) => !k.startsWith(REACT_RULES_PREFIX)),
  );
  return { ...entry, plugins, rules };
});

export default config;
