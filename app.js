import { MapboxOverlay as DeckOverlay } from '@deck.gl/mapbox';
import mapboxgl from 'mapbox-gl';

import { DMIOpenDataClient } from './src/dmi_fetch.js'
import { MyEnv } from './env.js';

mapboxgl.accessToken = MyEnv.MAPBOX_TOKEN;

const DMICLIENT_CLI = await DMIOpenDataClient.initialize(MyEnv.DMI_API_KEY_CLIMATE, "climateData", "v2");
const DMICLIENT_MET = await DMIOpenDataClient.initialize(MyEnv.DMI_API_KEY_METOBS, "metObs", "v2");

const map = new mapboxgl.Map({
  container: 'map',
  style: 'mapbox://styles/mapbox/light-v11',
  center: [8.60, 56.351],
  zoom: 10.5,
  bearing: 0,
  pitch: 0
});

//start --- testing reading the fetched data and drawing icons on the map
const clickedLayer = document.createElement('div');
clickedLayer.className = 'clicked_marker';
clickedLayer.style.backgroundImage = `url(${MyEnv.LOCALHOST}/resources/map-pin-ellipse-svgrepo-com.svg)`;
clickedLayer.style.width = `60px`;
clickedLayer.style.height = `60px`;
clickedLayer.style.backgroundSize = '100%';

const location_marker = new mapboxgl.Marker(clickedLayer);
var station_markers = [];

map.on('click', async (e) => {
  // place marker at clicked location
  location_marker.setLngLat(e.lngLat).addTo(map);

  // clearing previously set station markers
  if (station_markers.length > 0) {
    for (const m of station_markers) {
      m.remove();
    }
    station_markers.length = 0;
  }
  // fetch closest station to clicked location
  const station = await DMIOpenDataClient.get_closest_station(DMICLIENT_CLI, e.lngLat.lat, e.lngLat.lng);
  const stationLayer = document.createElement('div');
  stationLayer.className = 'station_marker';
  stationLayer.style.backgroundImage = `url(${MyEnv.LOCALHOST}/resources/weather-icons-67-svgrepo-com.svg)`;
  stationLayer.style.width = `60px`;
  stationLayer.style.height = `60px`;
  stationLayer.style.backgroundSize = '100%';

  station_markers.push(new mapboxgl.Marker(stationLayer).setLngLat([station.geometry.coordinates[0], station.geometry.coordinates[1]]).addTo(map));

})
//end --- testing reading the fetched data and drawing icons on the map

map.addControl(new mapboxgl.NavigationControl());
