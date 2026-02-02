/**
 * @license
 * Copyright 2026 Álvaro García
 * www.binarynonsense.com
 * SPDX-License-Identifier: BSD-2-Clause
 */

const { parentPort } = require("node:worker_threads");
const fs = require("node:fs");
const os = require("node:os");

let g_prevCpuStats = { idle: 0, total: 0 };
let g_smoothedCpu = 0;
let g_isFirstRun = true;
let g_hasShownFlatpakSpawnError = false;

parentPort.on("message", (message) => {
  if (message === "shutdown") {
    process.exit(0);
  }
});

setInterval(() => {
  const stats = getSystemStats();
  parentPort?.postMessage({ type: "stats", stats: stats });
}, 1000);

function getCpuPercent(currentIdleTicks, currentTotalTicks) {
  const diffIdle = currentIdleTicks - g_prevCpuStats.idle;
  const diffTotal = currentTotalTicks - g_prevCpuStats.total;
  const raw = diffTotal > 0 ? (1 - diffIdle / diffTotal) * 100 : 0;
  g_prevCpuStats = { idle: currentIdleTicks, total: currentTotalTicks };
  return raw;
}

function getSystemStats() {
  try {
    let totalGiB, usedGiB, rawCpuPercent;

    let useFallback = true;
    let isHostData = false;
    let showWarningIcon = false;
    let memInfo, statData;

    if (os.platform() === "linux") {
      // linux method: more precise, I think
      try {
        const isFlatpak = fs.existsSync("/.flatpak-info");
        if (isFlatpak) {
          try {
            // try to escape sandbox via D-Bus
            // needs flatpak override --user --talk-name=org.freedesktop.Flatpak com.binarynonsense.acbr
            // NOTE: using just flatpak-spawn, without /usr/bin/, didn't work
            // NOTE: I do this spawn method because checking, for example,
            // /run/host/proc/meminfo, as some refs suggested, didn't work
            const { execSync } = require("child_process");
            memInfo = execSync(
              "/usr/bin/flatpak-spawn --host cat /proc/meminfo 2>/dev/null",
              {
                encoding: "utf8",
                shell: true,
              },
            );
            statData = execSync(
              "/usr/bin/flatpak-spawn --host cat /proc/stat 2>/dev/null",
              {
                encoding: "utf8",
                shell: true,
              },
            ).split("\n")[0];
            isHostData = true;
          } catch (error) {
            // try the native way, less accurate
            if (!g_hasShownFlatpakSpawnError) {
              // show only once, no need to fill the terminal
              g_hasShownFlatpakSpawnError = true;
              parentPort?.postMessage({
                type: "dev-error-log",
                text: `error launching flatpak-spawn msg: ${error.message} | stderr: ${error.stderr?.toString()}`,
              });
            }
          }
        }
        if (!isHostData) {
          // native way (sandboxed in Flatpak, accurate elsewhere)
          try {
            // per node's docs using fs.existsSync could generate a race
            // condition, better just directly try reading, although with these
            // particular proc files I'm not sure it could happen
            memInfo = fs.readFileSync("/proc/meminfo", "utf8");
            statData = fs.readFileSync("/proc/stat", "utf8").split("\n")[0];
          } catch (error) {
            throw "permission error";
          }
        }
        // check for pid isolation: if in Flatpak and pids < 20 processes,
        // the sandbox is hiding the host system's activity so the data is
        // inaccurate
        const pids = fs.readdirSync("/proc").filter((f) => /^\d+$/.test(f));
        isRestricted = isFlatpak && pids.length < 20;
        // mem:
        // memInfo example:
        // MemTotal:       16369524 kB
        // MemFree:         9123048 kB
        // MemAvailable:   12458312 kB
        // Buffers:          345672 kB
        // Cached:          2109484 kB
        // ...
        const totalKB = parseInt(memInfo.match(/^MemTotal:\s+(\d+)/m)[1]);
        const availableKB = parseInt(
          memInfo.match(/^MemAvailable:\s+(\d+)/m)[1], // /m = check every line
        );
        totalGiB = totalKB / (1024 * 1024);
        usedGiB = (totalKB - availableKB) / (1024 * 1024);
        // cpu:
        // statData example:
        // cpu  145290 3456 52390 1289034 2390 102 50 0 0 0
        const ticks = statData.split(/\s+/).slice(1).map(Number);
        // ticks entries are cumulative time counters for each CPU state
        // user, nice, system, idle, iowait, irq, softirq, steal, guest, guest_nice
        const idleTicks = ticks[3] + ticks[4];
        const totalTicks = ticks.reduce(
          (totalTicks, stateTicks) => totalTicks + stateTicks,
          0,
        );
        rawCpuPercent = getCpuPercent(idleTicks, totalTicks);
        useFallback = false;
      } catch (error) {
        // use fallback
      }
      if (!isHostData && fs.existsSync("/.flatpak-info")) {
        showWarningIcon = true;
      }
    }

    // parentPort?.postMessage({
    //   type: "test-log",
    //   text: `isHostData: ${isHostData} | useFallback: ${useFallback}`,
    // });

    if (useFallback) {
      // fallback method
      // mem:
      totalGiB = os.totalmem() / 1024 ** 3;
      usedGiB = (os.totalmem() - os.freemem()) / 1024 ** 3;
      // cpu:
      const cpus = os.cpus();
      // accumulate values from cores
      const currentCpuIdle = cpus.reduce(
        (totalIdleTime, core) => totalIdleTime + core.times.idle,
        0,
      );
      const currentCpuTotal = cpus.reduce(
        (totalTime, core) =>
          totalTime +
          Object.values(core.times).reduce(
            (coreTime, stateTime) => coreTime + stateTime,
            0,
          ),
        0,
      );
      rawCpuPercent = getCpuPercent(currentCpuIdle, currentCpuTotal);
    }

    if (g_isFirstRun) {
      g_smoothedCpu = rawCpuPercent;
      g_isFirstRun = false;
    } else {
      // exponentially smooth it to avoid too much jitter
      // ref: https://en.wikipedia.org/wiki/Exponential_smoothing
      const factor = 0.3; // 0 to 1
      g_smoothedCpu = rawCpuPercent * factor + g_smoothedCpu * (1 - factor);
    }

    return {
      cpu: g_smoothedCpu,
      memoryUsed: usedGiB,
      memoryTotal: totalGiB,
      mode: !useFallback ? "proc" : "generic",
      warningIcon: showWarningIcon ? "warning" : "none",
    };
  } catch (error) {
    return {
      cpu: undefined,
      memoryUsed: undefined,
      memoryTotal: undefined,
      error: error.message,
      warningIcon: "error",
    };
  }
}
