import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

interface WgInterface {
  private_key: string;
  address: string;
  listen_port: number;
  dns?: string;
  post_up?: string;
  post_down?: string;
}

interface Peer {
  public_key: string;
  allowed_ips: string;
  persistent_keepalive?: number;
  endpoint?: string;
  name?: string;
}

interface WgConfig {
  name: string;
  path: string;
  interface: WgInterface;
  peers: Peer[];
}

interface PeerStatus {
  public_key: string;
  endpoint?: string;
  latest_handshake?: string;
  transfer_rx?: string;
  transfer_tx?: string;
}

function App() {
  const [configs, setConfigs] = useState<string[]>([]);
  const [activeConfig, setActiveConfig] = useState<string>("");
  const [config, setConfig] = useState<WgConfig | null>(null);
  const [isUp, setIsUp] = useState<boolean>(false);
  const [peerStatuses, setPeerStatuses] = useState<PeerStatus[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");
  const [editingPeer, setEditingPeer] = useState<Peer | null>(null);
  const [showAddPeer, setShowAddPeer] = useState<boolean>(false);
  const [selectedPeer, setSelectedPeer] = useState<string | null>(null);
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>('system');

  // Load configs on mount
  useEffect(() => {
    loadConfigs();
  }, []);

  // Load active config when selection changes
  useEffect(() => {
    if (activeConfig) {
      loadConfig(activeConfig);
    }
  }, [activeConfig]);

  // Poll status every 5 seconds
  useEffect(() => {
    if (activeConfig && isUp) {
      const interval = setInterval(() => {
        loadStatus();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeConfig, isUp]);

  // Apply theme
  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.classList.remove('light-mode', 'dark-mode');
    } else if (theme === 'dark') {
      root.classList.remove('light-mode');
      root.classList.add('dark-mode');
    } else {
      root.classList.remove('dark-mode');
      root.classList.add('light-mode');
    }
  }, [theme]);

  async function loadConfigs() {
    try {
      setLoading(true);
      const configList = await invoke<string[]>("list_wireguard_configs");
      setConfigs(configList);
      if (configList.length > 0 && !activeConfig) {
        setActiveConfig(configList[0]);
      }
      setError("");
    } catch (e) {
      setError(`Failed to load configs: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadConfig(name: string) {
    try {
      setLoading(true);
      const cfg = await invoke<WgConfig>("load_wireguard_config", { name });
      setConfig(cfg);

      // Check if interface is up
      const up = await invoke<boolean>("check_interface_status", { configName: name });
      setIsUp(up);

      if (up) {
        await loadStatus();
      }

      setError("");
    } catch (e) {
      setError(`Failed to load config: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function loadStatus() {
    if (!activeConfig) return;

    try {
      const statuses = await invoke<PeerStatus[]>("get_wireguard_status", {
        configName: activeConfig
      });
      setPeerStatuses(statuses);
    } catch (e) {
      console.error("Failed to load status:", e);
    }
  }

  async function handleRestart() {
    if (!activeConfig) return;

    try {
      setLoading(true);
      await invoke("restart_wireguard", { configName: activeConfig });
      setIsUp(true);
      await loadStatus();
      setError("");
    } catch (e) {
      setError(`Failed to restart: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleBringDown() {
    if (!activeConfig) return;

    try {
      setLoading(true);
      await invoke("bring_interface_down", { configName: activeConfig });
      setIsUp(false);
      setPeerStatuses([]);
      setError("");
    } catch (e) {
      setError(`Failed to bring down: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleDeletePeer(publicKey: string) {
    if (!activeConfig || !confirm("Are you sure you want to delete this peer?")) return;

    try {
      setLoading(true);
      const updated = await invoke<WgConfig>("delete_peer", {
        configName: activeConfig,
        publicKey
      });
      setConfig(updated);
      setError("");
    } catch (e) {
      setError(`Failed to delete peer: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSavePeer(peer: Peer) {
    if (!activeConfig) return;

    try {
      setLoading(true);

      if (editingPeer) {
        // Update existing peer
        const updated = await invoke<WgConfig>("update_peer", {
          configName: activeConfig,
          publicKey: editingPeer.public_key,
          updatedPeer: peer
        });
        setConfig(updated);
      } else {
        // Add new peer
        const updated = await invoke<WgConfig>("add_peer", {
          configName: activeConfig,
          peer
        });
        setConfig(updated);
      }

      setEditingPeer(null);
      setShowAddPeer(false);
      setError("");
    } catch (e) {
      setError(`Failed to save peer: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleGenerateKeypair() {
    try {
      const [privateKey, publicKey] = await invoke<[string, string]>("generate_wireguard_keypair");
      return { privateKey, publicKey };
    } catch (e) {
      setError(`Failed to generate keypair: ${e}`);
      return null;
    }
  }

  function getPeerStatus(publicKey: string): PeerStatus | undefined {
    return peerStatuses.find(s => s.public_key === publicKey);
  }

  function isPeerActive(publicKey: string): boolean {
    const status = getPeerStatus(publicKey);
    return status?.latest_handshake !== undefined && status.latest_handshake !== "0";
  }

  function formatHandshake(timestamp?: string): string {
    if (!timestamp || timestamp === "0") return "Never";

    // timestamp is Unix time in seconds, calculate seconds ago
    const unixTime = parseInt(timestamp);
    const now = Math.floor(Date.now() / 1000);
    const secondsAgo = now - unixTime;

    if (secondsAgo < 0) return "Just now";
    if (secondsAgo < 60) return `${secondsAgo} seconds ago`;
    if (secondsAgo < 3600) {
      const minutes = Math.floor(secondsAgo / 60);
      const seconds = secondsAgo % 60;
      return `${minutes} minute${minutes !== 1 ? 's' : ''}${seconds > 0 ? `, ${seconds} second${seconds !== 1 ? 's' : ''}` : ''} ago`;
    }
    if (secondsAgo < 86400) {
      const hours = Math.floor(secondsAgo / 3600);
      return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    }
    const days = Math.floor(secondsAgo / 86400);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
  }

  function formatBytes(bytes?: string): string {
    if (!bytes) return "0 B";
    const b = parseInt(bytes);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
    return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  }

  if (loading && !config) {
    return <div className="container">Loading...</div>;
  }

  if (configs.length === 0) {
    return (
      <div className="container">
        <div className="empty">
          <h2>No WireGuard configurations found</h2>
          <p>Create a config file in your WireGuard directory first.</p>
        </div>
      </div>
    );
  }

  const selectedPeerData = config?.peers.find(p => p.public_key === selectedPeer);
  const selectedPeerStatus = selectedPeer ? getPeerStatus(selectedPeer) : undefined;

  return (
    <div className="app-layout">
      {/* Sidebar */}
      <aside className="sidebar">
        {config && (
          <>
            {/* Interface Selector */}
            {configs.length > 1 ? (
              <div className="interface-selector">
                <span className={isUp ? "status-dot active" : "status-dot"}></span>
                <select
                  className="interface-select"
                  value={activeConfig}
                  onChange={(e) => setActiveConfig(e.target.value)}
                >
                  {configs.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
                {isUp ? (
                  <button onClick={handleBringDown} className="btn-text btn-danger">
                    Stop
                  </button>
                ) : (
                  <button onClick={handleRestart} className="btn-text btn-primary">
                    Start
                  </button>
                )}
              </div>
            ) : (
              <div className="interface-header">
                <span className={isUp ? "status-dot active" : "status-dot"}></span>
                <span className="interface-title">{config.name}</span>
                {isUp ? (
                  <button onClick={handleBringDown} className="btn-text btn-danger">
                    Stop
                  </button>
                ) : (
                  <button onClick={handleRestart} className="btn-text btn-primary">
                    Start
                  </button>
                )}
              </div>
            )}

            <div className="sidebar-divider"></div>

            {/* Interface Info */}
            <div className="interface-info-compact">
              <div className="info-item-compact">
                <span className="info-label-compact">Address</span>
                <span className="info-value-compact">{config.interface.address}</span>
              </div>
              <div className="info-item-compact">
                <span className="info-label-compact">Port</span>
                <span className="info-value-compact">{config.interface.listen_port}</span>
              </div>
              <div className="info-item-compact">
                <span className="info-label-compact">Public Key</span>
                <code className="info-value-compact">{config.interface.private_key.substring(0, 16)}...</code>
              </div>
            </div>

            {/* Peers Header */}
            <div className="peers-compact-header">
              <span>Peers ({config.peers.length})</span>
              <button
                onClick={() => setShowAddPeer(true)}
                className="btn-add"
                title="Add Peer"
              >
                +
              </button>
            </div>

            <div className="sidebar-divider"></div>

            {/* Peers List */}
            <div className="peers-compact-list">
              {config.peers.length === 0 ? (
                <div className="empty-peers">No peers configured</div>
              ) : (
                config.peers.map(peer => {
                  const isActive = isPeerActive(peer.public_key);
                  const isSelected = selectedPeer === peer.public_key;

                  return (
                    <div
                      key={peer.public_key}
                      className={`peer-compact-item ${isSelected ? "selected" : ""}`}
                      onClick={() => setSelectedPeer(peer.public_key)}
                    >
                      <span className={`status-dot ${isActive ? "active" : ""}`}></span>
                      <div className="peer-compact-info">
                        <span className="peer-compact-name">{peer.name || "Unnamed Peer"}</span>
                        <span className="peer-compact-ip">{peer.allowed_ips}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Theme Toggle */}
        <div className="theme-toggle">
          <button
            className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
            onClick={() => setTheme('light')}
            title="Light Mode"
          >
            ☀️
          </button>
          <button
            className={`theme-btn ${theme === 'system' ? 'active' : ''}`}
            onClick={() => setTheme('system')}
            title="System"
          >
            💻
          </button>
          <button
            className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
            onClick={() => setTheme('dark')}
            title="Dark Mode"
          >
            🌙
          </button>
        </div>

        {error && <div className="error">{error}</div>}

        {!selectedPeerData ? (
          <div className="empty-state">
            <h2>Select a peer to view details</h2>
            <p>Choose a peer from the sidebar to see its configuration and status</p>
          </div>
        ) : (
          <div className="peer-details">
            <div className="details-header">
              <div>
                <h2>{selectedPeerData.name || "Unnamed Peer"}</h2>
                <span className={isPeerActive(selectedPeerData.public_key) ? "status-badge active" : "status-badge"}>
                  {isPeerActive(selectedPeerData.public_key) ? "Active" : "Inactive"}
                </span>
              </div>
              <div className="details-actions">
                <button onClick={() => setEditingPeer(selectedPeerData)}>
                  Edit
                </button>
                <button
                  onClick={() => handleDeletePeer(selectedPeerData.public_key)}
                  className="btn-danger"
                >
                  Delete
                </button>
              </div>
            </div>

            <div className="details-grid">
              <div className="detail-section">
                <h3>Configuration</h3>
                <div className="detail-row">
                  <span className="detail-label">Public Key</span>
                  <code className="detail-value">{selectedPeerData.public_key}</code>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Allowed IPs</span>
                  <span className="detail-value">{selectedPeerData.allowed_ips}</span>
                </div>
                {selectedPeerData.endpoint && (
                  <div className="detail-row">
                    <span className="detail-label">Endpoint</span>
                    <span className="detail-value">{selectedPeerData.endpoint}</span>
                  </div>
                )}
                {selectedPeerData.persistent_keepalive && (
                  <div className="detail-row">
                    <span className="detail-label">Keepalive</span>
                    <span className="detail-value">{selectedPeerData.persistent_keepalive}s</span>
                  </div>
                )}
              </div>

              {selectedPeerStatus && (
                <div className="detail-section">
                  <h3>Connection Status</h3>
                  <div className="detail-row">
                    <span className="detail-label">Last Handshake</span>
                    <span className="detail-value">{formatHandshake(selectedPeerStatus.latest_handshake)}</span>
                  </div>
                  {selectedPeerStatus.endpoint && (
                    <div className="detail-row">
                      <span className="detail-label">Connected Endpoint</span>
                      <span className="detail-value">{selectedPeerStatus.endpoint}</span>
                    </div>
                  )}
                  <div className="detail-row">
                    <span className="detail-label">Transfer (RX)</span>
                    <span className="detail-value transfer-rx">
                      ↓ {formatBytes(selectedPeerStatus.transfer_rx)}
                    </span>
                  </div>
                  <div className="detail-row">
                    <span className="detail-label">Transfer (TX)</span>
                    <span className="detail-value transfer-tx">
                      ↑ {formatBytes(selectedPeerStatus.transfer_tx)}
                    </span>
                  </div>
                </div>
              )}

              {!selectedPeerStatus && isUp && (
                <div className="detail-section">
                  <h3>Connection Status</h3>
                  <p className="no-status">No active connection data available</p>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {(showAddPeer || editingPeer) && (
        <PeerEditor
          peer={editingPeer}
          onSave={handleSavePeer}
          onCancel={() => {
            setShowAddPeer(false);
            setEditingPeer(null);
          }}
          onGenerateKeypair={handleGenerateKeypair}
        />
      )}
    </div>
  );
}

interface PeerEditorProps {
  peer: Peer | null;
  onSave: (peer: Peer) => void;
  onCancel: () => void;
  onGenerateKeypair: () => Promise<{ privateKey: string; publicKey: string } | null>;
}

function PeerEditor({ peer, onSave, onCancel, onGenerateKeypair }: PeerEditorProps) {
  const [formData, setFormData] = useState<Peer>(
    peer || {
      public_key: "",
      allowed_ips: "",
      persistent_keepalive: 25,
      endpoint: "",
      name: "",
    }
  );

  const [generatedPrivateKey, setGeneratedPrivateKey] = useState<string>("");

  async function handleGenerate() {
    const result = await onGenerateKeypair();
    if (result) {
      setFormData({ ...formData, public_key: result.publicKey });
      setGeneratedPrivateKey(result.privateKey);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSave(formData);
  }

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{peer ? "Edit Peer" : "Add New Peer"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Name (optional):</label>
            <input
              type="text"
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Alice's Phone"
            />
          </div>

          <div className="form-group">
            <label>Public Key:</label>
            <div className="input-with-button">
              <input
                type="text"
                value={formData.public_key}
                onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                placeholder="Enter public key"
                required
              />
              {!peer && (
                <button type="button" onClick={handleGenerate}>
                  Generate
                </button>
              )}
            </div>
          </div>

          {generatedPrivateKey && (
            <div className="form-group">
              <label>Private Key (for client):</label>
              <textarea
                value={generatedPrivateKey}
                readOnly
                rows={3}
                style={{ fontFamily: "monospace", fontSize: "0.9em" }}
              />
              <small>Save this! It won't be shown again.</small>
            </div>
          )}

          <div className="form-group">
            <label>Allowed IPs:</label>
            <input
              type="text"
              value={formData.allowed_ips}
              onChange={(e) => setFormData({ ...formData, allowed_ips: e.target.value })}
              placeholder="e.g., 10.0.0.2/32"
              required
            />
          </div>

          <div className="form-group">
            <label>Persistent Keepalive (seconds, optional):</label>
            <input
              type="number"
              value={formData.persistent_keepalive || ""}
              onChange={(e) => setFormData({
                ...formData,
                persistent_keepalive: e.target.value ? parseInt(e.target.value) : undefined
              })}
              placeholder="25"
            />
          </div>

          <div className="form-group">
            <label>Endpoint (optional):</label>
            <input
              type="text"
              value={formData.endpoint || ""}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              placeholder="e.g., 1.2.3.4:51820"
            />
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default App;
