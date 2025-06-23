// imports
import {
  Engine,
  Address,
  toTokens,
  getContract,
  readContract,
  getRpcClient,
  eth_getBalance,
  sendTransaction,
  prepareTransaction,
  prepareContractCall,
  toUnits,
} from "thirdweb";
import { transfer, balanceOf } from "thirdweb/extensions/erc20";

// configs
import { env, thirdwebClient } from "@/configs";

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
      const rpcRequest = getRpcClient({
        client: thirdwebClient,
        chain: apeChainCurtis,
      });
      const balance = await eth_getBalance(rpcRequest, {
        address: wallet.address,
        blockTag: "latest",
      });

      return toTokens(balance, token.decimals);
    }

    // else get ERC20 token balance
    const contract = getContract({
      address: token.addess,
      client: thirdwebClient,
      chain: apeChainCurtis,
    });

    // const balance = await readContract({
    //   contract,
    //   method: "function balanceOf(address) view returns (uint256)",
    //   params: [wallet.address],
    // });

    const balance = await balanceOf({
      contract,
      address: wallet.address,
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
        type: "legacy",
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

(async () => {
 try {
   // Example usage
  const wallet = ThirdwebService.getWallet("0x1BDBd7300A77eDFE832fDd64C995C4f4204fBd4B");

  const apeBalance = await ThirdwebService.getTokenBalance(wallet.address as Address, "APE");
  console.log("APE Balance:", apeBalance.toString());

  const usdtBalance = await ThirdwebService.getTokenBalance(wallet.address as Address, "USDT");
  console.log("USDT Balance:", usdtBalance.toString());

  const usdcBalance = await ThirdwebService.getTokenBalance(wallet.address as Address, "USDC");
  console.log("USDC Balance:", usdcBalance.toString());


  // Sending tokens (example)
  // const txHash = await ThirdwebService.sendToken({
  //   from: wallet.address as Address,
  //   to: "0x9E2a2638d5FE806aac3140d134F14938F5f01439",
  //   tokenSymbol: "APE",
  //   amount: toUnits("0.01", 18), // 1 APE (18 decimals)
  // });
  // console.log("Send APE Transaction Hash:", txHash);

  // const usdtTxHash = await ThirdwebService.sendToken({
  //   from: wallet.address as Address,
  //   to: "0x9E2a2638d5FE806aac3140d134F14938F5f01439",
  //   tokenSymbol: "USDT",
  //   amount: toUnits("1", 6), // 10 USDT (6 decimals)
  // });
  // console.log("Send USDT Transaction Hash:", usdtTxHash);

  const usdcTxHash = await ThirdwebService.sendToken({
    from: wallet.address as Address,
    to: "0x9E2a2638d5FE806aac3140d134F14938F5f01439",
    tokenSymbol: "USDC",
    amount: toUnits("0.1", 6), // 10 USDC (6 decimals)
  });
  console.log("Send USDC Transaction Hash:", usdcTxHash);
 } catch (error) {
  console.error(error);
 }
})()