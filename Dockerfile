FROM node:24-alpine AS deps

WORKDIR /app

COPY package*.json ./

# Install production dependencies
ENV YOUTUBE_DL_SKIP_PYTHON_CHECK=1
RUN npm install --omit=dev && npm cache clean --force

FROM node:24-alpine

ENV NODE_ENV=production
ENV PYTHONUNBUFFERED=1

# Install system dependencies
RUN apk update && apk add --no-cache \
    ffmpeg \
    fontconfig \
    ttf-freefont \
    yt-dlp \
    python3 \
    py3-pip \
    wget \
    && rm -rf /var/cache/apk/*

# Install PM2 globally
RUN npm install -g pm2

# Create python -> python3 symlink (youtube-dl-exec expects `python`)
RUN ln -sf /usr/bin/python3 /usr/bin/python

# Create custom font directory
RUN mkdir -p /usr/share/fonts/truetype/custom/

# Copy custom fonts (Arabic fonts for Quran rendering)
COPY Data/Font/*.ttf /usr/share/fonts/truetype/custom/

# Rebuild font cache so FFmpeg/fontconfig can find custom fonts
RUN fc-cache -fv

WORKDIR /app

# Copy node_modules and PM2 from deps stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application code
COPY . .

# Create Required Directories
RUN mkdir -p \
    Data/temp \
    Data/temp_images \
    Data/audio/cache \
    Data/audio/custom \
    Data/subtitles \
    Data/text \
    Data/Background_Video/uploads \
    Data/Font \
    Output_Video

RUN chown -R node:node /app

USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:3001/ || exit 1

CMD ["pm2-runtime", "start", "ecosystem.config.cjs"]