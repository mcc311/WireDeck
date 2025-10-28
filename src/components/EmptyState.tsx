import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  description?: string;
}

export function EmptyState({ title, description }: EmptyStateProps) {
  return (
    <div className={styles.emptyState}>
      <h2>{title}</h2>
      {description && <p>{description}</p>}
    </div>
  );
}
