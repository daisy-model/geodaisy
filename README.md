# geodaisy
Uses [Vite](https://vitejs.dev/) to bundle and serve files.

## Usage
To  setup API tokens and other local variables, you need to create a file called `env.js` in the root of this folder, containing the following variable definitions (add your own API tokens):

```
const MyEnv = {
    DMI_API_KEY_METOBS: ,
    DMI_API_KEY_CLIMATE: ,
    MAPBOX_TOKEN: 
}

export { MyEnv }
```

To install dependencies:

```bash
npm install
# or
yarn
```

Commands:
* `npm start` is the development target, to serve the app and hot reload.
* `npm run build` is the production target, to create the final bundle and write to disk.

### Basemap

The basemap in this example is provided by [CARTO free basemap service](https://carto.com/basemaps). To use an alternative base map solution, visit [this guide](https://deck.gl/docs/get-started/using-with-map#using-other-basemap-services)