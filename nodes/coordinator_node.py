

import math
import threading
import time
from typing import Any, Dict, List, Optional

from middleware.broker import MessageBrokerClient
from middleware.fault_monitor import HeartbeatMonitor
from middleware.naming import ServiceRegistry, generate_id
from middleware.rpc import RPCServerSkeleton


class CoordinatorNode:
    def __init__(self, host: str = "127.0.0.1", rpc_port: int = 9000, broker_port: int = 9100):
        self.host = host
        self.rpc_port = rpc_port
        self.broker_port = broker_port
        
        self.registry = ServiceRegistry()
        self.registry.register("service://coordinator", host, rpc_port, {"type": "coordinator"})
        
        # State stores
        self.drivers: Dict[str, dict] = {}       # driver_id -> {x, y, status, last_seen, host, port}
        self.active_rides: Dict[str, dict] = {}   # ride_id -> {customer_id, driver_id, pickup, dropoff, status}
        self.driver_to_ride: Dict[str, str] = {}  # driver_id -> ride_id
        self._lock = threading.Lock()
        
        # Fault Tolerance: Heartbeat Monitor
        self.fault_monitor = HeartbeatMonitor(heartbeat_timeout=3.5, check_interval=0.8)
        self.fault_monitor.register_failure_callback(self._on_driver_crashed)
        
        # RPC Skeleton for incoming Customer and System RPCs
        self.rpc_skeleton = RPCServerSkeleton(self.host, self.rpc_port)
        self.rpc_skeleton.register_procedure("estimate_fare", self.rpc_estimate_fare)
        self.rpc_skeleton.register_procedure("request_ride", self.rpc_request_ride)
        self.rpc_skeleton.register_procedure("get_trip_status", self.rpc_get_trip_status)
        self.rpc_skeleton.register_procedure("report_driver_state", self.rpc_report_driver_state)
        self.rpc_skeleton.register_procedure("kill_driver_simulation", self.rpc_kill_driver_simulation)

        # Message Broker Client
        self.broker_client: Optional[MessageBrokerClient] = None
        self._running = False

    def start(self) -> None:
        self._running = True
        self.rpc_skeleton.start()
        self.fault_monitor.start()

        # Connect to MOM broker
        self.broker_client = MessageBrokerClient(self.host, self.broker_port)
        # Subscribe to driver telemetry and heartbeats
        self.broker_client.subscribe("driver.telemetry", self._on_driver_telemetry)
        self.broker_client.subscribe("driver.heartbeat", self._on_driver_heartbeat)
        self.broker_client.subscribe("driver.trip_completed", self._on_trip_completed)

        print(f"[Coordinator] Started on RPC port {self.rpc_port}. Registered in ServiceRegistry.")

    # ------------------ RPC Procedures ------------------

    def rpc_estimate_fare(self, pickup: List[int], dropoff: List[int]) -> dict:
        """RPC method: Synchronous fare estimation."""
        dist = math.hypot(dropoff[0] - pickup[0], dropoff[1] - pickup[1])
        base_fare = 5.00
        cost = round(base_fare + (dist * 1.75), 2)
        eta_seconds = max(5, int(dist * 2.5))
        return {
            "status": "OK",
            "distance_km": round(dist, 2),
            "estimated_fare": cost,
            "eta_seconds": eta_seconds
        }

    def rpc_request_ride(self, customer_id: str, pickup: List[int], dropoff: List[int]) -> dict:
        """
        RPC method: Synchronous Ride Request.
        Finds the nearest healthy available driver and dispatches the ride.
        """
        ride_id = generate_id("ride")
        best_driver = self._find_nearest_driver(pickup)

        if not best_driver:
            return {
                "status": "FAILED",
                "message": "No available drivers found in the area. Please try again in a few seconds."
            }

        driver_id = best_driver["driver_id"]
        with self._lock:
            ride_data = {
                "ride_id": ride_id,
                "customer_id": customer_id,
                "driver_id": driver_id,
                "pickup": pickup,
                "dropoff": dropoff,
                "status": "DISPATCHED",
                "reassigned_count": 0,
                "created_at": time.time()
            }
            self.active_rides[ride_id] = ride_data
            self.driver_to_ride[driver_id] = ride_id
            if driver_id in self.drivers:
                self.drivers[driver_id]["status"] = "ASSIGNED"

        # Notify the assigned driver via MOM Point-to-Point Queue or Topic
        self.broker_client.publish(f"driver.{driver_id}.assignments", {
            "action": "ACCEPT_RIDE",
            "ride_id": ride_id,
            "pickup": pickup,
            "dropoff": dropoff,
            "customer_id": customer_id
        })

        # Broadcast event to subscribers (e.g. Dashboard, Customer)
        self.broker_client.publish("rides.status", {
            "event": "RIDE_DISPATCHED",
            "ride": ride_data
        })

        return {
            "status": "OK",
            "ride_id": ride_id,
            "driver_id": driver_id,
            "driver_location": [best_driver["x"], best_driver["y"]],
            "message": f"Driver '{driver_id}' assigned and en-route!"
        }

    def rpc_get_trip_status(self, ride_id: str) -> dict:
        with self._lock:
            ride = self.active_rides.get(ride_id)
            if not ride:
                return {"status": "NOT_FOUND"}
            driver_info = self.drivers.get(ride["driver_id"], {})
            return {
                "status": "OK",
                "ride": ride,
                "driver_location": [driver_info.get("x", 0), driver_info.get("y", 0)]
            }

    def rpc_report_driver_state(self, driver_id: str, x: int, y: int, status: str) -> dict:
        with self._lock:
            if driver_id not in self.drivers:
                self.drivers[driver_id] = {}
            self.drivers[driver_id].update({
                "driver_id": driver_id,
                "x": x,
                "y": y,
                "status": status,
                "last_seen": time.time()
            })
        self.fault_monitor.record_heartbeat(driver_id, {"x": x, "y": y, "status": status})
        return {"status": "OK"}

    def rpc_kill_driver_simulation(self, driver_id: str) -> dict:
        """Simulate a driver node crash to test fault tolerance and failover."""
        # print(f"[Coordinator] Manual kill invoked for '{driver_id}'")
        self.fault_monitor.mark_crashed_manually(driver_id)
        return {"status": "OK", "message": f"Crash injected for {driver_id}"}

    # ------------------ Fault Tolerance & Failover ------------------

    def _on_driver_crashed(self, driver_id: str, metadata: dict) -> None:
        """
        Unit 2 Fault Tolerance: Driver crash detection callback.
        Re-dispatches any active ride to another healthy driver!
        """
        print(f"\n⚠️  [Coordinator FAULT DETECTOR] CRASH DETECTED on node '{driver_id}'! (Missed heartbeats)")
        with self._lock:
            if driver_id in self.drivers:
                self.drivers[driver_id]["status"] = "CRASHED"
            
            ride_id = self.driver_to_ride.get(driver_id)
            if not ride_id:
                # Driver had no active ride
                return
            
            ride = self.active_rides.get(ride_id)
            if not ride or ride["status"] in ["COMPLETED", "CANCELLED"]:
                return

            # Driver had an active ride! Initiate Automatic Failover
            print(f"🔄 [Coordinator FAILOVER] Reassigning stranded ride '{ride_id}' from crashed '{driver_id}'...")
            del self.driver_to_ride[driver_id]
            
            # Find replacement driver
            replacement = self._find_nearest_driver(ride["pickup"], exclude_ids=[driver_id])
            if not replacement:
                print("❌ [Coordinator FAILOVER] No alternative healthy drivers available!")
                ride["status"] = "FAILED_NO_DRIVERS"
                self.broker_client.publish("rides.status", {
                    "event": "RIDE_FAILED_NO_DRIVERS",
                    "ride": ride,
                    "crashed_driver": driver_id
                })
                return

            new_driver_id = replacement["driver_id"]
            ride["driver_id"] = new_driver_id
            ride["reassigned_count"] += 1
            ride["status"] = "REASSIGNED_FAILOVER"
            self.driver_to_ride[new_driver_id] = ride_id
            if new_driver_id in self.drivers:
                self.drivers[new_driver_id]["status"] = "ASSIGNED"

        print(f"✅ [Coordinator FAILOVER] Ride '{ride_id}' successfully re-dispatched to '{new_driver_id}'!")
        
        # Dispatch to new driver via MOM
        self.broker_client.publish(f"driver.{new_driver_id}.assignments", {
            "action": "ACCEPT_RIDE",
            "ride_id": ride_id,
            "pickup": ride["pickup"],
            "dropoff": ride["dropoff"],
            "customer_id": ride["customer_id"],
            "failover": True,
            "previous_driver": driver_id
        })

        # Broadcast failover event to update Customer and Dashboard
        self.broker_client.publish("rides.status", {
            "event": "RIDE_REASSIGNED_FAILOVER",
            "ride": ride,
            "crashed_driver": driver_id,
            "new_driver": new_driver_id
        })

    # ------------------ Matchmaking Algorithm ------------------

    def _find_nearest_driver(self, pickup: List[int], exclude_ids: Optional[List[str]] = None) -> Optional[dict]:
        exclude_ids = exclude_ids or []
        best_driver = None
        min_dist = float('inf')

        with self._lock:
            for driver_id, dinfo in self.drivers.items():
                if driver_id in exclude_ids:
                    continue
                # Verify healthy according to fault monitor
                if self.fault_monitor.get_node_status(driver_id) != "HEALTHY":
                    continue
                if dinfo.get("status") != "AVAILABLE":
                    continue

                dist = math.hypot(dinfo["x"] - pickup[0], dinfo["y"] - pickup[1])
                if dist < min_dist:
                    min_dist = dist
                    best_driver = dict(dinfo)

        return best_driver

    # ------------------ MOM Subscriptions ------------------

    def _on_driver_heartbeat(self, topic: str, payload: dict) -> None:
        driver_id = payload.get("driver_id")
        if driver_id:
            self.fault_monitor.record_heartbeat(driver_id, payload)
            with self._lock:
                if driver_id in self.drivers and self.drivers[driver_id]["status"] == "CRASHED":
                    self.drivers[driver_id]["status"] = payload.get("status", "AVAILABLE")

    def _on_driver_telemetry(self, topic: str, payload: dict) -> None:
        driver_id = payload.get("driver_id")
        if driver_id:
            with self._lock:
                if driver_id not in self.drivers:
                    self.drivers[driver_id] = {}
                self.drivers[driver_id].update({
                    "driver_id": driver_id,
                    "x": payload.get("x", 0),
                    "y": payload.get("y", 0),
                    "status": payload.get("status", "AVAILABLE"),
                    "last_seen": time.time()
                })
            self.fault_monitor.record_heartbeat(driver_id)

    def _on_trip_completed(self, topic: str, payload: dict) -> None:
        ride_id = payload.get("ride_id")
        driver_id = payload.get("driver_id")
        with self._lock:
            if ride_id in self.active_rides:
                self.active_rides[ride_id]["status"] = "COMPLETED"
            if driver_id in self.driver_to_ride:
                del self.driver_to_ride[driver_id]
            if driver_id in self.drivers:
                self.drivers[driver_id]["status"] = "AVAILABLE"

        self.broker_client.publish("rides.status", {
            "event": "RIDE_COMPLETED",
            "ride_id": ride_id,
            "driver_id": driver_id
        })

    def stop(self) -> None:
        self._running = False
        self.rpc_skeleton.stop()
        self.fault_monitor.stop()
        if self.broker_client:
            self.broker_client.close()
