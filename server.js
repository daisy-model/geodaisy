// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch"; // You might need to install: npm install node-fetch

// Functions for input validation.
// TODO: Move elsewhere
function check_float(x) {
  return typeof (x) == "number" || x == parseFloat(x).toString()
}

function check_int(x) {
  return typeof (x) == "number" || x == parseInt(x).toString()
}

function check_date_time(s) {
  try {
    return s == (new Date(s + "Z")).toISOString().slice(0, 19);
  } catch {
    return false;
  }
}

function check_string(s, allowed) {
  for (let t of allowed) {
    if (s === t) {
      return true;
    }
  }
  return false;
}

function check_interpolation(s) {
  return check_string(s, ["none", "bilinear"]);
}

function validate_hip_parameters(x, y, fromTime, toTime, interpolation, apiVersion) {
  const errors = []
  if (!x || !y || !fromTime || !toTime || !interpolation || !apiVersion) {
    errors.push("Missing required parameters (x, y, fromTime, toTime, interpolation, apiVersion)");
  }
  if (!check_float(x)) {
    errors.push("Parameter 'x' must be number")
  }
  if (!check_float(y)) {
    errors.push("Parameter 'y' must be number")
  }
  if (!check_date_time(fromTime)) {
    errors.push(
      "Parameter 'fromTime' must be a datetime string in the format YYYY-MM-DDTHH:mm:ss"
    )
  }
  if (!check_date_time(toTime)) {
    errors.push(
      "Parameter 'toTime' must be a datetime string in the format YYYY-MM-DDTHH:mm:ss"
    )
  }
  if (!check_interpolation(interpolation)) {
    errors.push("Parameter 'interpolation' must be one of {'none', 'bilinear'}")
  }
  if (!check_int(apiVersion)) {
    errors.push("Parameter 'apiVersion' must be an integer (1 or 2)")
  }
  return errors;
}

async function hip_query_v1(x, y, fromTime, toTime, interpolation) {
  // v1 is no longer updated (sice 2019). It contains data from 1990-01-01 to 2019-12-31
  // From the documentation it seems that we get the value of the tile that the point is
  //in. Possibly from the nearest tile if we pick a point outside the domain
  // v1 only accepts dates, not times
  const fromDate = fromTime.slice(0, 10);
  const toDate = toTime.slice(0, 10);

  if (interpolation === "none") {
    const response = await _hip_query_v1(x, y, fromDate, toDate);
    response.data.interpolation = interpolation;
    return response;
  }
  return _interp_query(_hip_query_v1, x, y, fromDate, toDate, interpolation);
}

async function _hip_query_v1(x, y, fromDate, toDate) {
  const apiKey = process.env.HIP_API_KEY;
  // v1 needs a geometry
  const point = `POINT(${x} ${y})`;
  const url = `${HIP_BASE_URL}/rest/hydro_model/v1.0/terraennaert-grundvand/100m?token=${apiKey}&punkt=${point}&fra=${fromDate}&til=${toDate}`;
  const response = await fetch(url);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: `HIP API Error: ${response.statusText}`
    }
  }
  const data = await response.json();
  const dates = []
  const depths = []
  for (const day of data.resultater.dag) {
    dates.push(day.dato);
    depths.push(day.dybde);
  }
  const actual_coordinates = get_coordinates_from_geometry_point(data.geometry);
  return {
    ok: true,
    status: response.status,
    data: {
      request_point: { x: x, y: y },
      actual_point: { x: actual_coordinates[0], y: actual_coordinates[1] },
      dates: dates,
      depths: depths
    }
  };
}

async function hip_query_v2(x, y, fromTime, toTime, interpolation) {
  if (interpolation === "none") {
    const response = await _hip_query_v2(x, y, fromTime, toTime);
    response.data.interpolation = interpolation;
    return response;
  }
  return _interp_query(_hip_query_v2, x, y, fromTime, toTime, interpolation);
}

async function _hip_query_v2(x, y, fromTime, toTime) {
  const apiKey = process.env.HIP_API_KEY;
  const url = `${HIP_BASE_URL}/rest/hydro_model/v2/graph/shallowgroundwater/depth/day?token=${apiKey}&x=${x}&y=${y}&startDate=${fromTime}Z&endDate=${toTime}Z`;
  const response = await fetch(url);
  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      data: `HIP API Error: ${response.statusText}`
    }
  }
  const data = await response.json();
  const actual_coordinates = get_coordinates_from_geometry_point(data[0].geometry);
  return {
    ok: true,
    status: response.status,
    data: {
      request_point: { x: x, y: y },
      actual_point: { x: actual_coordinates[0], y: actual_coordinates[1] },
      dates: data[0].dateTimes,
      depths: data[0].values
    }
  };
}

async function _interp_query(query, x, y, fromTime, toTime, interpolation) {
  x = parseFloat(x);
  y = parseFloat(y);
  const integral_x = Math.floor(x);
  const integral_y = Math.floor(y);

  // Cell boundaries are at coordinates ending in 50
  const x0 = integral_x - (integral_x + 50) % 100;
  const x1 = x0 + 100;
  const y0 = integral_y - (integral_y + 50) % 100;
  const y1 = y0 + 100;
  const p00 = await query(x0, y0, fromTime, toTime);
  if (!p00.ok) { return p00 }
  console.log("p00", p00);

  const p01 = await query(x0, y1, fromTime, toTime);
  if (!p01.ok) { return p01 }
  console.log("p01", p01);

  const p10 = await query(x1, y0, fromTime, toTime);
  if (!p10.ok) { return p10 }
  console.log("p10", p10);

  const p11 = await query(x1, y1, fromTime, toTime);
  if (!p11.ok) { return p11 }
  console.log("p11", p11);

  const N = p00.data.depths.length;
  if (p01.data.depths.length != N || p10.data.depths.length != N || p11.data.depths.length != N) {
    return {
      ok: false,
      status: 500,
      data: "ERROR: Expected all queries for interpolation to yield the same number of data points"
    }
  }

  const xt = (x - x0) / (x1 - x0);
  const yt = (y - y0) / (y1 - y0);
  console.log(xt, yt);
  const depths = [];
  for (let i = 0; i < N; ++i) {
    const p0 = (1 - yt) * p00.data.depths[i] + yt * p01.data.depths[i];
    const p1 = (1 - yt) * p10.data.depths[i] + yt * p11.data.depths[i];
    console.log(p0, p1);
    depths.push((1 - xt) * p0 + xt * p1);
  }
  return {
    ok: true,
    status: p00.status,
    data: {
      request_point: { x: x, y: y },
      actual_point: { x: x, y: y },
      dates: p00.data.dates,
      depths: depths,
      interpolation: interpolation
    }
  };
}

// g : string in the format 'POINT(<number> <number>)' or 'EPSG:<srid>;POINT(<number> <number>)'
function get_coordinates_from_geometry_point(g) {
  const srid_point = g.split(';');
  const point_string = srid_point.length == 2 ? srid_point[1] : srid_point[0];
  const coordinate_strings = point_string.split('(')[1].split(" ");
  if (coordinate_strings.length != 2) {
    console.error(`Expected 2 coordinates. Got ${coordinate_strings.length}`);
    return [0, 0];
  }
  const coordinates = coordinate_strings.map(parseFloat);
  if (Number.isNaN(coordinates[0]) || Number.isNaN(coordinates[1])) {
    console.error("Unable to parse coordinates");
  }
  return coordinates;
}

// Load environment variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS for development
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : ["http://localhost:5173"]; // Default for development

app.use(
  cors({
    origin: allowedOrigins,
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
  })
);

// Base URLs
const DMI_BASE_URL = "https://dmigw.govcloud.dk";
const HIP_BASE_URL = "https://api.dataforsyningen.dk";
const MAPTILER_BASE_URL = "https://api.maptiler.com";


// Validate required environment variables
if (
  !process.env.DMI_API_KEY_METOBS ||
  !process.env.DMI_API_KEY_CLIMATE
) {
  console.error("Error: Missing required DMI API keys in environment variables!");
  process.exit(1);
}

if (!process.env.HIP_API_KEY) {
  console.error("Error: Missing required HIP API key in environment variable");
  process.exit(1);
}

if (!process.env.MAPTILER_API_KEY) {
  console.error("Error: Missing required MAPTILER API key in environment variable");
  process.exit(1);
}


// Helper to construct datetime argument (copied from your Helpers class)
function constructDatetimeArgument(from_time, to_time) {
  if (from_time == undefined && to_time == undefined) {
    return "";
  }
  if (from_time != undefined && to_time == undefined) {
    return `${new Date(from_time).toISOString()}/${new Date().toISOString()}`;
  }
  if (from_time == undefined && to_time != undefined) {
    return `${new Date(to_time).toISOString()}`;
  }
  return `${new Date(from_time).toISOString()}/${new Date(to_time).toISOString()}`;
}

// Distance calculation helper (copied from your Helpers class)
function calculateDistance(lat1, lon1, lat2, lon2) {
  const p = Math.PI / 180.0;
  const CONST_EARTH_DIAMETER = 12742; // km
  const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2.0 +
    Math.cos(lat1 * p) * Math.cos(lat2 * p) *
    (1.0 - Math.cos((lon2 - lon1) * p)) / 2;
  return CONST_EARTH_DIAMETER * Math.asin(Math.sqrt(a));
}

// Helper to check if array is subset
function checkSubset(parentArray, subsetArray) {
  return subsetArray.every((el) => parentArray.includes(el));
}

// Endpoint to get stations for climate data
app.get("/api/dmi/stations", async (req, res) => {
  try {
    const { api } = req.query;
    let apiKey;
    let apiName;

    if (api === "climate") {
      apiKey = process.env.DMI_API_KEY_CLIMATE;
      apiName = "climateData";
    } else if (api === "metobs") {
      apiKey = process.env.DMI_API_KEY_METOBS;
      apiName = "metObs";
    } else {
      return res.status(400).json({ error: "Invalid API specified" });
    }

    const url = `${DMI_BASE_URL}/v2/${apiName}/collections/station/items?api-key=${apiKey}&limit=10000&offset=0`;

    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({
        error: `DMI API Error: ${response.statusText}`
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Station fetch error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to get closest station
app.get("/api/dmi/closest-station", async (req, res) => {
  try {
    const { latitude, longitude, params, api } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({ error: "Missing latitude or longitude" });
    }

    let apiKey;
    let apiName;

    if (api === "climate") {
      apiKey = process.env.DMI_API_KEY_CLIMATE;
      apiName = "climateData";
    } else if (api === "metobs") {
      apiKey = process.env.DMI_API_KEY_METOBS;
      apiName = "metObs";
    } else {
      return res.status(400).json({ error: "Invalid API specified" });
    }

    const paramArray = params ? params.split(",") : [];

    const url = `${DMI_BASE_URL}/v2/${apiName}/collections/station/items?api-key=${apiKey}&limit=10000&offset=0`;
    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `DMI API Error: ${response.statusText}`
      });
    }

    const data = await response.json();
    const stations = data.features;

    let closest_station = null;
    let closest_dist = Number.MAX_VALUE;

    for (const station of stations) {
      const coordinates = station.geometry.coordinates;
      if (!coordinates || coordinates.length < 2) {
        continue;
      }

      const lon = coordinates[0];
      const lat = coordinates[1];

      if (lon === undefined || lat === undefined) {
        continue;
      }

      const station_params = station.properties.parameterId;

      // Skip if required parameters are not available at this station
      if (paramArray.length > 0 && !checkSubset(station_params, paramArray)) {
        continue;
      }

      const dist = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        lat,
        lon
      );

      if (dist < closest_dist) {
        closest_dist = dist;
        closest_station = station;
      }
    }

    if (!closest_station) {
      return res.status(404).json({ error: "No suitable station found" });
    }

    res.json(closest_station);
  } catch (error) {
    console.error("Closest station error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to get climate data
app.get("/api/dmi/climate-data", async (req, res) => {
  try {
    const {
      parameter,
      stationId,
      fromTime,
      toTime,
      timeResolution = "hour",
      limit = 200000,
      offset = 0
    } = req.query;

    if (!parameter || !stationId) {
      return res.status(400).json({
        error: "Missing required parameters (parameter, stationId)"
      });
    }

    const apiKey = process.env.DMI_API_KEY_CLIMATE;
    const datetime = constructDatetimeArgument(fromTime, toTime);

    const url = `${DMI_BASE_URL}/v2/climateData/collections/stationValue/items?api-key=${apiKey}&parameterId=${parameter}&stationId=${stationId}&datetime=${datetime}&timeResolution=${timeResolution}&limit=${limit}&offset=${offset}`;

    const response = await fetch(url);

    if (!response.ok) {
      return res.status(response.status).json({
        error: `DMI API Error: ${response.statusText}`
      });
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Climate data error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint for full data retrieval (similar to get_data in your client)
app.get("/api/dmi/get-data", async (req, res) => {
  try {
    const {
      lat,
      lng,
      fromTime,
      toTime,
      timeResolution = "hour",
      params
    } = req.query;

    if (!lat || !lng || !params) {
      return res.status(400).json({
        error: "Missing required parameters (lat, lng, params)"
      });
    }

    const paramArray = params.split(",");
    const results = {
      parameters: [],
      stations: []
    };

    for (const param of paramArray) {
      // Find closest station for this parameter
      const stationResponse = await fetch(
        `http://localhost:${port}/api/dmi/closest-station?latitude=${lat}&longitude=${lng}&params=${param}&api=climate`
      );

      if (!stationResponse.ok) {
        console.warn(`Failed to find station for parameter ${param}`);
        continue;
      }

      const station = await stationResponse.json();
      const coordinates = station.geometry.coordinates;
      const stationId = station.properties.stationId;

      // Record station info
      results.stations.push({
        par: param,
        id: stationId,
        dist: calculateDistance(
          parseFloat(lat),
          parseFloat(lng),
          coordinates[1],
          coordinates[0]
        ),
        lat: coordinates[1],
        lon: coordinates[0]
      });

      // Get data for this parameter and station
      const dataResponse = await fetch(
        `http://localhost:${port}/api/dmi/climate-data?parameter=${param}&stationId=${stationId}&fromTime=${fromTime}&toTime=${toTime}&timeResolution=${timeResolution}`
      );

      if (!dataResponse.ok) {
        console.warn(`Failed to get data for parameter ${param} at station ${stationId}`);
        continue;
      }

      const data = await dataResponse.json();

      if (data.features && data.features.length > 0) {
        // Transform data for this parameter
        const values = data.features.map(item => ({
          time_stamp: new Date(item.properties.to).toISOString(),
          [param]: item.properties.value
        }));

        results.parameters.push({
          parameter: param,
          values: values
        });
      }
    }

    res.json(results);
  } catch (error) {
    console.error("Get data error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Endpoint to get HIP data
app.get("/api/hip/groundwater", async (req, res) => {
  try {
    const {
      x, // Floating point x-coordinate in EPSG:25832 CRS
      y, // Floating point y-coordinate in EPSG:25832 CRS
      fromTime, // String with start time in ISO 8601 datetime format (YYYY-MM-DDThh:mm::ss)
      toTime,  // String with end time ISO 8601 datetime format (YYYY-MM-DDThh:mm::ss)
      interpolation, // String with interpolation method, on of {"none", "bilinear"}
      apiVersion // Int to select between v1 and v2 of the API
    } = req.query;
    const param_validation_errors = validate_hip_parameters(x, y, fromTime, toTime, interpolation, apiVersion);
    if (param_validation_errors.length > 0) {
      return res.status(400).json({
        error: param_validation_errors
      });
    }
    const use_v1 = (parseInt(apiVersion) == 1);
    const response = use_v1 ?
      await hip_query_v1(x, y, fromTime, toTime, interpolation) :
      await hip_query_v2(x, y, fromTime, toTime, interpolation);
    if (!response.ok) {
      return res.status(response.status).json({
        error: response.data
      });
    }
    res.json(response.data);
  } catch (error) {
    console.error("Groundwater error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});


// Endpoint to convert from lat/long (EPSG:4236) to EPSG:25832
app.get("/api/maptiler/transform", async (req, res) => {
  try {
    const {
      longitude, // Floating point longitude
      latitude // Floating point lattitude
    } = req.query;
    if (!longitude || !latitude) {
      return res.status(400).json({
        error: "Missing required parameters (long, lat)"
      });
    }
    const apiKey = process.env.MAPTILER_API_KEY;
    const coordinates = `${longitude},${latitude}` // Long first is the convention
    const source = 4326
    const target = 25832
    const url = `${MAPTILER_BASE_URL}/coordinates/transform/${coordinates}.json?key=${apiKey}&s_srs=${source}&t_srs=${target}`
    const response = await fetch(url);
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Coordinate API Error: ${response.statusText}`
      });
    }
    const data = await response.json();
    console.log(data);
    const results = {
      x: data.results[0].x, // This should be easting
      y: data.results[0].y, // This should be northing
    };
    res.json(results);
  } catch (error) {
    console.error("Coordinate transform error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Backend proxy server listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
