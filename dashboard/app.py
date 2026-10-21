

import asyncio
import json
import os
import threading
import time
from typing import Any, Dict, List, Optional

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from middleware.broker import MessageBrokerClient
from middleware.naming import ServiceRegistry
from middleware.rpc import RPCClientStub, RPCException

app = FastAPI(title="UrbanPulse Distributed Systems Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

STATIC_DIR = os.path.join(os.path.dirname(__file__), "static")
if not os.path.exists(STATIC_DIR):
    os.makedirs(STATIC_DIR, exist_ok=True)

app.mount("/static", StaticFiles(directory=STATIC_DIR), name="static")

# Shared state and clients
registry = ServiceRegistry()
broker_client: Optional[MessageBrokerClient] = None
connected_websockets: List[WebSocket] = []
ws_lock = asyncio.Lock()

# Cached telemetry and live states
latest_telemetry: Dict[str, dict] = {}
latest_rides: Dict[str, dict] = {}
p2p_alerts: List[dict] = []
system_logs: List[dict] = []

# Reference to active driver nodes when running in unified mode
active_driver_instances: Dict[str, Any] = {}
active_coordinator_instance: Optional[Any] = None


def add_log(category: str, message: str, details: Optional[dict] = None) -> None:
    log_entry = {
        "id": f"log-{int(time.time() * 1000)}-{len(system_logs)}",
        "timestamp": time.strftime("%H:%M:%S"),
        "category": category,  # RPC, MOM, P2P, STREAM, FAULT, WEBRTC
        "message": message,
        "details": details or {}
    }
    system_logs.append(log_entry)
    if len(system_logs) > 100:
        system_logs.pop(0)


# ------------------ Request Models ------------------

class FareEstimateRequest(BaseModel):
    pickup: List[int]
    dropoff: List[int]


class RideBookingRequest(BaseModel):
    customer_id: str
    pickup: List[int]
    dropoff: List[int]


class CrashSimulationRequest(BaseModel):
    driver_id: str


class P2PHazardRequest(BaseModel):
    driver_id: str
    hazard_type: str
    description: str


# ------------------ API Endpoints ------------------

@app.get("/")
def read_root():
    return FileResponse(os.path.join(STATIC_DIR, "index.html"))


@app.get("/api/state")
def get_system_state():
    """Returns cluster snapshot: drivers, rides, registry, and recent logs."""
    coord_info = registry.lookup("service://coordinator")
    drivers_list = list(latest_telemetry.values())
    return {
        "coordinator": coord_info,
        "drivers": drivers_list,
        "active_rides": list(latest_rides.values()),
        "p2p_hazards": p2p_alerts[-10:],
        "recent_logs": system_logs[-25:],
        "server_time": time.time()
    }


@app.post("/api/ride/estimate")
def api_estimate_fare(req: FareEstimateRequest):
    """
    Unit 2 RPC Demonstration:
    Client Stub contacts Coordinator's RPC Skeleton synchronously.
    """
    coord_info = registry.lookup("service://coordinator")
    host = coord_info["host"] if coord_info else "127.0.0.1"
    port = coord_info["port"] if coord_info else 9000
    
    stub = RPCClientStub(host, port)
    try:
        add_log("RPC", f"Invoking remote procedure 'estimate_fare' on {host}:{port}", {
            "pickup": req.pickup, "dropoff": req.dropoff
        })
        result = stub.call("estimate_fare", pickup=req.pickup, dropoff=req.dropoff)
        add_log("RPC", f"Received RPC response: Fare = ${result.get('estimated_fare')}", result)
        return result
    except RPCException as e:
        add_log("RPC", f"RPC Call Failed: {str(e)}", {"error": str(e)})
        return JSONResponse(status_code=500, content={"status": "ERROR", "message": str(e)})


@app.post("/api/ride/request")
def api_request_ride(req: RideBookingRequest):
    """
    Unit 2 RPC + MOM:
    Synchronously dispatches ride request to Coordinator stub.
    """
    coord_info = registry.lookup("service://coordinator")
    host = coord_info["host"] if coord_info else "127.0.0.1"
    port = coord_info["port"] if coord_info else 9000

    stub = RPCClientStub(host, port)
    try:
        add_log("RPC", f"Invoking remote procedure 'request_ride' for {req.customer_id}", {
            "pickup": req.pickup, "dropoff": req.dropoff
        })
        result = stub.call("request_ride", customer_id=req.customer_id, pickup=req.pickup, dropoff=req.dropoff)
        add_log("RPC", f"Ride assigned to driver '{result.get('driver_id')}' (Ride ID: {result.get('ride_id')})", result)
        return result
    except RPCException as e:
        add_log("RPC", f"RPC Request Failed: {str(e)}", {"error": str(e)})
        return JSONResponse(status_code=500, content={"status": "ERROR", "message": str(e)})


@app.post("/api/fault/kill_driver")
def api_kill_driver(req: CrashSimulationRequest):
    """
    Unit 2 Fault Tolerance Demo:
    Simulates sudden driver crash, stopping heartbeats.
    """
    driver_id = req.driver_id
    if driver_id in active_driver_instances:
        active_driver_instances[driver_id].simulate_crash()
    
    # Also inform coordinator
    coord_info = registry.lookup("service://coordinator")
    if coord_info:
        try:
            stub = RPCClientStub(coord_info["host"], coord_info["port"])
            stub.call("kill_driver_simulation", driver_id=driver_id)
        except Exception:
            pass

    if driver_id in latest_telemetry:
        latest_telemetry[driver_id]["status"] = "CRASHED"

    add_log("FAULT", f"⚠️ FAULT INJECTION: Node '{driver_id}' CRASHED! Heartbeats ceased.", {"node": driver_id})
    return {"status": "OK", "message": f"Driver {driver_id} crashed. Watch coordinator failover!"}


@app.post("/api/fault/recover_driver")
def api_recover_driver(req: CrashSimulationRequest):
    """Recovers a crashed driver."""
    driver_id = req.driver_id
    if driver_id in active_driver_instances:
        active_driver_instances[driver_id].recover()
    if driver_id in latest_telemetry:
        latest_telemetry[driver_id]["status"] = "AVAILABLE"
    add_log("FAULT", f"✨ Node '{driver_id}' recovered and reconnected.", {"node": driver_id})
    return {"status": "OK", "message": f"Driver {driver_id} recovered."}


@app.post("/api/p2p/hazard")
def api_broadcast_hazard(req: P2PHazardRequest):
    """
    Unit 2 P2P Messaging Demo:
    Triggers direct peer-to-peer gossip broadcast between driver nodes.
    """
    driver_id = req.driver_id
    if driver_id in active_driver_instances:
        alert = active_driver_instances[driver_id].report_hazard(req.hazard_type, req.description)
        p2p_alerts.append(alert)
        add_log("P2P", f"📢 P2P Gossip Broadcast from '{driver_id}': {req.hazard_type} - {req.description}", alert)
        return {"status": "OK", "alert": alert}
    return JSONResponse(status_code=404, content={"status": "ERROR", "message": f"Driver {driver_id} not found"})


# ------------------ WebSocket Telemetry & WebRTC Signaling ------------------

@app.websocket("/ws/telemetry")
async def websocket_telemetry_endpoint(websocket: WebSocket):
    """
    Unit 2 Stream-Oriented Communication & WebRTC Signaling:
    Pushes real-time coordinate updates and handles WebRTC SDP/ICE signaling.
    """
    await websocket.accept()
    async with ws_lock:
        connected_websockets.append(websocket)
    try:
        while True:
            # Receive WebRTC signaling packets or client commands
            data_text = await websocket.receive_text()
            try:
                msg = json.loads(data_text)
                msg_type = msg.get("type")

                # WebRTC Signaling (SDP Offer / Answer / ICE Candidate)
                if msg_type in ["webrtc_offer", "webrtc_answer", "webrtc_candidate"]:
                    add_log("WEBRTC", f"WebRTC Signaling packet exchanged: {msg_type}", {
                        "from": msg.get("from"), "to": msg.get("to")
                    })
                    # Relay signaling packet to all other connected peers
                    async with ws_lock:
                        for ws in list(connected_websockets):
                            if ws != websocket:
                                try:
                                    await ws.send_text(data_text)
                                except Exception:
                                    pass

                elif msg_type == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))

            except json.JSONDecodeError:
                pass
    except WebSocketDisconnect:
        pass
    finally:
        async with ws_lock:
            if websocket in connected_websockets:
                connected_websockets.remove(websocket)


async def broadcast_ws_packet(packet: dict) -> None:
    data = json.dumps(packet)
    async with ws_lock:
        dead = []
        for ws in connected_websockets:
            try:
                await ws.send_text(data)
            except Exception:
                dead.append(ws)
        for d in dead:
            if d in connected_websockets:
                connected_websockets.remove(d)


# ------------------ Background MOM Event Listeners ------------------

def init_broker_listeners(broker_host: str = "127.0.0.1", broker_port: int = 9100) -> None:
    global broker_client
    try:
        broker_client = MessageBrokerClient(broker_host, broker_port)
        
        def on_telemetry(topic, payload):
            did = payload.get("driver_id")
            if did:
                latest_telemetry[did] = payload
                # Send stream packet to browser
                asyncio.run(broadcast_ws_packet({
                    "type": "telemetry",
                    "driver": payload
                }))

        def on_ride_status(topic, payload):
            event = payload.get("event")
            ride = payload.get("ride")
            if ride:
                latest_rides[ride["ride_id"]] = ride
            if event == "RIDE_REASSIGNED_FAILOVER":
                add_log("FAULT", f"🔄 AUTOMATIC FAILOVER: Stranded ride reassigned to '{payload.get('new_driver')}'!", payload)
            elif event == "RIDE_DISPATCHED":
                add_log("MOM", f"MOM Pub/Sub: Ride {ride['ride_id']} dispatched to {ride['driver_id']}", ride)
            elif event == "DRIVER_EN_ROUTE_PICKUP":
                add_log("MOM", f"Driver {payload.get('driver_id')} en route to pickup", payload)
            elif event == "CUSTOMER_PICKED_UP":
                add_log("MOM", f"Customer picked up by driver {payload.get('driver_id')}", payload)
            elif event == "RIDE_COMPLETED":
                add_log("MOM", f"Trip {payload.get('ride_id')} completed!", payload)

            asyncio.run(broadcast_ws_packet({
                "type": "ride_event",
                "event": event,
                "data": payload
            }))

        broker_client.subscribe("driver.telemetry", on_telemetry)
        broker_client.subscribe("rides.status", on_ride_status)
    except Exception as e:
        print(f"[Dashboard Gateway] Warning: Could not connect to MOM broker yet ({e})")
