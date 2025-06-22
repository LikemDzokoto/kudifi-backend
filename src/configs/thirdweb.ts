// imports
import ky from "ky";
import { createThirdwebClient } from "thirdweb";

// configs
import { env } from "./env";

// create thirdweb client
export const thirdwebClient = createThirdwebClient({
  clientId: env.THIRDWEB_CLIENT_ID,
  secretKey: env.THIRDWEB_SECRET_KEY,
});

export const engineApiClient = ky.create({
  prefixUrl: "https://engine.thirdweb.com/v1",
  headers: {
    "x-secret-key": env.THIRDWEB_SECRET_KEY,
  },
  timeout: 50000, // 5 seconds
  retry: {
    limit: 2, // Retry up to 2 times
    methods: ["get", "post", "put", "delete"], // Retry on these methods
    statusCodes: [408, 500, 502, 503, 504], // Retry on these status codes
  },
  hooks: {
    beforeError: [
      (error) => {
        // Log the error for debugging
        console.error("Engine API Error:", error);
        return error;
      },
    ],
  },
});
