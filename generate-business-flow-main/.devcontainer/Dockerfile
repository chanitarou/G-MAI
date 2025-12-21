# Dockerfile
FROM python:3.14-slim

WORKDIR /workspaces

# 基本的な Linux ツールをインストール
RUN apt-get update && apt-get install -y --no-install-recommends \
    bash \
    curl \
    wget \
    git \
    vim \
    nano \
    net-tools \
    less \
    iputils-ping \
    procps \
    ca-certificates \
    unzip \
    npm \
    nodejs \
    postgresql-client \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g @anthropic-ai/claude-code
RUN npm install -g @openai/codex

# Python ライブラリ
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# デフォルトのシェルを bash に
CMD ["/bin/bash"]
