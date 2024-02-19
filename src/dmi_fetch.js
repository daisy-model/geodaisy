const dmi_url = "https://dmigw.govcloud.dk";

class DMIOpenDataClient {
    constructor(data = undefined, is_initialized = false) {
        this.data           = data;
        this.is_initialized = is_initialized;
        this.api_key        = "";
        this.api_name       = "";
        this.version        = "";
        this.base_url       = "";
    }

    client_data() {
        if (this.is_initialized) {
            return this.data;
        } else {
            throw new Error("DMIOpenDataClient not yet initialized!");
        }
    }

    static async initialize(api_key, api_name, version) {
        const allowed_apis = ["metObs", "climateData"];
        if (api_key == undefined) throw new Error(`Invalid value for \`api_key\`: ${api_key}`);
        if (!(allowed_apis.includes(api_name))) throw new Error(`Following api is not supported yet: ${api_name}`);
        if (version == "v1") throw new Error("DMI metObs v1 not longer supported");
        if (version != "v2") throw new Error(`API version ${version} not supported`);

        const service   = "collections/station/items";
        const base_url  = `${dmi_url}/${version}/${api_name}`;
        const url       = `${base_url}/${service}?api-key=${api_key}`;

        const response          = await fetch(url);
        let http_status_code    = response["status"]
        
        if (http_status_code!= 200) {
            message = response["statusText"]
            throw new Error(
                `Failed HTTP request with HTTP status code ${http_status_code} and message: ${message}`);
        }

        const data = await response.json();

        let client      = new DMIOpenDataClient(data, true);
        client.api_key  = api_key;
        client.api_name = api_name;
        client.version  = version;
        client.base_url = base_url;

        return client;
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

            if (!Helpers.check_subset(station_params, params)) {console.log("not matching parameters"); continue};

            const dist = Helpers.distance(latitude, longitude, lat, lon);
            if (dist < closests_dist) {
                closests_dist = dist;
                closest_station = station;
            }

        }
        return closest_station;
    }
}

class Helpers{

    static check_subset(parentArray, subsetArray){
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
}
export { DMIOpenDataClient };