// vite.config.js
import { defineConfig } from "vite";
import { splitVendorChunkPlugin } from "vite"; // Import the helper

export default defineConfig({
  plugins: [
    splitVendorChunkPlugin(), // Automatically splits vendor code
  ],
  server: {
    host: "0.0.0.0",
    port: Number(process.env.VITE_PORT) || 4173,
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
  },
  preview: {
    port: Number(process.env.VITE_PORT) || 4173,
    allowedHosts: true // ['daisy', 'geodaisy.dk', 'localhost', '127.0.0.1']
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // Create specific chunks for large libraries
          if (id.includes("node_modules/mapbox-gl")) {
            return "mapbox-gl";
          }
          if (id.includes("node_modules/@deck.gl")) {
            return "deck-gl";
          }
          // You could add more rules for dataframe-js, etc.
          // Let splitVendorChunkPlugin handle the rest
        },
      },
    },
  },
});
