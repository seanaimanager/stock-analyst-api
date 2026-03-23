FROM node:22-slim

# Install Python and pip for chart generation
RUN apt-get update && apt-get install -y \
    python3 python3-pip python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Create Python venv and install chart dependencies
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir yfinance mplfinance matplotlib pandas numpy

WORKDIR /app

# Copy package files and install Node dependencies
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

# Copy source code
COPY src/ src/
COPY scripts/ scripts/

# Create charts output directory
RUN mkdir -p charts

ENV PORT=3001
EXPOSE 3001

CMD ["node", "--import", "tsx", "src/index.ts"]
