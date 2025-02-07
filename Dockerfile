# syntax=docker/dockerfile:1

ARG NODE_VERSION=22.7.0
FROM node:${NODE_VERSION}-alpine

# Set working directory
WORKDIR /usr/src/app

# Install Python and ffmpeg (required by youtube-dl-exec and fluent-ffmpeg)
RUN apk add --no-cache python3 py3-pip ffmpeg

# Create directories and set permissions
RUN mkdir -p Data/audio Data/text Data/subtitles Data/Background_Images Data/Background_Video Output_Video public
RUN chown -R node:node /usr/src/app

# Copy package files before installing dependencies
COPY --chown=node:node package.json package-lock.json ./

# Install dependencies
RUN npm ci --omit=dev

# Copy the rest of the application code (with ownership)
COPY --chown=node:node . .

# Set non-root user for security
USER node

# Expose the port
EXPOSE 3001

# Run the application
CMD ["node", "index.js"]
