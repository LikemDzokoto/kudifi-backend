// imports
import { Engine, Address } from "thirdweb";

// configs
import { env, thirdwebClient } from "@/configs";

export class ThirdwebService {
  public static async createWallet() {
    return await Engine.createServerWallet({
      client: thirdwebClient,
      label: "Kudifi Account",
    });
  }

  public static getWallet(address: Address) {
    return Engine.serverWallet({
      address,
      client: thirdwebClient,
      vaultAccessToken: env.THIRDWEB_VAULT_ACCESS_TOKEN,
    });
  }
}
