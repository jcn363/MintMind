use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use sysinfo::{ProcessExt, System, SystemExt};
use base64::{Engine as _, engine::general_purpose};

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub ppid: u32,
    pub name: String,
    pub cmd: Option<String>,
    pub exe: Option<String>,
    pub cwd: Option<String>,
    pub memory: u64,
    pub cpu_usage: f32,
    pub status: String,
    pub start_time: u64,
    pub children: Option<Vec<ProcessInfo>>,
}

impl From<&sysinfo::Process> for ProcessInfo {
    fn from(process: &sysinfo::Process) -> Self {
        Self {
            pid: process.pid().as_u32(),
            ppid: 0, // Will be set when building tree
            name: process.name().to_string(),
            cmd: Some(process.cmd().join(" ")),
            exe: Some(process.exe().to_string_lossy().to_string()),
            cwd: process.cwd().map(|p| p.to_string_lossy().to_string()),
            memory: process.memory(),
            cpu_usage: process.cpu_usage(),
            status: format!("{:?}", process.status()),
            start_time: process.start_time(),
            children: None,
        }
    }
}

fn clean_unc_prefix(cmd: &str) -> String {
    if cmd.starts_with("\\\\?\\") || cmd.starts_with("\\\\??\\") {
        cmd[4..].to_string()
    } else {
        cmd.to_string()
    }
}

pub fn get_process_tree(root_pid: u32) -> Result<ProcessInfo, String> {
    let mut system = System::new_all();
    system.refresh_all();

    let processes = system.processes();
    let root_process = processes
        .get(&sysinfo::Pid::from(root_pid as usize))
        .ok_or_else(|| format!("Process with PID {} not found", root_pid))?;

    let mut root_info = ProcessInfo::from(root_process);
    root_info.cmd = root_info.cmd.map(|cmd| clean_unc_prefix(&cmd));

    // Build the process tree recursively
    root_info.children = Some(build_process_tree(processes, root_pid));

    Ok(root_info)
}

fn build_process_tree(processes: &HashMap<sysinfo::Pid, sysinfo::Process>, root_pid: u32) -> Vec<ProcessInfo> {
    let mut children = Vec::new();

    for (pid, process) in processes {
        if process.parent().map_or(false, |parent| parent.as_u32() == root_pid) {
            let mut child_info = ProcessInfo::from(process);
            child_info.ppid = root_pid;
            child_info.cmd = child_info.cmd.map(|cmd| clean_unc_prefix(&cmd));

            // Recursively build children
            child_info.children = Some(build_process_tree(processes, pid.as_u32()));

            children.push(child_info);
        }
    }

    children
}

pub fn get_process_list_flat(root_pid: u32) -> Result<Vec<ProcessInfo>, String> {
    let mut system = System::new_all();
    system.refresh_all();

    let processes = system.processes();
    let mut result = Vec::new();

    // Start with root process
    if let Some(root_process) = processes.get(&sysinfo::Pid::from(root_pid as usize)) {
        let mut root_info = ProcessInfo::from(root_process);
        root_info.cmd = root_info.cmd.map(|cmd| clean_unc_prefix(&cmd));
        result.push(root_info);
    } else {
        return Err(format!("Root process with PID {} not found", root_pid));
    }

    // Collect all descendant processes
    get_all_descendants(processes, root_pid, &mut result);

    Ok(result)
}

fn get_all_descendants(
    processes: &HashMap<sysinfo::Pid, sysinfo::Process>,
    root_pid: u32,
    result: &mut Vec<ProcessInfo>,
) {
    for (pid, process) in processes {
        if process.parent().map_or(false, |parent| parent.as_u32() == root_pid) {
            let mut child_info = ProcessInfo::from(process);
            child_info.ppid = root_pid;
            child_info.cmd = child_info.cmd.map(|cmd| clean_unc_prefix(&cmd));

            result.push(child_info.clone());

            // Recursively get children
            get_all_descendants(processes, pid.as_u32(), result);
        }
    }
}

pub fn get_single_process_info(pid: u32) -> Result<ProcessInfo, String> {
    let mut system = System::new_all();
    system.refresh_all();

    let processes = system.processes();
    let process = processes
        .get(&sysinfo::Pid::from(pid as usize))
        .ok_or_else(|| format!("Process with PID {} not found", pid))?;

    let mut info = ProcessInfo::from(process);
    info.cmd = info.cmd.map(|cmd| clean_unc_prefix(&cmd));

    Ok(info)
}

pub fn get_all_system_processes() -> Result<Vec<ProcessInfo>, String> {
    let mut system = System::new_all();
    system.refresh_all();

    let processes = system.processes();
    let mut result = Vec::new();

    for process in processes.values() {
        let mut info = ProcessInfo::from(process);
        info.cmd = info.cmd.map(|cmd| clean_unc_prefix(&cmd));
        result.push(info);
    }

    Ok(result)
}

pub fn find_processes_by_name(name: &str) -> Result<Vec<ProcessInfo>, String> {
    let mut system = System::new_all();
    system.refresh_all();

    let processes = system.processes();
    let mut result = Vec::new();

    for process in processes.values() {
        if process.name().to_lowercase().contains(&name.to_lowercase()) {
            let mut info = ProcessInfo::from(process);
            info.cmd = info.cmd.map(|cmd| clean_unc_prefix(&cmd));
            result.push(info);
        }
    }

    Ok(result)
}

#[cfg(target_os = "windows")]
pub fn get_shell_executable(root_pid: u32) -> Result<String, String> {
    use windows::Win32::System::Threading::{OpenProcess, QueryFullProcessImageNameW, PROCESS_QUERY_LIMITED_INFORMATION};
    use windows::Win32::Foundation::CloseHandle;
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    let process_handle = unsafe {
        OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, root_pid)
    };

    if process_handle.is_invalid() {
        return Err("Failed to open process".to_string());
    }

    let mut buffer = [0u16; 1024];
    let mut size = buffer.len() as u32;

    let success = unsafe {
        QueryFullProcessImageNameW(process_handle, 0, &mut buffer, &mut size)
    };

    unsafe { CloseHandle(process_handle) };

    if !success.as_bool() {
        return Err("Failed to query process image name".to_string());
    }

    let exe_path = OsString::from_wide(&buffer[..size as usize]);
    Ok(exe_path.to_string_lossy().to_string())
}

#[cfg(not(target_os = "windows"))]
pub fn get_shell_executable(_root_pid: u32) -> Result<String, String> {
    Err("Shell executable detection only supported on Windows".to_string())
}