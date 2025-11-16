/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

use crate::services::watcher::types::FileChange;
use std::collections::VecDeque;
use std::sync::atomic::{AtomicUsize, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use tokio::sync::mpsc;
use tokio::time::{self, Duration};

#[derive(Clone)]
pub struct ThrottlerConfig {
    pub max_buffered: usize,
    pub _chunk_size: usize,
    pub throttle_delay: Duration,
}

pub struct EventThrottler {
    buffer: Mutex<VecDeque<FileChange>>,
    max_buffered: usize,
    _chunk_size: usize,
    _throttle_delay: Duration,
    log_sink: Option<Arc<dyn Fn(String) + Send + Sync>>,
    pending: Arc<AtomicUsize>,
    dropped: Arc<AtomicU64>,
    throttled_batches: Arc<AtomicU64>,
    output_tx: mpsc::Sender<Vec<FileChange>>,
    worker_handle: Option<tokio::task::JoinHandle<()>>,
}

impl EventThrottler {
    pub fn new(config: ThrottlerConfig, log_sink: Option<Arc<dyn Fn(String) + Send + Sync>>) -> Self {
        let (output_tx, _output_rx) = mpsc::channel(100); // buffered channel

        let buffer = Mutex::new(VecDeque::new());
        let pending = Arc::new(AtomicUsize::new(0));
        let dropped = Arc::new(AtomicU64::new(0));
        let throttled_batches = Arc::new(AtomicU64::new(0));

        let worker_handle = {
            let pending = pending.clone();
            let log_sink = log_sink.clone();
            tokio::spawn(async move {
                Self::throttling_worker_async(
                    pending,
                    log_sink,
                ).await;
            })
        };

        EventThrottler {
            buffer,
            max_buffered: config.max_buffered,
            _chunk_size: config._chunk_size,
            _throttle_delay: config.throttle_delay,
            log_sink,
            pending,
            dropped,
            throttled_batches,
            output_tx,
            worker_handle: Some(worker_handle),
        }
    }

    pub fn send(&self, event: FileChange) -> Result<(), ()> {
        let mut buffer = self.buffer.lock().unwrap();
        if buffer.len() >= self.max_buffered {
            self.dropped.fetch_add(1, Ordering::Relaxed);
            if let Some(ref sink) = self.log_sink {
                sink(format!("started ignoring events due to too many file changes (buffer: {}, max: {})", buffer.len(), self.max_buffered));
            }
            return Err(());
        }
        buffer.push_back(event);
        self.pending.fetch_add(1, Ordering::Relaxed);
        Ok(())
    }

    /// Receive a batch with timeout
    pub fn recv_timeout(&self, _timeout: Duration) -> Option<Vec<FileChange>> {
        // This would need to be implemented using the mpsc receiver
        // For now, return None to indicate not implemented
        None
    }

    pub fn get_stats(&self) -> (usize, u64, u64) {
        (
            self.pending.load(Ordering::Relaxed),
            self.dropped.load(Ordering::Relaxed),
            self.throttled_batches.load(Ordering::Relaxed),
        )
    }

    pub fn reset_stats(&self) {
        self.pending.store(0, Ordering::Relaxed);
        self.dropped.store(0, Ordering::Relaxed);
        self.throttled_batches.store(0, Ordering::Relaxed);
    }

    async fn throttling_worker_async(
        pending: Arc<AtomicUsize>,
        log_sink: Option<Arc<dyn Fn(String) + Send + Sync>>,
    ) {
        loop {
            // Check for throttling start logging
            let current_pending = pending.load(Ordering::Relaxed);
            if current_pending > 1000 {
                if let Some(ref sink) = log_sink {
                    sink(format!("started throttling events due to large amount of file changes (pending: {})", current_pending));
                }
            }
            time::sleep(Duration::from_millis(10)).await;
        }
    }

    // Helper method to create throttler for recursive watchers
    pub fn recursive_config() -> ThrottlerConfig {
        ThrottlerConfig {
            max_buffered: 30000,
            _chunk_size: 500,
            throttle_delay: Duration::from_millis(200),
        }
    }

    // Helper method to create throttler for non-recursive watchers
    pub fn non_recursive_config() -> ThrottlerConfig {
        ThrottlerConfig {
            max_buffered: 10000,
            _chunk_size: 100,
            throttle_delay: Duration::from_millis(200),
        }
    }
}

impl Drop for EventThrottler {
    fn drop(&mut self) {
        // Flush remaining buffer
        {
            let mut buffer = self.buffer.lock().unwrap();
            if !buffer.is_empty() {
                // Create final chunk from remaining events
                let mut chunk = Vec::new();
                while let Some(event) = buffer.pop_front() {
                    chunk.push(event);
                }
                // Try to send remaining events (fire and forget)
                let _ = self.output_tx.try_send(chunk);
            }
        }

        // Abort the worker task
        if let Some(handle) = self.worker_handle.take() {
            handle.abort();
        }
    }
}

/// Convenience function to create throttler for recursive watchers
pub fn recursive_throttler(log_sink: Option<Arc<dyn Fn(String) + Send + Sync>>) -> EventThrottler {
    EventThrottler::new(EventThrottler::recursive_config(), log_sink)
}

/// Convenience function to create throttler for non-recursive watchers
pub fn non_recursive_throttler(log_sink: Option<Arc<dyn Fn(String) + Send + Sync>>) -> EventThrottler {
    EventThrottler::new(EventThrottler::non_recursive_config(), log_sink)
}