"""
Unit 2: Communication - Peer-to-Peer (P2P) Messaging
Unit 1: Architectures - Peer-to-Peer & Hybrid Architectures

This module implements a decentralized P2P overlay network for Driver nodes:
1. Direct peer-to-peer socket messaging between driver nodes.
2. Gossip protocol dissemination for traffic hazard/road blockage alerts.
3. Message deduplication (seen-message cache) and Time-To-Live (TTL) to prevent broadcast loops.
4. Independent of the central coordinator (pure peer-to-peer communication).
"""

import json
import socket
import threading
import time
from typing import Callable, Dict, List, Set, Tuple


class P2PNode:
    """
    Decentralized Peer-to-Peer Node running on each Driver.
    Enables drivers to communicate directly with other drivers.
    """
    def __init__(self, node_id: str, host: str, p2p_port: int):
        self.node_id = node_id
        self.host = host
        self.port = p2p_port
        self.peers: Set[Tuple[str, int]] = set()  # Set of (host, port)
        self.seen_messages: Set[str] = set()       # For deduplication
        self.on_alert_received_callbacks: List[Callable[[dict], None]] = []
        self._running = False
        self._server_sock: socket.socket = None
        self._lock = threading.Lock()

    def add_peer(self, host: str, port: int) -> None:
        """Adds a known peer to the overlay network topology."""
        if (host, port) != (self.host, self.port):
            with self._lock:
                self.peers.add((host, port))

    def register_alert_callback(self, callback: Callable[[dict], None]) -> None:
        """Registers a callback when a new P2P gossip message arrives."""
        self.on_alert_received_callbacks.append(callback)

    def start(self) -> None:
        """Starts the P2P listener socket."""
        self._running = True
        self._server_sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        self._server_sock.bind((self.host, self.port))
        
        threading.Thread(target=self._listen_loop, daemon=True).start()

    def _listen_loop(self) -> None:
        while self._running:
            try:
                data, addr = self._server_sock.recvfrom(4096)
                if not data:
                    continue
                packet = json.loads(data.decode('utf-8'))
                self._handle_incoming_packet(packet)
            except Exception:
                break

    def _handle_incoming_packet(self, packet: dict) -> None:
        msg_id = packet.get("msg_id")
        if not msg_id:
            return

        with self._lock:
            if msg_id in self.seen_messages:
                return  # Drop duplicate to prevent loops
            self.seen_messages.add(msg_id)

        # Notify local driver of hazard/alert
        for cb in self.on_alert_received_callbacks:
            try:
                cb(packet)
            except Exception:
                pass

        # Gossip forwarding if TTL > 0
        ttl = packet.get("ttl", 0) - 1
        if ttl > 0:
            packet["ttl"] = ttl
            self._broadcast_to_peers(packet)

    def broadcast_hazard_alert(self, hazard_type: str, grid_location: Tuple[int, int], description: str) -> dict:
        """
        Originates a new P2P gossip message from this driver node.
        """
        msg_id = f"p2p-{self.node_id}-{int(time.time() * 1000)}"
        packet = {
            "msg_id": msg_id,
            "origin_node": self.node_id,
            "hazard_type": hazard_type,
            "location": grid_location,
            "description": description,
            "timestamp": time.time(),
            "ttl": 3  # Hop limit
        }

        with self._lock:
            self.seen_messages.add(msg_id)

        self._broadcast_to_peers(packet)
        return packet

    def _broadcast_to_peers(self, packet: dict) -> None:
        payload = json.dumps(packet).encode('utf-8')
        with self._lock:
            targets = list(self.peers)

        for host, port in targets:
            try:
                s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
                s.sendto(payload, (host, port))
                s.close()
            except Exception:
                pass

    def stop(self) -> None:
        self._running = False
        if self._server_sock:
            try:
                self._server_sock.close()
            except Exception:
                pass
