import DataFrame, { Row } from 'dataframe-js';

// No more direct DMI URL or API keys
class DMIOpenDataClient {
    constructor(api_name, version) {
        // Store the API name for proxy calls, but we don't need the API key anymore
        const allowed_apis = ["metObs", "climateData"];
        if (!(allowed_apis.includes(api_name))) throw new Error(`Following api is not supported yet: ${api_name}`);
        if (version == "v1") throw new Error("DMI metObs v1 not longer supported");
        if (version != "v2") throw new Error(`API version ${version} not supported`);

        this.api_name = api_name;
        this.version = version;
        this.api_type = api_name === "climateData" ? "climate" : "metobs";
    }

    static async query(endpoint, params = {}) {
        // Build URL to our proxy API, not directly to DMI
        const paramList = new URLSearchParams(params).toString();
        const url = `/api/dmi/${endpoint}?${paramList}`;
        
        const response = await fetch(url);
        let http_status_code = response.status;
        
        if (http_status_code != 200) {
            const message = response.statusText;
            throw new Error(
                `Failed HTTP request with HTTP status code ${http_status_code} and message: ${message}`);
        }

        const data = await response.json();
        return data;
    }

    static async get_closest_station(client, latitude, longitude, params = []) {
        // Use the proxy endpoint to find closest station
        const data = await this.query("closest-station", {
            latitude: latitude,
            longitude: longitude,
            params: params.join(","),
            api: client.api_type
        });
        
        return data; // The backend proxy already returns the closest station
    }

    static async get_data(client, lat, lng, from_time = undefined, to_time = undefined, time_resolution = "hour", params = []) {
        let parameter_df = new DataFrame([], []);
        let stations_df = new DataFrame([], ["par", "id", "dist", "lat", "lon"]);

        try {
            // Get all data in one call to the backend
            const data = await this.query("get-data", {
                lat: lat,
                lng: lng,
                fromTime: from_time,
                toTime: to_time,
                timeResolution: time_resolution,
                params: params.join(",")
            });
            
            // Convert stations data from the proxy response
            for (const station of data.stations) {
                const station_row = new DataFrame([{ 
                    'par': station.par, 
                    'id': station.id, 
                    'dist': station.dist, 
                    'lat': station.lat, 
                    'lon': station.lon 
                }], ["par", "id", "dist", "lat", "lon"]);
                
                stations_df = stations_df.union(station_row);
            }
            
            // Convert parameter data from the proxy response
            for (const paramData of data.parameters) {
                const param = paramData.parameter;
                const values = paramData.values;
                
                if (values.length > 0) {
                    // Extract timestamps and values
                    const timestamps = values.map(v => v.time_stamp);
                    const paramValues = values.map(v => v[param]);
                    
                    let par_column = new DataFrame({ 
                        'time_stamp': timestamps, 
                        [param]: paramValues 
                    }, ['time_stamp', param]);
                    
                    if (parameter_df.count() < 1) {
                        parameter_df = parameter_df.union(par_column);
                    } else {
                        parameter_df = parameter_df.innerJoin(par_column, 'time_stamp');
                    }
                }
            }
        } catch (error) {
            console.error("Error fetching data:", error);
        }

        return [parameter_df, stations_df];
    }

    static async get_series(client, par, station_id, timeres, from_time, to_time) {
        console.log(`Looking up parameter ${par}`);
        
        const data = await this.query("climate-data", {
            parameter: par,
            stationId: station_id,
            fromTime: from_time,
            toTime: to_time,
            timeResolution: timeres,
            limit: 200000
        });
        
        const features = data.features || [];
        if (features.length > 0) console.log(`Has ${features.length} datapoints`);
        else console.log("No data, ignoring");

        let val = [];
        let idx = [];
        for (const i of features) {
            val.push(i.properties.value);
            idx.push(new Date(i.properties.to).toISOString());
        }
        return [val, idx];
    }
}

class Helpers {
    // Keep the helper functions unchanged
    static check_subset(parentArray, subsetArray) {
        return subsetArray.every((el) => {
            return parentArray.includes(el)
        })
    }

    static distance(lat1, lon1, lat2, lon2) {
        const p = Math.PI / 180.0;
        const CONST_EARTH_DIAMETER = 12742; // km
        const a = 0.5 - Math.cos((lat2 - lat1) * p) / 2.0 + Math.cos(lat1 * p) * Math.cos(lat2 * p) * (1.0 - Math.cos((lon2 - lon1) * p)) / 2;
        return CONST_EARTH_DIAMETER * Math.asin(Math.sqrt(a));  // 2*R*asin...
    }

    static construct_datetime_argument(from_time, to_time) {
        if (from_time == undefined && to_time == undefined) {
            return "";
        }
        if (from_time != undefined && to_time == undefined) {
            return `${new Date(from_time).toISOString()}/${new Date().toISOString()}`
        }
        if (from_time == undefined && to_time != undefined) {
            return `${new Date(to_time).toISOString()}`
        }
        return `${new Date(from_time).toISOString()}/${new Date(to_time).toISOString()}`
    }
}

export { DMIOpenDataClient };
