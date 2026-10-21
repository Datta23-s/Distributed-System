"""
Unit 2: Communication - Fault Tolerance & Failure Detection
Unit 1: Goals of Distributed Systems - Failure Transparency & Reliability

This module implements:
1. Heartbeat receiver and timestamp tracker for all active nodes.
2. Background watchdog thread detecting node crashes (missed heartbeats).
3. Automatic failover callback triggering re-dispatching of stranded rides.
"""

import time
import threading
from typing import Callable, Dict, Optional, Set


class HeartbeatMonitor:
    """
    Monitors liveness of distributed nodes.
    Detects crashes when a node stops transmitting periodic heartbeats.
    """
    def __init__(self, heartbeat_timeout: float = 4.0, check_interval: float = 1.0):
        self.heartbeat_timeout = heartbeat_timeout
        self.check_interval = check_interval
        self._last_seen: Dict[str, float] = {}
        self._node_metadata: Dict[str, dict] = {}
        self._dead_nodes: Set[str] = set()
        self._lock = threading.Lock()
        self._running = False
        self._watchdog_thread: Optional[threading.Thread] = None
        self._on_failure_callbacks: list[Callable[[str, dict], None]] = []

    def register_failure_callback(self, callback: Callable[[str, dict], None]) -> None:
        """Registers a function to be invoked when a node crashes (e.g., reassign ride)."""
        self._on_failure_callbacks.append(callback)

    def record_heartbeat(self, node_id: str, metadata: Optional[dict] = None) -> None:
        """Invoked whenever a heartbeat is received from a node."""
        with self._lock:
            self._last_seen[node_id] = time.time()
            if metadata:
                self._node_metadata[node_id] = metadata
            if node_id in self._dead_nodes:
                self._dead_nodes.remove(node_id)
                # print(f"[FaultMonitor] Node {node_id} recovered / reconnected.")

    def mark_crashed_manually(self, node_id: str) -> None:
        """Forces an immediate crash simulation for testing/demo purposes."""
        with self._lock:
            self._last_seen[node_id] = 0.0  # Force timeout
        self._check_failures()

    def get_node_status(self, node_id: str) -> str:
        with self._lock:
            if node_id in self._dead_nodes:
                return "CRASHED"
            last = self._last_seen.get(node_id, 0)
            if time.time() - last > self.heartbeat_timeout:
                return "CRASHED"
            return "HEALTHY"

    def get_all_statuses(self) -> Dict[str, dict]:
        with self._lock:
            now = time.time()
            statuses = {}
            for nid, last in self._last_seen.items():
                is_dead = (nid in self._dead_nodes) or (now - last > self.heartbeat_timeout)
                statuses[nid] = {
                    "node_id": nid,
                    "status": "CRASHED" if is_dead else "HEALTHY",
                    "seconds_since_heartbeat": round(now - last, 2),
                    "metadata": self._node_metadata.get(nid, {})
                }
            return statuses

    def _check_failures(self) -> None:
        now = time.time()
        crashed_now = []
        with self._lock:
            for node_id, last_ts in list(self._last_seen.items()):
                if node_id not in self._dead_nodes and (now - last_ts > self.heartbeat_timeout):
                    self._dead_nodes.add(node_id)
                    meta = self._node_metadata.get(node_id, {})
                    crashed_now.append((node_id, meta))

        # Invoke callbacks outside lock
        for node_id, meta in crashed_now:
            # print(f"[FaultMonitor] CRASH DETECTED: Node '{node_id}' missed heartbeats! Triggering failover...")
            for cb in self._on_failure_callbacks:
                try:
                    cb(node_id, meta)
                except Exception as e:
                    # print(f"[FaultMonitor] Error in failover callback: {e}")
                    pass

    def start(self) -> None:
        self._running = True
        def loop():
            while self._running:
                time.sleep(self.check_interval)
                self._check_failures()
        self._watchdog_thread = threading.Thread(target=loop, daemon=True)
        self._watchdog_thread.start()

    def stop(self) -> None:
        self._running = False
