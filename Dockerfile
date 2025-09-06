FROM python:3.12-slim

LABEL maintainer="Karl Swanson <karlcswanson@gmail.com>"

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

EXPOSE 8058

CMD ["python3", "py/micboard.py"]
