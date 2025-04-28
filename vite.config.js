// vite.config.js
import { defineConfig } from "vite";
import { splitVendorChunkPlugin } from "vite"; // Import the helper

export default defineConfig({
  plugins: [
    splitVendorChunkPlugin(), // Automatically splits vendor code
  ],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
      },
    },
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
