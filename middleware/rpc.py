"""
Unit 2: Communication - Remote Procedure Call (RPC)
Unit 1: Architectures - Object-Based Architecture & Middleware Layer

This module provides a custom, transparent RPC framework implementing:
1. Client Stub (Packs arguments, marshals to JSON wire format, sends over TCP socket, waits synchronously, unmarshals result)
2. Server Skeleton (Listens on TCP socket, unmarshals wire format, dispatches to local method, marshals response)
3. Parameter Passing (Pass-by-value with JSON serialization)
4. Transparent Exception Handling (Server-side exceptions caught and re-raised on client)
"""

import json
import socket
import threading
from typing import Any, Callable, Dict, Optional


class RPCException(Exception):
    """Raised when an RPC invocation fails either locally or on the remote server."""
    pass


class RPCSerializer:
    """
    Marshalling and Unmarshalling engine.
    Converts in-memory Python objects to network-transmittable bytes (JSON over TCP).
    """
    @staticmethod
    def marshal(data: Any) -> bytes:
        payload = json.dumps(data)
        # Prefix with 4-byte big-endian length header for framing
        payload_bytes = payload.encode('utf-8')
        length_header = len(payload_bytes).to_bytes(4, byteorder='big')
        return length_header + payload_bytes

    @staticmethod
    def unmarshal(sock: socket.socket) -> Optional[Any]:
        # Read the 4-byte length header
        raw_length = sock.recv(4)
        if not raw_length or len(raw_length) < 4:
            return None
        length = int.from_bytes(raw_length, byteorder='big')
        
        # Read the exact payload bytes
        chunks = []
        bytes_read = 0
        while bytes_read < length:
            chunk = sock.recv(min(length - bytes_read, 4096))
            if not chunk:
                break
            chunks.append(chunk)
            bytes_read += len(chunk)
        
        payload_bytes = b"".join(chunks)
        return json.loads(payload_bytes.decode('utf-8'))


class RPCClientStub:
    """
    Client-side proxy (Stub) that abstracts the network communication.
    The caller invokes methods on this stub as if they were local functions.
    """
    def __init__(self, host: str, port: int, timeout: float = 5.0):
        self.host = host
        self.port = port
        self.timeout = timeout

    def call(self, procedure_name: str, **kwargs) -> Any:
        """
        Synchronous blocking Remote Procedure Call.
        1. Marshals procedure name and arguments.
        2. Establishes TCP connection.
        3. Transmits request.
        4. Blocks waiting for response.
        5. Unmarshals return value or raises RPCException.
        """
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(self.timeout)
        try:
            sock.connect((self.host, self.port))
            packet = {
                "procedure": procedure_name,
                "params": kwargs
            }
            # Marshalling
            wire_data = RPCSerializer.marshal(packet)
            sock.sendall(wire_data)

            # Unmarshalling response
            response = RPCSerializer.unmarshal(sock)
            if response is None:
                raise RPCException("Server closed connection without responding.")
            
            if response.get("status") == "ERROR":
                raise RPCException(f"Remote Error: {response.get('error')}")
            
            return response.get("result")
        except socket.timeout:
            raise RPCException(f"RPC Timeout calling '{procedure_name}' on {self.host}:{self.port}")
        except ConnectionRefusedError:
            raise RPCException(f"Connection Refused: Remote node at {self.host}:{self.port} is down.")
        except Exception as e:
            raise RPCException(f"RPC Failure: {str(e)}")
        finally:
            sock.close()


class RPCServerSkeleton:
    """
    Server-side Skeleton (Dispatcher).
    Listens for incoming client connections, decodes wire packets,
    dispatches invocations to registered procedure handlers, and returns marshalled results.
    """
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.methods: Dict[str, Callable] = {}
        self._running = False
        self._server_sock: Optional[socket.socket] = None
        self._thread: Optional[threading.Thread] = None

    def register_procedure(self, name: str, func: Callable) -> None:
        """Registers a local procedure to be exposed to remote callers."""
        self.methods[name] = func

    def _handle_connection(self, client_sock: socket.socket) -> None:
        try:
            request = RPCSerializer.unmarshal(client_sock)
            if not request:
                return
            
            proc_name = request.get("procedure")
            params = request.get("params", {})
            
            if proc_name not in self.methods:
                response = {
                    "status": "ERROR",
                    "error": f"Unknown procedure: {proc_name}"
                }
            else:
                try:
                    # Dynamically invoke local method
                    result = self.methods[proc_name](**params)
                    response = {
                        "status": "OK",
                        "result": result
                    }
                except Exception as e:
                    response = {
                        "status": "ERROR",
                        "error": str(e)
                    }

            client_sock.sendall(RPCSerializer.marshal(response))
        except Exception as e:
            pass
        finally:
            client_sock.close()

    def start(self) -> None:
        """Starts the RPC server loop in a background daemon thread."""
        self._running = True
        self._server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._server_sock.bind((self.host, self.port))
        self._server_sock.listen(10)

        def listen_loop():
            while self._running:
                try:
                    client_sock, _ = self._server_sock.accept()
                    t = threading.Thread(target=self._handle_connection, args=(client_sock,), daemon=True)
                    t.start()
                except Exception:
                    break

        self._thread = threading.Thread(target=listen_loop, daemon=True)
        self._thread.start()

    def stop(self) -> None:
        """Stops the RPC skeleton server."""
        self._running = False
        if self._server_sock:
            try:
                self._server_sock.close()
            except Exception:
                pass
