# Kudifi Backend

A backend service for Kudifi, built with Elysia and Bun, providing blockchain wallet management, token transfers, and mobile money integration for users in Ghana. The backend exposes a USSD-compatible API endpoint, designed for integration with Africastalking's USSD callback system.

## Backend Architecture

- **Framework & Runtime:**  
  Uses [Elysia](https://elysiajs.com/) as the web framework, running on the Bun JavaScript runtime.

- **API Layer:**  
  The main entry point is `src/index.ts`, which sets up the Elysia app, routes, and integrates Swagger for API documentation.

- **USSD Callback Endpoint:**  
  The backend exposes a POST `/` endpoint that processes USSD requests from Africastalking. This endpoint handles user registration, wallet creation, PIN setup, token transfers, balance checks, token purchases, and more, all via USSD menu flows. The endpoint expects a JSON body with `sessionId`, `serviceCode`, `phoneNumber`, and `text` fields, and returns a USSD-compatible response string.

- **Database:**  
  Uses PostgreSQL, managed via Prisma ORM (`prisma/schema.prisma`).  
  The Prisma client is extended with Accelerate for performance.

- **Caching:**  
  Integrates Upstash Redis for caching (see `src/configs/redis.ts`).

- **Third-party Integrations:**  
  - **Thirdweb:** For blockchain wallet and token operations (`src/services/thirdweb.ts`, `src/configs/thirdweb.ts`) with account abstraction and gas sponserships.
  - **Pyth Network:** For crypto price feeds (`src/services/price.ts`).
  - **Currency API:** For fiat exchange rates.

- **Services:**  
  - `ThirdwebService`: Handles wallet creation, token transfers, and blockchain interactions.
  - `PriceService`: Fetches and caches token and FX prices.

- **Helpers:**  
  Utility functions for phone number sanitization and other tasks.

- **Constants:**  
  Supported tokens and chain configuration are defined in `src/constants.ts`.

- **Environment Configuration:**  
  All secrets and config values are loaded and validated from environment variables (`src/configs/env.ts`).
  Env variables can be found in the `.env.example` file, which should be copied to `.env` and filled with dummy values.

## API Reference

Interactive API documentation is available at:

```
{BASE_URL}/swagger
```
Replace `{BASE_URL}` with your server's address (e.g., http://localhost:3000/swagger).

## Getting Started

### Install Dependencies

First, make sure you have [Bun](https://bun.sh/) installed. Then, install project dependencies:

```bash
bun install
```

### Start the App

To start the development server:

```bash
bun run dev
```

The app will be available at http://localhost:3000/ and the API reference at http://localhost:3000/swagger.