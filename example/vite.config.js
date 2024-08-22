// vite.config.js
import { resolve } from 'path'
import { defineConfig } from 'vite'
import fs from "fs";

export default defineConfig({
  server: {
    https: {
      key: fs.readFileSync("./127.0.0.2+1-key.pem"),
      cert: fs.readFileSync("./127.0.0.2+1.pem"),
    },
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
      }
    }
  }
})