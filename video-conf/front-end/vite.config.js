import { defineConfig } from "vite";
import fs from "fs";

export default defineConfig({
  build: {
    sourcemap: true, // Enable source maps
  },
  server: {
    https: {
      key: fs.readFileSync("./cert/cert.key"),
      cert: fs.readFileSync("./cert/cert.crt"),
    },
    host: "0.0.0.0", // atau '0.0.0.0' kalau mau diakses dari perangkat lain
    port: 3000,
  },
});
