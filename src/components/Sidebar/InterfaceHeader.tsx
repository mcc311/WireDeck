import { StatusDot } from '../StatusDot';
import styles from './InterfaceHeader.module.css';

interface InterfaceHeaderProps {
  configs: string[];
  activeConfig: string;
  configName: string;
  isUp: boolean;
  onConfigChange: (name: string) => void;
  onStart: () => void;
  onStop: () => void;
}

export function InterfaceHeader({
  configs,
  activeConfig,
  configName,
  isUp,
  onConfigChange,
  onStart,
  onStop
}: InterfaceHeaderProps) {
  const hasMultipleConfigs = configs.length > 1;

  return (
    <>
      {hasMultipleConfigs ? (
        <div className={styles.interfaceSelector}>
          <StatusDot active={isUp} />
          <select
            className={styles.interfaceSelect}
            value={activeConfig}
            onChange={(e) => onConfigChange(e.target.value)}
          >
            {configs.map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          {isUp ? (
            <button onClick={onStop} className={`${styles.btnText} ${styles.btnDanger}`}>
              Stop
            </button>
          ) : (
            <button onClick={onStart} className={`${styles.btnText} ${styles.btnPrimary}`}>
              Start
            </button>
          )}
        </div>
      ) : (
        <div className={styles.interfaceHeader}>
          <StatusDot active={isUp} />
          <span className={styles.interfaceTitle}>{configName}</span>
          {isUp ? (
            <button onClick={onStop} className={`${styles.btnText} ${styles.btnDanger}`}>
              Stop
            </button>
          ) : (
            <button onClick={onStart} className={`${styles.btnText} ${styles.btnPrimary}`}>
              Start
            </button>
          )}
        </div>
      )}
    </>
  );
}
