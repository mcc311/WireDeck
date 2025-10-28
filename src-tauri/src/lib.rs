mod wireguard;

use wireguard::*;

// WireGuard configuration management commands

#[tauri::command]
fn list_wireguard_configs() -> Result<Vec<String>, String> {
    list_configs().map_err(|e| e.to_string())
}

#[tauri::command]
fn load_wireguard_config(name: String) -> Result<WgConfig, String> {
    parse_config(&name).map_err(|e| e.to_string())
}

#[tauri::command]
fn save_wireguard_config(config: WgConfig) -> Result<(), String> {
    save_config(&config).map_err(|e| e.to_string())
}

#[tauri::command]
fn add_peer(config_name: String, peer: Peer) -> Result<WgConfig, String> {
    let mut config = parse_config(&config_name).map_err(|e| e.to_string())?;
    config.peers.push(peer);
    save_config(&config).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
fn update_peer(config_name: String, public_key: String, updated_peer: Peer) -> Result<WgConfig, String> {
    let mut config = parse_config(&config_name).map_err(|e| e.to_string())?;

    if let Some(peer) = config.peers.iter_mut().find(|p| p.public_key == public_key) {
        *peer = updated_peer;
        save_config(&config).map_err(|e| e.to_string())?;
        Ok(config)
    } else {
        Err("Peer not found".to_string())
    }
}

#[tauri::command]
fn delete_peer(config_name: String, public_key: String) -> Result<WgConfig, String> {
    let mut config = parse_config(&config_name).map_err(|e| e.to_string())?;
    config.peers.retain(|p| p.public_key != public_key);
    save_config(&config).map_err(|e| e.to_string())?;
    Ok(config)
}

#[tauri::command]
fn get_wireguard_status(config_name: String) -> Result<Vec<PeerStatus>, String> {
    get_peer_status(&config_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn check_interface_status(config_name: String) -> Result<bool, String> {
    is_interface_up(&config_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn restart_wireguard(config_name: String) -> Result<String, String> {
    restart_interface(&config_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn bring_interface_up(config_name: String) -> Result<String, String> {
    bring_up(&config_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn bring_interface_down(config_name: String) -> Result<String, String> {
    bring_down(&config_name).map_err(|e| e.to_string())
}

#[tauri::command]
fn generate_wireguard_keypair() -> Result<(String, String), String> {
    generate_keypair().map_err(|e| e.to_string())
}

#[tauri::command]
fn derive_public_key(private_key: String) -> Result<String, String> {
    get_public_key(&private_key).map_err(|e| e.to_string())
}

#[tauri::command]
fn get_wireguard_directory() -> String {
    get_wireguard_dir().to_string_lossy().to_string()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            list_wireguard_configs,
            load_wireguard_config,
            save_wireguard_config,
            add_peer,
            update_peer,
            delete_peer,
            get_wireguard_status,
            check_interface_status,
            restart_wireguard,
            bring_interface_up,
            bring_interface_down,
            generate_wireguard_keypair,
            derive_public_key,
            get_wireguard_directory,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
