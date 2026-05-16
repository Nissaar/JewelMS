# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm install

# Copy source code
COPY . .

# Build the application
# This generates the frontend in dist/ and the backend in dist/server.cjs
RUN npm run build

# Stage 2: Production
FROM node:20-slim

WORKDIR /app

ENV NODE_ENV=production

# Copy package files for production dependency install
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy the built application from the builder stage
COPY --from=builder /app/dist ./dist

# The backend bundle uses --packages=external, so we need the production node_modules
# which we just installed in this stage.

# Create uploads directory
RUN mkdir -p uploads

# Expose the application port
EXPOSE 3000

# Start the application
CMD ["npm", "start"]
