use regex::Regex;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum WgError {
    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parse error: {0}")]
    Parse(String),
    #[error("Command execution failed: {0}")]
    CommandFailed(String),
    #[error("Config not found: {0}")]
    NotFound(String),
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Interface {
    pub private_key: String,
    pub address: String,
    pub listen_port: u16,
    pub dns: Option<String>,
    pub post_up: Option<String>,
    pub post_down: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Peer {
    pub public_key: String,
    pub allowed_ips: String,
    pub persistent_keepalive: Option<u16>,
    pub endpoint: Option<String>,
    pub name: Option<String>, // From comment above peer
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WgConfig {
    pub name: String,
    pub path: PathBuf,
    pub interface: Interface,
    pub peers: Vec<Peer>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PeerStatus {
    pub public_key: String,
    pub endpoint: Option<String>,
    pub latest_handshake: Option<String>,
    pub transfer_rx: Option<String>,
    pub transfer_tx: Option<String>,
}

/// Get WireGuard config directory based on system architecture
pub fn get_wireguard_dir() -> PathBuf {
    // Check for Homebrew on Apple Silicon
    let arm_path = PathBuf::from("/opt/homebrew/etc/wireguard");
    if arm_path.exists() {
        return arm_path;
    }

    // Check for Homebrew on Intel
    let intel_path = PathBuf::from("/usr/local/etc/wireguard");
    if intel_path.exists() {
        return intel_path;
    }

    // Default to Intel path
    intel_path
}

/// List all WireGuard configuration files
pub fn list_configs() -> Result<Vec<String>, WgError> {
    let wg_dir = get_wireguard_dir();

    if !wg_dir.exists() {
        return Ok(Vec::new());
    }

    let entries = fs::read_dir(&wg_dir)?;
    let mut configs = Vec::new();

    for entry in entries {
        let entry = entry?;
        let path = entry.path();

        if path.extension().and_then(|s| s.to_str()) == Some("conf") {
            if let Some(name) = path.file_stem().and_then(|s| s.to_str()) {
                configs.push(name.to_string());
            }
        }
    }

    configs.sort();
    Ok(configs)
}

/// Parse WireGuard configuration file
pub fn parse_config(name: &str) -> Result<WgConfig, WgError> {
    let wg_dir = get_wireguard_dir();
    let path = wg_dir.join(format!("{}.conf", name));

    if !path.exists() {
        return Err(WgError::NotFound(name.to_string()));
    }

    let content = fs::read_to_string(&path)?;
    parse_config_content(name, &path, &content)
}

/// Parse WireGuard config from string content
fn parse_config_content(name: &str, path: &Path, content: &str) -> Result<WgConfig, WgError> {
    let mut interface: Option<Interface> = None;
    let mut peers: Vec<Peer> = Vec::new();
    let mut current_section = "";
    let mut current_peer: Option<Peer> = None;
    let mut last_comment: Option<String> = None;

    for line in content.lines() {
        let line = line.trim();

        // Skip empty lines
        if line.is_empty() {
            continue;
        }

        // Handle comments
        if line.starts_with('#') {
            last_comment = Some(line.trim_start_matches('#').trim().to_string());
            continue;
        }

        // Handle sections
        if line.starts_with('[') && line.ends_with(']') {
            // Save previous peer if exists
            if let Some(peer) = current_peer.take() {
                peers.push(peer);
            }

            current_section = line.trim_matches(|c| c == '[' || c == ']');

            if current_section == "Peer" {
                current_peer = Some(Peer {
                    public_key: String::new(),
                    allowed_ips: String::new(),
                    persistent_keepalive: None,
                    endpoint: None,
                    name: last_comment.clone(),
                });
                last_comment = None;
            }
            continue;
        }

        // Parse key-value pairs
        if let Some((key, value)) = line.split_once('=') {
            let key = key.trim();
            let value = value.trim().to_string();

            match current_section {
                "Interface" => {
                    if interface.is_none() {
                        interface = Some(Interface {
                            private_key: String::new(),
                            address: String::new(),
                            listen_port: 51820,
                            dns: None,
                            post_up: None,
                            post_down: None,
                        });
                    }

                    if let Some(ref mut iface) = interface {
                        match key {
                            "PrivateKey" => iface.private_key = value,
                            "Address" => iface.address = value,
                            "ListenPort" => iface.listen_port = value.parse().unwrap_or(51820),
                            "DNS" => iface.dns = Some(value),
                            "PostUp" => iface.post_up = Some(value),
                            "PostDown" => iface.post_down = Some(value),
                            _ => {}
                        }
                    }
                }
                "Peer" => {
                    if let Some(ref mut peer) = current_peer {
                        match key {
                            "PublicKey" => peer.public_key = value,
                            "AllowedIPs" => peer.allowed_ips = value,
                            "PersistentKeepalive" => peer.persistent_keepalive = value.parse().ok(),
                            "Endpoint" => peer.endpoint = Some(value),
                            _ => {}
                        }
                    }
                }
                _ => {}
            }
        }
    }

    // Save last peer
    if let Some(peer) = current_peer {
        peers.push(peer);
    }

    let interface = interface.ok_or_else(|| WgError::Parse("No [Interface] section found".to_string()))?;

    Ok(WgConfig {
        name: name.to_string(),
        path: path.to_path_buf(),
        interface,
        peers,
    })
}

/// Serialize WgConfig back to .conf format
pub fn serialize_config(config: &WgConfig) -> String {
    let mut output = String::new();

    // Interface section
    output.push_str("[Interface]\n");
    output.push_str(&format!("PrivateKey = {}\n", config.interface.private_key));
    output.push_str(&format!("Address = {}\n", config.interface.address));
    output.push_str(&format!("ListenPort = {}\n", config.interface.listen_port));

    if let Some(ref dns) = config.interface.dns {
        output.push_str(&format!("DNS = {}\n", dns));
    }

    if let Some(ref post_up) = config.interface.post_up {
        output.push_str(&format!("PostUp = {}\n", post_up));
    }

    if let Some(ref post_down) = config.interface.post_down {
        output.push_str(&format!("PostDown = {}\n", post_down));
    }

    // Peers
    for peer in &config.peers {
        output.push('\n');

        if let Some(ref name) = peer.name {
            output.push_str(&format!("# {}\n", name));
        }

        output.push_str("[Peer]\n");
        output.push_str(&format!("PublicKey = {}\n", peer.public_key));
        output.push_str(&format!("AllowedIPs = {}\n", peer.allowed_ips));

        if let Some(keepalive) = peer.persistent_keepalive {
            output.push_str(&format!("PersistentKeepalive = {}\n", keepalive));
        }

        if let Some(ref endpoint) = peer.endpoint {
            output.push_str(&format!("Endpoint = {}\n", endpoint));
        }
    }

    output
}

/// Save configuration to file
pub fn save_config(config: &WgConfig) -> Result<(), WgError> {
    let content = serialize_config(config);

    // Create backup
    if config.path.exists() {
        let backup_path = config.path.with_extension("conf.bak");
        fs::copy(&config.path, backup_path)?;
    }

    // Write new config
    fs::write(&config.path, content)?;
    Ok(())
}

/// Get status of all peers in a config
pub fn get_peer_status(config_name: &str) -> Result<Vec<PeerStatus>, WgError> {
    let output = Command::new("wg")
        .arg("show")
        .arg(config_name)
        .arg("dump")
        .output()?;

    if !output.status.success() {
        return Err(WgError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).to_string()
        ));
    }

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut statuses = Vec::new();

    for (i, line) in stdout.lines().enumerate() {
        if i == 0 {
            continue; // Skip interface line
        }

        let parts: Vec<&str> = line.split('\t').collect();
        if parts.len() >= 6 {
            statuses.push(PeerStatus {
                public_key: parts[0].to_string(),
                endpoint: if parts[2].is_empty() { None } else { Some(parts[2].to_string()) },
                latest_handshake: if parts[4] == "0" { None } else { Some(parts[4].to_string()) },
                transfer_rx: Some(parts[5].to_string()),
                transfer_tx: if parts.len() > 6 { Some(parts[6].to_string()) } else { None },
            });
        }
    }

    Ok(statuses)
}

/// Check if WireGuard interface is running
pub fn is_interface_up(config_name: &str) -> Result<bool, WgError> {
    let output = Command::new("wg")
        .arg("show")
        .arg(config_name)
        .output()?;

    Ok(output.status.success())
}

/// Bring up WireGuard interface
pub fn bring_up(config_name: &str) -> Result<String, WgError> {
    let output = Command::new("sudo")
        .arg("wg-quick")
        .arg("up")
        .arg(config_name)
        .output()?;

    if !output.status.success() {
        return Err(WgError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).to_string()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Bring down WireGuard interface
pub fn bring_down(config_name: &str) -> Result<String, WgError> {
    let output = Command::new("sudo")
        .arg("wg-quick")
        .arg("down")
        .arg(config_name)
        .output()?;

    if !output.status.success() {
        return Err(WgError::CommandFailed(
            String::from_utf8_lossy(&output.stderr).to_string()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

/// Restart WireGuard interface (down then up)
pub fn restart_interface(config_name: &str) -> Result<String, WgError> {
    // Try to bring down (ignore error if already down)
    let _ = bring_down(config_name);

    // Bring up
    bring_up(config_name)
}

/// Generate WireGuard key pair
pub fn generate_keypair() -> Result<(String, String), WgError> {
    // Generate private key
    let private_output = Command::new("wg")
        .arg("genkey")
        .output()?;

    if !private_output.status.success() {
        return Err(WgError::CommandFailed(
            "Failed to generate private key".to_string()
        ));
    }

    let private_key = String::from_utf8_lossy(&private_output.stdout).trim().to_string();

    // Generate public key from private key
    let public_output = Command::new("wg")
        .arg("pubkey")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(mut stdin) = child.stdin.take() {
                stdin.write_all(private_key.as_bytes())?;
            }
            child.wait_with_output()
        })?;

    if !public_output.status.success() {
        return Err(WgError::CommandFailed(
            "Failed to generate public key".to_string()
        ));
    }

    let public_key = String::from_utf8_lossy(&public_output.stdout).trim().to_string();

    Ok((private_key, public_key))
}

/// Get public key from private key
pub fn get_public_key(private_key: &str) -> Result<String, WgError> {
    let output = Command::new("wg")
        .arg("pubkey")
        .stdin(std::process::Stdio::piped())
        .stdout(std::process::Stdio::piped())
        .spawn()
        .and_then(|mut child| {
            use std::io::Write;
            if let Some(mut stdin) = child.stdin.take() {
                stdin.write_all(private_key.as_bytes())?;
            }
            child.wait_with_output()
        })?;

    if !output.status.success() {
        return Err(WgError::CommandFailed(
            "Failed to derive public key".to_string()
        ));
    }

    Ok(String::from_utf8_lossy(&output.stdout).trim().to_string())
}
