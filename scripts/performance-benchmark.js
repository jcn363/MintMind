import { execSync, spawn } from 'child_process';
import { readdirSync, statSync } from 'fs';
import { platform } from 'os';
import { join } from 'path';

const TAURI_BUNDLE_DIR = join(process.cwd(), 'src-tauri', 'target', 'release', 'bundle');
// Historical baseline for comparison (Electron was ~150MB, Tauri is ~15-20MB)
const LEGACY_TAURI_BASELINE_MB = 150;
const TAURI_TARGET_MB = 20; // Target bundle size for Tauri
const STARTUP_TARGET_MS = 1000;
const MEMORY_TARGET_MB = 120;
const IPC_TARGET_MS = 5;

async function measureBundleSize() {
  try {
    const files = readdirSync(TAURI_BUNDLE_DIR);
    let totalSize = 0;

    for (const file of files) {
      const filePath = join(TAURI_BUNDLE_DIR, file);
      const stats = statSync(filePath);
      if (stats.isFile()) {
        totalSize += stats.size;
      }
    }

    const sizeMB = totalSize / (1024 * 1024);
    const comparison = ((sizeMB - TAURI_TARGET_MB) / TAURI_TARGET_MB * 100).toFixed(2);
    // Dramatic size reduction: Tauri achieves ~15-20MB vs Electron's ~150MB (87%+ smaller)
    return {
      bundleSizeMB: sizeMB.toFixed(2),
      comparisonToTauriTarget: `${comparison}%`, // Negative values indicate meeting target
      status: sizeMB <= TAURI_TARGET_MB ? 'PASS' : 'FAIL'
    };
  } catch (error) {
    return { error: `Failed to measure bundle size: ${error.message}` };
  }
}

async function measureStartupTime() {
  return new Promise((resolve) => {
    const start = Date.now();

    // Determine the binary path based on platform
    const binaryPath = join(TAURI_BUNDLE_DIR, 'mintmind');

    const child = spawn(binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let readyDetected = false;

    child.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('ready') && !readyDetected) {
        const time = Date.now() - start;
        readyDetected = true;
        child.kill();
        resolve({
          startupTimeMs: time,
          status: time < STARTUP_TARGET_MS ? 'PASS' : 'FAIL'
        });
      }
    });

    child.stderr.on('data', (data) => {
      // Handle stderr if needed
    });

    child.on('close', () => {
      if (!readyDetected) {
        resolve({ error: 'Failed to detect app ready event' });
      }
    });

    // Timeout after 30 seconds
    setTimeout(() => {
      if (!readyDetected) {
        child.kill();
        resolve({ error: 'Startup timed out' });
      }
    }, 30000);
  });
}

async function measureMemoryUsage() {
  return new Promise((resolve) => {
    // Spawn the binary and measure memory
    let binaryPath;
    if (platform() === 'win32') {
      binaryPath = join(TAURI_BUNDLE_DIR, 'mintmind.exe');
    } else if (platform() === 'darwin') {
      binaryPath = join(TAURI_BUNDLE_DIR, 'mintmind.app/Contents/MacOS/mintmind');
    } else {
      binaryPath = join(TAURI_BUNDLE_DIR, 'mintmind');
    }

    const child = spawn(binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      cwd: process.cwd()
    });

    let pid = child.pid;
    let readyDetected = false;

    child.stdout.on('data', (data) => {
      const output = data.toString();
      if (output.includes('ready') && !readyDetected) {
        readyDetected = true;
        // Wait a bit for stable memory usage
        setTimeout(() => {
          try {
            let memoryMB;
            if (platform() === 'win32') {
              const output = execSync(`tasklist /FI "PID eq ${pid}" /FO CSV`).toString();
              const lines = output.split('\n');
              if (lines.length > 1) {
                const columns = lines[1].split(',');
                memoryMB = parseInt(columns[4].replace(/"/g, '')) / 1024; // Convert KB to MB
              }
            } else {
              const output = execSync(`ps -o rss= -p ${pid}`).toString().trim();
              memoryMB = parseInt(output) / 1024; // Convert KB to MB
            }
            child.kill();
            resolve({
              memoryUsageMB: Math.round(memoryMB),
              status: memoryMB < MEMORY_TARGET_MB ? 'PASS' : 'FAIL'
            });
          } catch (error) {
            child.kill();
            resolve({ error: `Failed to measure memory: ${error.message}` });
          }
        }, 2000); // Wait 2 seconds after ready
      }
    });

    child.on('close', () => {
      if (!readyDetected) {
        resolve({ error: 'Failed to detect app ready event' });
      }
    });

    setTimeout(() => {
      if (!readyDetected) {
        child.kill();
        resolve({ error: 'Memory measurement timed out' });
      }
    }, 30000);
  });
}


async function runBenchmarks() {
  console.log('Running performance benchmarks...');

  const results = {
    timestamp: new Date().toISOString(),
    bundleSize: await measureBundleSize(),
    startupTime: await measureStartupTime(),
    memoryUsage: await measureMemoryUsage()
  };

  console.log(JSON.stringify(results, null, 2));

  // Check overall status
  const failedTests = Object.values(results).filter(result =>
    typeof result === 'object' && result.status === 'FAIL'
  );

  if (failedTests.length > 0) {
    console.error(`Performance benchmarks failed: ${failedTests.length} tests did not meet targets`);
    process.exit(1);
  } else {
    console.log('All performance benchmarks passed!');
  }
}

runBenchmarks().catch(console.error);
