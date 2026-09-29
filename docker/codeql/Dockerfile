FROM ubuntu:24.04

ARG CODEQL_VERSION=2.27.1
ARG CODEQL_SHA256=1d380f79896ededc654c7b21fafb3360136f1aeb678ad4df4df9af3910c6b815

ENV DEBIAN_FRONTEND=noninteractive
ENV CODEQL_HOME=/opt/codeql
ENV PATH=/opt/codeql/codeql:$PATH

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        ca-certificates \
        curl \
        git \
        golang-go \
        nodejs \
        npm \
        openjdk-17-jdk-headless \
        python3 \
        python3-minimal \
        tar \
        zstd \
    && rm -rf /var/lib/apt/lists/*

RUN mkdir -p /opt/codeql \
    && curl -fsSL "https://github.com/github/codeql-action/releases/download/codeql-bundle-v${CODEQL_VERSION}/codeql-bundle-linux64.tar.gz" -o /tmp/codeql-bundle.tar.gz \
    && echo "${CODEQL_SHA256}  /tmp/codeql-bundle.tar.gz" | sha256sum -c - \
    && tar -xzf /tmp/codeql-bundle.tar.gz -C /opt/codeql \
    && rm /tmp/codeql-bundle.tar.gz \
    && chmod -R a+rX /opt/codeql

RUN groupadd --gid 1000 arve 2>/dev/null || true \
    && useradd --uid 1000 --gid 1000 --create-home --home-dir /tmp/arve arve 2>/dev/null || true \
    && mkdir -p /opt/arve-codeql /tmp/arve /tmp/codeql-db /tmp/codeql-results \
    && chown -R 1000:1000 /opt/arve-codeql /tmp/arve /tmp/codeql-db /tmp/codeql-results

COPY run-codeql.sh /opt/arve-codeql/run-codeql.sh
RUN chmod 0755 /opt/arve-codeql/run-codeql.sh

ENV HOME=/tmp/arve \
    CODEQL_ENABLE_TELEMETRY=false \
    GOTOOLCHAIN=local \
    GOPROXY=off \
    GOSUMDB=off

USER 1000:1000
ENTRYPOINT ["/opt/arve-codeql/run-codeql.sh"]
