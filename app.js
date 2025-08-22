import { MapboxOverlay as DeckOverlay } from '@deck.gl/mapbox';
import mapboxgl from 'mapbox-gl';
import { saveAs } from 'file-saver';
import { DMIOpenDataClient } from './src/dmi_fetch.js'
import { CoordinateClient } from './src/coordinate_fetch.js'
import { HIPOpenDataClient } from './src/hip_fetch.js'
import { MyEnv } from './env.js';

mapboxgl.accessToken = MyEnv.MAPBOX_TOKEN;

const DMICLIENT_CLI = new DMIOpenDataClient("climateData", "v2");
const DMICLIENT_MET = new DMIOpenDataClient("metObs", "v2");
const COORDINATE_CLIENT = new CoordinateClient("maptiler", "v1");
const HIP_CLIENT = new HIPOpenDataClient("hydro", "v1");

const SPINNING_ICON = `url(/resources/180-ring-with-bg.svg)`;
const LOCATION_ICON = `url(/resources/map-pin-ellipse-svgrepo-com.svg)`;
const STATION_ICON = `url(/resources/weather-icons-67-svgrepo-com.svg)`;

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
clickedLayer.style.backgroundImage = LOCATION_ICON;
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
    clickedLayer.style.backgroundImage = LOCATION_ICON;
    for (const m of station_markers) {
      m.remove();
    }
    station_markers.length = 0;
  }

  const soil_column = [{ type: "TopSoil", depth: 2 }, { type: "Clay", depth: 5 }];
  var soil_str = "Soil column: ";
  for (const s of soil_column) {
    soil_str = `${soil_str} ${s.type} at ${s.depth}m</br>`;
  }
  document.getElementById("parameter-text").innerHTML = `
      <p>Location selected is: ${e.lngLat.lng.toFixed(4)}, ${e.lngLat.lat.toFixed(4)} </br></p>
      `;
  document.getElementById("location_specific_data").innerHTML = `
        <button type="button" class="collapsible">Management</button>
        <div class="content">
        <p>Management data source: <a href='https://lbst.dk'>LBST</a></p>
        <p>Soil usage is: Farmland, intensive </br></p>
        <button id="getfielddata" type='button'>Download management file</button></br>
        </div>
        <button type="button" class="collapsible">Soil</button>
        <div class="content">
        <p>Soil data source: <a href='https://pure.au.dk/portal/da/projects/digital-jordbundskortl%C3%A6gning-ud-fra-satellit-sensordata-og-modelb'>DIGIJORD</a></p>
          <p>${soil_str}</p>
        <button id="getcolumndata" type='button'>Download soil column</button></br>
        </div>`;
  // add buttons to time_specific_data div
  document.getElementById("time_specific_data").innerHTML = `
  <button type="button" class="collapsible">Weather</button>
  <div class="content">
      <p>Weather data source: <a href='https://www.dmi.dk/'>DMI</a></p>
        <label for="startdate">Start date:</label>
        <input type="date" id="startdate" name="time-start" value="2018-07-22" min="2018-01-01" max="2018-12-31" />
        <label for="enddate">End date:</label>
        <input type="date" id="enddate" name="time-end" value="2018-07-22" min="2018-01-01" max="2018-12-31" />
      </br></br>
        <button id="getdmidata" type='button'>Download weather data</button></br>
        <button id="getmetadata" type='button'>Download weather meta data</button></br>
      </div>
      <button type="button" class="collapsible">Hydrology</button>
      <div class="content">
        <p>Hydrologic data source: <a href='https://hip.dataforsyningen.dk/'>HIP</a> </p>
        <button id="getpressuredata" type='button'>Download pressure table</button>
        </div>`;
  // add listeners to the buttons, to save the fetched data
  document.getElementById("getdmidata").addEventListener("click", async function () {
    // fetch closest station to clicked location
    clickedLayer.style.backgroundImage = SPINNING_ICON;
    const [ps, stations] = await fetchDMI(e);
    // data has been fetched, update spinner to location marker
    clickedLayer.style.backgroundImage = LOCATION_ICON;
    ps.sortBy('time_stamp');
    const file_content = ps.toCSV(true);
    saveAs(new Blob([file_content], {
      type: "text/plain;charset=utf-8",
    }), "dmi_observations.csv");
  });
  document.getElementById("getmetadata").addEventListener("click", async function () {
    // fetch closest station to clicked location
    clickedLayer.style.backgroundImage = SPINNING_ICON;
    const [ps, stations] = await fetchDMI(e);
    // data has been fetched, update spinner to location marker
    clickedLayer.style.backgroundImage = LOCATION_ICON;
    const file_content = stations.toCSV(true);
    saveAs(new Blob([file_content], {
      type: "text/plain;charset=utf-8",
    }), "dmi_meta.csv");
  });
  document.getElementById("getpressuredata").addEventListener("click", async function () {
      clickedLayer.style.backgroundImage = SPINNING_ICON;
      // We have lat/long coordinate but we need it as easting/northing in EPSG:25832
      await fetchCoordinate(e); // TODO: Where does e come from? Can we make it explicit?
      const fake_time = "T00:00:00"
      const start_time = document.getElementById("startdate").value + fake_time;
      const end_time = document.getElementById("enddate").value + fake_time;
      const groundwater = await HIPOpenDataClient.get_groundwater(HIP_CLIENT, coordinates.x, coordinates.y, start_time, end_time)
      clickedLayer.style.backgroundImage = LOCATION_ICON;
      const file_content = format_groundwater_header(groundwater.header) + groundwater.data.toCSV(true);
      saveAs(new Blob([file_content], {
          type: "text/plain;charset=utf-8",
      }), "pressure_table.csv");
  });
  document.getElementById("getcolumndata").addEventListener("click", function () {
    const file_content = "not yet implemented";
    saveAs(new Blob([file_content], {
      type: "text/plain;charset=utf-8",
    }), "soil_column.dai");
  });

  document.getElementById("getfielddata").addEventListener("click", function () {
    const file_content = "not yet implemented";
    saveAs(new Blob([file_content], {
      type: "text/plain;charset=utf-8",
    }), "management.dai");
  });
  var coll = document.getElementsByClassName("collapsible");
  var i;

  for (i = 0; i < coll.length; i++) {
    coll[i].addEventListener("click", function () {
      this.classList.toggle("active");
      var content = this.nextElementSibling;
      if (content.style.display === "block") {
        content.style.display = "none";
      } else {
        content.style.display = "block";
      }
    });
  }
})

//end --- testing reading the fetched data and drawing icons on the map

function format_groundwater_header(h) {
    return [
        `# Data source : ${h.data_src}`,
        `# License : ${h.data_license}`,
        `# tileId : ${h.tileId}`,
        `# Kote : ${h.kote}`,
        `# Requested point : (${h.request_point.x} ${h.request_point.y})`,
        `# Actual point : (${h.actual_point.x} ${h.actual_point.y})`,
        ""
    ].join("\n");
}

async function fetchCoordinate(e) {
    const transformed = await CoordinateClient.transform(COORDINATE_CLIENT, e.lngLat.lat, e.lngLat.lng);
    return transformed;
}

async function fetchDMI(e) {
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

  return [ps, stations];

}
map.addControl(new mapboxgl.NavigationControl());
