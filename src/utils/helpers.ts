import { PeerStatus } from '../types';

export function getPeerStatus(publicKey: string, peerStatuses: PeerStatus[]): PeerStatus | undefined {
  return peerStatuses.find(s => s.public_key === publicKey);
}

export function isPeerActive(publicKey: string, peerStatuses: PeerStatus[]): boolean {
  const status = getPeerStatus(publicKey, peerStatuses);
  return status?.latest_handshake !== undefined && status.latest_handshake !== "0";
}
