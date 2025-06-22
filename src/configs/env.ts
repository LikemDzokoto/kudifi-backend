// imports
import { z } from "zod";

const envSchema = z.object({
  THIRDWEB_CLIENT_ID: z.string(),
  THIRDWEB_SECRET_KEY: z.string(),
  THIRDWEB_VAULT_ADMIN_KEY: z.string(),
  THIRDWEB_VAULT_ACCESS_TOKEN: z.string(),
});

const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error("Invalid environment variables:", result.error.format());
  throw new Error("Invalid environment variables");
}

export const env = result.data;