FROM python:3.12-slim

LABEL maintainer="Karl Swanson <karlcswanson@gmail.com>"
LABEL description="Micboard - A visual monitoring tool for network enabled Shure devices"
LABEL version="2.0.0"

WORKDIR /usr/src/app

# Install Node.js 20+ and build tools
RUN apt-get update && apt-get install -y \
    curl \
    build-essential \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Copy package files first for better caching
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --only=production

# Copy Python requirements and install
COPY py/requirements.txt ./
RUN pip3 install --no-cache-dir -r requirements.txt

# Copy the rest of the application
COPY . .

# Build the frontend
RUN npm run build

# Create non-root user for security
RUN useradd -m -u 1000 micboard && chown -R micboard:micboard /usr/src/app
USER micboard

# Create config directory
RUN mkdir -p /home/micboard/.local/share/micboard

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8058/api/health || exit 1

EXPOSE 8058

# Use exec form for better signal handling
CMD ["python3", "py/micboard.py"]
