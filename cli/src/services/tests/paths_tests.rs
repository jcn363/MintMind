/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use super::super::PathNormalizer;

#[cfg(unix)]
#[test]
fn test_normalize_unix() {
    // Test Unix path normalization (. , .., multiple slashes)
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
    assert_eq!(PathNormalizer::normalize("/foo//bar"), "/foo/bar");
    assert_eq!(PathNormalizer::normalize("/foo///bar"), "/foo/bar");
    assert_eq!(PathNormalizer::normalize("foo//bar"), "foo/bar");
}

#[cfg(windows)]
#[test]
fn test_normalize_windows() {
    // Test Windows path normalization (backslashes, drive letters, UNC)
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
    assert_eq!(PathNormalizer::normalize("C:\\foo\\\\bar"), "C:\\foo\\bar");
    assert_eq!(PathNormalizer::normalize("C:\\foo\\\\\\bar"), "C:\\foo\\bar");
}

#[test]
fn test_resolve_absolute() {
    // Verify absolute path resolution
    #[cfg(unix)]
    {
        assert_eq!(PathNormalizer::resolve(&["/foo/bar", "baz"]), "/foo/bar/baz");
        assert_eq!(PathNormalizer::resolve(&["/foo/bar", "../baz"]), "/foo/baz");
        assert_eq!(PathNormalizer::resolve(&["/"]), "/");
        assert_eq!(PathNormalizer::resolve(&["/foo"]), "/foo");
    }
    #[cfg(windows)]
    {
        assert_eq!(PathNormalizer::resolve(&["C:\\foo\\bar", "baz"]), "C:\\foo\\bar\\baz");
        assert_eq!(PathNormalizer::resolve(&["C:\\foo\\bar", "..\\baz"]), "C:\\foo\\baz");
        assert_eq!(PathNormalizer::resolve(&["C:\\"]), "C:\\");
        assert_eq!(PathNormalizer::resolve(&["C:\\foo"]), "C:\\foo");
        assert_eq!(PathNormalizer::resolve(&["\\\\server\\share"]), "\\\\server\\share");
    }
}

#[test]
fn test_resolve_relative() {
    // Verify relative path resolution
    #[cfg(unix)]
    {
        assert_eq!(PathNormalizer::resolve(&["foo/bar", "baz"]), format!("{}/foo/bar/baz", std::env::current_dir().unwrap().to_string_lossy()));
        assert_eq!(PathNormalizer::resolve(&["foo/bar", "../baz"]), format!("{}/foo/baz", std::env::current_dir().unwrap().to_string_lossy()));
        assert_eq!(PathNormalizer::resolve(&["."]), std::env::current_dir().unwrap().to_string_lossy().to_string());
    }
    #[cfg(windows)]
    {
        assert_eq!(PathNormalizer::resolve(&["foo\\bar", "baz"]), format!("{}\\foo\\bar\\baz", std::env::current_dir().unwrap().to_string_lossy()));
        assert_eq!(PathNormalizer::resolve(&["foo\\bar", "..\\baz"]), format!("{}\\foo\\baz", std::env::current_dir().unwrap().to_string_lossy()));
        assert_eq!(PathNormalizer::resolve(&["."]), std::env::current_dir().unwrap().to_string_lossy().to_string());
    }
}

#[test]
fn test_relative_path() {
    // Test computing relative paths between two locations
    #[cfg(unix)]
    {
        assert_eq!(PathNormalizer::relative("/foo/bar", "/foo/baz"), "../baz");
        assert_eq!(PathNormalizer::relative("/foo/bar", "/foo/bar/baz"), "baz");
        assert_eq!(PathNormalizer::relative("/foo/bar/baz", "/foo/bar"), "..");
        assert_eq!(PathNormalizer::relative("/foo/bar", "/foo/bar"), "");
        assert_eq!(PathNormalizer::relative("/", "/foo"), "foo");
    }
    #[cfg(windows)]
    {
        assert_eq!(PathNormalizer::relative("C:\\foo\\bar", "C:\\foo\\baz"), "..\\baz");
        assert_eq!(PathNormalizer::relative("C:\\foo\\bar", "C:\\foo\\bar\\baz"), "baz");
        assert_eq!(PathNormalizer::relative("C:\\foo\\bar\\baz", "C:\\foo\\bar"), "..");
        assert_eq!(PathNormalizer::relative("C:\\foo\\bar", "C:\\foo\\bar"), "");
        assert_eq!(PathNormalizer::relative("C:\\", "C:\\foo"), "foo");
    }
}

#[test]
fn test_join_paths() {
    // Test joining multiple path segments
    #[cfg(unix)]
    {
        assert_eq!(PathNormalizer::join(&["/", "foo", "bar"]), "/foo/bar");
        assert_eq!(PathNormalizer::join(&["/foo", "bar", "baz"]), "/foo/bar/baz");
        assert_eq!(PathNormalizer::join(&["foo", "bar"]), "foo/bar");
        assert_eq!(PathNormalizer::join(&[".", "foo"]), "foo");
        assert_eq!(PathNormalizer::join(&[]), ".");
        assert_eq!(PathNormalizer::join(&["", ""]), ".");
    }
    #[cfg(windows)]
    {
        assert_eq!(PathNormalizer::join(&["C:\\", "foo", "bar"]), "C:\\foo\\bar");
        assert_eq!(PathNormalizer::join(&["C:\\foo", "bar", "baz"]), "C:\\foo\\bar\\baz");
        assert_eq!(PathNormalizer::join(&["foo", "bar"]), "foo\\bar");
        assert_eq!(PathNormalizer::join(&[".", "foo"]), "foo");
        assert_eq!(PathNormalizer::join(&[]), ".");
        assert_eq!(PathNormalizer::join(&["", ""]), ".");
    }
}

#[test]
fn test_case_sensitivity() {
    // Verify case handling per platform
    #[cfg(unix)]
    {
        // Unix is case sensitive
        assert_eq!(PathNormalizer::resolve(&["/Foo"]), "/Foo");
        assert_eq!(PathNormalizer::resolve(&["/foo"]), "/foo");
        assert_eq!(PathNormalizer::relative("/Foo", "/foo"), "../foo");
    }
    #[cfg(windows)]
    {
        // Windows is case insensitive
        assert_eq!(PathNormalizer::resolve(&["C:\\Foo"]), "C:\\Foo");
        assert_eq!(PathNormalizer::resolve(&["C:\\foo"]), "C:\\foo");
        // Note: relative path computation may not handle case insensitivity in the same way as full path resolution
        // This test focuses on resolution behavior
    }
}

#[test]
fn test_edge_cases() {
    // Test empty paths, root paths, trailing slashes
    assert_eq!(PathNormalizer::normalize(""), ".");
    #[cfg(unix)]
    {
        assert_eq!(PathNormalizer::normalize("/"), "/");
        assert_eq!(PathNormalizer::resolve(&["/"]), "/");
        assert_eq!(PathNormalizer::join(&["/"]), "/");
        assert_eq!(PathNormalizer::relative("/", "/"), "");
        assert_eq!(PathNormalizer::normalize("///"), "/");
        assert_eq!(PathNormalizer::normalize("/foo//"), "/foo/");
    }
    #[cfg(windows)]
    {
        assert_eq!(PathNormalizer::normalize("\\"), "\\");
        assert_eq!(PathNormalizer::resolve(&["C:\\"]), "C:\\");
        assert_eq!(PathNormalizer::join(&["C:\\"]), "C:\\");
        assert_eq!(PathNormalizer::relative("C:\\", "C:\\"), "");
        assert_eq!(PathNormalizer::normalize("\\\\\\"), "\\");
        assert_eq!(PathNormalizer::normalize("C:\\foo\\\\"), "C:\\foo\\");
    }
}