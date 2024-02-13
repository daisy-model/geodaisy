import {MapboxOverlay as DeckOverlay} from '@deck.gl/mapbox';
import mapboxgl from 'mapbox-gl';

import { DMIOpenDataClient } from './src/dmi_fetch.js'
import { MyEnv } from './env.js';

mapboxgl.accessToken = MyEnv.MAPBOX_TOKEN;

const DMICLIENT_CLI = await DMIOpenDataClient.initialize(MyEnv.DMI_API_KEY_CLIMATE, "climateData", "v2");
const DMICLIENT_MET = await DMIOpenDataClient.initialize(MyEnv.DMI_API_KEY_METOBS, "metObs", "v2");

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',//'https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json',
  center: [8.60, 56.351],
  zoom: 10.5,
  bearing: 0,
  pitch: 0
});

map.addControl(new mapboxgl.NavigationControl());
