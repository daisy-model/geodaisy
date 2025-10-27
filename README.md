# geodaisy

A web application using [Deck.gl](https://deck.gl/) and [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/api/) to visualize weather and groundwater data sourced through DMI and HIP APIs. The project pairs a Vite-powered frontend with an Express proxy backend so API keys stay server-side.

## Environment configuration

Create a `.env` file in the project root before running any workflow:

```dotenv
# .env (never commit this)
DMI_API_KEY_METOBS="YOUR_DMI_METOBS_API_KEY"
DMI_API_KEY_CLIMATE="YOUR_DMI_CLIMATE_API_KEY"
HIP_API_KEY="YOUR_HIP_API_KEY"
MAPTILER_API_KEY="YOUR_MAPTILER_API_KEY"
VITE_MAPBOX_TOKEN="YOUR_PUBLIC_MAPBOX_TOKEN"
PORT=3000
ALLOWED_ORIGINS=http://localhost:4173
```

> **Note:** Docker Compose also recognises two additional variables from your shell:
> * `APP_ENV` — `development` (default) enables hot-reload, `production` serves the built bundle.
> * `CLOUDFLARE_TUNNEL_TOKEN` — required when exposing production traffic through Cloudflare Tunnel.

## Docker-first workflows

The repository ships with a multi-stage `Dockerfile` and a single `docker-compose.yml` that flexes between development and production based on `APP_ENV`.

### Development (hot reload with docker watch)

1.  Ensure Docker Engine and Docker Compose Plugin v2 are installed.
2.  From the project root run:
    ```bash
    APP_ENV=development docker compose up --build
    ```
3.  What you get:
    * Express API on <http://localhost:3000>.
    * Vite dev server with live reload via polling on <http://localhost:4173>.
    * File changes on your host are mirrored into the container through a bind mount, so the preview refreshes automatically.
4.  Stop with `Ctrl+C`, or keep services running in the background with `APP_ENV=development docker compose up -d` and view aggregated logs via `docker compose logs -f`.

### Production (docker compose up with Cloudflare)

1.  Generate or copy an existing Cloudflare Tunnel token. Save it securely—Compose expects it via `CLOUDFLARE_TUNNEL_TOKEN`.
2.  Build and start the hardened stack:
    ```bash
    APP_ENV=production \
    CLOUDFLARE_TUNNEL_TOKEN=YOUR_TUNNEL_TOKEN \
    docker compose up --build -d
    ```
3.  Behaviour in production mode:
    * The container boots from the production stage of the multi-stage build and serves pre-built assets with `npm run start-prod-server`.
    * The Cloudflare sidecar only activates when `APP_ENV=production` **and** a tunnel token is present; otherwise it idles safely.
    * Default ports remain published locally (3000 API, 4173 preview) for health checks or internal access.
4.  Rotate or revoke the tunnel by updating `CLOUDFLARE_TUNNEL_TOKEN` and re-running `docker compose up -d`.
5.  Tear everything down with:
    ```bash
    APP_ENV=production docker compose down --remove-orphans
    ```

### Useful docker commands

```bash
# Rebuild after dependency changes
APP_ENV=development docker compose build

# Tail logs for both services
docker compose logs -f

# Run a one-off command in the app container
docker compose exec geodaisy npm test
```

## Optional: local Node.js workflows

Running outside Docker is still supported when Node.js 20+ is installed locally.

1.  Install dependencies:
    ```bash
    npm install
    ```
2.  Start the dev experience:
    ```bash
    npm run dev
    ```
    The command concurrently launches the backend (`nodemon`) and Vite dev server (now bound to `0.0.0.0` for parity with Docker).
3.  Build for production or serve locally:
    ```bash
    npm run build
    npm run start-prod-server
    ```

## Optional: deploying as a systemd service

If you manage the app directly on a Linux host (without containers), you can still use the included `install-service.sh`.

1.  Ensure prerequisites are installed: `rsync`, `useradd`, `groupadd`, `systemctl`, Node.js/npm, and that your `.env` file is present.
2.  Install the service (the script provisions a locked-down `geodaisy` system user by default):
    ```bash
    sudo SERVICE_USER=<your-user-if-needed> npm run install-service
    ```
3.  Manage the service via standard commands:
    * `sudo systemctl status geodaisy.service`
    * `sudo systemctl stop geodaisy.service`
    * `sudo systemctl start geodaisy.service`
4.  Uninstall cleanly:
    ```bash
    npm run uninstall-service
    ```

## Project structure

* **Frontend:** `/src`, `app.js`, `index.html`, `env.js`.
* **Backend:** `server.js` exposes `/api/*` endpoints and mediates external API requests.
* **Static assets:** Store icons and images in `/public`.

## Basemap

The basemap in this example is provided by [CARTO free basemap service](https://carto.com/basemaps). To use an alternative base map solution, visit [this guide](https://deck.gl/docs/get-started/using-with-map#using-other-basemap-services).

