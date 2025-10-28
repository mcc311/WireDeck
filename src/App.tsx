import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, Play, Square, Plus, Trash2, Edit, Circle } from "lucide-react";
import { WgConfig, Peer, PeerStatus, Theme } from "./types";
import { isPeerActive, getPeerStatus } from "./utils/helpers";
import { formatHandshake, formatBytes } from "./utils/formatters";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import "@/styles/globals.css";

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
  const [showSettings, setShowSettings] = useState<boolean>(false);

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
    root.classList.remove('light', 'dark');

    if (theme === 'dark') {
      root.classList.add('dark');
    } else if (theme === 'light') {
      root.classList.add('light');
    } else {
      // System theme - let CSS media query handle it
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (systemDark) {
        root.classList.add('dark');
      }
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
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (configs.length === 0) {
    return (
      <div className="flex h-screen items-center justify-center p-8">
        <div className="text-center space-y-4">
          <h2 className="text-2xl font-bold">No WireGuard configurations found</h2>
          <p className="text-muted-foreground">
            Please create a WireGuard configuration file in{" "}
            <code className="bg-muted px-2 py-1 rounded">/opt/homebrew/etc/wireguard/</code> or{" "}
            <code className="bg-muted px-2 py-1 rounded">/usr/local/etc/wireguard/</code>
          </p>
        </div>
      </div>
    );
  }

  const selectedPeerData = config?.peers.find(p => p.public_key === selectedPeer);
  const selectedPeerStatus = selectedPeer ? getPeerStatus(selectedPeer, peerStatuses) : undefined;

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <aside className="w-80 border-r flex flex-col">
        {/* Interface Header */}
        <div className="p-4 border-b">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-2 h-2 rounded-full ${isUp ? 'bg-green-500 animate-pulse' : 'bg-gray-400'}`} />
            {configs.length > 1 ? (
              <select
                value={activeConfig}
                onChange={(e) => setActiveConfig(e.target.value)}
                className="flex-1 bg-transparent font-semibold text-lg focus:outline-none"
              >
                {configs.map(name => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            ) : (
              <span className="flex-1 font-semibold text-lg">{config?.name}</span>
            )}
          </div>
          <div className="flex gap-2">
            {isUp ? (
              <Button onClick={handleBringDown} variant="destructive" size="sm" className="flex-1">
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
            ) : (
              <Button onClick={handleRestart} size="sm" className="flex-1">
                <Play className="w-4 h-4 mr-2" />
                Start
              </Button>
            )}
          </div>
        </div>

        {/* Interface Info */}
        <div className="p-4 space-y-2 text-sm border-b">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Address</span>
            <span className="font-mono">{config?.interface.address}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Port</span>
            <span className="font-mono">{config?.interface.listen_port}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Public Key</span>
            <code className="text-xs">{config?.interface.private_key.substring(0, 16)}...</code>
          </div>
        </div>

        {/* Peers List */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-4 flex items-center justify-between border-b">
            <span className="font-semibold">Peers ({config?.peers.length || 0})</span>
            <Button onClick={() => setShowAddPeer(true)} size="icon" variant="ghost">
              <Plus className="w-4 h-4" />
            </Button>
          </div>
          <ScrollArea className="flex-1">
            <div className="p-2">
              {config?.peers.length === 0 ? (
                <div className="text-center text-muted-foreground py-8 text-sm">
                  No peers configured
                </div>
              ) : (
                config?.peers.map(peer => {
                  const isActive = isPeerActive(peer.public_key, peerStatuses);
                  const isSelected = selectedPeer === peer.public_key;

                  return (
                    <button
                      key={peer.public_key}
                      onClick={() => setSelectedPeer(peer.public_key)}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        isSelected
                          ? 'bg-accent'
                          : 'hover:bg-accent/50'
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Circle className={`w-2 h-2 mt-1.5 ${isActive ? 'fill-green-500 text-green-500' : 'fill-gray-400 text-gray-400'}`} />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">
                            {peer.name || "Unnamed Peer"}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {peer.allowed_ips}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </div>

        {/* Settings Button */}
        <div className="p-4 border-t">
          <Button onClick={() => setShowSettings(true)} variant="outline" className="w-full">
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-auto p-8">
        {error && (
          <div className="mb-6 p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive">
            {error}
          </div>
        )}

        {!selectedPeerData ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-2">
              <h2 className="text-2xl font-bold">Select a peer to view details</h2>
              <p className="text-muted-foreground">Choose a peer from the sidebar to see its configuration and status</p>
            </div>
          </div>
        ) : (
          <div className="max-w-4xl space-y-6">
            {/* Peer Header */}
            <div className="bg-card border rounded-lg p-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold mb-2">
                    {selectedPeerData.name || "Unnamed Peer"}
                  </h2>
                  <Badge variant={isPeerActive(selectedPeerData.public_key, peerStatuses) ? "success" : "secondary"}>
                    {isPeerActive(selectedPeerData.public_key, peerStatuses) ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setEditingPeer(selectedPeerData)} variant="outline" size="sm">
                    <Edit className="w-4 h-4 mr-2" />
                    Edit
                  </Button>
                  <Button
                    onClick={() => handleDeletePeer(selectedPeerData.public_key)}
                    variant="destructive"
                    size="sm"
                  >
                    <Trash2 className="w-4 h-4 mr-2" />
                    Delete
                  </Button>
                </div>
              </div>
            </div>

            {/* Configuration */}
            <div className="bg-card border rounded-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Configuration</h3>
              <div className="space-y-4">
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Public Key</div>
                  <code className="text-sm bg-muted p-2 rounded block break-all">
                    {selectedPeerData.public_key}
                  </code>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground mb-1">Allowed IPs</div>
                  <div className="font-mono text-sm">{selectedPeerData.allowed_ips}</div>
                </div>
                {selectedPeerData.endpoint && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Endpoint</div>
                    <div className="font-mono text-sm">{selectedPeerData.endpoint}</div>
                  </div>
                )}
                {selectedPeerData.persistent_keepalive && (
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Keepalive</div>
                    <div className="font-mono text-sm">{selectedPeerData.persistent_keepalive}s</div>
                  </div>
                )}
              </div>
            </div>

            {/* Connection Status */}
            {selectedPeerStatus && (
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-4">Connection Status</h3>
                <div className="space-y-4">
                  <div>
                    <div className="text-sm text-muted-foreground mb-1">Last Handshake</div>
                    <div className="text-sm">{formatHandshake(selectedPeerStatus.latest_handshake)}</div>
                  </div>
                  {selectedPeerStatus.endpoint && (
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Connected Endpoint</div>
                      <div className="font-mono text-sm">{selectedPeerStatus.endpoint}</div>
                    </div>
                  )}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Transfer (RX)</div>
                      <div className="text-sm text-green-600 dark:text-green-400 font-semibold">
                        ↓ {formatBytes(selectedPeerStatus.transfer_rx)}
                      </div>
                    </div>
                    <div>
                      <div className="text-sm text-muted-foreground mb-1">Transfer (TX)</div>
                      <div className="text-sm text-red-600 dark:text-red-400 font-semibold">
                        ↑ {formatBytes(selectedPeerStatus.transfer_tx)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {!selectedPeerStatus && isUp && (
              <div className="bg-card border rounded-lg p-6">
                <h3 className="text-lg font-semibold mb-2">Connection Status</h3>
                <p className="text-sm text-muted-foreground italic">No active connection data available</p>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Peer Editor Dialog */}
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

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Customize your WireDeck experience</DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            <div className="space-y-3">
              <Label>Theme</Label>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant={theme === 'light' ? 'default' : 'outline'}
                  onClick={() => setTheme('light')}
                  size="sm"
                >
                  ☀️ Light
                </Button>
                <Button
                  variant={theme === 'system' ? 'default' : 'outline'}
                  onClick={() => setTheme('system')}
                  size="sm"
                >
                  💻 System
                </Button>
                <Button
                  variant={theme === 'dark' ? 'default' : 'outline'}
                  onClick={() => setTheme('dark')}
                  size="sm"
                >
                  🌙 Dark
                </Button>
              </div>
            </div>
            <Separator />
            <div className="space-y-3">
              <Label>Language</Label>
              <select className="w-full h-9 rounded-md border border-input bg-transparent px-3 py-1 text-sm">
                <option>English</option>
                <option>中文</option>
              </select>
              <p className="text-xs text-muted-foreground">Coming soon</p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowSettings(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
    <Dialog open={true} onOpenChange={onCancel}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{peer ? "Edit Peer" : "Add New Peer"}</DialogTitle>
          <DialogDescription>
            Configure the peer settings for your WireGuard network
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              value={formData.name || ""}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Alice's Phone"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="public_key">Public Key</Label>
            <div className="flex gap-2">
              <Input
                id="public_key"
                value={formData.public_key}
                onChange={(e) => setFormData({ ...formData, public_key: e.target.value })}
                placeholder="Enter public key"
                required
                className="flex-1"
              />
              {!peer && (
                <Button type="button" onClick={handleGenerate} variant="outline">
                  Generate
                </Button>
              )}
            </div>
          </div>

          {generatedPrivateKey && (
            <div className="space-y-2">
              <Label>Private Key (for client)</Label>
              <textarea
                value={generatedPrivateKey}
                readOnly
                rows={3}
                className="w-full rounded-md border border-input bg-muted px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-muted-foreground">Save this! It won't be shown again.</p>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="allowed_ips">Allowed IPs</Label>
            <Input
              id="allowed_ips"
              value={formData.allowed_ips}
              onChange={(e) => setFormData({ ...formData, allowed_ips: e.target.value })}
              placeholder="e.g., 10.0.0.2/32"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="keepalive">Persistent Keepalive (seconds)</Label>
              <Input
                id="keepalive"
                type="number"
                value={formData.persistent_keepalive || ""}
                onChange={(e) => setFormData({
                  ...formData,
                  persistent_keepalive: e.target.value ? parseInt(e.target.value) : undefined
                })}
                placeholder="25"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endpoint">Endpoint (optional)</Label>
              <Input
                id="endpoint"
                value={formData.endpoint || ""}
                onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
                placeholder="e.g., 1.2.3.4:51820"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" onClick={onCancel} variant="outline">Cancel</Button>
            <Button type="submit">Save</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default App;
