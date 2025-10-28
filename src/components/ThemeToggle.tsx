import { Theme } from '../types';
import styles from './ThemeToggle.module.css';

interface ThemeToggleProps {
  theme: Theme;
  onChange: (theme: Theme) => void;
}

export function ThemeToggle({ theme, onChange }: ThemeToggleProps) {
  return (
    <div className={styles.themeToggle}>
      <button
        className={`${styles.themeBtn} ${theme === 'light' ? styles.active : ''}`}
        onClick={() => onChange('light')}
        title="Light Mode"
      >
        ☀️
      </button>
      <button
        className={`${styles.themeBtn} ${theme === 'system' ? styles.active : ''}`}
        onClick={() => onChange('system')}
        title="System"
      >
        💻
      </button>
      <button
        className={`${styles.themeBtn} ${theme === 'dark' ? styles.active : ''}`}
        onClick={() => onChange('dark')}
        title="Dark Mode"
      >
        🌙
      </button>
    </div>
  );
}
