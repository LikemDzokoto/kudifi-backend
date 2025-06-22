// imports
import {
  Engine,
  Address,
  toTokens,
  getContract,
  readContract,
  prepareTransaction,
  prepareContractCall,
} from "thirdweb";

// configs
import { env, thirdwebClient, engineApiClient } from "@/configs";

// constants
import { supportedTokensMap, apeChainCurtis } from "@/constants";

// types
type TokenSymbol = keyof typeof supportedTokensMap;

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

  public static async getTokenBalance(
    address: Address,
    tokenSymbol: TokenSymbol
  ) {
    const wallet = this.getWallet(address);
    const token = supportedTokensMap[tokenSymbol];

    if (tokenSymbol === "APE") {
      // get native token balance and early return
      const resonse = await engineApiClient
        .post(`/read/balance`, {
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            chainId: apeChainCurtis.id.toString(),
            address: wallet.address,
          }),
        })
        .json<{
          result: {
            balance: string;
          };
        }>();

      return toTokens(BigInt(resonse.result.balance), token.decimals);
    }

    // else get ERC20 token balance
    const contract = getContract({
      address: token.addess,
      client: thirdwebClient,
      chain: apeChainCurtis,
    });

    const balance = await readContract({
      contract,
      method: "function balanceOf(address) view returns (uint256)",
      params: [wallet.address],
    });

    return toTokens(balance, token.decimals);
  }

  public static async sendToken({
    from,
    to,
    tokenSymbol,
    amount,
  }: {
    from: Address;
    to: Address;
    tokenSymbol: TokenSymbol;
    amount: bigint;
  }) {
    const wallet = this.getWallet(from);
    const token = supportedTokensMap[tokenSymbol];

    if (tokenSymbol === "APE") {
      // send native token
      const transaction = prepareTransaction({
        to: to,
        chain: apeChainCurtis,
        client: thirdwebClient,
        value: amount,
      });

      // enqueue the transaction to the wallet
      const { transactionId } = await wallet.enqueueTransaction({
        transaction,
      });

      // wait for the transaction to be executed
      const { transactionHash } = await Engine.waitForTransactionHash({
        client: thirdwebClient,
        transactionId,
      });

      return transactionHash;
    }

    // else send ERC20 token
    const contract = getContract({
      address: token.addess,
      client: thirdwebClient,
      chain: apeChainCurtis,
    });

    // prepare the transaction
    const transaction = prepareContractCall({
      contract,
      method: "function transfer(address to, uint256 amount) returns (bool)",
      params: [to, amount],
    });

    // enqueue the transaction to the wallet
    const { transactionId } = await wallet.enqueueTransaction({
      transaction,
    });

    // wait for the transaction to be executed
    const { transactionHash } = await Engine.waitForTransactionHash({
      client: thirdwebClient,
      transactionId,
    });

    return transactionHash;
  }
}
