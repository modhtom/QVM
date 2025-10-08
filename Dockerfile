FROM node:24-alpine

# Set environment variables
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Install necessary system dependencies including FFmpeg and fonts
RUN apk update && apk add --no-cache \
    ffmpeg \
    fontconfig \
    ttf-freefont \
    yt-dlp


# Create font directory for Arabic fonts
RUN mkdir -p /usr/share/fonts/truetype/custom/

# Copy custom fonts (if available)
COPY Data/Font/*.ttf /usr/share/fonts/truetype/custom/

# Update font cache
RUN fc-cache -fv

# Clean npm cache to reduce image size
RUN npm cache clean --force

# Set working directory
WORKDIR /app

# Copy package files and install dependencies
# This leverages Docker layer caching
COPY package*.json ./
RUN npm install --omit=dev

# Copy the rest of the application code
COPY . .

# Install PM2 globally within the container
RUN npm install -g pm2

# Expose the port your app runs on
EXPOSE 3001

# The command to start both the server and worker using pm2-runtime
# pm2-runtime is the recommended way to run PM2 in a container
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]