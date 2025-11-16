/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use std::env;

#[derive(Debug, Clone, PartialEq)]
pub struct PathComponents {
    pub root: String,
    pub dir: String,
    pub base: String,
    pub ext: String,
    pub name: String,
}

pub struct PathNormalizer;

impl PathNormalizer {
    const CHAR_FORWARD_SLASH: u32 = '/' as u32;
    const _CHAR_BACKWARD_SLASH: u32 = '\\' as u32;
    const _CHAR_DOT: u32 = '.' as u32;
    const _CHAR_UPPERCASE_A: u32 = 'A' as u32;
    const _CHAR_LOWERCASE_A: u32 = 'a' as u32;
    const _CHAR_UPPERCASE_Z: u32 = 'Z' as u32;
    const _CHAR_LOWERCASE_Z: u32 = 'z' as u32;


    fn is_posix_path_separator(code: Option<u32>) -> bool {
        code == Some(Self::CHAR_FORWARD_SLASH)
    }


    fn normalize_string(path: &str, allow_above_root: bool, separator: char, is_path_sep: fn(Option<u32>) -> bool) -> String {
        let mut res = String::new();
        let mut last_segment_length = 0;
        let mut last_slash = -1;
        let mut dots = 0;
        let mut i = 0;
        let len = path.len();
        while i <= len {
            let code = if i < len {
                Some(path.as_bytes()[i] as u32)
            } else {
                if is_path_sep(Some(Self::CHAR_FORWARD_SLASH)) {
                    break;
                }
                Some(Self::CHAR_FORWARD_SLASH)
            };

            if is_path_sep(code) {
                if last_slash == i as i32 - 1 || dots == 1 {
                    // NOOP
                } else if dots == 2 {
                    if res.len() < 2 || last_segment_length != 2 ||
                        res.as_bytes()[res.len() - 1] != Self::_CHAR_DOT as u8 ||
                        res.as_bytes()[res.len() - 2] != Self::_CHAR_DOT as u8 {
                        if res.len() > 2 {
                            let last_slash_index = res.rfind(separator).unwrap_or(res.len());
                            if last_slash_index == res.len() {
                                res.clear();
                                last_segment_length = 0;
                            } else {
                                res.truncate(last_slash_index);
                                last_segment_length = res.len() - 1 - res.rfind(separator).unwrap_or(0);
                            }
                            last_slash = i as i32;
                            dots = 0;
                            i += 1;
                            continue;
                        } else if res.len() != 0 {
                            res.clear();
                            last_segment_length = 0;
                            last_slash = i as i32;
                            dots = 0;
                            i += 1;
                            continue;
                        }
                    }
                    if allow_above_root {
                        if res.is_empty() {
                            res.push_str("..");
                        } else {
                            res.push_str(&format!("{}..", separator));
                        }
                        last_segment_length = 2;
                    }
                } else {
                    if res.is_empty() {
                        res = path[last_slash as usize + 1..i].to_string();
                    } else {
                        res.push(separator);
                        res.push_str(&path[last_slash as usize + 1..i]);
                    }
                    last_segment_length = i - (last_slash as usize + 1);
                }
                last_slash = i as i32;
                dots = 0;
            } else if code == Some(Self::_CHAR_DOT) && dots != -1 {
                dots += 1;
            } else {
                dots = -1;
            }
            i += 1;
        }
        res
    }

    pub fn normalize(path: &str) -> String {
        if path.is_empty() {
            return ".".to_string();
        }

        #[cfg(windows)]
        {
            let len = path.len();
            if len == 0 {
                return ".".to_string();
            }
            let mut root_end = 0;
            let mut device: Option<String> = None;
            let mut is_absolute = false;
            let code = path.as_bytes()[0] as u32;

            if len == 1 {
                return if Self::is_posix_path_separator(Some(code)) { "\\".to_string() } else { path.to_string() };
            }
            if Self::is_path_separator(Some(code)) {
                is_absolute = true;
                if Self::is_path_separator(Some(path.as_bytes()[1] as u32)) {
                    let mut j = 2;
                    let mut last = j;
                    while j < len && !Self::is_path_separator(Some(path.as_bytes()[j] as u32)) {
                        j += 1;
                    }
                    if j < len && j != last {
                        let first_part = &path[last..j];
                        last = j;
                        while j < len && Self::is_path_separator(Some(path.as_bytes()[j] as u32)) {
                            j += 1;
                        }
                        if j < len && j != last {
                            last = j;
                            while j < len && !Self::is_path_separator(Some(path.as_bytes()[j] as u32)) {
                                j += 1;
                            }
                            if j == len || j != last {
                                device = Some(format!("\\\\{}\\{}", first_part, &path[last..j]));
                                root_end = j;
                            }
                        }
                    }
                } else {
                    root_end = 1;
                }
            } else if Self::is_windows_device_root(code) && path.as_bytes()[1] as u32 == Self::CHAR_COLON {
                device = Some(path[0..2].to_string());
                root_end = 2;
                if len > 2 && Self::is_path_separator(Some(path.as_bytes()[2] as u32)) {
                    is_absolute = true;
                    root_end = 3;
                }
            }

            let mut tail = if root_end < len {
                Self::normalize_string(&path[root_end..], !is_absolute, '\\', Self::is_path_separator)
            } else {
                "".to_string()
            };
            if tail.is_empty() && !is_absolute {
                tail = ".".to_string();
            }
            if tail.len() > 0 && Self::is_path_separator(Some(path.as_bytes()[len - 1] as u32)) {
                tail.push('\\');
            }
            if !is_absolute && device.is_none() && path.contains(':') {
                if tail.len() >= 2 &&
                    Self::is_windows_device_root(tail.as_bytes()[0] as u32) &&
                    tail.as_bytes()[1] as u32 == Self::CHAR_COLON {
                    return format!(".\\{}", tail);
                }
                let mut index = path.find(':').unwrap_or(len);
                while index < len - 1 {
                    if Self::is_path_separator(Some(path.as_bytes()[index + 1] as u32)) {
                        return format!(".\\{}", tail);
                    }
                    if let Some(next) = path[index + 1..].find(':') {
                        index += next + 1;
                    } else {
                        break;
                    }
                }
            }
            if device.is_none() {
                if is_absolute { format!("\\{}", tail) } else { tail }
            } else {
                if is_absolute { format!("{}\\{}", device.unwrap(), tail) } else { format!("{}{}", device.unwrap(), tail) }
            }
        }

        #[cfg(not(windows))]
        {
            let is_absolute = path.as_bytes()[0] as char == '/';
            let trailing_separator = !path.is_empty() && path.as_bytes()[path.len() - 1] as char == '/';
            let mut path_normalized = Self::normalize_string(path, !is_absolute, '/', Self::is_posix_path_separator);
            if path_normalized.is_empty() {
                if is_absolute {
                    "/".to_string()
                } else {
                    if trailing_separator { "./".to_string() } else { ".".to_string() }
                }
            } else {
                if trailing_separator {
                    path_normalized.push('/');
                }
                if is_absolute {
                    format!("/{}", path_normalized)
                } else {
                    path_normalized
                }
            }
        }
    }

    pub fn resolve(paths: &[&str]) -> String {
        #[cfg(windows)]
        {
            let mut resolved_device = String::new();
            let mut resolved_tail = String::new();
            let mut resolved_absolute = false;

            for i in (0..paths.len()).rev() {
                let path = paths[i];
                if path.is_empty() {
                    continue;
                }
                let len = path.len();
                let mut root_end = 0;
                let mut device = String::new();
                let mut is_absolute = false;
                let code = path.as_bytes()[0] as u32;

                if len == 1 {
                    if Self::is_path_separator(Some(code)) {
                        root_end = 1;
                        is_absolute = true;
                    }
                } else if Self::is_path_separator(Some(code)) {
                    is_absolute = true;
                    if Self::is_path_separator(Some(path.as_bytes()[1] as u32)) {
                        let mut j = 2;
                        let mut last = j;
                        while j < len && !Self::is_path_separator(Some(path.as_bytes()[j] as u32)) {
                            j += 1;
                        }
                        if j < len && j != last {
                            let first_part = &path[last..j];
                            last = j;
                            while j < len && Self::is_path_separator(Some(path.as_bytes()[j] as u32)) {
                                j += 1;
                            }
                            if j < len && j != last {
                                last = j;
                                while j < len && !Self::is_path_separator(Some(path.as_bytes()[j] as u32)) {
                                    j += 1;
                                }
                                if j == len || j != last {
                                    device = format!("\\\\{}\\{}", first_part, &path[last..j]);
                                    root_end = j;
                                }
                            }
                        }
                    } else {
                        root_end = 1;
                    }
                } else if Self::is_windows_device_root(code) && path.as_bytes()[1] as u32 == Self::CHAR_COLON {
                    device = path[0..2].to_string();
                    root_end = 2;
                    if len > 2 && Self::is_path_separator(Some(path.as_bytes()[2] as u32)) {
                        is_absolute = true;
                        root_end = 3;
                    }
                }

                if !device.is_empty() {
                    if !resolved_device.is_empty() {
                        if device.to_lowercase() != resolved_device.to_lowercase() {
                            continue;
                        }
                    } else {
                        resolved_device = device;
                    }
                }

                if resolved_absolute {
                    if !resolved_device.is_empty() {
                        break;
                    }
                } else {
                    resolved_tail = format!("{}\\{}", &path[root_end..], resolved_tail);
                    resolved_absolute = is_absolute;
                    if is_absolute && !resolved_device.is_empty() {
                        break;
                    }
                }
            }

            resolved_tail = Self::normalize_string(&resolved_tail, !resolved_absolute, '\\', Self::is_path_separator);

            if resolved_absolute {
                format!("{}\\{}", resolved_device, resolved_tail)
            } else {
                let result = format!("{}{}", resolved_device, resolved_tail);
                if result.is_empty() { ".".to_string() } else { result.trim_end_matches('\\').to_string() }
            }
        }

        #[cfg(not(windows))]
        {
            let mut resolved_path = String::new();
            let mut resolved_absolute = false;

            for i in (0..paths.len()).rev() {
                let path = paths[i];
                if path.is_empty() {
                    continue;
                }
                resolved_path = format!("{}/{}", path, resolved_path);
                resolved_absolute = path.as_bytes()[0] as char == '/';
            }

            if !resolved_absolute {
                let cwd = env::current_dir().unwrap_or_else(|_| std::path::PathBuf::from(".")).to_string_lossy().to_string();
                resolved_path = format!("{}/{}", cwd, resolved_path);
                resolved_absolute = cwd.starts_with('/');
            }

            resolved_path = Self::normalize_string(&resolved_path, !resolved_absolute, '/', Self::is_posix_path_separator);

            if resolved_absolute {
                format!("/{}", resolved_path)
            } else {
                if resolved_path.is_empty() { ".".to_string() } else { resolved_path }
            }
        }
    }

    pub fn relative(from: &str, to: &str) -> String {
        if from == to {
            return "".to_string();
        }

        #[cfg(windows)]
        {
            let from_orig = Self::resolve(&[from]);
            let to_orig = Self::resolve(&[to]);

            if from_orig == to_orig {
                return "".to_string();
            }

            let mut from_lower = from_orig.to_lowercase();
            let mut to_lower = to_orig.to_lowercase();

            if from_lower == to_lower {
                return "".to_string();
            }

            if from_orig.len() != from_lower.len() || to_orig.len() != to_lower.len() {
                let from_split: Vec<&str> = from_orig.split('\\').collect();
                let to_split: Vec<&str> = to_orig.split('\\').collect();
                let mut from_split = from_split.clone();
                let mut to_split = to_split.clone();
                if from_split.last() == Some(&"") {
                    from_split.pop();
                }
                if to_split.last() == Some(&"") {
                    to_split.pop();
                }

                let from_len = from_split.len();
                let to_len = to_split.len();
                let length = if from_len < to_len { from_len } else { to_len };

                let mut i = 0;
                while i < length {
                    if from_split[i].to_lowercase() != to_split[i].to_lowercase() {
                        break;
                    }
                    i += 1;
                }

                if i == 0 {
                    return to_orig;
                } else if i == length {
                    if to_len > length {
                        return to_split[i..].join("\\");
                    }
                    if from_len > length {
                        return format!("..\\{}", "..\\".repeat(from_len - 1 - i));
                    }
                    return "".to_string();
                }

                format!("{}\\{}", "..\\".repeat(from_len - i), to_split[i..].join("\\"))
            } else {
                let mut from_start = 0;
                while from_start < from_lower.len() && from_lower.as_bytes()[from_start] == '\\' as u8 {
                    from_start += 1;
                }
                let mut from_end = from_lower.len();
                while from_end > from_start && from_lower.as_bytes()[from_end - 1] == '\\' as u8 {
                    from_end -= 1;
                }
                let from_len = from_end - from_start;

                let mut to_start = 0;
                while to_start < to_lower.len() && to_lower.as_bytes()[to_start] == '\\' as u8 {
                    to_start += 1;
                }
                let mut to_end = to_lower.len();
                while to_end > to_start && to_lower.as_bytes()[to_end - 1] == '\\' as u8 {
                    to_end -= 1;
                }
                let to_len = to_end - to_start;

                let length = if from_len < to_len { from_len } else { to_len };
                let mut last_common_sep = -1;
                let mut i = 0;
                while i < length {
                    let from_code = from_lower.as_bytes()[from_start + i];
                    if from_code != to_lower.as_bytes()[to_start + i] {
                        break;
                    } else if from_code == '\\' as u8 {
                        last_common_sep = i as i32;
                    }
                    i += 1;
                }

                if i != length {
                    if last_common_sep == -1 {
                        return to_orig;
                    }
                } else {
                    if to_len > length {
                        if to_lower.as_bytes()[to_start + i] == '\\' as u8 {
                            return to_orig[from_start + i + 1..].to_string();
                        }
                        if i == 2 {
                            return to_orig[from_start + i..].to_string();
                        }
                    }
                    if from_len > length {
                        if from_lower.as_bytes()[from_start + i] == '\\' as u8 {
                            last_common_sep = i as i32;
                        } else if i == 2 {
                            last_common_sep = 3;
                        }
                    }
                    if last_common_sep == -1 {
                        last_common_sep = 0;
                    }
                }

                let mut out = String::new();
                let mut i = from_start + last_common_sep as usize + 1;
                while i <= from_end {
                    if i == from_end || from_lower.as_bytes()[i] == '\\' as u8 {
                        out.push_str(if out.is_empty() { ".." } else { "\\.." });
                    }
                    i += 1;
                }

                let to_start = to_start + last_common_sep as usize;
                if out.is_empty() {
                    to_orig[to_start..to_end].to_string()
                } else {
                    if !to_orig.is_empty() && to_orig.as_bytes().get(to_start) == Some(&('\\' as u8)) {
                        format!("{}{}", out, &to_orig[to_start + 1..to_end])
                    } else {
                        format!("{}{}", out, &to_orig[to_start..to_end])
                    }
                }
            }
        }

        #[cfg(not(windows))]
        {
            let from_resolved = Self::resolve(&[from]);
            let to_resolved = Self::resolve(&[to]);

            if from_resolved == to_resolved {
                return "".to_string();
            }

            let from_start = 1;
            let from_end = from_resolved.len();
            let from_len = from_end - from_start;
            let to_start = 1;
            let to_len = to_resolved.len() - to_start;

            let length = if from_len < to_len { from_len } else { to_len };
            let mut last_common_sep = -1;
            let mut i = 0;
            while i < length {
                let from_code = from_resolved.as_bytes()[from_start + i];
                if from_code != to_resolved.as_bytes()[to_start + i] {
                    break;
                } else if from_code == '/' as u8 {
                    last_common_sep = i as i32;
                }
                i += 1;
            }

            if i == length {
                if to_len > length {
                    if to_resolved.as_bytes().get(to_start + i) == Some(&('/' as u8)) {
                        return to_resolved[to_start + i + 1..].to_string();
                    }
                    if i == 0 {
                        return to_resolved[to_start + i..].to_string();
                    }
                } else if from_len > length {
                    if from_resolved.as_bytes().get(from_start + i) == Some(&('/' as u8)) {
                        last_common_sep = i as i32;
                    } else if i == 0 {
                        last_common_sep = 0;
                    }
                }
            }

            let mut out = String::new();
            let mut i = from_start + last_common_sep as usize + 1;
            while i <= from_end {
                if i == from_end || from_resolved.as_bytes()[i] == '/' as u8 {
                    out.push_str(if out.is_empty() { ".." } else { "/.." });
                }
                i += 1;
            }

            format!("{}{}", out, &to_resolved[to_start + last_common_sep as usize..])
        }
    }

    pub fn is_absolute(path: &str) -> bool {
        if path.is_empty() {
            return false;
        }

        #[cfg(windows)]
        {
            let code = path.as_bytes()[0] as u32;
            Self::is_path_separator(Some(code)) ||
                (path.len() > 2 &&
                 Self::is_windows_device_root(code) &&
                 path.as_bytes()[1] as u32 == Self::CHAR_COLON &&
                 Self::is_path_separator(Some(path.as_bytes()[2] as u32)))
        }

        #[cfg(not(windows))]
        {
            path.as_bytes()[0] as char == '/'
        }
    }

    pub fn join(paths: &[&str]) -> String {
        if paths.is_empty() {
            return ".".to_string();
        }

        #[cfg(windows)]
        {
            let mut joined = String::new();
            let mut first_part: Option<&str> = None;
            for arg in paths {
                if !arg.is_empty() {
                    if joined.is_empty() {
                        joined = arg.to_string();
                        first_part = Some(arg);
                    } else {
                        joined.push('\\');
                        joined.push_str(arg);
                    }
                }
            }

            if joined.is_empty() {
                return ".".to_string();
            }

            let mut needs_replace = true;
            let mut slash_count = 0;
            if let Some(first) = first_part {
                if Self::is_path_separator(Some(first.as_bytes()[0] as u32)) {
                    slash_count += 1;
                    if first.len() > 1 && Self::is_path_separator(Some(first.as_bytes()[1] as u32)) {
                        slash_count += 1;
                        if first.len() > 2 {
                            if Self::is_path_separator(Some(first.as_bytes()[2] as u32)) {
                                slash_count += 1;
                            } else {
                                needs_replace = false;
                            }
                        }
                    }
                }
            }
            if needs_replace {
                while slash_count < joined.len() && Self::is_path_separator(Some(joined.as_bytes()[slash_count] as u32)) {
                    slash_count += 1;
                }
                if slash_count >= 2 {
                    joined = format!("\\{}", &joined[slash_count..]);
                }
            }

            Self::normalize(&joined)
        }

        #[cfg(not(windows))]
        {
            let filtered: Vec<&str> = paths.iter().filter(|p| !p.is_empty()).cloned().collect();
            if filtered.is_empty() {
                ".".to_string()
            } else {
                Self::normalize(&filtered.join("/"))
            }
        }
    }

    pub fn parse(path: &str) -> PathComponents {
        #[cfg(windows)]
        {
            let mut ret = PathComponents {
                root: "".to_string(),
                dir: "".to_string(),
                base: "".to_string(),
                ext: "".to_string(),
                name: "".to_string(),
            };
            if path.is_empty() {
                return ret;
            }

            let len = path.len();
            let mut root_end = 0;
            let code = path.as_bytes()[0] as u32;

            if len == 1 {
                if Self::is_path_separator(Some(code)) {
                    ret.root = path.to_string();
                    ret.dir = path.to_string();
                    return ret;
                }
                ret.base = path.to_string();
                ret.name = path.to_string();
                return ret;
            }

            if Self::is_path_separator(Some(code)) {
                root_end = 1;
                if Self::is_path_separator(Some(path.as_bytes()[1] as u32)) {
                    let mut j = 2;
                    let mut last = j;
                    while j < len && !Self::is_path_separator(Some(path.as_bytes()[j] as u32)) {
                        j += 1;
                    }
                    if j < len && j != last {
                        last = j;
                        while j < len && Self::is_path_separator(Some(path.as_bytes()[j] as u32)) {
                            j += 1;
                        }
                        if j < len && j != last {
                            last = j;
                            while j < len && !Self::is_path_separator(Some(path.as_bytes()[j] as u32)) {
                                j += 1;
                            }
                            if j == len {
                                root_end = j;
                            } else if j != last {
                                root_end = j + 1;
                            }
                        }
                    }
                }
            } else if Self::is_windows_device_root(code) && path.as_bytes()[1] as u32 == Self::CHAR_COLON {
                if len <= 2 {
                    ret.root = path.to_string();
                    ret.dir = path.to_string();
                    return ret;
                }
                root_end = 2;
                if Self::is_path_separator(Some(path.as_bytes()[2] as u32)) {
                    if len == 3 {
                        ret.root = path.to_string();
                        ret.dir = path.to_string();
                        return ret;
                    }
                    root_end = 3;
                }
            }

            if root_end > 0 {
                ret.root = path[0..root_end].to_string();
            }

            let mut start_dot = -1i32;
            let start_part = root_end;
            let mut end = -1i32;
            let mut matched_slash = true;
            let mut pre_dot_state = 0;
            let mut i = len as i32 - 1;

            while i >= root_end as i32 {
                let code = path.as_bytes()[i as usize] as u32;
                if Self::is_path_separator(Some(code)) {
                    if !matched_slash {
                        let start_part = i + 1;
                        break;
                    }
                    i -= 1;
                    continue;
                }
                if end == -1 {
                    matched_slash = false;
                    end = i + 1;
                }
                if code == Self::_CHAR_DOT {
                    if start_dot == -1 {
                        start_dot = i;
                    } else if pre_dot_state != 1 {
                        pre_dot_state = 1;
                    }
                } else if start_dot != -1 {
                    pre_dot_state = -1;
                }
                i -= 1;
            }

            if end != -1 {
                let start_part = start_part as i32;
                if start_dot == -1 ||
                    pre_dot_state == 0 ||
                    (pre_dot_state == 1 && start_dot == end - 1 && start_dot == start_part + 1) {
                    ret.base = path[start_part as usize..end as usize].to_string();
                    ret.name = ret.base.clone();
                } else {
                    ret.name = path[start_part as usize..start_dot as usize].to_string();
                    ret.base = path[start_part as usize..end as usize].to_string();
                    ret.ext = path[start_dot as usize..end as usize].to_string();
                }
            }

            if start_part > 0 && start_part != root_end {
                ret.dir = path[0..start_part - 1].to_string();
            } else {
                ret.dir = ret.root.clone();
            }

            ret
        }

        #[cfg(not(windows))]
        {
            let mut ret = PathComponents {
                root: "".to_string(),
                dir: "".to_string(),
                base: "".to_string(),
                ext: "".to_string(),
                name: "".to_string(),
            };
            if path.is_empty() {
                return ret;
            }
            let is_absolute = path.as_bytes()[0] as char == '/';
            let mut start = 0;
            if is_absolute {
                ret.root = "/".to_string();
                start = 1;
            }
            let mut start_dot = -1i32;
            let mut start_part = start;
            let mut end = -1i32;
            let mut matched_slash = true;
            let mut pre_dot_state = 0;
            let mut i = path.len() as i32 - 1;

            while i >= start as i32 {
                let code = path.as_bytes()[i as usize] as u32;
                if code == Self::CHAR_FORWARD_SLASH {
                    if !matched_slash {
                        start_part = i as usize + 1;
                        break;
                    }
                    i -= 1;
                    continue;
                }
                if end == -1 {
                    matched_slash = false;
                    end = i + 1;
                }
                if code == Self::_CHAR_DOT {
                    if start_dot == -1 {
                        start_dot = i;
                    } else if pre_dot_state != 1 {
                        pre_dot_state = 1;
                    }
                } else if start_dot != -1 {
                    pre_dot_state = -1;
                }
                i -= 1;
            }

            if end != -1 {
                let start = if start_part == 0 && is_absolute { 1 } else { start_part };
                if start_dot == -1 ||
                    pre_dot_state == 0 ||
                    (pre_dot_state == 1 && start_dot == end - 1 && start_dot == start_part as i32 + 1) {
                    ret.base = path[start..end as usize].to_string();
                    ret.name = ret.base.clone();
                } else {
                    ret.name = path[start..start_dot as usize].to_string();
                    ret.base = path[start..end as usize].to_string();
                    ret.ext = path[start_dot as usize..end as usize].to_string();
                }
            }

            if start_part > 0 {
                ret.dir = path[0..start_part - 1].to_string();
            } else if is_absolute {
                ret.dir = "/".to_string();
            }

            ret
        }
    }
}

pub fn to_path_buf(path: &str) -> Result<std::path::PathBuf, Box<dyn std::error::Error + Send + Sync>> {
    Ok(std::path::PathBuf::from(PathNormalizer::normalize(path)))
}

#[cfg(test)]
mod tests {
    #[cfg(windows)]
    mod windows {
        use super::super::PathNormalizer;

        #[test]
        fn test_normalize() {
            assert_eq!(PathNormalizer::normalize(""), ".");
            assert_eq!(PathNormalizer::normalize("."), ".");
            assert_eq!(PathNormalizer::normalize(".."), "..");
            assert_eq!(PathNormalizer::normalize("\\"), "\\");
            assert_eq!(PathNormalizer::normalize("C:\\"), "C:\\");
            assert_eq!(PathNormalizer::normalize("C:\\foo"), "C:\\foo");
            assert_eq!(PathNormalizer::normalize("C:\\foo\\"), "C:\\foo\\");
            assert_eq!(PathNormalizer::normalize("C:\\foo\\bar"), "C:\\foo\\bar");
            assert_eq!(PathNormalizer::normalize("C:\\foo\\bar\\"), "C:\\foo\\bar\\");
            assert_eq!(PathNormalizer::normalize("C:\\foo\\bar\\.."), "C:\\foo");
            assert_eq!(PathNormalizer::normalize("C:\\foo\\bar\\.\\"), "C:\\foo\\bar\\");
            assert_eq!(PathNormalizer::normalize("\\\\server\\share"), "\\\\server\\share");
            assert_eq!(PathNormalizer::normalize("\\\\server\\share\\"), "\\\\server\\share\\");
            assert_eq!(PathNormalizer::normalize("\\\\server\\share\\foo"), "\\\\server\\share\\foo");
        }

        #[test]
        fn test_resolve() {
            assert_eq!(PathNormalizer::resolve(&[]), ".");
            assert_eq!(PathNormalizer::resolve(&[""]), ".");
            assert_eq!(PathNormalizer::resolve(&["C:\\foo\\bar", "baz"]), "C:\\foo\\bar\\baz");
            assert_eq!(PathNormalizer::resolve(&["C:\\foo\\bar", "..\\baz"]), "C:\\foo\\baz");
        }

        #[test]
        fn test_join() {
            assert_eq!(PathNormalizer::join(&[]), ".");
            assert_eq!(PathNormalizer::join(&["", ""]), ".");
            assert_eq!(PathNormalizer::join(&["C:\\", "foo", "bar"]), "C:\\foo\\bar");
            assert_eq!(PathNormalizer::join(&["C:\\foo", "bar", "baz"]), "C:\\foo\\bar\\baz");
        }

        #[test]
        fn test_is_absolute() {
            assert!(!PathNormalizer::is_absolute(""));
            assert!(PathNormalizer::is_absolute("C:\\"));
            assert!(PathNormalizer::is_absolute("\\"));
            assert!(!PathNormalizer::is_absolute("foo"));
        }

        #[test]
        fn test_relative() {
            assert_eq!(PathNormalizer::relative("C:\\foo\\bar", "C:\\foo\\baz"), "..\\baz");
            assert_eq!(PathNormalizer::relative("C:\\foo\\bar", "C:\\foo\\bar\\baz"), "baz");
            assert_eq!(PathNormalizer::relative("C:\\foo\\bar\\baz", "C:\\foo\\bar"), "..");
        }
    }

    #[cfg(unix)]
    mod unix {
        use super::super::PathNormalizer;

        #[test]
        fn test_normalize() {
            assert_eq!(PathNormalizer::normalize(""), ".");
            assert_eq!(PathNormalizer::normalize("."), ".");
            assert_eq!(PathNormalizer::normalize(".."), "..");
            assert_eq!(PathNormalizer::normalize("/"), "/");
            assert_eq!(PathNormalizer::normalize("/foo"), "/foo");
            assert_eq!(PathNormalizer::normalize("/foo/"), "/foo/");
            assert_eq!(PathNormalizer::normalize("/foo/bar"), "/foo/bar");
            assert_eq!(PathNormalizer::normalize("/foo/bar/"), "/foo/bar/");
            assert_eq!(PathNormalizer::normalize("/foo/bar/.."), "/foo");
            assert_eq!(PathNormalizer::normalize("/foo/bar/./"), "/foo/bar/");
        }

        #[test]
        fn test_resolve() {
            assert_eq!(PathNormalizer::resolve(&[]), ".");
            assert_eq!(PathNormalizer::resolve(&[""]), ".");
            assert_eq!(PathNormalizer::resolve(&["/foo/bar", "baz"]), "/foo/bar/baz");
            assert_eq!(PathNormalizer::resolve(&["/foo/bar", "../baz"]), "/foo/baz");
        }

        #[test]
        fn test_join() {
            assert_eq!(PathNormalizer::join(&[]), ".");
            assert_eq!(PathNormalizer::join(&["", ""]), ".");
            assert_eq!(PathNormalizer::join(&["/", "foo", "bar"]), "/foo/bar");
            assert_eq!(PathNormalizer::join(&["/foo", "bar", "baz"]), "/foo/bar/baz");
        }

        #[test]
        fn test_is_absolute() {
            assert!(!PathNormalizer::is_absolute(""));
            assert!(PathNormalizer::is_absolute("/"));
            assert!(!PathNormalizer::is_absolute("foo"));
        }

        #[test]
        fn test_relative() {
            assert_eq!(PathNormalizer::relative("/foo/bar", "/foo/baz"), "../baz");
            assert_eq!(PathNormalizer::relative("/foo/bar", "/foo/bar/baz"), "baz");
            assert_eq!(PathNormalizer::relative("/foo/bar/baz", "/foo/bar"), "..");
        }
    }
}