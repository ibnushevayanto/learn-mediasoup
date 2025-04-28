const os = require("os");

function getLocalIp(preferIPv4 = true) {
  const interfaces = os.networkInterfaces();

  for (const name in interfaces) {
    for (const iface of interfaces[name]) {
      if (!iface.internal) {
        if (preferIPv4 && iface.family === "IPv4") return iface.address;
        if (!preferIPv4 && iface.family === "IPv6") return iface.address;
      }
    }
  }

  return "127.0.0.1"; // fallback
}

module.exports = getLocalIp;
