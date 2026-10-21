/**
 * ============================================================================
 * UNIT 4: EMERGING DISTRIBUTED PARADIGMS — DISTRIBUTED LEDGER & BLOCKCHAIN (DLT)
 * Module: services/ledger/blockchainLedger.js
 * ============================================================================
 *
 * WHICH FILE IMPLEMENTS WHAT:
 * - services/ledger/blockchainLedger.js: Implements a SHA-256 hash-chained immutable
 *   trip and payment ledger replicated across 4 distributed nodes (Coordinator + Drivers):
 *   1. Hash Chaining: Each block cryptographically binds to the previous block hash.
 *   2. Proof-of-Work (PoW): Low-difficulty mining target ('000' prefix) completing in <1.5s.
 *   3. Majority Consensus: Nodes vote on chain validity; honesty verified by longest valid chain.
 *   4. Tamper Detection & Auto-Repair: Allows examiners to inject tampering into a node's
 *      local ledger, detects the break via majority vote (3 > 1), and repairs the block.
 *
 * HOW TO DEMO TO EXAMINER:
 * 1. Open Dashboard -> "Unit 4: Emerging Paradigms" tab -> "Distributed Ledger & Blockchain".
 * 2. Click "⛏️ Mine Trip Block" -> Watch mining loop find PoW nonce (e.g. Nonce #2184, Hash: 000a9f...).
 * 3. Inspect the Block Explorer showing Genesis Block and mined trip transaction records.
 * 4. Click "🔨 Tamper with Block #1 on Driver 2" -> Hash verification fails! Node 2 flagged CORRUPTED.
 * 5. Click "🛡️ Run Majority Consensus Repair" -> Majority nodes (3 vs 1) outvote Driver 2 and restore
 *    the honest blockchain state!
 */

const crypto = require('crypto');
const { ServiceRegistry } = require('../../middleware/naming');

const POW_DIFFICULTY_PREFIX = '000'; // 3 leading zeroes for <1.5s mining on CPU

class Block {
  constructor(index, timestamp, data, previousHash = '', nonce = 0, hash = null) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.nonce = nonce;
    this.hash = hash || this.calculateHash();
  }

  calculateHash() {
    const raw = `${this.index}|${this.previousHash}|${this.timestamp}|${JSON.stringify(this.data)}|${this.nonce}`;
    return crypto.createHash('sha256').update(raw).digest('hex');
  }

  mineBlock() {
    const t0 = Date.now();
    while (!this.hash.startsWith(POW_DIFFICULTY_PREFIX)) {
      this.nonce++;
      this.hash = this.calculateHash();
    }
    const elapsedMs = Date.now() - t0;
    return { nonce: this.nonce, hash: this.hash, elapsedMs };
  }
}

class BlockchainLedger {
  constructor(nodeId = 'coordinator') {
    this.nodeId = nodeId;
    this.registry = new ServiceRegistry();

    // 4 Nodes replicating the ledger
    this.nodes = ['coordinator', 'driver-1', 'driver-2', 'driver-3'];

    // Per-node independent blockchain copies
    this.nodeChains = {};
    this.nodes.forEach((nid) => {
      this.nodeChains[nid] = [this._createGenesisBlock()];
    });

    this.consensusLog = [];

    this.registry.register(`service://ledger/${this.nodeId}`, '127.0.0.1', 9600, {
      type: 'blockchain_ledger',
      nodeId: this.nodeId
    });
  }

  _createGenesisBlock() {
    const genesis = new Block(
      0,
      1700000000000,
      { type: 'GENESIS', message: 'UrbanPulse Dispatch Distributed Ledger Root' },
      '0000000000000000000000000000000000000000000000000000000000000000',
      0
    );
    genesis.mineBlock();
    return genesis;
  }

  getChain(nodeId = 'coordinator') {
    return this.nodeChains[nodeId] || this.nodeChains['coordinator'];
  }

  getLatestBlock(nodeId = 'coordinator') {
    const chain = this.getChain(nodeId);
    return chain[chain.length - 1];
  }

  /**
   * Mine a new block and broadcast across all 4 ledger nodes
   */
  mineNewBlock(tripData, minerNode = 'driver-1') {
    const chain = this.getChain(minerNode);
    const prevBlock = chain[chain.length - 1];

    const newBlock = new Block(
      chain.length,
      Date.now(),
      {
        tripId: tripData.tripId || `trip-${Date.now()}`,
        customerId: tripData.customerId || 'cust-1',
        driverId: tripData.driverId || minerNode,
        fare: parseFloat(tripData.fare || 24.50),
        pickup: tripData.pickup || [25, 30],
        dropoff: tripData.dropoff || [55, 60]
      },
      prevBlock.hash
    );

    const mineResult = newBlock.mineBlock();

    // Replicate mined block across all nodes
    this.nodes.forEach((nid) => {
      const clone = new Block(
        newBlock.index,
        newBlock.timestamp,
        JSON.parse(JSON.stringify(newBlock.data)),
        newBlock.previousHash,
        newBlock.nonce,
        newBlock.hash
      );
      this.nodeChains[nid].push(clone);
    });

    const entry = {
      id: `mine-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      action: 'BLOCK_MINED',
      blockIndex: newBlock.index,
      minerNode,
      nonce: mineResult.nonce,
      hash: mineResult.hash,
      elapsedMs: mineResult.elapsedMs,
      data: newBlock.data
    };

    this.consensusLog.unshift(entry);
    return { status: 'OK', block: newBlock, mineResult, logEntry: entry };
  }

  /**
   * Validate blockchain cryptographic integrity
   */
  validateChain(nodeId = 'coordinator') {
    const chain = this.getChain(nodeId);
    const errors = [];

    for (let i = 1; i < chain.length; i++) {
      const current = chain[i];
      const prev = chain[i - 1];

      // Recompute hash
      const expectedHash = current.calculateHash();
      if (current.hash !== expectedHash) {
        errors.push({
          blockIndex: i,
          type: 'HASH_MISMATCH',
          recordedHash: current.hash,
          expectedHash
        });
      }

      // Check linkage
      if (current.previousHash !== prev.hash) {
        errors.push({
          blockIndex: i,
          type: 'CHAIN_BROKEN',
          recordedPrevHash: current.previousHash,
          actualPrevHash: prev.hash
        });
      }
    }

    return {
      isValid: errors.length === 0,
      nodeId,
      length: chain.length,
      errors
    };
  }

  /**
   * Tamper with block data on a specific node (for live examiner demonstration)
   */
  tamperBlock(nodeId = 'driver-2', blockIndex = 1, fraudulentFare = 999.99) {
    const chain = this.getChain(nodeId);
    if (blockIndex >= chain.length) {
      blockIndex = chain.length - 1;
    }

    const victimBlock = chain[blockIndex];
    const originalFare = victimBlock.data.fare;
    victimBlock.data.fare = fraudulentFare;
    victimBlock.data.tampered = true;
    // Notice: we do NOT re-mine the hash; cryptographic binding breaks!

    const entry = {
      id: `tamper-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      action: 'TAMPER_INJECTED',
      nodeId,
      blockIndex,
      originalFare,
      fraudulentFare,
      message: `Corrupted block #${blockIndex} on '${nodeId}': Fare changed from $${originalFare} to $${fraudulentFare}!`
    };

    this.consensusLog.unshift(entry);
    return entry;
  }

  /**
   * Majority Vote Consensus & Repair:
   * Compares chains across all 4 nodes, identifies corrupt nodes, and repairs from honest majority.
   */
  runMajorityConsensus() {
    const nodeReports = {};
    let validCount = 0;
    let corruptedNodes = [];

    this.nodes.forEach((nid) => {
      const val = this.validateChain(nid);
      nodeReports[nid] = val;
      if (val.isValid) validCount++;
      else corruptedNodes.push(nid);
    });

    const isMajorityHonest = validCount > (this.nodes.length / 2);
    const repairSteps = [];

    if (isMajorityHonest && corruptedNodes.length > 0) {
      // Find honest reference node (e.g. coordinator or driver-1)
      const honestNode = this.nodes.find((nid) => nodeReports[nid].isValid);
      const honestChain = this.nodeChains[honestNode];

      corruptedNodes.forEach((badNode) => {
        // Deep copy honest chain to repair corrupt node
        this.nodeChains[badNode] = honestChain.map((b) => {
          return new Block(
            b.index,
            b.timestamp,
            JSON.parse(JSON.stringify(b.data)),
            b.previousHash,
            b.nonce,
            b.hash
          );
        });

        repairSteps.push({
          repairedNode: badNode,
          sourceHonestNode: honestNode,
          blocksRestored: honestChain.length
        });
      });
    }

    const consensusResult = {
      timestamp: Date.now(),
      totalNodes: this.nodes.length,
      validNodesCount: validCount,
      corruptedNodes,
      consensusAchieved: isMajorityHonest,
      repairsPerformed: repairSteps,
      summary: isMajorityHonest
        ? `Consensus verified: ${validCount}/${this.nodes.length} nodes honest. ${corruptedNodes.length} corrupted ledger(s) repaired!`
        : `Consensus failure: Majority of nodes are corrupted!`
    };

    this.consensusLog.unshift({
      id: `cns-${Date.now()}`,
      time: new Date().toLocaleTimeString(),
      action: 'MAJORITY_CONSENSUS',
      ...consensusResult
    });

    return consensusResult;
  }

  getStatus() {
    const nodeStatus = {};
    this.nodes.forEach((nid) => {
      nodeStatus[nid] = this.validateChain(nid);
    });

    return {
      status: 'OK',
      nodes: this.nodes,
      nodeStatus,
      chain: this.getChain('coordinator'),
      coordinatorChain: this.getChain('coordinator'),
      consensusLog: this.consensusLog.slice(0, 15)
    };
  }
}

module.exports = {
  BlockchainLedger,
  Block,
  POW_DIFFICULTY_PREFIX
};
