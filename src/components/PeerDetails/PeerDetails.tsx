import { Peer, PeerStatus } from '../../types';
import { formatHandshake, formatBytes } from '../../utils/formatters';
import styles from './PeerDetails.module.css';

interface PeerDetailsProps {
  peer: Peer;
  status: PeerStatus | undefined;
  isUp: boolean;
  isActive: boolean;
  onEdit: () => void;
  onDelete: () => void;
}

export function PeerDetails({
  peer,
  status,
  isUp,
  isActive,
  onEdit,
  onDelete
}: PeerDetailsProps) {
  return (
    <div className={styles.peerDetails}>
      <div className={styles.detailsHeader}>
        <div>
          <h2>{peer.name || "Unnamed Peer"}</h2>
          <span className={`${styles.statusBadge} ${isActive ? styles.active : ''}`}>
            {isActive ? "Active" : "Inactive"}
          </span>
        </div>
        <div className={styles.detailsActions}>
          <button onClick={onEdit}>
            Edit
          </button>
          <button
            onClick={onDelete}
            className={styles.btnDanger}
          >
            Delete
          </button>
        </div>
      </div>

      <div className={styles.detailsGrid}>
        <div className={styles.detailSection}>
          <h3>Configuration</h3>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Public Key</span>
            <code className={styles.detailValue}>{peer.public_key}</code>
          </div>
          <div className={styles.detailRow}>
            <span className={styles.detailLabel}>Allowed IPs</span>
            <span className={styles.detailValue}>{peer.allowed_ips}</span>
          </div>
          {peer.endpoint && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Endpoint</span>
              <span className={styles.detailValue}>{peer.endpoint}</span>
            </div>
          )}
          {peer.persistent_keepalive && (
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Keepalive</span>
              <span className={styles.detailValue}>{peer.persistent_keepalive}s</span>
            </div>
          )}
        </div>

        {status && (
          <div className={styles.detailSection}>
            <h3>Connection Status</h3>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Last Handshake</span>
              <span className={styles.detailValue}>{formatHandshake(status.latest_handshake)}</span>
            </div>
            {status.endpoint && (
              <div className={styles.detailRow}>
                <span className={styles.detailLabel}>Connected Endpoint</span>
                <span className={styles.detailValue}>{status.endpoint}</span>
              </div>
            )}
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Transfer (RX)</span>
              <span className={`${styles.detailValue} ${styles.transferRx}`}>
                ↓ {formatBytes(status.transfer_rx)}
              </span>
            </div>
            <div className={styles.detailRow}>
              <span className={styles.detailLabel}>Transfer (TX)</span>
              <span className={`${styles.detailValue} ${styles.transferTx}`}>
                ↑ {formatBytes(status.transfer_tx)}
              </span>
            </div>
          </div>
        )}

        {!status && isUp && (
          <div className={styles.detailSection}>
            <h3>Connection Status</h3>
            <p className={styles.noStatus}>No active connection data available</p>
          </div>
        )}
      </div>
    </div>
  );
}
