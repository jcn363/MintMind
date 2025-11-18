use std::collections::HashMap;
use std::sync::Mutex;
use lazy_static::lazy_static;
use portable_pty::{native_pty_system, Child, CommandBuilder, MasterPty, PtySize};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use base64::{Engine as _, engine::general_purpose};

lazy_static! {
    static ref PTY_SESSIONS: Mutex<HashMap<String, PtySession>> = Mutex::new(HashMap::new());
}

#[derive(Debug)]
pub struct PtySession {
    pub pty_id: String,
    pub child_pid: u32,
    pub shell_type: Option<String>,
    pub cwd: Option<String>,
    pub title: Option<String>,
    #[allow(dead_code)]
    pub master_pty: Box<dyn MasterPty + Send>,
    #[allow(dead_code)]
    pub child: Box<dyn Child + Send>,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SpawnConfig {
    pub command: String,
    pub args: Vec<String>,
    pub cwd: Option<String>,
    pub env: Option<HashMap<String, String>>,
    pub cols: u16,
    pub rows: u16,
}

#[derive(Serialize, Deserialize, Debug)]
pub struct SpawnResult {
    pub pty_id: String,
    pub pid: u32,
    pub success: bool,
}

pub fn spawn_pty(config: SpawnConfig) -> Result<SpawnResult, String> {
    let pty_system = native_pty_system();
    let pty_pair = pty_system
        .openpty(PtySize {
            rows: config.rows,
            cols: config.cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    let mut cmd = CommandBuilder::new(&config.command);
    cmd.args(&config.args);
    if let Some(cwd) = &config.cwd {
        cmd.cwd(cwd);
    }
    if let Some(env) = &config.env {
        for (k, v) in env {
            cmd.env(k, v);
        }
    }

    let child = pty_pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn command: {}", e))?;

    let pty_id = uuid::Uuid::new_v4().to_string();
    let session = PtySession {
        pty_id: pty_id.clone(),
        child_pid: child.process_id().unwrap_or(0),
        shell_type: Some(config.command.clone()),
        cwd: config.cwd,
        title: None,
        master_pty: pty_pair.master,
        child,
    };

    {
        let mut sessions = PTY_SESSIONS.lock().unwrap();
        sessions.insert(pty_id.clone(), session);
    }

    {
        let mut sessions = PTY_SESSIONS.lock().unwrap();
        sessions.insert(pty_id.clone(), session);
    }

    let sessions = PTY_SESSIONS.lock().unwrap();
    let pid = sessions.get(&pty_id).unwrap().child_pid;

    Ok(SpawnResult {
        pty_id,
        pid,
        success: true,
    })
}

pub async fn write_to_pty(pty_id: &str, data: &str) -> Result<(), String> {
    let pty_id = pty_id.to_string();
    let data = data.to_string();
    tokio::task::spawn_blocking(move || {
        let mut sessions = PTY_SESSIONS.lock().unwrap();
        if let Some(session) = sessions.get_mut(&pty_id) {
            let encoded_data = data.as_bytes();
            session.master_pty.write_all(encoded_data)
                .map_err(|e| format!("Failed to write to PTY: {}", e))?;
            Ok(())
        } else {
            Err(format!("PTY session {} not found", pty_id))
        }
    }).await.map_err(|e| format!("Task join error: {}", e))?
}

pub async fn resize_pty(pty_id: &str, cols: u16, rows: u16) -> Result<(), String> {
    let pty_id = pty_id.to_string();
    tokio::task::spawn_blocking(move || {
        let mut sessions = PTY_SESSIONS.lock().unwrap();
        if let Some(session) = sessions.get_mut(&pty_id) {
            session.master_pty.resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            }).map_err(|e| format!("Failed to resize PTY: {}", e))?;
            Ok(())
        } else {
            Err(format!("PTY session {} not found", pty_id))
        }
    }).await.map_err(|e| format!("Task join error: {}", e))?
}

pub async fn read_from_pty(pty_id: &str) -> Result<String, String> {
    let pty_id = pty_id.to_string();
    tokio::task::spawn_blocking(move || {
        let mut sessions = PTY_SESSIONS.lock().unwrap();
        if let Some(session) = sessions.get_mut(&pty_id) {
            let mut buf = [0u8; 4096];
            match session.master_pty.read(&mut buf) {
                Ok(n) if n > 0 => {
                    let data = &buf[..n];
                    Ok(general_purpose::STANDARD.encode(data))
                }
                Ok(_) => Ok(String::new()),
                Err(e) => Err(format!("Failed to read from PTY: {}", e)),
            }
        } else {
            Err(format!("PTY session {} not found", pty_id))
        }
    }).await.map_err(|e| format!("Task join error: {}", e))?
}

pub async fn kill_pty(pty_id: &str) -> Result<(), String> {
    let pty_id = pty_id.to_string();
    tokio::task::spawn_blocking(move || {
        let mut sessions = PTY_SESSIONS.lock().unwrap();
        if let Some(mut session) = sessions.remove(&pty_id) {
            session.child.kill()
                .map_err(|e| format!("Failed to kill PTY process: {}", e))?;
            Ok(())
        } else {
            Err(format!("PTY session {} not found", pty_id))
        }
    }).await.map_err(|e| format!("Task join error: {}", e))?
}

pub async fn get_pty_info(pty_id: &str) -> Result<serde_json::Value, String> {
    let pty_id = pty_id.to_string();
    tokio::task::spawn_blocking(move || {
        let sessions = PTY_SESSIONS.lock().unwrap();
        if let Some(session) = sessions.get(&pty_id) {
            let info = serde_json::json!({
                "pty_id": session.pty_id,
                "pid": session.child_pid,
                "shell_type": session.shell_type,
                "cwd": session.cwd,
                "title": session.title,
            });
            Ok(info)
        } else {
            Err(format!("PTY session {} not found", pty_id))
        }
    }).await.map_err(|e| format!("Task join error: {}", e))?
}