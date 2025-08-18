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
        VITE_MAPBOX_TOKEN: "YOUR_PUBLIC_MAPBOX_TOKEN"
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

## Building for Production

To create an optimized build of the frontend application:

```bash
npm run build
```

This command generates static HTML, CSS, and JavaScript files in the `dist` directory.

## Testing the Production Build Locally

Before deploying, you can test the production build locally:

1.  **Ensure the backend server is running:** ```bash npm run server # or node --watch server.js ```
    (Keep this running in a separate terminal).

2.  **Run the preview command:**
    (Make sure you have run `npm run build` first)
    ```bash
    npm run preview
    ```

3.  **Access the application:** Open your browser to the URL provided by `vite preview` (e.g.,
    `http://localhost:4173`). This serves the files from `dist` and uses the same proxy
    configuration for API calls.


## Basemap

The basemap in this example is provided by [CARTO free basemap service](https://carto.com/basemaps). To use an alternative
base map solution, visit [this guide](https://deck.gl/docs/get-started/using-with-map#using-other-basemap-services).

