"""
Unit 1: Architectures - Client-Server / Hybrid Architecture
Unit 2: Communication - RPC Client Stub & Real-Time Event Tracking

Customer Node:
1. Uses RPC Client Stub to request fares and book rides from the Coordinator.
2. Subscribes to MOM ride status events and assigned driver stream.
3. Observes transparent failover if the assigned driver crashes.
"""

from typing import List, Optional, Tuple

from middleware.broker import MessageBrokerClient
from middleware.naming import ServiceRegistry, generate_id
from middleware.rpc import RPCClientStub


class CustomerNode:
    def __init__(
        self,
        customer_id: Optional[str] = None,
        coordinator_host: str = "127.0.0.1",
        coordinator_rpc_port: int = 9000,
        broker_port: int = 9100,
    ):
        self.customer_id = customer_id or generate_id("cust")
        self.coordinator_host = coordinator_host
        self.coordinator_rpc_port = coordinator_rpc_port
        self.broker_port = broker_port

        # Look up coordinator endpoint via ServiceRegistry (Unit 2 Naming)
        self.registry = ServiceRegistry()
        coord_info = self.registry.lookup("service://coordinator")
        if coord_info:
            self.coordinator_host = coord_info["host"]
            self.coordinator_rpc_port = coord_info["port"]

        # Unit 2: RPC Client Stub (Synchronous Request-Reply)
        self.rpc_stub = RPCClientStub(self.coordinator_host, self.coordinator_rpc_port)

        # Unit 2: MOM Client for asynchronous events
        self.broker = MessageBrokerClient(self.coordinator_host, self.broker_port)
        
        self.current_ride: Optional[dict] = None
        self.assigned_driver_id: Optional[str] = None
        self.driver_location: Optional[Tuple[float, float]] = None

    def start(self) -> None:
        self.broker.subscribe("rides.status", self._on_ride_status_event)
        self.broker.subscribe("driver.telemetry", self._on_driver_telemetry)

    def estimate_fare(self, pickup: List[int], dropoff: List[int]) -> dict:
        """
        Unit 2 RPC: Synchronous call to coordinator's estimate_fare procedure.
        """
        return self.rpc_stub.call("estimate_fare", pickup=pickup, dropoff=dropoff)

    def request_ride(self, pickup: List[int], dropoff: List[int]) -> dict:
        """
        Unit 2 RPC: Synchronous call to coordinator's request_ride procedure.
        """
        res = self.rpc_stub.call("request_ride", customer_id=self.customer_id, pickup=pickup, dropoff=dropoff)
        if res.get("status") == "OK":
            self.current_ride = {
                "ride_id": res.get("ride_id"),
                "pickup": pickup,
                "dropoff": dropoff,
                "status": "DISPATCHED"
            }
            self.assigned_driver_id = res.get("driver_id")
        return res

    def _on_ride_status_event(self, topic: str, payload: dict) -> None:
        event = payload.get("event")
        ride = payload.get("ride", {})
        
        # Check if event pertains to this customer
        if self.current_ride and (ride.get("ride_id") == self.current_ride.get("ride_id") or payload.get("ride_id") == self.current_ride.get("ride_id")):
            if event == "RIDE_REASSIGNED_FAILOVER":
                old_d = payload.get("crashed_driver")
                new_d = payload.get("new_driver")
                self.assigned_driver_id = new_d
                print(f"\n[Customer '{self.customer_id}'] 🔄 TRANSPARENT FAILOVER: Driver '{old_d}' crashed! Coordinator reassigned ride to '{new_d}'!")
            
            elif event == "CUSTOMER_PICKED_UP":
                print(f"[Customer '{self.customer_id}'] 🚕 Driver has arrived and trip started!")

            elif event == "RIDE_COMPLETED":
                print(f"[Customer '{self.customer_id}'] 🏁 Arrived at destination! Trip completed successfully.")
                self.current_ride = None
                self.assigned_driver_id = None

    def _on_driver_telemetry(self, topic: str, payload: dict) -> None:
        if self.assigned_driver_id and payload.get("driver_id") == self.assigned_driver_id:
            self.driver_location = (payload.get("x"), payload.get("y"))

    def stop(self) -> None:
        self.broker.close()
