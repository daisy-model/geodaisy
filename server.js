// server.js
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import fetch from "node-fetch"; // You might need to install: npm install node-fetch

// Load environment variables from .env
dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Configure CORS for development
app.use(
  cors({
    origin: "http://localhost:5173", // Vite dev server default
    // TODO: add prod domain name, read from meta.env
    // In production, limit to your actual domain
  })
);

// Base URLs
const DMI_BASE_URL = "https://dmigw.govcloud.dk";

// Validate required environment variables
if (
  !process.env.DMI_API_KEY_METOBS ||
  !process.env.DMI_API_KEY_CLIMATE
) {
  console.error("Error: Missing required DMI API keys in environment variables!");
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

// Start the server
app.listen(port, () => {
  console.log(`Backend proxy server listening on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || "development"}`);
});
