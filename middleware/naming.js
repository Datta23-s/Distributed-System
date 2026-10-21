/**
 * Unit 2: Communication - Names, Identifiers & Addresses
 * Unit 1: Goals of Distributed Systems - Location & Access Transparency
 *
 * This module implements:
 * 1. Logical Name Resolution (Logical Name -> Physical Address {host, port})
 * 2. Service Registry (Directory Service)
 * 3. UUID generation for distributed requests and entities
 */

const crypto = require('crypto');

class ServiceRegistry {
  constructor() {
    if (ServiceRegistry.instance) {
      return ServiceRegistry.instance;
    }
    this.registry = new Map();
    ServiceRegistry.instance = this;
  }

  /**
   * Registers a logical name to a physical endpoint.
   * e.g., 'service://coordinator' -> { host: '127.0.0.1', port: 9000 }
   */
  register(logicalName, host, port, metadata = {}) {
    this.registry.set(logicalName, {
      logicalName,
      host,
      port,
      metadata,
      registeredAt: Date.now(),
      status: 'HEALTHY'
    });
    // console.log(`[Registry] Registered '${logicalName}' -> ${host}:${port}`);
  }

  /**
   * Resolves a logical URI into a physical network endpoint.
   * Provides Location Transparency: Callers do not need hardcoded IP/ports.
   */
  lookup(logicalName) {
    return this.registry.get(logicalName) || null;
  }

  deregister(logicalName) {
    this.registry.delete(logicalName);
  }

  listAll(prefix = null) {
    const results = {};
    for (const [name, entry] of this.registry.entries()) {
      if (!prefix || name.startsWith(prefix)) {
        results[name] = entry;
      }
    }
    return results;
  }
}

function generateId(prefix = 'req') {
  return `${prefix}-${crypto.randomBytes(4).toString('hex')}`;
}

module.exports = {
  ServiceRegistry,
  generateId
};
