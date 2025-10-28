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

  function formatHandshake(timestamp?: string): string {
    if (!timestamp || timestamp === "0") return "Never";
    const seconds = parseInt(timestamp);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
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

  return (
    <div className="container">
      <header className="header">
        <h1>WireDeck</h1>
        <p>WireGuard Server Manager</p>
      </header>

      {error && <div className="error">{error}</div>}

      {configs.length === 0 ? (
        <div className="empty">
          <p>No WireGuard configurations found.</p>
          <p>Create a config file in your WireGuard directory first.</p>
        </div>
      ) : (
        <>
          <div className="config-selector">
            <label>Configuration:</label>
            <select
              value={activeConfig}
              onChange={(e) => setActiveConfig(e.target.value)}
            >
              {configs.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <button onClick={loadConfigs}>Refresh</button>
          </div>

          {config && (
            <>
              <section className="server-info">
                <h2>Server Information</h2>
                <div className="info-grid">
                  <div className="info-item">
                    <span className="label">Address:</span>
                    <span>{config.interface.address}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Listen Port:</span>
                    <span>{config.interface.listen_port}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Status:</span>
                    <span className={isUp ? "status-up" : "status-down"}>
                      {isUp ? "🟢 Running" : "🔴 Stopped"}
                    </span>
                  </div>
                  <div className="info-item actions">
                    {isUp ? (
                      <button onClick={handleBringDown} className="btn-danger">
                        Stop Interface
                      </button>
                    ) : (
                      <button onClick={handleRestart} className="btn-primary">
                        Start Interface
                      </button>
                    )}
                    {isUp && (
                      <button onClick={handleRestart}>Restart</button>
                    )}
                  </div>
                </div>
              </section>

              <section className="peers-section">
                <div className="section-header">
                  <h2>Peers ({config.peers.length})</h2>
                  <button
                    onClick={() => setShowAddPeer(true)}
                    className="btn-primary"
                  >
                    + Add Peer
                  </button>
                </div>

                {config.peers.length === 0 ? (
                  <div className="empty">No peers configured</div>
                ) : (
                  <div className="peers-list">
                    {config.peers.map(peer => {
                      const status = getPeerStatus(peer.public_key);
                      const isActive = status?.latest_handshake && status.latest_handshake !== "0";

                      return (
                        <div key={peer.public_key} className="peer-card">
                          <div className="peer-header">
                            <h3>{peer.name || "Unnamed Peer"}</h3>
                            <span className={isActive ? "status-active" : "status-inactive"}>
                              {isActive ? "🟢 Active" : "🔴 Inactive"}
                            </span>
                          </div>
                          <div className="peer-info">
                            <div className="peer-field">
                              <span className="label">Public Key:</span>
                              <code>{peer.public_key.substring(0, 20)}...</code>
                            </div>
                            <div className="peer-field">
                              <span className="label">Allowed IPs:</span>
                              <span>{peer.allowed_ips}</span>
                            </div>
                            {status && (
                              <>
                                <div className="peer-field">
                                  <span className="label">Last Handshake:</span>
                                  <span>{formatHandshake(status.latest_handshake)}</span>
                                </div>
                                <div className="peer-field">
                                  <span className="label">Transfer:</span>
                                  <span>
                                    ↓ {formatBytes(status.transfer_rx)} /
                                    ↑ {formatBytes(status.transfer_tx)}
                                  </span>
                                </div>
                              </>
                            )}
                          </div>
                          <div className="peer-actions">
                            <button onClick={() => setEditingPeer(peer)}>Edit</button>
                            <button
                              onClick={() => handleDeletePeer(peer.public_key)}
                              className="btn-danger"
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </>
          )}
        </>
      )}

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
