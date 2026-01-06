FROM node:24-alpine

# Set environment variables
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Install necessary system dependencies including FFmpeg and fonts
RUN apk update && apk add --no-cache \
    ffmpeg \
    fontconfig \
    ttf-freefont \
    yt-dlp \
    python3


# Create font directory for Arabic fonts
RUN mkdir -p /usr/share/fonts/truetype/custom/

# Copy custom fonts (if available)
COPY fonts/*.ttf /usr/share/fonts/truetype/custom/

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

# Install PM2 globally
RUN npm install -g pm2

# Copy the rest of the application code
COPY . .

# Expose the port
EXPOSE 3001

# Start via PM2
CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]