# Use Bun's official base image
FROM oven/bun:1.1.10

# Set working directory
WORKDIR /app

# Copy everything
COPY . .

# Install dependencies (installs both deps and devDeps)
RUN bun install

# Build your Bun app (e.g., transpile TS to JS if needed)
RUN bun build src/index.ts --outdir dist

# Expose your app’s port
EXPOSE 3000

# Start the server
CMD ["bun", "run", "dist/index.js"]
