# Use Bun's official base image
FROM oven/bun:1.1.10

# Set working directory
WORKDIR /app

# Copy package files and .env first for better caching
COPY package*.json ./
COPY bun.lock ./
# COPY .env ./

# Install dependencies (installs both deps and devDeps)
RUN bun install

# Copy the rest of the app
COPY . .

# Run Prisma generate before building
RUN bunx prisma generate --no-engine

# Build your Bun app (e.g., transpile TS to JS if needed)
# RUN bun build src/index.ts --outdir dist

# Expose your app’s port
EXPOSE 3000

# Start the server
CMD ["bun", "run", "src/index.ts"]
