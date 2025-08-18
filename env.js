// env.js

// Access the Mapbox token provided by Vite at build time
const mapboxToken = import.meta.env.VITE_MAPBOX_TOKEN;

// Optional: Add a check or warning if the token isn't set during build
if (!mapboxToken) {
  console.warn(
    "Warning: VITE_MAPBOX_TOKEN is not defined. Map functionality may be limited. Ensure it's set in your .env file and prefixed with VITE_."
  );
}

const MyEnv = {
  // Public Mapbox token is generally OK to include (often domain-restricted)
  MAPBOX_TOKEN: mapboxToken
};

export { MyEnv };
