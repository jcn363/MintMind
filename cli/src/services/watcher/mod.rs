/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

pub mod coalescer;
pub mod non_recursive;
pub mod recursive;
pub mod service;
pub mod suspend;
pub mod throttler;
pub mod types;

pub use service::UniversalWatcher;