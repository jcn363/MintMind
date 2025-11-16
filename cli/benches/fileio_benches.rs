/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use criterion::{black_box, criterion_group, criterion_main, Criterion};
use std::fs;
use tempfile::TempDir;
use tokio::runtime::Runtime;

fn benchmark_fileio_operations(c: &mut Criterion) {
    let rt = Runtime::new().unwrap();
    let temp_dir = TempDir::new().unwrap();
    let test_file = temp_dir.path().join("benchmark_test.txt");
    let content = "Test content for benchmarking\n".repeat(1000);

    c.bench_function("fileio_write_utf8", |b| {
        b.iter(|| {
            rt.block_on(async {
                fs::write(&test_file, &content).unwrap();
                black_box(&test_file);
            });
        });
    });

    c.bench_function("fileio_read_utf8", |b| {
        b.iter(|| {
            rt.block_on(async {
                let _content = fs::read_to_string(&test_file).unwrap();
                black_box(&_content);
            });
        });
    });

    c.bench_function("fileio_read_write_cycle", |b| {
        b.iter(|| {
            rt.block_on(async {
                fs::write(&test_file, &content).unwrap();
                let read_content = fs::read_to_string(&test_file).unwrap();
                black_box(read_content);
            });
        });
    });
}

criterion_group!(benches, benchmark_fileio_operations);
criterion_main!(benches);