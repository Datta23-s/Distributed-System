# ==============================================================================
# UrbanPulse Dispatch - Multi-Stage Container Dockerfile
# Distributed Ride-Sharing Simulator (Distributed Systems FA-1)
# ==============================================================================

FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy application source code
COPY . .

# Expose Distributed Ports:
# 5000: Gateway Dashboard & WebSockets
# 9000: Coordinator RPC Skeleton
# 9100: MOM Message Broker Server
# 9021-9023: Driver P2P UDP Gossip Ports
# 9030-9033: Control Channel TCP Ports (Mutex, Snapshot, Deadlock)
# 9041-9043: UDP Beacon Ports
# 9200: Mini-HDFS NameNode
# 9301-9303: Mini-HDFS DataNodes
# 9400: Serverless FaaS Runtime
# 9500: Distributed Object Registry
# 9600-9604: Blockchain Ledger Nodes
# 9700-9703: Quorum Key-Value Store Replicas
EXPOSE 5000 9000 9100 9021 9022 9023 9030 9031 9032 9033 9200 9301 9302 9303 9400 9500 9600 9700

# Environment variables
ENV NODE_ENV=production \
    PORT=5000 \
    HOST=0.0.0.0

# Start orchestrator
CMD ["node", "start.js"]
