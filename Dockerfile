# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.7.0
FROM node:${NODE_VERSION}-alpine

# Set working directory
WORKDIR /usr/src/app

# Install Python (required by youtube-dl-exec)
RUN apk add --no-cache python3 py3-pip

# Copy package files before installing dependencies
COPY package.json package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy the rest of the application code
COPY . .

# Set a non-root user for security
USER node

# Expose the port your app uses
EXPOSE 3001

# Run the application
CMD ["node", "index.js"]
