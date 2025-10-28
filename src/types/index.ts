export interface WgInterface {
  private_key: string;
  address: string;
  listen_port: number;
  dns?: string;
  post_up?: string;
  post_down?: string;
}

export interface Peer {
  public_key: string;
  allowed_ips: string;
  persistent_keepalive?: number;
  endpoint?: string;
  name?: string;
}

export interface WgConfig {
  name: string;
  path: string;
  interface: WgInterface;
  peers: Peer[];
}

export interface PeerStatus {
  public_key: string;
  endpoint?: string;
  latest_handshake?: string;
  transfer_rx?: string;
  transfer_tx?: string;
}

export type Theme = 'light' | 'dark' | 'system';
