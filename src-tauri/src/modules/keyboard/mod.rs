use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Mutex;
use lazy_static::lazy_static;

lazy_static! {
    static ref KEYBOARD_LAYOUT_CACHE: Mutex<Option<KeyboardLayoutData>> = Mutex::new(None);
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct KeyboardLayoutInfo {
    pub id: String,
    pub lang: String,
    pub localized_name: Option<String>,
    pub display_name: Option<String>,
    pub text: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct KeyboardLayoutData {
    pub keyboard_layout_info: KeyboardLayoutInfo,
    pub keyboard_mapping: HashMap<String, serde_json::Value>,
}

pub fn get_keyboard_layout_data() -> Result<KeyboardLayoutData, String> {
    let mut cache = KEYBOARD_LAYOUT_CACHE.lock().unwrap();
    if let Some(data) = &*cache {
        return Ok(data.clone());
    }

    #[cfg(target_os = "windows")]
    {
        let data = get_windows_keyboard_layout()?;
        *cache = Some(data.clone());
        Ok(data)
    }

    #[cfg(target_os = "macos")]
    {
        let data = get_macos_keyboard_layout()?;
        *cache = Some(data.clone());
        Ok(data)
    }

    #[cfg(target_os = "linux")]
    {
        let data = get_linux_keyboard_layout()?;
        *cache = Some(data.clone());
        Ok(data)
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported platform for keyboard layout detection".to_string())
    }
}

pub fn get_available_keyboard_layouts() -> Result<Vec<KeyboardLayoutInfo>, String> {
    #[cfg(target_os = "windows")]
    {
        get_windows_available_layouts()
    }

    #[cfg(target_os = "macos")]
    {
        get_macos_available_layouts()
    }

    #[cfg(target_os = "linux")]
    {
        get_linux_available_layouts()
    }

    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        Err("Unsupported platform for keyboard layout detection".to_string())
    }
}

#[cfg(target_os = "windows")]
fn get_windows_keyboard_layout() -> Result<KeyboardLayoutData, String> {
    use winapi::um::winuser::{GetKeyboardLayout, GetKeyboardLayoutNameW};
    use std::ffi::OsString;
    use std::os::windows::ffi::OsStringExt;

    // Get current keyboard layout
    let hkl = unsafe { GetKeyboardLayout(0) };
    let layout_id = format!("{:08x}", hkl as u32);

    // Get layout name
    let mut layout_name: [u16; 9] = [0; 9];
    let success = unsafe { GetKeyboardLayoutNameW(layout_name.as_mut_ptr()) };
    let layout_name_str = if success != 0 {
        OsString::from_wide(&layout_name)
            .to_string_lossy()
            .to_string()
    } else {
        "en-US".to_string()
    };

    let mut mapping = HashMap::new();
    // Generate key mappings based on layout
    // This is a simplified implementation - in production you'd want to use
    // VkKeyScanEx or similar to get actual mappings for the layout
    let basic_keys = vec![
        ("KeyA", "a"), ("KeyB", "b"), ("KeyC", "c"), ("KeyD", "d"), ("KeyE", "e"),
        ("KeyF", "f"), ("KeyG", "g"), ("KeyH", "h"), ("KeyI", "i"), ("KeyJ", "j"),
        ("KeyK", "k"), ("KeyL", "l"), ("KeyM", "m"), ("KeyN", "n"), ("KeyO", "o"),
        ("KeyP", "p"), ("KeyQ", "q"), ("KeyR", "r"), ("KeyS", "s"), ("KeyT", "t"),
        ("KeyU", "u"), ("KeyV", "v"), ("KeyW", "w"), ("KeyX", "x"), ("KeyY", "y"),
        ("KeyZ", "z"), ("Digit1", "1"), ("Digit2", "2"), ("Digit3", "3"), ("Digit4", "4"),
        ("Digit5", "5"), ("Digit6", "6"), ("Digit7", "7"), ("Digit8", "8"), ("Digit9", "9"),
        ("Digit0", "0"),
    ];

    for (key, value) in basic_keys {
        mapping.insert(key.to_string(), serde_json::json!({
            "value": value,
            "withShift": value.to_uppercase(),
            "withAltGr": value,
            "withShiftAltGr": value.to_uppercase()
        }));
    }

    let info = KeyboardLayoutInfo {
        id: layout_id,
        lang: layout_name_str.split('-').next().unwrap_or("en").to_string(),
        localized_name: Some(layout_name_str.clone()),
        display_name: Some(layout_name_str.clone()),
        text: Some(layout_name_str.split('-').next().unwrap_or("EN").to_uppercase()),
    };

    Ok(KeyboardLayoutData {
        keyboard_layout_info: info,
        keyboard_mapping: mapping,
    })
}

#[cfg(target_os = "windows")]
fn get_windows_available_layouts() -> Result<Vec<KeyboardLayoutInfo>, String> {
    use winapi::um::winuser::{GetKeyboardLayoutList, ActivateKeyboardLayout, KLF_SETFORPROCESS};
    use std::ptr;

    // Get the number of layouts
    let count = unsafe { GetKeyboardLayoutList(0, ptr::null_mut()) };
    if count == 0 {
        return Ok(vec![]);
    }

    let mut layouts = vec![0; count as usize];
    let actual_count = unsafe { GetKeyboardLayoutList(count as i32, layouts.as_mut_ptr()) };

    let mut result = Vec::new();
    for i in 0..actual_count as usize {
        let hkl = layouts[i];
        let layout_id = format!("{:08x}", hkl as u32);

        // Activate temporarily to get name (hacky but works)
        unsafe { ActivateKeyboardLayout(hkl, KLF_SETFORPROCESS) };

        use winapi::um::winuser::GetKeyboardLayoutNameW;
        use std::ffi::OsString;
        use std::os::windows::ffi::OsStringExt;

        let mut layout_name: [u16; 9] = [0; 9];
        let success = unsafe { GetKeyboardLayoutNameW(layout_name.as_mut_ptr()) };
        let layout_name_str = if success != 0 {
            OsString::from_wide(&layout_name)
                .to_string_lossy()
                .to_string()
        } else {
            format!("Layout {}", layout_id)
        };

        result.push(KeyboardLayoutInfo {
            id: layout_id,
            lang: layout_name_str.split('-').next().unwrap_or("en").to_string(),
            localized_name: Some(layout_name_str.clone()),
            display_name: Some(layout_name_str.clone()),
            text: Some(layout_name_str.split('-').next().unwrap_or("EN").to_uppercase()),
        });
    }

    Ok(result)
}

#[cfg(target_os = "macos")]
fn get_macos_keyboard_layout() -> Result<KeyboardLayoutData, String> {
    use core_foundation::string::CFString;
    use core_foundation::base::TCFType;
    use objc::{class, msg_send, sel, sel_impl};
    use std::ffi::CStr;

    // Get current keyboard layout using TIS (Text Input Sources)
    let tis_class = class!(TISInputSource);
    let current_keyboard: *mut objc::runtime::Object = unsafe {
        msg_send![tis_class, currentKeyboardInputSource]
    };

    if current_keyboard.is_null() {
        return Err("Could not get current keyboard layout".to_string());
    }

    // Get layout ID
    let id_key = CFString::from_static_string("TISPropertyInputSourceID");
    let cf_id: *mut objc::runtime::Object = unsafe {
        msg_send![current_keyboard, valueForProperty: id_key.as_concrete_TypeRef()]
    };

    let layout_id = if !cf_id.is_null() {
        unsafe {
            let cstr: *const i8 = msg_send![cf_id, UTF8String];
            CStr::from_ptr(cstr).to_string_lossy().to_string()
        }
    } else {
        "en-US".to_string()
    };

    // Get localized name
    let name_key = CFString::from_static_string("TISPropertyLocalizedName");
    let cf_name: *mut objc::runtime::Object = unsafe {
        msg_send![current_keyboard, valueForProperty: name_key.as_concrete_TypeRef()]
    };

    let localized_name = if !cf_name.is_null() {
        unsafe {
            let cstr: *const i8 = msg_send![cf_name, UTF8String];
            Some(CStr::from_ptr(cstr).to_string_lossy().to_string())
        }
    } else {
        Some("U.S.".to_string())
    };

    let mut mapping = HashMap::new();
    let basic_keys = vec![
        ("KeyA", "a"), ("KeyB", "b"), ("KeyC", "c"), ("KeyD", "d"), ("KeyE", "e"),
        ("KeyF", "f"), ("KeyG", "g"), ("KeyH", "h"), ("KeyI", "i"), ("KeyJ", "j"),
        ("KeyK", "k"), ("KeyL", "l"), ("KeyM", "m"), ("KeyN", "n"), ("KeyO", "o"),
        ("KeyP", "p"), ("KeyQ", "q"), ("KeyR", "r"), ("KeyS", "s"), ("KeyT", "t"),
        ("KeyU", "u"), ("KeyV", "v"), ("KeyW", "w"), ("KeyX", "x"), ("KeyY", "y"),
        ("KeyZ", "z"), ("Digit1", "1"), ("Digit2", "2"), ("Digit3", "3"), ("Digit4", "4"),
        ("Digit5", "5"), ("Digit6", "6"), ("Digit7", "7"), ("Digit8", "8"), ("Digit9", "9"),
        ("Digit0", "0"),
    ];

    for (key, value) in basic_keys {
        mapping.insert(key.to_string(), serde_json::json!({
            "value": value,
            "withShift": value.to_uppercase(),
            "withAltGr": value,
            "withShiftAltGr": value.to_uppercase()
        }));
    }

    let info = KeyboardLayoutInfo {
        id: layout_id.clone(),
        lang: layout_id.split('-').next().unwrap_or("en").to_string(),
        localized_name: localized_name.clone(),
        display_name: localized_name,
        text: Some(layout_id.split('-').next().unwrap_or("EN").to_uppercase()),
    };

    Ok(KeyboardLayoutData {
        keyboard_layout_info: info,
        keyboard_mapping: mapping,
    })
}

#[cfg(target_os = "macos")]
fn get_macos_available_layouts() -> Result<Vec<KeyboardLayoutInfo>, String> {
    use core_foundation::string::CFString;
    use core_foundation::array::CFArray;
    use core_foundation::base::TCFType;
    use objc::{class, msg_send, sel, sel_impl};
    use std::ffi::CStr;

    // Get all keyboard input sources
    let tis_class = class!(TISInputSource);
    let input_sources: *mut objc::runtime::Object = unsafe {
        msg_send![tis_class, inputSourcesForLanguage: ptr::null()]
    };

    if input_sources.is_null() {
        return Ok(vec![]);
    }

    let count: usize = unsafe { msg_send![input_sources, count] };
    let mut result = Vec::new();

    for i in 0..count {
        let source: *mut objc::runtime::Object = unsafe {
            msg_send![input_sources, objectAtIndex: i]
        };

        if source.is_null() {
            continue;
        }

        // Get layout ID
        let id_key = CFString::from_static_string("TISPropertyInputSourceID");
        let cf_id: *mut objc::runtime::Object = unsafe {
            msg_send![source, valueForProperty: id_key.as_concrete_TypeRef()]
        };

        let layout_id = if !cf_id.is_null() {
            unsafe {
                let cstr: *const i8 = msg_send![cf_id, UTF8String];
                CStr::from_ptr(cstr).to_string_lossy().to_string()
            }
        } else {
            continue;
        };

        // Get localized name
        let name_key = CFString::from_static_string("TISPropertyLocalizedName");
        let cf_name: *mut objc::runtime::Object = unsafe {
            msg_send![source, valueForProperty: name_key.as_concrete_TypeRef()]
        };

        let localized_name = if !cf_name.is_null() {
            unsafe {
                let cstr: *const i8 = msg_send![cf_name, UTF8String];
                Some(CStr::from_ptr(cstr).to_string_lossy().to_string())
            }
        } else {
            Some(layout_id.clone())
        };

        result.push(KeyboardLayoutInfo {
            id: layout_id.clone(),
            lang: layout_id.split('-').next().unwrap_or("en").to_string(),
            localized_name: localized_name.clone(),
            display_name: localized_name,
            text: Some(layout_id.split('-').next().unwrap_or("EN").to_uppercase()),
        });
    }

    Ok(result)
}

#[cfg(target_os = "linux")]
fn get_linux_keyboard_layout() -> Result<KeyboardLayoutData, String> {
    use x11::xlib::{XOpenDisplay, XCloseDisplay, XGetInputFocus};
    use x11::xkb::{XkbGetNames, XkbNamesRec, XkbStateRec, XkbDescRec};
    use std::ffi::CStr;

    unsafe {
        let display = XOpenDisplay(std::ptr::null());
        if display.is_null() {
            return Err("Could not open X display".to_string());
        }

        let mut xkb_desc = XkbDescRec {
            dpy: display,
            flags: 0,
            device_spec: 0,
            min_key_code: 0,
            max_key_code: 0,
            ctrls: std::ptr::null_mut(),
            server: std::ptr::null_mut(),
            map: std::ptr::null_mut(),
            indicators: std::ptr::null_mut(),
            names: std::ptr::null_mut(),
            compat: std::ptr::null_mut(),
            geom: std::ptr::null_mut(),
        };

        let mut names = XkbNamesRec {
            keycodes: 0,
            geometry: 0,
            symbols: 0,
            types: 0,
            compat: 0,
            vmods: [0; 16],
            indicators: [0; 32],
            groups: [0; 4],
            keys: std::ptr::null_mut(),
            key_aliases: std::ptr::null_mut(),
            radio_groups: std::ptr::null_mut(),
            phys_symbols: 0,
        };

        xkb_desc.names = &mut names;

        let result = XkbGetNames(display, 0x3FFF, &mut xkb_desc);
        if result != 1 {
            XCloseDisplay(display);
            return Err("Failed to get XKB names".to_string());
        }

        // Get current layout from symbols
        let symbols_name = if !names.symbols.is_null() {
            CStr::from_ptr(names.symbols).to_string_lossy().to_string()
        } else {
            "us".to_string()
        };

        XCloseDisplay(display);

        // Parse layout from symbols (simplified)
        let layout = symbols_name.split('+').nth(1).unwrap_or("us");
        let layout_parts: Vec<&str> = layout.split('(').collect();
        let layout_id = layout_parts[0].to_string();

        let mut mapping = HashMap::new();
        let basic_keys = vec![
            ("KeyA", "a"), ("KeyB", "b"), ("KeyC", "c"), ("KeyD", "d"), ("KeyE", "e"),
            ("KeyF", "f"), ("KeyG", "g"), ("KeyH", "h"), ("KeyI", "i"), ("KeyJ", "j"),
            ("KeyK", "k"), ("KeyL", "l"), ("KeyM", "m"), ("KeyN", "n"), ("KeyO", "o"),
            ("KeyP", "p"), ("KeyQ", "q"), ("KeyR", "r"), ("KeyS", "s"), ("KeyT", "t"),
            ("KeyU", "u"), ("KeyV", "v"), ("KeyW", "w"), ("KeyX", "x"), ("KeyY", "y"),
            ("KeyZ", "z"), ("Digit1", "1"), ("Digit2", "2"), ("Digit3", "3"), ("Digit4", "4"),
            ("Digit5", "5"), ("Digit6", "6"), ("Digit7", "7"), ("Digit8", "8"), ("Digit9", "9"),
            ("Digit0", "0"),
        ];

        for (key, value) in basic_keys {
            mapping.insert(key.to_string(), serde_json::json!({
                "value": value,
                "withShift": value.to_uppercase(),
                "withAltGr": value,
                "withShiftAltGr": value.to_uppercase()
            }));
        }

        let info = KeyboardLayoutInfo {
            id: layout_id.clone(),
            lang: layout_id.split('-').next().unwrap_or("en").to_string(),
            localized_name: Some(get_layout_display_name(&layout_id)),
            display_name: Some(get_layout_display_name(&layout_id)),
            text: Some(layout_id.split('-').next().unwrap_or("EN").to_uppercase()),
        };

        Ok(KeyboardLayoutData {
            keyboard_layout_info: info,
            keyboard_mapping: mapping,
        })
    }
}

#[cfg(target_os = "linux")]
fn get_linux_available_layouts() -> Result<Vec<KeyboardLayoutInfo>, String> {
    // This is a simplified implementation
    // In practice, you'd parse /usr/share/X11/xkb/rules/evdev.xml or similar
    let common_layouts = vec![
        ("us", "English (US)"),
        ("de", "German"),
        ("fr", "French"),
        ("es", "Spanish"),
        ("it", "Italian"),
        ("pt", "Portuguese"),
        ("ru", "Russian"),
        ("ja", "Japanese"),
        ("ko", "Korean"),
        ("zh", "Chinese"),
    ];

    let mut result = Vec::new();
    for (id, name) in common_layouts {
        result.push(KeyboardLayoutInfo {
            id: id.to_string(),
            lang: id.split('-').next().unwrap_or("en").to_string(),
            localized_name: Some(name.to_string()),
            display_name: Some(name.to_string()),
            text: Some(id.split('-').next().unwrap_or("EN").to_uppercase()),
        });
    }

    Ok(result)
}

#[cfg(target_os = "linux")]
fn get_layout_display_name(layout: &str) -> String {
    // Simplified layout name mapping
    match layout {
        "us" => "English (US)",
        "de" => "German",
        "fr" => "French",
        "es" => "Spanish",
        "it" => "Italian",
        "pt" => "Portuguese",
        "ru" => "Russian",
        "ja" => "Japanese",
        "ko" => "Korean",
        "zh" => "Chinese",
        _ => layout,
    }.to_string()
}