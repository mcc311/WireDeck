import { Peer } from '../../types';
import { StatusDot } from '../StatusDot';
import styles from './PeersList.module.css';

interface PeersListProps {
  peers: Peer[];
  selectedPeer: string | null;
  onPeerSelect: (publicKey: string) => void;
  onAddPeer: () => void;
  isPeerActive: (publicKey: string) => boolean;
}

export function PeersList({
  peers,
  selectedPeer,
  onPeerSelect,
  onAddPeer,
  isPeerActive
}: PeersListProps) {
  return (
    <>
      <div className={styles.peersHeader}>
        <span>Peers ({peers.length})</span>
        <button
          onClick={onAddPeer}
          className={styles.btnAdd}
          title="Add Peer"
        >
          +
        </button>
      </div>

      <div className={styles.divider}></div>

      <div className={styles.peersList}>
        {peers.length === 0 ? (
          <div className={styles.emptyPeers}>No peers configured</div>
        ) : (
          peers.map(peer => {
            const isActive = isPeerActive(peer.public_key);
            const isSelected = selectedPeer === peer.public_key;

            return (
              <div
                key={peer.public_key}
                className={`${styles.peerItem} ${isSelected ? styles.selected : ''}`}
                onClick={() => onPeerSelect(peer.public_key)}
              >
                <StatusDot active={isActive} />
                <div className={styles.peerInfo}>
                  <span className={styles.peerName}>{peer.name || "Unnamed Peer"}</span>
                  <span className={styles.peerIp}>{peer.allowed_ips}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
