FROM node:24-alpine

# Set environment variables
ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apk update && apk add --no-cache \
    ffmpeg \
    python3 \
    py3-pip \
    make \
    g++ \
    git \
    fontconfig \
    ttf-freefont \
    ttf-dejavu \
    ttf-liberation \
    yt-dlp \
    && npm install -g npm@latest

# Create font directory for Arabic fonts
RUN mkdir -p /usr/share/fonts/truetype/custom/

# Copy custom fonts (if available)
COPY Data/Font/*.ttf /usr/share/fonts/truetype/custom/

# Update font cache
RUN fc-cache -fv

# Clean npm cache to reduce image size
RUN npm cache clean --force

# Set a working directory 
WORKDIR /app

# Copy package.json and package-lock.json first for better caching
COPY package*.json ./

# Install project dependencies
RUN npm ci --omit=dev

# Copy the rest of your app
COPY . .

# set default command
CMD ["node", "index.js"]