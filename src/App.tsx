import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { WgConfig, Peer, PeerStatus, Theme } from "./types";
import { isPeerActive, getPeerStatus } from "./utils/helpers";
import { Sidebar } from "./components/Sidebar/Sidebar";
import { ThemeToggle } from "./components/ThemeToggle";
import { ErrorBanner } from "./components/ErrorBanner";
import { EmptyState } from "./components/EmptyState";
import { PeerDetails } from "./components/PeerDetails/PeerDetails";
import "./styles/globals.css";
import "./styles/layout.css";
import "./styles/modal.css";

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
  const [theme, setTheme] = useState<Theme>('system');

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
      const loadedConfig = await invoke<WgConfig>("load_wireguard_config", { name });
      setConfig(loadedConfig);

      const status = await invoke<boolean>("check_interface_status", { configName: name });
      setIsUp(status);

      if (status) {
        await loadStatus();
      }

      setError("");
    } catch (e) {
      setError(`Failed to load config: ${e}`);
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
      await invoke("restart_interface", { name: activeConfig });
      setIsUp(true);
      setError("");
      await loadStatus();
    } catch (e) {
      setError(`Failed to start interface: ${e}`);
    }
  }

  async function handleBringDown() {
    if (!activeConfig) return;
    try {
      await invoke("bring_down_interface", { name: activeConfig });
      setIsUp(false);
      setPeerStatuses([]);
      setError("");
    } catch (e) {
      setError(`Failed to stop interface: ${e}`);
    }
  }

  async function handleDeletePeer(publicKey: string) {
    if (!config) return;
    if (!confirm("Are you sure you want to delete this peer?")) return;

    try {
      const updatedPeers = config.peers.filter(p => p.public_key !== publicKey);
      await invoke("save_wireguard_config", {
        name: activeConfig,
        config: { ...config, peers: updatedPeers }
      });

      setConfig({ ...config, peers: updatedPeers });
      if (selectedPeer === publicKey) {
        setSelectedPeer(null);
      }
      setError("");
    } catch (e) {
      setError(`Failed to delete peer: ${e}`);
    }
  }

  async function handleSavePeer(peer: Peer) {
    if (!config) return;

    try {
      let updatedPeers: Peer[];
      if (editingPeer) {
        updatedPeers = config.peers.map(p =>
          p.public_key === editingPeer.public_key ? peer : p
        );
      } else {
        updatedPeers = [...config.peers, peer];
      }

      await invoke("save_wireguard_config", {
        name: activeConfig,
        config: { ...config, peers: updatedPeers }
      });

      setConfig({ ...config, peers: updatedPeers });
      setShowAddPeer(false);
      setEditingPeer(null);
      setError("");
    } catch (e) {
      setError(`Failed to save peer: ${e}`);
    }
  }

  async function handleGenerateKeypair() {
    try {
      const result = await invoke<{ private_key: string; public_key: string }>("generate_keypair");
      return { privateKey: result.private_key, publicKey: result.public_key };
    } catch (e) {
      setError(`Failed to generate keypair: ${e}`);
      return null;
    }
  }

  if (loading && !config) {
    return <div className="container">Loading...</div>;
  }

  if (configs.length === 0) {
    return (
      <div className="container">
        <div className="empty">
          <h2>No WireGuard configurations found</h2>
          <p>
            Please create a WireGuard configuration file in <code>/opt/homebrew/etc/wireguard/</code> or <code>/usr/local/etc/wireguard/</code>
          </p>
        </div>
      </div>
    );
  }

  const selectedPeerData = config?.peers.find(p => p.public_key === selectedPeer);
  const selectedPeerStatus = selectedPeer ? getPeerStatus(selectedPeer, peerStatuses) : undefined;

  return (
    <div className="app-layout">
      <Sidebar
        configs={configs}
        activeConfig={activeConfig}
        config={config}
        isUp={isUp}
        selectedPeer={selectedPeer}
        onConfigChange={setActiveConfig}
        onStart={handleRestart}
        onStop={handleBringDown}
        onPeerSelect={setSelectedPeer}
        onAddPeer={() => setShowAddPeer(true)}
        isPeerActive={(publicKey) => isPeerActive(publicKey, peerStatuses)}
      />

      <main className="main-content">
        <ThemeToggle theme={theme} onChange={setTheme} />

        {error && <ErrorBanner message={error} />}

        {!selectedPeerData ? (
          <EmptyState
            title="Select a peer to view details"
            description="Choose a peer from the sidebar to see its configuration and status"
          />
        ) : (
          <PeerDetails
            peer={selectedPeerData}
            status={selectedPeerStatus}
            isUp={isUp}
            isActive={isPeerActive(selectedPeerData.public_key, peerStatuses)}
            onEdit={() => setEditingPeer(selectedPeerData)}
            onDelete={() => handleDeletePeer(selectedPeerData.public_key)}
          />
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
