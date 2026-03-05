const SERVICE_NAME: &str = "rbx-asset-uploader";
const API_KEY_USER: &str = "api-key";

pub fn save_api_key(key: &str) -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, API_KEY_USER)
        .map_err(|e| format!("Failed to create keyring entry: {e}"))?;
    entry
        .set_password(key)
        .map_err(|e| format!("Failed to save API key: {e}"))
}

pub fn load_api_key() -> Result<Option<String>, String> {
    let entry = keyring::Entry::new(SERVICE_NAME, API_KEY_USER)
        .map_err(|e| format!("Failed to create keyring entry: {e}"))?;
    match entry.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(format!("Failed to load API key: {e}")),
    }
}

pub fn delete_api_key() -> Result<(), String> {
    let entry = keyring::Entry::new(SERVICE_NAME, API_KEY_USER)
        .map_err(|e| format!("Failed to create keyring entry: {e}"))?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("Failed to delete API key: {e}")),
    }
}

pub fn has_api_key() -> Result<bool, String> {
    load_api_key().map(|opt| opt.is_some())
}
