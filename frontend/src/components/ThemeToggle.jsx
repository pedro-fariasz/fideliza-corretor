import { useTheme } from '../hooks/useTheme';

// Toggle de dark mode — usado nas telas autenticadas (nunca no login).
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? 'Ativar tema claro' : 'Ativar tema escuro'}
      title={isDark ? 'Tema claro' : 'Tema escuro'}
      className={
        'inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 ' +
        'text-gray-600 transition-colors hover:bg-gray-100 ' +
        'dark:border-white/15 dark:text-gray-300 dark:hover:bg-white/10 ' +
        className
      }
    >
      <span aria-hidden="true">{isDark ? '☀️' : '🌙'}</span>
    </button>
  );
}
