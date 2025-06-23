import ky from "ky";
import { HermesClient } from "@pythnetwork/hermes-client";

// configs
import { redis } from "@/configs";

const connection = new HermesClient("https://hermes.pyth.network", {});
const FX_KEY = "usd_ghs_rate";
const FX_TTL_SECONDS = 24 * 60 * 60; // 24 hours
const TOKEN_TTL_SECONDS = 5 * 60; // 5 mins

export class PriceService {
  public static async getPriceFeed(symbol: string) {
    const feeds = await connection.getPriceFeeds({
      query: symbol,
      assetType: "crypto",
    });
    return feeds[0];
  }

  public static async getLatestPriceUpdate(symbol: string) {
    const feed = await this.getPriceFeed(symbol);
    const updates = await connection.getLatestPriceUpdates([feed.id]);
    return updates.parsed?.[0];
  }

  public static async getUSDToGHSRate(): Promise<number> {
    const cached = await redis.get<number>(FX_KEY);
    if (cached !== null) return cached;

    const res = await ky
      .get("https://latest.currency-api.pages.dev/v1/currencies/usd.json")
      .json<{ usd: { ghs: number } }>();

    const rate = res.usd.ghs;
    await redis.set(FX_KEY, rate, { ex: FX_TTL_SECONDS });
    return rate;
  }

  public static async getTokenPriceInGHS(
    symbol: string,
    amount = 1
  ): Promise<number> {
    const cacheKey = `price_ghs_${symbol.toLowerCase()}_${amount}`;
    const cached = await redis.get<string>(cacheKey);
    if (cached) return Number(cached);

    const update = await this.getLatestPriceUpdate(symbol);
    if (!update?.price?.price) throw new Error(`No price for ${symbol}`);

    const usd = Number(update.price.price) / 1e8;
    const ghsRate = await this.getUSDToGHSRate();
    const total = usd * ghsRate * amount;
    const result = Number(total.toFixed(2));

    await redis.set(cacheKey, result.toString(), { ex: TOKEN_TTL_SECONDS });

    return result;
  }
}