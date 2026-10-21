/**
 * Unit 2: Communication - Message-Oriented Communication (MOM)
 * Unit 1: Architectures - Event-Based & Shared Data-Space Architecture
 *
 * This module implements a Message Broker supporting:
 * 1. Asynchronous Point-to-Point Persistent Queues (FIFO: one producer, one consumer)
 * 2. Publish/Subscribe Topics (One-to-Many event broadcast)
 * 3. Networked TCP Broker Server & Broker Client
 */

const net = require('net');

class MessageBrokerServer {
  constructor(host = '127.0.0.1', port = 9100, lamportClock = null) {
    this.host = host;
    this.port = port;
    this.queues = new Map();       // queueName -> array of payloads
    this.subscribers = new Map();  // topic -> Set of sockets
    this.server = null;
    this.lamportClock = lamportClock;
  }

  setLamportClock(clock) {
    this.lamportClock = clock;
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = net.createServer((socket) => {
        let buffer = '';
        const clientTopics = new Set();

        socket.on('data', (data) => {
          buffer += data.toString('utf-8');
          let newlineIndex;
          while ((newlineIndex = buffer.indexOf('\n')) !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            if (line) {
              this._handleCommand(line, socket, clientTopics);
            }
          }
        });

        const cleanup = () => {
          for (const topic of clientTopics) {
            const subs = this.subscribers.get(topic);
            if (subs) {
              subs.delete(socket);
            }
          }
        };

        socket.on('close', cleanup);
        socket.on('error', cleanup);
      });

      this.server.listen(this.port, this.host, () => {
        // console.log(`[MOM Broker] Running on ${this.host}:${this.port}`);
        resolve();
      });

      this.server.on('error', (err) => reject(err));
    });
  }

  _handleCommand(line, socket, clientTopics) {
    try {
      const msg = JSON.parse(line);
      const action = msg.action;

      if (action === 'PUBLISH') {
        // Topic-based Pub/Sub (Unit 2 MOM)
        const { topic, payload } = msg;
        const isTelemetryOrHeartbeat = topic === 'driver.telemetry' || topic === 'driver.heartbeat';
        if (!isTelemetryOrHeartbeat) {
          if (payload && payload.lamportTs && this.lamportClock) {
            this.lamportClock.receive(payload.lamportTs);
          }
          if (payload && this.lamportClock && !payload.lamportTs) {
            payload.lamportTs = this.lamportClock.send();
          }
        }
        this._dispatchPub(topic, payload);
        socket.write(JSON.stringify({ status: 'OK' }) + '\n');

      } else if (action === 'SUBSCRIBE') {
        // Register subscriber for topic
        const { topic } = msg;
        if (!this.subscribers.has(topic)) {
          this.subscribers.set(topic, new Set());
        }
        this.subscribers.get(topic).add(socket);
        clientTopics.add(topic);
        socket.write(JSON.stringify({ status: 'SUBSCRIBED' }) + '\n');

      } else if (action === 'ENQUEUE') {
        // Point-to-Point Queue (Unit 2 MOM: Persistent queue)
        const { queue, payload } = msg;
        if (payload && payload.lamportTs && this.lamportClock) {
          this.lamportClock.receive(payload.lamportTs);
        }
        if (!this.queues.has(queue)) {
          this.queues.set(queue, []);
        }
        this.queues.get(queue).push(payload);
        socket.write(JSON.stringify({ status: 'ENQUEUED' }) + '\n');

      } else if (action === 'DEQUEUE') {
        const { queue } = msg;
        const q = this.queues.get(queue);
        if (q && q.length > 0) {
          const item = q.shift();
          socket.write(JSON.stringify({ status: 'OK', item }) + '\n');
        } else {
          socket.write(JSON.stringify({ status: 'EMPTY', item: null }) + '\n');
        }
      }
    } catch (e) {
      socket.write(JSON.stringify({ status: 'ERROR', error: e.message }) + '\n');
    }
  }

  _dispatchPub(topic, payload) {
    const message = JSON.stringify({ type: 'EVENT', topic, payload }) + '\n';
    const targets = new Set();

    // Exact topic matches
    if (this.subscribers.has(topic)) {
      for (const sock of this.subscribers.get(topic)) {
        targets.add(sock);
      }
    }
    // Wildcard matches
    if (this.subscribers.has('*')) {
      for (const sock of this.subscribers.get('*')) {
        targets.add(sock);
      }
    }

    for (const sock of targets) {
      try {
        sock.write(message);
      } catch (err) {
        // Dead socket will be cleaned on error/close
      }
    }
  }

  stop() {
    if (this.server) {
      this.server.close();
      this.server = null;
    }
  }
}

class MessageBrokerClient {
  constructor(host = '127.0.0.1', port = 9100, lamportClock = null) {
    this.host = host;
    this.port = port;
    this.callbacks = new Map(); // topic -> array of callbacks
    this.subSocket = null;
    this.buffer = '';
    this.lamportClock = lamportClock;
  }

  setLamportClock(clock) {
    this.lamportClock = clock;
  }

  async publish(topic, payload) {
    const isTelemetryOrHeartbeat = topic === 'driver.telemetry' || topic === 'driver.heartbeat';
    if (!isTelemetryOrHeartbeat && payload && typeof payload === 'object' && this.lamportClock && !payload.lamportTs) {
      payload.lamportTs = this.lamportClock.send();
    }
    return new Promise((resolve) => {
      const socket = net.connect(this.port, this.host, () => {
        const cmd = JSON.stringify({ action: 'PUBLISH', topic, payload }) + '\n';
        socket.write(cmd);
      });
      socket.on('data', () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
  }

  async enqueue(queue, payload) {
    if (payload && typeof payload === 'object' && this.lamportClock && !payload.lamportTs) {
      payload.lamportTs = this.lamportClock.send();
    }
    return new Promise((resolve) => {
      const socket = net.connect(this.port, this.host, () => {
        const cmd = JSON.stringify({ action: 'ENQUEUE', queue, payload }) + '\n';
        socket.write(cmd);
      });
      socket.on('data', () => {
        socket.end();
        resolve(true);
      });
      socket.on('error', () => resolve(false));
    });
  }

  async dequeue(queue) {
    return new Promise((resolve) => {
      const socket = net.connect(this.port, this.host, () => {
        const cmd = JSON.stringify({ action: 'DEQUEUE', queue }) + '\n';
        socket.write(cmd);
      });
      socket.on('data', (data) => {
        try {
          const resp = JSON.parse(data.toString('utf-8').trim());
          socket.end();
          resolve(resp.status === 'OK' ? resp.item : null);
        } catch {
          socket.end();
          resolve(null);
        }
      });
      socket.on('error', () => resolve(null));
    });
  }

  subscribe(topic, callback) {
    if (!this.callbacks.has(topic)) {
      this.callbacks.set(topic, []);
    }
    this.callbacks.get(topic).push(callback);

    if (!this.subSocket) {
      this._initSubscriber();
    } else if (this.subSocket.writable) {
      const cmd = JSON.stringify({ action: 'SUBSCRIBE', topic }) + '\n';
      this.subSocket.write(cmd);
    }
  }

  _initSubscriber() {
    this.subSocket = net.connect(this.port, this.host, () => {
      for (const topic of this.callbacks.keys()) {
        const cmd = JSON.stringify({ action: 'SUBSCRIBE', topic }) + '\n';
        this.subSocket.write(cmd);
      }
    });

    this.subSocket.on('data', (data) => {
      this.buffer += data.toString('utf-8');
      let newlineIndex;
      while ((newlineIndex = this.buffer.indexOf('\n')) !== -1) {
        const line = this.buffer.slice(0, newlineIndex).trim();
        this.buffer = this.buffer.slice(newlineIndex + 1);
        if (line) {
          try {
            const parsed = JSON.parse(line);
            if (parsed.type === 'EVENT') {
              const { topic, payload } = parsed;
              if (payload && payload.lamportTs && this.lamportClock) {
                this.lamportClock.receive(payload.lamportTs);
              }
              const handlers = this.callbacks.get(topic) || [];
              handlers.forEach((fn) => fn(topic, payload));
              const wildcardHandlers = this.callbacks.get('*') || [];
              wildcardHandlers.forEach((fn) => fn(topic, payload));
            }
          } catch (e) {}
        }
      }
    });

    this.subSocket.on('error', () => {});
  }

  close() {
    if (this.subSocket) {
      this.subSocket.destroy();
      this.subSocket = null;
    }
  }
}

module.exports = {
  MessageBrokerServer,
  MessageBrokerClient
};
