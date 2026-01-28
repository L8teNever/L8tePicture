# -- Stage 1: Build stage --
FROM python:3.11-slim as builder

WORKDIR /app

# Install build dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libjpeg-dev \
    zlib1g-dev \
    && rm -rf /var/lib/apt/lists/*

# Install python dependencies to a local directory
COPY requirements.txt .
RUN pip install --no-cache-dir --prefix=/install -r requirements.txt


# -- Stage 2: Final image --
FROM python:3.11-slim

WORKDIR /app

# Install runtime dependencies for Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg62-turbo \
    zlib1g \
    && rm -rf /var/lib/apt/lists/*

# Copy installed dependencies from builder
COPY --from=builder /install /usr/local

# Copy application code
COPY . .

# Create persistent directories
RUN mkdir -p uploads thumbnails previews data && chmod 777 uploads thumbnails previews data

EXPOSE 8000

# Metadata
LABEL org.opencontainers.image.source="https://github.com/L8teNever/L8tePicture"
LABEL org.opencontainers.image.description="Futuristic iOS-style Gallery"

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
