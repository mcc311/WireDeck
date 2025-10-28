import { WgConfig } from '../../types';
import { InterfaceHeader } from './InterfaceHeader';
import { PeersList } from './PeersList';
import styles from './Sidebar.module.css';

interface SidebarProps {
  configs: string[];
  activeConfig: string;
  config: WgConfig | null;
  isUp: boolean;
  selectedPeer: string | null;
  onConfigChange: (name: string) => void;
  onStart: () => void;
  onStop: () => void;
  onPeerSelect: (publicKey: string) => void;
  onAddPeer: () => void;
  isPeerActive: (publicKey: string) => boolean;
}

export function Sidebar({
  configs,
  activeConfig,
  config,
  isUp,
  selectedPeer,
  onConfigChange,
  onStart,
  onStop,
  onPeerSelect,
  onAddPeer,
  isPeerActive
}: SidebarProps) {
  if (!config) return null;

  return (
    <aside className={styles.sidebar}>
      <InterfaceHeader
        configs={configs}
        activeConfig={activeConfig}
        configName={config.name}
        isUp={isUp}
        onConfigChange={onConfigChange}
        onStart={onStart}
        onStop={onStop}
      />

      <div className={styles.divider}></div>

      <div className={styles.interfaceInfo}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Address</span>
          <span className={styles.infoValue}>{config.interface.address}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Port</span>
          <span className={styles.infoValue}>{config.interface.listen_port}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Public Key</span>
          <code className={styles.infoValue}>{config.interface.private_key.substring(0, 16)}...</code>
        </div>
      </div>

      <PeersList
        peers={config.peers}
        selectedPeer={selectedPeer}
        onPeerSelect={onPeerSelect}
        onAddPeer={onAddPeer}
        isPeerActive={isPeerActive}
      />
    </aside>
  );
}
