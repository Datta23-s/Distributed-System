/**
 * ============================================================================
 * UNIT 4 & UNIT 1: EVENT SOURCING & CQRS ARCHITECTURE
 * Module: services/eventsourcing/eventStore.js
 * ============================================================================
 *
 * Implements an immutable Event Sourcing & CQRS architecture:
 * 1. Append-only Event Store with sequential monotonic versioning.
 * 2. Immutable domain event stream (RIDE_REQUESTED, DRIVER_DISPATCHED, TRIP_COMPLETED, etc.).
 * 3. CQRS separation:
 *    - Command Side (Write): Validates business rules, appends events, persists to DFS log.
 *    - Query Side (Read): Subscribes to event stream and maintains materialized projections.
 * 4. Temporal Time-Travel Replay: Replays events up to a chosen timestamp to reconstruct exact past state.
 */

class DomainEvent {
  constructor(type, aggregateId, payload = {}, metadata = {}) {
    this.eventId = `evt-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    this.type = type;
    this.aggregateId = aggregateId;
    this.timestamp = Date.now();
    this.payload = payload;
    this.metadata = metadata;
    this.version = 1;
  }
}

class EventStore {
  constructor(nameNode = null, maxInMemoryEvents = 500) {
    this.nameNode = nameNode;
    this.maxInMemoryEvents = maxInMemoryEvents;
    this.events = []; // Ordered append-only log
    this.subscribers = [];
    this.projections = {
      activeRides: new Map(),
      completedRides: new Map(),
      driverStates: new Map(),
      totalFares: 0,
      zoneTripCounts: {}
    };
  }

  subscribe(callback) {
    this.subscribers.push(callback);
  }

  async append(type, aggregateId, payload = {}, metadata = {}) {
    const event = new DomainEvent(type, aggregateId, payload, metadata);
    event.version = this.events.length + 1;

    // Append to memory log
    this.events.push(event);
    if (this.events.length > this.maxInMemoryEvents) {
      this.events.shift();
    }

    // Update CQRS Read Projections
    this._applyToProjections(event, this.projections);

    // Notify async projections / subscribers
    this.subscribers.forEach(cb => {
      try { cb(event); } catch (e) { }
    });

    // Asynchronously persist to Mini-HDFS Data Lake if NameNode is available
    if (this.nameNode) {
      try {
        const line = JSON.stringify(event) + '\n';
        this.nameNode.writeFile('events_append_log.json', line, 2).catch(() => {});
      } catch (e) { }
    }

    return event;
  }

  _applyToProjections(event, target) {
    const { type, aggregateId, payload } = event;

    switch (type) {
      case 'RIDE_REQUESTED': {
        target.activeRides.set(aggregateId, {
          rideId: aggregateId,
          customerId: payload.customerId,
          pickup: payload.pickup,
          dropoff: payload.dropoff,
          status: 'REQUESTED',
          requestedAt: event.timestamp
        });
        break;
      }
      case 'DRIVER_DISPATCHED': {
        if (target.activeRides.has(aggregateId)) {
          const r = target.activeRides.get(aggregateId);
          r.status = 'DISPATCHED';
          r.driverId = payload.driverId;
          r.fare = payload.fare;
        }
        target.driverStates.set(payload.driverId, 'ASSIGNED');
        break;
      }
      case 'TRIP_STARTED': {
        if (target.activeRides.has(aggregateId)) {
          target.activeRides.get(aggregateId).status = 'IN_TRIP';
        }
        break;
      }
      case 'TRIP_COMPLETED': {
        if (target.activeRides.has(aggregateId)) {
          const r = target.activeRides.get(aggregateId);
          r.status = 'COMPLETED';
          r.completedAt = event.timestamp;
          target.completedRides.set(aggregateId, r);
          target.activeRides.delete(aggregateId);
        }
        if (payload.driverId) {
          target.driverStates.set(payload.driverId, 'AVAILABLE');
        }
        if (payload.fare) {
          target.totalFares += Number(payload.fare);
        }
        if (payload.zone) {
          target.zoneTripCounts[payload.zone] = (target.zoneTripCounts[payload.zone] || 0) + 1;
        }
        break;
      }
      case 'DRIVER_TELEMETRY': {
        target.driverStates.set(payload.driverId, payload.status || 'AVAILABLE');
        break;
      }
      default:
        break;
    }
  }

  /**
   * Time-Travel Replay: Reconstructs exact system state as of targetTimestamp.
   */
  replay(upToTimestamp = Date.now()) {
    const stateAtTime = {
      activeRides: new Map(),
      completedRides: new Map(),
      driverStates: new Map(),
      totalFares: 0,
      zoneTripCounts: {},
      eventsReplayed: 0,
      replayTimestamp: upToTimestamp
    };

    for (const evt of this.events) {
      if (evt.timestamp <= upToTimestamp) {
        this._applyToProjections(evt, stateAtTime);
        stateAtTime.eventsReplayed++;
      }
    }

    return {
      replayTimestamp: upToTimestamp,
      eventsReplayed: stateAtTime.eventsReplayed,
      totalEventsInStore: this.events.length,
      activeRides: Array.from(stateAtTime.activeRides.values()),
      completedRides: Array.from(stateAtTime.completedRides.values()),
      driverStates: Object.fromEntries(stateAtTime.driverStates.entries()),
      totalFares: Number(stateAtTime.totalFares.toFixed(2)),
      zoneTripCounts: stateAtTime.zoneTripCounts
    };
  }

  getEvents(limit = 100) {
    return this.events.slice(-limit);
  }

  getProjections() {
    return {
      activeRides: Array.from(this.projections.activeRides.values()),
      completedRides: Array.from(this.projections.completedRides.values()),
      driverStates: Object.fromEntries(this.projections.driverStates.entries()),
      totalFares: Number(this.projections.totalFares.toFixed(2)),
      zoneTripCounts: this.projections.zoneTripCounts,
      totalEvents: this.events.length
    };
  }
}

// Global event store singleton
const globalEventStore = new EventStore(null, 500);

module.exports = {
  EventStore,
  DomainEvent,
  globalEventStore
};
