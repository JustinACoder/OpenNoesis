# Multi-stage build for Django backend
FROM python:3.12-slim AS builder

WORKDIR /app

# Install system dependencies (build-time)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    postgresql-client \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create a virtual environment for dependencies (NOT in /root/.local)
RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy requirements and install Python dependencies into the venv
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Final stage (runtime)
FROM python:3.12-slim

WORKDIR /app

# Install runtime dependencies only (same as you had)
RUN apt-get update && apt-get install -y --no-install-recommends \
    postgresql-client \
    curl \
    supervisor \
    && rm -rf /var/lib/apt/lists/*

# Copy the virtualenv from builder
COPY --from=builder /opt/venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Copy application code
COPY . .

# Create a non-root user and switch to it
RUN useradd -m -u 1000 appuser \
    && mkdir -p /run/daphne \
    && chown -R appuser:appuser /app /run/daphne
USER appuser

EXPOSE 8000

CMD ["supervisord", "-c", "/app/supervisord.daphne.conf"]
