class CoordinateClient {
    constructor(api_name, version) {
        const allowed_apis = ["maptiler"];
        if (!(allowed_apis.includes(api_name))) throw new Error(`Following api is not supported yet: ${api_name}`);
        if (version != "v1") throw new Error(`API version ${version} not supported`);

        this.api_name = api_name;
        this.version = version;
    }

    static async query(endpoint, params = {}) {
        const paramList = new URLSearchParams(params).toString();
        const url = `/api/maptiler/${endpoint}?${paramList}`;

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

    static async transform(client, latitude, longitude) {
        let transformed = { x: 0, y: 0}
        try {
            const data = await this.query("transform", {
                longitude: longitude,
                latitude: latitude,
            });
            transformed.x = data.x
            transformed.y = data.y
        } catch(error) {
            console.error("Error transforming coordinate:", error);
        }
        return transformed;
    }
}

export { CoordinateClient };
