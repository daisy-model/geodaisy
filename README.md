# geodaisy

A web application using [Deck.gl](https://deck.gl/) and [Mapbox GL JS](https://docs.mapbox.com/mapbox-gl-js/api/) to visualize data, potentially including
weather observations fetched from the DMI API.

This project uses:
*   [Vite](https://vitejs.dev/) for frontend bundling and development server.
*   [Node.js](https://nodejs.org/) with [Express](https://expressjs.com/) for a backend proxy server to securely handle API keys.

## Project Structure

*   **Frontend:** Code in `/src`, `app.js`, `index.html`, `env.js`. Handled by Vite.
*   **Backend:** Code in `server.js`. Handles API requests to `/api/*` and securely calls external
    APIs (like DMI).
*   **Static Assets:** Place public static assets (like icons, images) in the `/public` directory.

## Setup

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/daisy-model/geodaisy || gh repo clone daisy-model/geodaisy
    cd geodaisy
    ```

1.  **Install dependencies:**
    (This installs dependencies for both frontend and backend)
    ```bash
    npm install
    # or
    yarn install
    ```

1.  **Configure The Environment:**
    *   Create a file named `.env` in the project root directory.
    *   Add your secret DMI API keys to this file:
        ```dotenv
        # .env - DO NOT COMMIT THIS FILE!
        DMI_API_KEY_METOBS="YOUR_DMI_METOBS_API_KEY"
        DMI_API_KEY_CLIMATE="YOUR_DMI_CLIMATE_API_KEY"
        VITE_MAPBOX_TOKEN="YOUR_PUBLIC_MAPBOX_TOKEN"
        ```

## Development

To run the application locally for development:

1.  **Run the development script:** ```bash npm run dev ``` This command concurrently starts:
    *   The backend Node.js server (using `nodemon` for auto-restarts) on its port (default 3000).
    *   The Vite frontend development server on its port (default 5173).

2.  **Access the application:** Open your browser to the URL provided by Vite (e.g.,
    `http://localhost:5173`).

The Vite dev server will automatically proxy API requests starting with `/api/` to your backend
server, thanks to the configuration in `vite.config.js`.

## Production

Instructions for building, running, and deploying the application in a production environment.

### Building the Application

To create an optimized build of the frontend application for production:

```bash
npm run build
```

This command generates static HTML, CSS, and JavaScript files in the `dist` directory.

### Running the Production Build

After building, you can run the production-ready application.

The easiest way to start both the backend server and the frontend server is:

```bash
npm run start-prod
```

This command first runs `npm run build` and then concurrently starts both the backend API server and the Vite preview server for the static frontend files.

If you have already built the application and want to skip the build step, you can run:
```bash
npm run start-prod-server
```

### Deploying as a Service (Linux)

For deploying on a Linux server, the repository includes scripts to manage the application as a `systemd` service. This ensures the application restarts automatically if it crashes or the server reboots.

1.  **Prepare the environment:**
    *   Ensure a `.env` file exists in the project root. The installer copies it alongside the deployed application.
    *   Confirm required system utilities (`rsync`, `useradd`, `groupadd`, `systemctl`) and Node.js are installed on the server.

2.  **Install the service:**
    Run the installation script with `sudo`. This will create or reuse a dedicated system account (default `geodaisy`), copy the current project to `/opt/geodaisy`, install production dependencies, and create a `systemd` unit that runs `npm run start-prod-server`.
    ```bash
    sudo SERVICE_USER=<your-user-if-needed> npm run install-service
    ```
    Omit the `SERVICE_USER` override to let the script manage a locked-down `geodaisy` system user automatically.

3.  **Manage the service:**
    You can now manage the service using standard `systemctl` commands, e.g.:
    *   `sudo systemctl status geodaisy.service`
    *   `sudo systemctl stop geodaisy.service`
    *   `sudo systemctl start geodaisy.service`

4.  **Uninstall the service:**
    To stop and remove the `systemd` service:
    ```bash
    npm run uninstall-service
    ```

## Docker

You can build and run the project with Docker to avoid installing Node.js directly on your host.

### Build and Run with Docker Compose

1.  Ensure your `.env` file is present in the project root. It will be supplied to the container automatically.
2.  Build and start the stack:
    ```bash
    docker compose up --build
    ```
3.  Access the services:
    *   Frontend (Vite preview): <http://localhost:4173>
    *   Backend API: <http://localhost:3000>

To shut everything down, press `Ctrl+C` and run `docker compose down` if you want to remove the containers.

## Basemap

The basemap in this example is provided by [CARTO free basemap service](https://carto.com/basemaps). To use an alternative
base map solution, visit [this guide](https://deck.gl/docs/get-started/using-with-map#using-other-basemap-services).

