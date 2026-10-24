const os = require('os');
const si = require('systeminformation');

/**
 * Format seconds into human-readable duration (Xd Xh Xm Xs).
 * @param {number} totalSeconds
 * @returns {string}
 */
function formatDuration(totalSeconds) {
  const seconds = Math.floor(totalSeconds % 60);
  const minutes = Math.floor((totalSeconds / 60) % 60);
  const hours = Math.floor((totalSeconds / (60 * 60)) % 24);
  const days = Math.floor(totalSeconds / (60 * 60 * 24));

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0 || days > 0) parts.push(`${hours}h`);
  if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes}m`);
  parts.push(`${seconds}s`);

  return parts.join(' ');
}

/**
 * Format bytes to readable string (MB, GB).
 * @param {number} bytes
 * @returns {string}
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
}

/**
 * Fetch system and process metrics.
 * @returns {Promise<Object>}
 */
async function getSystemMetrics() {
  const nodeUptimeSeconds = process.uptime();
  const sysUptimeSeconds = os.uptime();

  // Process memory
  const processMemory = process.memoryUsage();

  // System memory
  let totalMem = os.totalmem();
  let freeMem = os.freemem();
  let usedMem = totalMem - freeMem;
  let memPercent = ((usedMem / totalMem) * 100).toFixed(1);

  // CPU load
  let cpuLoad = 0;
  let cpuModel = os.cpus()[0]?.model || 'Generic CPU';
  let cpuCores = os.cpus().length;

  try {
    const currentLoad = await si.currentLoad();
    cpuLoad = currentLoad.currentLoad.toFixed(1);
  } catch {
    // Fallback if systeminformation fails
    const loads = os.loadavg();
    cpuLoad = ((loads[0] / cpuCores) * 100).toFixed(1);
  }

  // OS Info
  let osInfo = `${os.type()} ${os.release()} (${os.arch()})`;
  try {
    const siOs = await si.osInfo();
    if (siOs.distro) {
      osInfo = `${siOs.distro} ${siOs.release} (${siOs.arch})`;
    }
  } catch {
    // ignore
  }

  return {
    botUptime: formatDuration(nodeUptimeSeconds),
    systemUptime: formatDuration(sysUptimeSeconds),
    cpu: {
      load: `${cpuLoad}%`,
      model: cpuModel,
      cores: cpuCores
    },
    memory: {
      total: formatBytes(totalMem),
      used: formatBytes(usedMem),
      free: formatBytes(freeMem),
      percent: `${memPercent}%`,
      processRss: formatBytes(processMemory.rss),
      processHeap: formatBytes(processMemory.heapUsed)
    },
    os: {
      platform: osInfo,
      nodeVersion: process.version
    }
  };
}

module.exports = {
  formatDuration,
  formatBytes,
  getSystemMetrics
};
