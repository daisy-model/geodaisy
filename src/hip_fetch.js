import DataFrame, { Row } from 'dataframe-js';

class HIPOpenDataClient {
    constructor(api_name, version) {
        const allowed_apis = ["hydro"];
        if (!(allowed_apis.includes(api_name))) throw new Error(`Following api is not supported yet: ${api_name}`);
        if (version == "v2") throw new Error("HIP Hydro API v2 supported yet");
        if (version != "v1") throw new Error(`HIP Hydro API version ${version} not supported`);

        this.api_name = api_name;
        this.version = version;
    }

    static async query(endpoint, params = {}) {
        // Build URL to our proxy API, not directly to HIP
        const paramList = new URLSearchParams(params).toString();
        const url = `/api/hip/${endpoint}?${paramList}`;

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

    static async get_groundwater(client, x, y, from_time, to_time) {
        try {
            const data = await this.query("groundwater", {
                x: x,
                y: y,
                fromTime: from_time,
                toTime: to_time,
            });
            return {
                header : {
                    data_src : "https://hipdata.dk",
                    data_license : "(CC BY 4.0) Klimadatastyrelsen",
                    tileId : data.tileId,
                    kote : data.kote,
                    request_point : data.request_point,
                    actual_point : data.actual_point,
                },
                data : new DataFrame({
                    "time" : data.dates,
                    "depth" : data.depths
                }, ["time", "depth"])
            }

        } catch (error) {
            console.error("Error fetching data:", error);
            return {
                header : {
                    data_src : "https://hipdata.dk",
                    data_license : "(CC BY 4.0) Klimadatastyrelsen",
                    tileId : "",
                    kote : "",
                    request_point: { x : x, y : y },
                    actual_point: { x : NaN, y : NaN }
                },
                data : new DataFrame([], ["time", "depth"])
            }
        }
    }
}
export { HIPOpenDataClient };
