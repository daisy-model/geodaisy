import DataFrame, { Row } from 'dataframe-js';
const dmi_url = "https://dmigw.govcloud.dk";

class DMIOpenDataClient {
    constructor(api_key, api_name, version) {
        const allowed_apis = ["metObs", "climateData"];
        if (api_key == undefined) throw new Error(`Invalid value for \`api_key\`: ${api_key}`);
        if (!(allowed_apis.includes(api_name))) throw new Error(`Following api is not supported yet: ${api_name}`);
        if (version == "v1") throw new Error("DMI metObs v1 not longer supported");
        if (version != "v2") throw new Error(`API version ${version} not supported`);

        this.api_key    = api_key;
        this.api_name   = api_name;
        this.version    = version;
        this.base_url   = `${dmi_url}/${version}/${api_name}`;
    }

    static async query(client, api, service, params = {}) {

        let paramlist = "";
        if (client.api_key != undefined) {
            paramlist = `${paramlist}api-key=${client.api_key}&`;
        }
        for (const [key, value] of Object.entries(params)) {
            paramlist = `${paramlist}${key}=${value}&`;
        }
        const url = `${client.base_url}/${service}?${paramlist}`;
        const response = await fetch(url);
        let http_status_code = response["status"]
        if (http_status_code != 200) {
            const message = response["statusText"]
            throw new Error(
                `Failed HTTP request with HTTP status code ${http_status_code} and message: ${message}`);
        }

        const data = await response.json();
        return data;
    }

    static async get_closest_station(client, latitude, longitude, params = []) {
        const data = await this.query(client, client.api_name, "collections/station/items", { "limit": 10000, "offset": 0 })
        const stations = data.features;

        let closest_station = {};
        let closests_dist = 10000000000.0;

        for (const station of stations) {
            const coordinates = station.geometry.coordinates;
            if (coordinates == undefined || coordinates.length < 2) {
                console.log("skipping coordinate");
                continue;
            }
            const lon = coordinates[0];
            const lat = coordinates[1];

            if (lon == undefined || lat == undefined) {
                console.log("skipping coordinate");
                continue;
            }

            const station_params = station.properties.parameterId;

            if (!Helpers.check_subset(station_params, params)) { console.log("not matching parameters"); continue };

            const dist = Helpers.distance(latitude, longitude, lat, lon);
            if (dist < closests_dist) {
                closests_dist = dist;
                closest_station = station;
            }

        }
        return closest_station;
    }

    static async get_data(client, lat, lng, from_time = undefined, to_time = undefined, time_resolution = "hour", params = []) {

        let parameter_df = new DataFrame([], []);
        let stations_df = new DataFrame([], ["par", "id", "dist", "lat", "lon"]);

        for (const p of params) {
            const station = await this.get_closest_station(client, lat, lng, [p]);
            if (station == undefined) {
                console.log("None found");
                continue;
            }

            const coordinates = station.geometry.coordinates;
            const station_id = station.properties.stationId;
            
            const dist = Helpers.distance(lat, lng, coordinates[1], coordinates[0]);

            const station_row = new DataFrame([{ 'par': p, 'id': station_id, 'dist': dist, 'lat': coordinates[1], 'lon': coordinates[0] }], ["par", "id", "dist", "lat", "lon"])
            stations_df = stations_df.union(station_row);

            const [v, i] = await this.get_series(client, p, station_id, time_resolution, from_time, to_time);
            if (v.length > 0) {
                let par_column = new DataFrame({ 'time_stamp': i, p: v }, ['time_stamp', p]);
                if (parameter_df.count() < 1) {
                    parameter_df = parameter_df.union(par_column);
                } else {
                    parameter_df = parameter_df.innerJoin(par_column, 'time_stamp');
                }
            }
        }

        return [parameter_df, stations_df];
    }

    static async get_series(client, par, station_id, timeres, from_time, to_time) {

        console.log(`Looking up parameter  ${par}`);
        const data = await this.get_climate_data(client, par, station_id, from_time, to_time, timeres, 200000);
        if (data.length > 0) console.log(`Has ${data.length} datapoints`);
        else console.log("No data, ignoring");

        let val = [];
        let idx = [];
        for (const i of data) {
            val.push(i['properties']['value']);
            idx.push(new Date(i['properties']['to']).toISOString());
        }
        return [val, idx]; //find better structure
    }

    static async get_climate_data(client, parameter, station_id, from_time, to_time, time_resolution = "hour", limit, offset = 0) {
        const data = await this.query(client, "climateData", "collections/stationValue/items", { "parameterId": parameter, "stationId": station_id, "datetime": Helpers.construct_datetime_argument(from_time, to_time), "timeResolution": time_resolution, "limit": limit, "offset": offset });
        return data.features;
    }
}

class Helpers {

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