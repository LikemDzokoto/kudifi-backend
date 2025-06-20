// imports
import { createThirdwebClient } from "thirdweb";

// configs
import { env } from "./env";

// create thirdweb client
export const thirdwebClient = createThirdwebClient({
  clientId: env.THIRDWEB_CLIENT_ID,
  secretKey: env.THIRDWEB_SECRET_KEY,
});
