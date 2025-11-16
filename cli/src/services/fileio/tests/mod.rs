/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

pub mod operations_tests;
pub mod locks_tests;
pub mod integration_tests;
pub mod platform_tests;

use std::path::Path;
use tempfile::NamedTempFile;
use std::io::Write;
use tokio::fs;

pub fn create_temp_file(content: &[u8]) -> NamedTempFile {
    let mut temp = NamedTempFile::new().expect("Failed to create temp file");
    temp.write_all(content).expect("Failed to write to temp file");
    temp
}

pub async fn assert_file_eq(path: &Path, expected: &[u8]) {
    let actual = fs::read(path).await.expect("Failed to read file");
    assert_eq!(actual, expected);
}