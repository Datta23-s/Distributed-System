

import math
import random
import threading
import time
from typing import List, Optional, Tuple

from middleware.broker import MessageBrokerClient
from middleware.naming import ServiceRegistry
from middleware.p2p_mesh import P2PNode


class DriverNode:
    def __init__(
        self,
        driver_id: str,
        initial_pos: Tuple[int, int],
        p2p_port: int,
        known_peer_ports: Optional[List[int]] = None,
        broker_host: str = "127.0.0.1",
        broker_port: int = 9100,
    ):
        self.driver_id = driver_id
        self.x, self.y = float(initial_pos[0]), float(initial_pos[1])
        self.target_x, self.target_y = float(initial_pos[0]), float(initial_pos[1])
        self.speed = 1.8  # grid units per second
        self.status = "AVAILABLE"  # AVAILABLE, PICKING_UP, ON_TRIP, CRASHED
        
        self.active_ride_id: Optional[str] = None
        self.pickup_pos: Optional[Tuple[int, int]] = None
        self.dropoff_pos: Optional[Tuple[int, int]] = None
        
        self.p2p_port = p2p_port
        self.known_peer_ports = known_peer_ports or []
        self.broker_host = broker_host
        self.broker_port = broker_port

        # P2P Gossip Overlay
        self.p2p = P2PNode(self.driver_id, "127.0.0.1", self.p2p_port)
        self.p2p.register_alert_callback(self._on_p2p_hazard_received)

        # MOM Broker Client
        self.broker = MessageBrokerClient(self.broker_host, self.broker_port)
        
        # Service Registry
        self.registry = ServiceRegistry()
        self.registry.register(f"driver://{self.driver_id}", "127.0.0.1", self.p2p_port, {
            "type": "driver",
            "p2p_port": self.p2p_port
        })

        self._running = False
        self._crashed = False
        self._lock = threading.Lock()
        self.known_hazards: List[dict] = []

    def start(self) -> None:
        self._running = True
        self.p2p.start()
        
        # Connect to known peers in overlay mesh
        for port in self.known_peer_ports:
            self.p2p.add_peer("127.0.0.1", port)

        # Subscribe to driver assignments from coordinator
        self.broker.subscribe(f"driver.{self.driver_id}.assignments", self._on_assignment_received)

        # Launch background loops
        threading.Thread(target=self._movement_and_telemetry_loop, daemon=True).start()
        threading.Thread(target=self._heartbeat_loop, daemon=True).start()

        # print(f"[{self.driver_id}] Started at ({self.x:.1f}, {self.y:.1f}) with P2P port {self.p2p_port}")

    def simulate_crash(self) -> None:
        """
        Simulates node crash (phone battery dies, process killed, network partition).
        Stops sending heartbeats so the Coordinator detects failure.
        """
        with self._lock:
            self._crashed = True
            self.status = "CRASHED"
        print(f"\n💥 [{self.driver_id}] HAS CRASHED! (Heartbeats halted)")

    def recover(self) -> None:
        """Restores crashed node to healthy state."""
        with self._lock:
            self._crashed = False
            self.status = "AVAILABLE"
            self.active_ride_id = None
        print(f"✨ [{self.driver_id}] Reconnected & recovered!")

    # ------------------ P2P Gossip Communication ------------------

    def report_hazard(self, hazard_type: str, description: str) -> dict:
        """
        Unit 2 P2P Messaging: Broadcasts traffic alert directly to other drivers.
        Does NOT contact the central coordinator!
        """
        grid_loc = (int(self.x), int(self.y))
        alert = self.p2p.broadcast_hazard_alert(hazard_type, grid_loc, description)
        print(f"📢 [{self.driver_id} P2P GOSSIP] Broadcasted '{hazard_type}' at {grid_loc} directly to peer drivers!")
        return alert

    def _on_p2p_hazard_received(self, packet: dict) -> None:
        with self._lock:
            self.known_hazards.append(packet)
        # print(f"🔔 [{self.driver_id} P2P GOSSIP] Received peer hazard '{packet.get('hazard_type')}' from {packet.get('origin_node')} at {packet.get('location')}")

    # ------------------ Assignment & Lifecycle ------------------

    def _on_assignment_received(self, topic: str, payload: dict) -> None:
        if self._crashed:
            return

        action = payload.get("action")
        if action == "ACCEPT_RIDE":
            with self._lock:
                self.active_ride_id = payload.get("ride_id")
                self.pickup_pos = tuple(payload.get("pickup", [0, 0]))
                self.dropoff_pos = tuple(payload.get("dropoff", [0, 0]))
                self.status = "PICKING_UP"
                self.target_x, self.target_y = float(self.pickup_pos[0]), float(self.pickup_pos[1])
            
            is_failover = payload.get("failover", False)
            if is_failover:
                print(f"🚨 [{self.driver_id}] ACCEPTED FAILOVER RIDE '{self.active_ride_id}' (replacing crashed {payload.get('previous_driver')})")
            else:
                print(f"🚕 [{self.driver_id}] Accepted Ride '{self.active_ride_id}' -> Heading to Pickup {self.pickup_pos}")

            self.broker.publish("rides.status", {
                "event": "DRIVER_EN_ROUTE_PICKUP",
                "ride_id": self.active_ride_id,
                "driver_id": self.driver_id
            })

    # ------------------ Telemetry & Movement Loops ------------------

    def _movement_and_telemetry_loop(self) -> None:
        """
        Unit 2 Stream-Oriented Communication:
        Continuously moves vehicle and streams high-frequency GPS coordinate packets.
        """
        last_time = time.time()
        while self._running:
            now = time.time()
            dt = now - last_time
            last_time = now

            if not self._crashed:
                with self._lock:
                    self._update_position(dt)

                # Stream telemetry packet to MOM broker
                telemetry_packet = {
                    "driver_id": self.driver_id,
                    "x": round(self.x, 2),
                    "y": round(self.y, 2),
                    "status": self.status,
                    "active_ride": self.active_ride_id,
                    "timestamp": now
                }
                self.broker.publish("driver.telemetry", telemetry_packet)

            time.sleep(0.4)  # 2.5 Hz continuous stream

    def _update_position(self, dt: float) -> None:
        dx = self.target_x - self.x
        dy = self.target_y - self.y
        dist = math.hypot(dx, dy)

        if dist > 0.4:
            # Move towards target
            step = min(dist, self.speed * dt * 4.0)
            self.x += (dx / dist) * step
            self.y += (dy / dist) * step
        else:
            # Arrived at current target
            if self.status == "PICKING_UP":
                # Arrived at customer pickup, start trip to dropoff
                self.status = "ON_TRIP"
                self.target_x, self.target_y = float(self.dropoff_pos[0]), float(self.dropoff_pos[1])
                print(f"🙋 [{self.driver_id}] Arrived at customer! Trip started -> Heading to Dropoff {self.dropoff_pos}")
                self.broker.publish("rides.status", {
                    "event": "CUSTOMER_PICKED_UP",
                    "ride_id": self.active_ride_id,
                    "driver_id": self.driver_id
                })
            elif self.status == "ON_TRIP":
                # Arrived at dropoff, complete ride
                print(f"🏁 [{self.driver_id}] Arrived at dropoff! Ride '{self.active_ride_id}' COMPLETED!")
                self.status = "AVAILABLE"
                finished_ride_id = self.active_ride_id
                self.active_ride_id = None
                self.broker.publish("driver.trip_completed", {
                    "ride_id": finished_ride_id,
                    "driver_id": self.driver_id
                })
            elif self.status == "AVAILABLE":
                # Idle wandering around city grid
                if random.random() < 0.05:
                    self.target_x = max(2, min(98, self.x + random.randint(-15, 15)))
                    self.target_y = max(2, min(98, self.y + random.randint(-15, 15)))

    def _heartbeat_loop(self) -> None:
        """
        Unit 2 Fault Tolerance:
        Sends periodic heartbeats to prove node liveness.
        If crashed, this loop halts transmission.
        """
        while self._running:
            if not self._crashed:
                heartbeat = {
                    "driver_id": self.driver_id,
                    "status": self.status,
                    "x": round(self.x, 2),
                    "y": round(self.y, 2),
                    "timestamp": time.time()
                }
                self.broker.publish("driver.heartbeat", heartbeat)
            time.sleep(1.0)

    def stop(self) -> None:
        self._running = False
        self.p2p.stop()
        self.broker.close()
