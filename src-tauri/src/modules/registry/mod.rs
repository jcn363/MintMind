use serde::{Deserialize, Serialize};
use winreg::enums::*;
use winreg::RegKey;

#[derive(Serialize, Deserialize, Debug)]
pub struct RegistryValue {
    pub value: serde_json::Value,
    pub value_type: String,
}

pub fn parse_hive(hive: &str) -> Result<RegKey, String> {
    match hive.to_uppercase().as_str() {
        "HKEY_CLASSES_ROOT" | "HKCR" => Ok(RegKey::predef(HKEY_CLASSES_ROOT)),
        "HKEY_CURRENT_USER" | "HKCU" => Ok(RegKey::predef(HKEY_CURRENT_USER)),
        "HKEY_LOCAL_MACHINE" | "HKLM" => Ok(RegKey::predef(HKEY_LOCAL_MACHINE)),
        "HKEY_USERS" | "HKU" => Ok(RegKey::predef(HKEY_USERS)),
        "HKEY_CURRENT_CONFIG" | "HKCC" => Ok(RegKey::predef(HKEY_CURRENT_CONFIG)),
        _ => Err(format!("Invalid registry hive: {}", hive)),
    }
}

pub fn get_string_value(hive: &str, path: &str, name: &str) -> Result<String, String> {
    let hive_key = parse_hive(hive)?;
    let subkey = hive_key
        .open_subkey(path)
        .map_err(|e| format!("Failed to open registry key '{}': {}", path, e))?;
    let value: String = subkey
        .get_value(name)
        .map_err(|e| format!("Failed to read string value '{}': {}", name, e))?;
    Ok(value)
}

pub fn get_dword_value(hive: &str, path: &str, name: &str) -> Result<u32, String> {
    let hive_key = parse_hive(hive)?;
    let subkey = hive_key
        .open_subkey(path)
        .map_err(|e| format!("Failed to open registry key '{}': {}", path, e))?;
    let value: u32 = subkey
        .get_value(name)
        .map_err(|e| format!("Failed to read DWORD value '{}': {}", name, e))?;
    Ok(value)
}

pub fn get_binary_value(hive: &str, path: &str, name: &str) -> Result<Vec<u8>, String> {
    let hive_key = parse_hive(hive)?;
    let subkey = hive_key
        .open_subkey(path)
        .map_err(|e| format!("Failed to open registry key '{}': {}", path, e))?;
    let value: Vec<u8> = subkey
        .get_value(name)
        .map_err(|e| format!("Failed to read binary value '{}': {}", name, e))?;
    Ok(value)
}

pub fn enum_subkeys(hive: &str, path: &str) -> Result<Vec<String>, String> {
    let hive_key = parse_hive(hive)?;
    let subkey = hive_key
        .open_subkey(path)
        .map_err(|e| format!("Failed to open registry key '{}': {}", path, e))?;

    let mut subkeys = Vec::new();
    for key_name_result in subkey.enum_keys() {
        let key_name = key_name_result
            .map_err(|e| format!("Failed to enumerate subkeys: {}", e))?;
        subkeys.push(key_name);
    }
    Ok(subkeys)
}

pub fn enum_values(hive: &str, path: &str) -> Result<serde_json::Value, String> {
    let hive_key = parse_hive(hive)?;
    let subkey = hive_key
        .open_subkey(path)
        .map_err(|e| format!("Failed to open registry key '{}': {}", path, e))?;

    let mut values = serde_json::Map::new();
    for value_result in subkey.enum_values() {
        let (name, value_type) = value_result
            .map_err(|e| format!("Failed to enumerate values: {}", e))?;

        let value = match value_type {
            REG_SZ | REG_EXPAND_SZ | REG_MULTI_SZ => {
                let str_val: String = subkey.get_value(&name)
                    .map_err(|e| format!("Failed to read string value '{}': {}", name, e))?;
                serde_json::json!(str_val)
            },
            REG_DWORD => {
                let dword_val: u32 = subkey.get_value(&name)
                    .map_err(|e| format!("Failed to read DWORD value '{}': {}", name, e))?;
                serde_json::json!(dword_val)
            },
            REG_BINARY => {
                let binary_val: Vec<u8> = subkey.get_value(&name)
                    .map_err(|e| format!("Failed to read binary value '{}': {}", name, e))?;
                serde_json::json!(binary_val)
            },
            REG_QWORD => {
                let qword_val: u64 = subkey.get_value(&name)
                    .map_err(|e| format!("Failed to read QWORD value '{}': {}", name, e))?;
                serde_json::json!(qword_val)
            },
            REG_MULTI_SZ => {
                let multi_val: Vec<String> = subkey.get_value(&name)
                    .map_err(|e| format!("Failed to read multi-string value '{}': {}", name, e))?;
                serde_json::json!(multi_val)
            },
            _ => serde_json::json!(null),
        };

        values.insert(name, value);
    }

    Ok(serde_json::Value::Object(values))
}

pub fn key_exists(hive: &str, path: &str) -> Result<bool, String> {
    let hive_key = parse_hive(hive)?;
    match hive_key.open_subkey(path) {
        Ok(_) => Ok(true),
        Err(winreg::enums::Error::NotFound) => Ok(false),
        Err(e) => Err(format!("Failed to check key existence: {}", e)),
    }
}

pub fn value_exists(hive: &str, path: &str, name: &str) -> Result<bool, String> {
    let hive_key = parse_hive(hive)?;
    let subkey = hive_key
        .open_subkey(path)
        .map_err(|e| format!("Failed to open registry key '{}': {}", path, e))?;

    match subkey.get_value::<String, _>(name) {
        Ok(_) => Ok(true),
        Err(winreg::enums::Error::NotFound) => Ok(false),
        Err(e) => Err(format!("Failed to check value existence: {}", e)),
    }
}