"""
Unit 2: Communication - Names, Identifiers & Addresses
Unit 1: Distributed Systems Goals - Location & Access Transparency

This module implements:
1. Logical Name Resolution (Name -> Physical Address {host, port})
2. Service Registry / Directory Service
3. Unique Identifier (UUID) generation for requests and nodes
"""

import uuid
import threading
from typing import Dict, Any, Optional


class ServiceRegistry:
    """
    In-memory / Networked Service Registry.
    Provides Location Transparency: Callers reference services by logical URIs
    (e.g., 'service://coordinator', 'driver://driver-1') rather than hardcoded IP:Ports.
    """
    _instance = None
    _lock = threading.Lock()

    def __new__(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = super(ServiceRegistry, cls).__new__(cls)
                cls._instance._registry: Dict[str, Dict[str, Any]] = {}
                cls._instance._registry_lock = threading.Lock()
        return cls._instance

    def register(self, logical_name: str, host: str, port: int, metadata: Optional[Dict[str, Any]] = None) -> None:
        """
        Registers a node/service with its physical network address.
        """
        with self._registry_lock:
            self._registry[logical_name] = {
                "logical_name": logical_name,
                "host": host,
                "port": port,
                "metadata": metadata or {},
                "status": "HEALTHY"
            }
            # print(f"[Registry] Registered '{logical_name}' -> {host}:{port}")

    def lookup(self, logical_name: str) -> Optional[Dict[str, Any]]:
        """
        Resolves a logical name into its physical endpoint.
        Provides Location Transparency.
        """
        with self._registry_lock:
            return self._registry.get(logical_name)

    def deregister(self, logical_name: str) -> None:
        """
        Removes a node from the directory.
        """
        with self._registry_lock:
            if logical_name in self._registry:
                del self._registry[logical_name]

    def list_all(self, prefix: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """
        Lists registered services, optionally filtered by prefix (e.g. 'driver://').
        """
        with self._registry_lock:
            if prefix:
                return {k: v for k, v in self._registry.items() if k.startswith(prefix)}
            return dict(self._registry)


def generate_id(prefix: str = "req") -> str:
    """
    Generates a globally unique identifier (UUIDv4) for rides, orders, or transactions.
    """
    return f"{prefix}-{uuid.uuid4().hex[:8]}"
