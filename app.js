import { MapboxOverlay as DeckOverlay } from '@deck.gl/mapbox';
import mapboxgl from 'mapbox-gl';
import { saveAs } from 'file-saver';
import { DMIOpenDataClient } from './src/dmi_fetch.js'
import { MyEnv } from './env.js';

mapboxgl.accessToken = MyEnv.MAPBOX_TOKEN;

const DMICLIENT_CLI = new DMIOpenDataClient(MyEnv.DMI_API_KEY_CLIMATE, "climateData", "v2");
const DMICLIENT_MET = new DMIOpenDataClient(MyEnv.DMI_API_KEY_METOBS, "metObs", "v2");

const SPINNING_ICON = `url(${MyEnv.LOCALHOST}/resources/180-ring-with-bg.svg)`;
const LOCATION_ICON = `url(${MyEnv.LOCALHOST}/resources/map-pin-ellipse-svgrepo-com.svg)`;
const STATION_ICON = `url(${MyEnv.LOCALHOST}/resources/weather-icons-67-svgrepo-com.svg)`;

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
clickedLayer.style.backgroundImage = SPINNING_ICON;
clickedLayer.style.width = `60px`;
clickedLayer.style.height = `60px`;
clickedLayer.style.backgroundSize = '100%';

const location_marker = new mapboxgl.Marker(clickedLayer);
var station_markers = [];

map.on('click', async (e) => {
  // place marker at clicked location
  location_marker.setLngLat(e.lngLat).addTo(map);

  // clearing previously set station markers and resetting to spinning marker
  if (station_markers.length > 0) {
    clickedLayer.style.backgroundImage = SPINNING_ICON;
    for (const m of station_markers) {
      m.remove();
    }
    station_markers.length = 0;
  }
  // fetch closest station to clicked location
  const params = ["acc_precip", "mean_temp", "mean_relative_hum", "mean_wind_speed", "mean_radiation"];

  const startdate = document.getElementById("startdate").value;
  const enddate = document.getElementById("enddate").value;

  const [ps, stations] = await DMIOpenDataClient.get_data(DMICLIENT_CLI, e.lngLat.lat, e.lngLat.lng, startdate, enddate, "hour", params);

  for (const station of stations) {
    const stationLayer = document.createElement('div');
    stationLayer.className = 'station_marker';
    stationLayer.style.backgroundImage = STATION_ICON;
    stationLayer.style.width = `60px`;
    stationLayer.style.height = `60px`;
    stationLayer.style.backgroundSize = '100%';
    station_markers.push(new mapboxgl.Marker(stationLayer).setLngLat([station.get('lon'), station.get('lat')]).addTo(map));
  }

  // data has been fetched, update spinner to location marker
  location_marker.setLngLat(e.lngLat).addTo(map);
  clickedLayer.style.backgroundImage = LOCATION_ICON;

  // add buttons to download_area div
  document.getElementById("download_area").innerHTML = `
        <p>Location selected is: ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)} </p>
        <button id="getdmidata" type='button'>Download weather data</button></br>
        <button id="getmetadata" type='button'>Download weather meta data</button>
        `;
  // add listeners to the buttons, to save the fetched data
  document.getElementById("getdmidata").addEventListener("click", function () {
    ps.sortBy('time_stamp');
    const file_content = ps.toCSV(true);
    saveAs(new Blob([file_content], {
      type: "text/plain;charset=utf-8",
    }), "dmi_observations.txt");
  });
  document.getElementById("getmetadata").addEventListener("click", function () {
    const file_content = stations.toCSV(true);
    saveAs(new Blob([file_content], {
      type: "text/plain;charset=utf-8",
    }), "dmi_meta.txt");
  });
})
//end --- testing reading the fetched data and drawing icons on the map

map.addControl(new mapboxgl.NavigationControl());
