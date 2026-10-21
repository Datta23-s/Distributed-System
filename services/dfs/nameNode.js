/**
 * ============================================================================
 * UNIT 4: EMERGING DISTRIBUTED PARADIGMS — DISTRIBUTED FILE SYSTEM (MINI-HDFS)
 * Module: services/dfs/nameNode.js
 * ============================================================================
 *
 * WHICH FILE IMPLEMENTS WHAT:
 * - services/dfs/nameNode.js: Implements the NameNode (Master) for Mini-HDFS
 *   running on port 9200.
 *   1. Namespace & Metadata Management: Maintains file-to-block mapping on disk
 *      under './data/namenode/metadata.json'.
 *   2. Chunk Splitting & Replication: Splits incoming files into fixed 512-byte
 *      chunks and replicates each chunk 2x across available DataNodes (9301-9303).
 *   3. Fault-Tolerant Reads: If a primary DataNode fails, NameNode transparently
 *      reads the chunk from its replica without client errors.
 *   4. Autonomous Re-Replication: When a DataNode crash is detected (via Fault Monitor),
 *      NameNode copies under-replicated chunks from surviving replicas to healthy nodes.
 *
 * HOW TO DEMO TO EXAMINER:
 * 1. Open Dashboard -> "Unit 4: Emerging Paradigms" tab -> "Distributed File System (Mini-HDFS)".
 * 2. Click "Write Sample Trip Logs" -> File is split into chunks and replicated 2x across DataNodes.
 * 3. Inspect the Chunk Placement Map showing exact node locations for each chunk.
 * 4. Click "Crash DataNode 2" -> File reading STILL succeeds via DataNode 1 replica!
 * 5. Click "Re-Replicate Chunks" -> NameNode auto-replicates missing blocks to DataNode 3!
 */

const net = require('net');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { ServiceRegistry } = require('../../middleware/naming');

const CHUNK_SIZE = 512; // 512 bytes per chunk for clean pedagogical demonstration
const DEFAULT_REPLICATION = 2;

class NameNode {
  constructor(port = 9200, baseDataDir = null) {
    this.port = port;
    this.baseDir = baseDataDir || path.join(__dirname, '..', '..', 'data', 'namenode');
    this.metadataFile = path.join(this.baseDir, 'metadata.json');
    this.registry = new ServiceRegistry();

    // DataNode directory
    this.dataNodes = {
      'driver-1': { host: '127.0.0.1', port: 9301, alive: true },
      'driver-2': { host: '127.0.0.1', port: 9302, alive: true },
      'driver-3': { host: '127.0.0.1', port: 9303, alive: true }
    };

    // File metadata: filename -> fileRecord
    this.files = new Map();
    this.traceLog = [];

    if (!fs.existsSync(this.baseDir)) {
      fs.mkdirSync(this.baseDir, { recursive: true });
    }

    this._loadMetadata();

    this.registry.register('service://dfs/namenode', '127.0.0.1', this.port, {
      type: 'dfs_namenode',
      chunkSize: CHUNK_SIZE,
      replicationFactor: DEFAULT_REPLICATION
    });
  }

  logTrace(action, file, details) {
    const entry = {
      id: `dfs-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      time: new Date().toLocaleTimeString(),
      action,
      file,
      details,
      timestamp: Date.now()
    };
    this.traceLog.unshift(entry);
    if (this.traceLog.length > 50) this.traceLog.pop();
    return entry;
  }

  _loadMetadata() {
    if (fs.existsSync(this.metadataFile)) {
      try {
        const raw = fs.readFileSync(this.metadataFile, 'utf-8');
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          this.files.set(k, v);
        }
      } catch (e) {
        this.files = new Map();
      }
    }
  }

  _saveMetadata() {
    const obj = {};
    for (const [k, v] of this.files.entries()) {
      obj[k] = v;
    }
    fs.writeFileSync(this.metadataFile, JSON.stringify(obj, null, 2), 'utf-8');
  }

  _sendTcpDataNode(nodeId, request) {
    return new Promise((resolve) => {
      const node = this.dataNodes[nodeId];
      if (!node || !node.alive) {
        return resolve({ status: 'ERROR', error: `DataNode '${nodeId}' is offline / dead` });
      }

      const client = net.createConnection({ host: node.host, port: node.port }, () => {
        client.write(JSON.stringify(request) + '\n');
      });

      let buffer = '';
      client.on('data', (chunk) => {
        buffer += chunk.toString('utf-8');
        const newlineIdx = buffer.indexOf('\n');
        if (newlineIdx !== -1) {
          const line = buffer.slice(0, newlineIdx).trim();
          client.end();
          try {
            resolve(JSON.parse(line));
          } catch (e) {
            resolve({ status: 'ERROR', error: 'Malformed response' });
          }
        }
      });

      client.on('error', (err) => {
        resolve({ status: 'ERROR', error: err.message });
      });

      client.setTimeout(2500, () => {
        client.destroy();
        resolve({ status: 'ERROR', error: 'DataNode socket timeout' });
      });
    });
  }

  getAliveDataNodes() {
    return Object.keys(this.dataNodes).filter((id) => this.dataNodes[id].alive);
  }

  setDataNodeStatus(nodeId, isAlive) {
    if (this.dataNodes[nodeId]) {
      this.dataNodes[nodeId].alive = isAlive;
      this.logTrace('DATANODE_STATUS', nodeId, `DataNode status changed: ${isAlive ? 'ONLINE' : 'CRASHED'}`);
    }
  }

  /**
   * Write a file into Mini-HDFS:
   * Splits into 512-byte chunks and replicates across live DataNodes.
   */
  async writeFile(filename, content, replicationFactor = DEFAULT_REPLICATION) {
    const buffer = Buffer.from(content, 'utf-8');
    const totalBytes = buffer.length;
    const numChunks = Math.max(1, Math.ceil(totalBytes / CHUNK_SIZE));
    const liveNodes = this.getAliveDataNodes();

    if (liveNodes.length === 0) {
      throw new Error('No live DataNodes available in cluster to accept chunks!');
    }

    const chunkList = [];

    for (let i = 0; i < numChunks; i++) {
      const start = i * CHUNK_SIZE;
      const end = Math.min(totalBytes, start + CHUNK_SIZE);
      const chunkData = buffer.slice(start, end).toString('utf-8');
      const chunkId = `blk_${crypto.createHash('md5').update(`${filename}_${i}_${Date.now()}`).digest('hex').substring(0, 10)}`;

      // Select replica DataNodes (Round-Robin placement)
      const replicas = [];
      const neededReplicas = Math.min(replicationFactor, liveNodes.length);
      for (let r = 0; r < neededReplicas; r++) {
        const nodeIdx = (i + r) % liveNodes.length;
        replicas.push(liveNodes[nodeIdx]);
      }

      // Write chunk to each chosen replica DataNode over TCP
      const writeResults = await Promise.all(
        replicas.map((nid) => this._sendTcpDataNode(nid, { action: 'WRITE_CHUNK', chunkId, data: chunkData }))
      );

      const successfulReplicas = replicas.filter((nid, idx) => writeResults[idx].status === 'OK');

      chunkList.push({
        chunkId,
        index: i,
        sizeBytes: Buffer.byteLength(chunkData, 'utf-8'),
        replicas: successfulReplicas,
        checksum: crypto.createHash('sha256').update(chunkData).digest('hex').substring(0, 16)
      });

      this.logTrace('WRITE_CHUNK', filename,
        `Chunk #${i} [${chunkId}] written to replicas: [${successfulReplicas.join(', ')}]`);
    }

    const fileRecord = {
      filename,
      sizeBytes: totalBytes,
      chunkSize: CHUNK_SIZE,
      replicationFactor,
      chunks: chunkList,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    this.files.set(filename, fileRecord);
    this._saveMetadata();

    this.logTrace('FILE_CREATED', filename,
      `File stored in Mini-HDFS: ${totalBytes} bytes across ${numChunks} chunks (Replication: ${replicationFactor}x)`);

    return {
      status: 'OK',
      filename,
      totalBytes,
      numChunks,
      fileRecord
    };
  }

  /**
   * Read file from Mini-HDFS:
   * Sequentially reads each chunk. If primary replica is dead, falls back to secondary!
   */
  async readFile(filename) {
    const fileRecord = this.files.get(filename);
    if (!fileRecord) {
      throw new Error(`File '${filename}' not found in Mini-HDFS namespace!`);
    }

    const assembledChunks = [];
    const replicasQueried = [];

    for (const chunkMeta of fileRecord.chunks) {
      let chunkData = null;
      let readSuccessNode = null;

      // Try each replica in order (Primary -> Secondary -> Fallback)
      for (const replicaNode of chunkMeta.replicas) {
        if (!this.dataNodes[replicaNode]?.alive) continue;

        const res = await this._sendTcpDataNode(replicaNode, {
          action: 'READ_CHUNK',
          chunkId: chunkMeta.chunkId
        });

        if (res.status === 'OK' && res.data !== undefined) {
          chunkData = res.data;
          readSuccessNode = replicaNode;
          replicasQueried.push({ chunkId: chunkMeta.chunkId, node: replicaNode, status: 'HIT' });
          break;
        } else {
          replicasQueried.push({ chunkId: chunkMeta.chunkId, node: replicaNode, status: 'FAIL_FALLBACK' });
        }
      }

      if (chunkData === null) {
        throw new Error(`Unrecoverable data loss: All replicas for chunk '${chunkMeta.chunkId}' of '${filename}' are unreachable!`);
      }

      assembledChunks.push(chunkData);
    }

    const fullContent = assembledChunks.join('');

    this.logTrace('READ_FILE', filename,
      `Read complete: ${fullContent.length} bytes reassembled from surviving replicas.`);

    return {
      status: 'OK',
      filename,
      content: fullContent,
      sizeBytes: Buffer.byteLength(fullContent, 'utf-8'),
      chunks: fileRecord.chunks.length,
      replicasQueried
    };
  }

  /**
   * List all files and chunk locations
   */
  listFiles() {
    const list = [];
    for (const [filename, meta] of this.files.entries()) {
      list.push(meta);
    }
    return list;
  }

  /**
   * Re-Replication:
   * Scans all files for under-replicated chunks (e.g. after a DataNode crashed)
   * and copies chunks to healthy live nodes to restore the 2x replication invariant.
   */
  async reReplicateUnderReplicatedChunks() {
    const liveNodes = this.getAliveDataNodes();
    const reReplicationTrace = [];

    for (const [filename, fileMeta] of this.files.entries()) {
      let fileModified = false;

      for (const chunk of fileMeta.chunks) {
        const aliveReplicas = chunk.replicas.filter((nid) => this.dataNodes[nid]?.alive);

        if (aliveReplicas.length < fileMeta.replicationFactor && liveNodes.length > aliveReplicas.length) {
          // Chunk is under-replicated!
          const sourceNode = aliveReplicas[0];
          if (!sourceNode) continue; // Unrecoverable

          // Find a healthy node that doesn't currently host this chunk
          const candidateNodes = liveNodes.filter((nid) => !chunk.replicas.includes(nid));
          if (candidateNodes.length > 0) {
            const targetNode = candidateNodes[0];

            // 1. Read chunk from healthy surviving replica
            const readRes = await this._sendTcpDataNode(sourceNode, {
              action: 'READ_CHUNK',
              chunkId: chunk.chunkId
            });

            if (readRes.status === 'OK' && readRes.data) {
              // 2. Write chunk to new target DataNode
              const writeRes = await this._sendTcpDataNode(targetNode, {
                action: 'WRITE_CHUNK',
                chunkId: chunk.chunkId,
                data: readRes.data
              });

              if (writeRes.status === 'OK') {
                chunk.replicas = [...aliveReplicas, targetNode];
                fileModified = true;

                const step = {
                  chunkId: chunk.chunkId,
                  file: filename,
                  fromNode: sourceNode,
                  toNode: targetNode,
                  restoredReplication: chunk.replicas.length
                };
                reReplicationTrace.push(step);
                this.logTrace('RE_REPLICATION', filename,
                  `Restored replica: Block ${chunk.chunkId} replicated from ${sourceNode} to ${targetNode}`);
              }
            }
          }
        }
      }

      if (fileModified) {
        fileMeta.updatedAt = Date.now();
      }
    }

    this._saveMetadata();

    return {
      status: 'OK',
      restoredChunks: reReplicationTrace.length,
      trace: reReplicationTrace
    };
  }

  getClusterStatus() {
    const dataNodesWithCounts = {};
    for (const [nodeId, info] of Object.entries(this.dataNodes)) {
      let count = 0;
      for (const fileRecord of this.files.values()) {
        if (fileRecord.chunks) {
          for (const chk of fileRecord.chunks) {
            if (chk.replicas && chk.replicas.includes(nodeId)) {
              count++;
            }
          }
        }
      }
      // Cross-check actual chunk files on local disk if directory exists
      const diskDir = path.join(this.baseDir, '..', nodeId, 'chunks');
      if (fs.existsSync(diskDir)) {
        try {
          const diskCount = fs.readdirSync(diskDir).filter((f) => f.endsWith('.chk')).length;
          count = Math.max(count, diskCount);
        } catch (e) {}
      }

      dataNodesWithCounts[nodeId] = {
        ...info,
        chunkCount: count
      };
    }

    return {
      status: 'OK',
      namenodePort: this.port,
      chunkSize: CHUNK_SIZE,
      defaultReplication: DEFAULT_REPLICATION,
      dataNodes: dataNodesWithCounts,
      files: this.listFiles(),
      traceLog: this.traceLog.slice(-30)
    };
  }
}

module.exports = {
  NameNode,
  CHUNK_SIZE,
  DEFAULT_REPLICATION
};

if (require.main === module) {
  const nn = new NameNode();
  console.log('[NameNode] Mini-HDFS master initialized on port 9200');
}
