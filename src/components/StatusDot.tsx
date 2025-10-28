import styles from './StatusDot.module.css';

interface StatusDotProps {
  active: boolean;
}

export function StatusDot({ active }: StatusDotProps) {
  return (
    <span className={`${styles.statusDot} ${active ? styles.active : ''}`}></span>
  );
}
