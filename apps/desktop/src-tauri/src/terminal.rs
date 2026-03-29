use portable_pty::{native_pty_system, CommandBuilder, PtySize};
use std::collections::HashMap;
use std::io::{Read, Write};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use tauri::{Emitter, WebviewWindow};
use tokio::sync::Mutex;

struct TerminalInstance {
    writer: Box<dyn Write + Send>,
    #[allow(dead_code)]
    child: Box<dyn portable_pty::Child + Send>,
    master: Box<dyn portable_pty::MasterPty + Send>,
    shutdown: Arc<AtomicBool>,
}

#[derive(Default, Clone)]
pub struct TerminalProcessState {
    terminals: Arc<Mutex<HashMap<String, TerminalInstance>>>,
}

#[derive(serde::Serialize, Clone)]
struct TerminalOutputEvent {
    terminal_id: String,
    data: String,
}

#[tauri::command]
pub async fn terminal_spawn(
    window: WebviewWindow,
    terminal_id: String,
    cwd: String,
    shell: Option<String>,
    state: tauri::State<'_, TerminalProcessState>,
) -> Result<(), String> {
    let pty_system = native_pty_system();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| format!("Failed to open PTY: {}", e))?;

    // Use provided shell or fall back to $SHELL / /bin/zsh
    let shell_path = shell.unwrap_or_else(|| {
        std::env::var("SHELL").unwrap_or_else(|_| "/bin/zsh".to_string())
    });

    let mut cmd = CommandBuilder::new(&shell_path);
    cmd.cwd(&cwd);
    // Set TERM for color support
    cmd.env("TERM", "xterm-256color");

    let child = pair
        .slave
        .spawn_command(cmd)
        .map_err(|e| format!("Failed to spawn shell: {}", e))?;

    let writer = pair
        .master
        .take_writer()
        .map_err(|e| format!("Failed to get PTY writer: {}", e))?;

    let mut reader = pair
        .master
        .try_clone_reader()
        .map_err(|e| format!("Failed to get PTY reader: {}", e))?;

    let shutdown = Arc::new(AtomicBool::new(false));
    let shutdown_clone = shutdown.clone();
    let tid = terminal_id.clone();

    // Read PTY output on a blocking thread and emit events
    std::thread::spawn(move || {
        let mut buf = [0u8; 4096];
        loop {
            if shutdown_clone.load(Ordering::Relaxed) {
                break;
            }
            match reader.read(&mut buf) {
                Ok(0) => break, // EOF
                Ok(n) => {
                    let data = String::from_utf8_lossy(&buf[..n]).to_string();
                    let _ = window.emit(
                        "terminal-output",
                        TerminalOutputEvent {
                            terminal_id: tid.clone(),
                            data,
                        },
                    );
                }
                Err(_) => break,
            }
        }
    });

    let instance = TerminalInstance {
        writer,
        child,
        master: pair.master,
        shutdown,
    };

    state
        .terminals
        .lock()
        .await
        .insert(terminal_id, instance);

    Ok(())
}

#[tauri::command]
pub async fn terminal_write(
    terminal_id: String,
    data: String,
    state: tauri::State<'_, TerminalProcessState>,
) -> Result<(), String> {
    let mut terminals = state.terminals.lock().await;
    if let Some(instance) = terminals.get_mut(&terminal_id) {
        instance
            .writer
            .write_all(data.as_bytes())
            .map_err(|e| format!("Failed to write to PTY: {}", e))?;
        instance
            .writer
            .flush()
            .map_err(|e| format!("Failed to flush PTY: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn terminal_resize(
    terminal_id: String,
    cols: u16,
    rows: u16,
    state: tauri::State<'_, TerminalProcessState>,
) -> Result<(), String> {
    let terminals = state.terminals.lock().await;
    if let Some(instance) = terminals.get(&terminal_id) {
        instance
            .master
            .resize(PtySize {
                rows,
                cols,
                pixel_width: 0,
                pixel_height: 0,
            })
            .map_err(|e| format!("Failed to resize PTY: {}", e))?;
    }
    Ok(())
}

#[tauri::command]
pub async fn terminal_kill(
    terminal_id: String,
    state: tauri::State<'_, TerminalProcessState>,
) -> Result<(), String> {
    let mut terminals = state.terminals.lock().await;
    if let Some(mut instance) = terminals.remove(&terminal_id) {
        instance.shutdown.store(true, Ordering::Relaxed);
        let _ = instance.child.kill();
    }
    Ok(())
}

/// Kill all terminals associated with a window (called on window destroy).
pub async fn kill_all_terminals(state: &TerminalProcessState) {
    let mut terminals = state.terminals.lock().await;
    for (_, mut instance) in terminals.drain() {
        instance.shutdown.store(true, Ordering::Relaxed);
        let _ = instance.child.kill();
    }
}
