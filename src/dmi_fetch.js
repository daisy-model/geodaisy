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
}
export { DMIOpenDataClient };