import ky from 'ky';
import { BunSqliteKeyValue } from 'bun-sqlite-key-value';
import { HermesClient } from '@pythnetwork/hermes-client';

const connection = new HermesClient('https://hermes.pyth.network', {});
const FX_KEY = 'usd_ghs_rate';
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Initialize key-value store (in-memory for simplicity, use './store.sqlite' for persistence)
const store = new BunSqliteKeyValue(':memory:');

export class PriceService {
  public static async getPriceFeed(symbol: string) {
    const feeds = await connection.getPriceFeeds({
      query: symbol,
      assetType: 'crypto',
    });
    return feeds[0];
  }

  public static async getLatestPriceUpdate(symbol: string) {
    const feed = await this.getPriceFeed(symbol);
    const updates = await connection.getLatestPriceUpdates([feed.id]);
    return updates.parsed?.[0];
  }

  public static async getUSDToGHSRate(): Promise<number> {
    // check cache using BunSqliteKeyValue
    const cached = store.get(FX_KEY);
    if (cached !== undefined) return cached;

    // fetch from API if not cached
    const res = await ky
      .get('https://latest.currency-api.pages.dev/v1/currencies/usd.json')
      .json<{ usd: { ghs: number } }>();

    const rate = res.usd.ghs;
    // store with TTL
    store.set(FX_KEY, rate, TTL_MS);
    return rate;
  }

  public static async getTokenPriceInGHS(symbol: string, amount = 1): Promise<number> {
    const update = await this.getLatestPriceUpdate(symbol);
    if (!update?.price?.price) throw new Error(`No price for ${symbol}`);

    const usd = Number(update.price.price) / 1e8;
    const ghsRate = await this.getUSDToGHSRate();
    const total = usd * ghsRate * amount;

    return Number(total.toFixed(2));
  }
}