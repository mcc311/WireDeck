export function formatHandshake(timestamp?: string): string {
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

export function formatBytes(bytes?: string): string {
  if (!bytes) return "0 B";
  const b = parseInt(bytes);
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 * 1024 * 1024) return `${(b / (1024 * 1024)).toFixed(1)} MB`;
  return `${(b / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
