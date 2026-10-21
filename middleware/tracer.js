/**
 * ============================================================================
 * UNIT 4 & UNIT 2: DISTRIBUTED TRACING & OBSERVABILITY (OpenTelemetry-Inspired)
 * Module: middleware/tracer.js
 * ============================================================================
 *
 * Implements end-to-end distributed request tracing across RPC, MOM, and REST:
 * 1. 128-bit hex TraceId and 64-bit SpanId generation & context propagation.
 * 2. Span recording with service tags, timestamps, durations, and error annotations.
 * 3. In-memory circular buffer of distributed traces with parent-child span graphs.
 * 4. P50, P95, and P99 latency percentile analytics per microservice.
 * 5. Waterfall visualization model for System Inspector inspection.
 */

const crypto = require('crypto');

function randomHex(bytes) {
  return crypto.randomBytes(bytes).toString('hex');
}

class Span {
  constructor(name, options = {}) {
    this.name = name;
    this.spanId = options.spanId || randomHex(8);
    this.traceId = options.traceId || randomHex(16);
    this.parentSpanId = options.parentSpanId || null;
    this.service = options.service || 'gateway';
    this.startTime = Date.now();
    this.endTime = null;
    this.durationMs = null;
    this.status = 'IN_PROGRESS'; // 'OK', 'ERROR', 'IN_PROGRESS'
    this.tags = options.tags || {};
    this.events = [];
    this.error = null;
  }

  setTag(key, value) {
    this.tags[key] = value;
    return this;
  }

  addEvent(name, attributes = {}) {
    this.events.push({
      name,
      timestamp: Date.now(),
      attributes
    });
    return this;
  }

  finish(status = 'OK', error = null) {
    this.endTime = Date.now();
    this.durationMs = Math.max(1, this.endTime - this.startTime);
    this.status = error ? 'ERROR' : status;
    if (error) {
      this.error = typeof error === 'string' ? error : error.message;
      this.tags['error'] = true;
    }
    return this;
  }

  toJSON() {
    return {
      spanId: this.spanId,
      traceId: this.traceId,
      parentSpanId: this.parentSpanId,
      name: this.name,
      service: this.service,
      startTime: this.startTime,
      endTime: this.endTime,
      durationMs: this.durationMs,
      status: this.status,
      tags: this.tags,
      events: this.events,
      error: this.error
    };
  }
}

class DistributedTracer {
  constructor(maxStoredTraces = 200) {
    this.maxStoredTraces = maxStoredTraces;
    this.traces = new Map(); // traceId -> Array<Span>
    this.recentTraceIds = [];
  }

  startSpan(name, options = {}) {
    const span = new Span(name, options);
    const traceId = span.traceId;

    if (!this.traces.has(traceId)) {
      this.traces.set(traceId, []);
      this.recentTraceIds.push(traceId);
      if (this.recentTraceIds.length > this.maxStoredTraces) {
        const evicted = this.recentTraceIds.shift();
        this.traces.delete(evicted);
      }
    }

    this.traces.get(traceId).push(span);
    return span;
  }

  createTraceContext(parentContext = {}) {
    return {
      traceId: parentContext.traceId || randomHex(16),
      parentSpanId: parentContext.spanId || null,
      spanId: randomHex(8)
    };
  }

  getTrace(traceId) {
    const spans = this.traces.get(traceId);
    if (!spans) return null;

    const spanMap = new Map();
    let rootSpan = null;

    spans.forEach(s => spanMap.set(s.spanId, { ...s.toJSON(), children: [] }));

    spanMap.forEach(s => {
      if (s.parentSpanId && spanMap.has(s.parentSpanId)) {
        spanMap.get(s.parentSpanId).children.push(s);
      } else if (!rootSpan) {
        rootSpan = s;
      }
    });

    const totalDuration = spans.reduce((max, s) => Math.max(max, (s.endTime || Date.now()) - s.startTime), 0);
    const hasError = spans.some(s => s.status === 'ERROR');

    return {
      traceId,
      rootSpan: rootSpan || (spans[0] ? spans[0].toJSON() : null),
      spans: spans.map(s => s.toJSON()),
      totalDurationMs: totalDuration,
      status: hasError ? 'ERROR' : 'OK',
      spanCount: spans.length
    };
  }

  getAllTraces(limit = 50) {
    const list = [];
    const ids = [...this.recentTraceIds].reverse().slice(0, limit);
    for (const tid of ids) {
      const t = this.getTrace(tid);
      if (t) list.push(t);
    }
    return list;
  }

  getMetrics() {
    const serviceLatencies = new Map();
    let totalSpans = 0;
    let errorSpans = 0;

    for (const spans of this.traces.values()) {
      for (const s of spans) {
        if (!s.durationMs) continue;
        totalSpans++;
        if (s.status === 'ERROR') errorSpans++;

        if (!serviceLatencies.has(s.service)) {
          serviceLatencies.set(s.service, []);
        }
        serviceLatencies.get(s.service).push(s.durationMs);
      }
    }

    const serviceMetrics = {};
    for (const [svc, latencies] of serviceLatencies.entries()) {
      latencies.sort((a, b) => a - b);
      const count = latencies.length;
      const p50 = latencies[Math.floor(count * 0.5)] || 0;
      const p95 = latencies[Math.floor(count * 0.95)] || 0;
      const p99 = latencies[Math.floor(count * 0.99)] || 0;
      const avg = Number((latencies.reduce((a, b) => a + b, 0) / count).toFixed(2));

      serviceMetrics[svc] = {
        count,
        avgLatencyMs: avg,
        p50Ms: p50,
        p95Ms: p95,
        p99Ms: p99
      };
    }

    return {
      totalTraces: this.recentTraceIds.length,
      totalSpans,
      errorRate: totalSpans > 0 ? Number(((errorSpans / totalSpans) * 100).toFixed(2)) : 0,
      services: serviceMetrics
    };
  }
}

// Global singleton tracer
const globalTracer = new DistributedTracer(200);

module.exports = {
  DistributedTracer,
  Span,
  globalTracer
};
