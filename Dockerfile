# syntax=docker/dockerfile:1.4
FROM ghcr.io/home-assistant/base:3.23-2026.05.0@sha256:3036cd72ba7755263cd103acc77cb0b438462720c2c8c23b7c2b52e52d7f4b50

SHELL ["/bin/ash", "-o", "pipefail", "-c"]

ENV \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    S6_VERBOSITY=0

WORKDIR /app

# Install Python and build deps
RUN apk add --no-cache \
        python3 \
        py3-pip \
        gcc \
        musl-dev \
        python3-dev \
        libffi-dev

# Copy everything
COPY . .

# Run setup script — creates .venv and installs requirements.txt
RUN python3 script/setup

# Copy s6 rootfs overlay
COPY rootfs /

LABEL \
    io.lva.type="portal" \
    org.opencontainers.image.title="LVA Portal" \
    org.opencontainers.image.description="LVA OS web management portal" \
    org.opencontainers.image.authors="aryanhasgithub" \
    org.opencontainers.image.url="https://github.com/aryanhasgithub/lva-os" \
    org.opencontainers.image.licenses="Apache License 2.0" \
