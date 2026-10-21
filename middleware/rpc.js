/**
 * Unit 2: Communication - Remote Procedure Call (RPC)
 * Unit 1: Architectures - Object-Based Architecture & Middleware Layer
 *
 * This module provides an explicit custom RPC framework over TCP sockets:
 * 1. Client Stub (Marshals parameters, manages socket connection, receives & unmarshals response)
 * 2. Server Skeleton (Listens on TCP, unmarshals wire payload, dispatches to local method, marshals result)
 * 3. Parameter Passing (Pass-by-value via JSON wire serialization with length-prefixed framing)
 * 4. Transparent Exception Handling (Server errors caught and returned to caller)
 */

const net = require('net');

class RPCException extends Error {
  constructor(message) {
    super(message);
    this.name = 'RPCException';
  }
}

/**
 * Serializer: Handles Marshalling and Unmarshalling with length-prefixed binary framing.
 */
class RPCSerializer {
  static marshal(data) {
    const payload = Buffer.from(JSON.stringify(data), 'utf-8');
    const lengthHeader = Buffer.alloc(4);
    lengthHeader.writeUInt32BE(payload.length, 0);
    return Buffer.concat([lengthHeader, payload]);
  }

  static parseFrames(buffer, onFrame) {
    let offset = 0;
    while (buffer.length - offset >= 4) {
      const length = buffer.readUInt32BE(offset);
      if (buffer.length - offset - 4 < length) {
        break; // Incomplete frame, wait for more data
      }
      const frameBuffer = buffer.slice(offset + 4, offset + 4 + length);
      offset += 4 + length;
      const parsed = JSON.parse(frameBuffer.toString('utf-8'));
      onFrame(parsed);
    }
    return buffer.slice(offset);
  }
}

/**
 * Client Stub: Client-side proxy abstracting network communication.
 * The caller invokes methods on this stub as if they were local functions.
 */
class RPCClientStub {
  constructor(host, port, timeoutMs = 5000, lamportClock = null) {
    this.host = host;
    this.port = port;
    this.timeoutMs = timeoutMs;
    this.lamportClock = lamportClock;
  }

  setLamportClock(clock) {
    this.lamportClock = clock;
  }

  /**
   * Synchronous-style async Remote Procedure Call.
   * Packs procedure name & kwargs -> Sends to remote Skeleton -> Waits for unmarshalled response.
   * Piggybacks Lamport logical timestamp (Unit 3 Synchronization).
   */
  async call(procedureName, params = {}) {
    return new Promise((resolve, reject) => {
      const socket = new net.Socket();
      let buffer = Buffer.alloc(0);
      let resolved = false;

      socket.setTimeout(this.timeoutMs);

      socket.connect(this.port, this.host, () => {
        const lamportTs = this.lamportClock
          ? this.lamportClock.send()
          : (params._lamportTs !== undefined ? params._lamportTs : 1);

        const packet = {
          procedure: procedureName,
          params: params,
          timestamp: Date.now(),
          lamportTs: lamportTs
        };
        socket.write(RPCSerializer.marshal(packet));
      });

      socket.on('data', (data) => {
        buffer = Buffer.concat([buffer, data]);
        buffer = RPCSerializer.parseFrames(buffer, (response) => {
          resolved = true;
          socket.destroy();

          if (response.lamportTs && this.lamportClock) {
            this.lamportClock.receive(response.lamportTs);
          }

          if (response.status === 'ERROR') {
            reject(new RPCException(`Remote Error on '${procedureName}': ${response.error}`));
          } else {
            if (response.result && typeof response.result === 'object') {
              response.result._lamportTs = response.lamportTs || (this.lamportClock ? this.lamportClock.getTime() : null);
            }
            resolve(response.result);
          }
        });
      });

      socket.on('timeout', () => {
        socket.destroy();
        reject(new RPCException(`RPC Timeout (${this.timeoutMs}ms) invoking '${procedureName}' on ${this.host}:${this.port}`));
      });

      socket.on('error', (err) => {
        if (!resolved) {
          reject(new RPCException(`RPC Connection Error to ${this.host}:${this.port}: ${err.message}`));
        }
      });
    });
  }
}

/**
 * Server Skeleton: Server-side Dispatcher.
 * Listens for client connections, decodes wire frames, and invokes registered functions.
 */
class RPCServerSkeleton {
  constructor(host, port, lamportClock = null) {
    this.host = host;
    this.port = port;
    this.methods = new Map();
    this.server = null;
    this.lamportClock = lamportClock;
  }

  setLamportClock(clock) {
    this.lamportClock = clock;
  }

  registerProcedure(name, fn) {
    this.methods.set(name, fn);
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        let buffer = Buffer.alloc(0);

        socket.on('data', async (data) => {
          buffer = Buffer.concat([buffer, data]);
          buffer = RPCSerializer.parseFrames(buffer, async (request) => {
            const { procedure, params, lamportTs } = request;
            let response;

            if (lamportTs && this.lamportClock) {
              this.lamportClock.receive(lamportTs);
            }

            if (!this.methods.has(procedure)) {
              response = {
                status: 'ERROR',
                error: `Procedure '${procedure}' not found on server skeleton.`
              };
            } else {
              try {
                // Dynamically invoke the registered local method
                const result = await this.methods.get(procedure)(params);
                response = {
                  status: 'OK',
                  result: result
                };
              } catch (err) {
                response = {
                  status: 'ERROR',
                  error: err.message || String(err)
                };
              }
            }

            if (this.lamportClock) {
              response.lamportTs = this.lamportClock.send();
            }

            socket.write(RPCSerializer.marshal(response));
          });
        });

        socket.on('error', () => {});
      });

      this.server.listen(this.port, this.host, () => {
        // console.log(`[RPC Skeleton] Listening on ${this.host}:${this.port}`);
        resolve();
      });

      this.server.on('error', (err) => reject(err));
    });
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

module.exports = {
  RPCException,
  RPCSerializer,
  RPCClientStub,
  RPCServerSkeleton
};
