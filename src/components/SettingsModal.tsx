import { Theme } from '../types';
import styles from './SettingsModal.module.css';

interface SettingsModalProps {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  onClose: () => void;
}

export function SettingsModal({ theme, onThemeChange, onClose }: SettingsModalProps) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>Settings</h2>

        <div className={styles.settingsSection}>
          <h3>Theme</h3>
          <div className={styles.themeOptions}>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="theme"
                value="light"
                checked={theme === 'light'}
                onChange={() => onThemeChange('light')}
              />
              <span>☀️ Light</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="theme"
                value="system"
                checked={theme === 'system'}
                onChange={() => onThemeChange('system')}
              />
              <span>💻 System</span>
            </label>
            <label className={styles.radioLabel}>
              <input
                type="radio"
                name="theme"
                value="dark"
                checked={theme === 'dark'}
                onChange={() => onThemeChange('dark')}
              />
              <span>🌙 Dark</span>
            </label>
          </div>
        </div>

        <div className={styles.settingsSection}>
          <h3>Language</h3>
          <select className={styles.languageSelect} defaultValue="en">
            <option value="en">English</option>
            <option value="zh">中文</option>
          </select>
          <small className={styles.comingSoon}>Coming soon</small>
        </div>

        <div className="modal-actions">
          <button onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}
