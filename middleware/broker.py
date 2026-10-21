"""
Unit 2: Communication - Message-Oriented Communication (MOM)
Unit 1: Architectures - Event-Based & Shared Data-Space Architecture

This module implements a Message-Oriented Middleware supporting:
1. Asynchronous Persistent Queues (Point-to-Point: one producer, one consumer)
2. Publish/Subscribe Topics (One-to-Many broadcast with wildcard or exact topic matching)
3. Transient vs Persistent messaging semantics
4. Networked Broker Server & Lightweight Python Broker Client
"""

import json
import socket
import threading
import time
from collections import defaultdict, deque
from typing import Any, Callable, Dict, List, Optional


class MessageBrokerServer:
    """
    Message-Oriented Middleware Broker Server.
    Runs as an asynchronous TCP service routing messages to queues and pub/sub topics.
    """
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.queues: Dict[str, deque] = defaultdict(deque)
        self.subscribers: Dict[str, List[socket.socket]] = defaultdict(list)
        self._lock = threading.Lock()
        self._running = False
        self._server_sock: Optional[socket.socket] = None

    def start(self) -> None:
        self._running = True
        self._server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self._server_sock.bind((self.host, self.port))
        self._server_sock.listen(20)

        threading.Thread(target=self._accept_loop, daemon=True).start()

    def _accept_loop(self) -> None:
        while self._running:
            try:
                client_sock, _ = self._server_sock.accept()
                threading.Thread(target=self._client_handler, args=(client_sock,), daemon=True).start()
            except Exception:
                break

    def _client_handler(self, sock: socket.socket) -> None:
        subscribed_topics = []
        buffer = ""
        try:
            while self._running:
                data = sock.recv(4096)
                if not data:
                    break
                buffer += data.decode('utf-8')
                while "\n" in buffer:
                    line, buffer = buffer.split("\n", 1)
                    line = line.strip()
                    if not line:
                        continue
                    self._process_command(line, sock, subscribed_topics)
        except Exception:
            pass
        finally:
            with self._lock:
                for topic in subscribed_topics:
                    if sock in self.subscribers[topic]:
                        self.subscribers[topic].remove(sock)
            sock.close()

    def _process_command(self, line: str, sock: socket.socket, client_subs: List[str]) -> None:
        try:
            msg = json.loads(line)
            action = msg.get("action")
            
            if action == "PUBLISH":
                # Topic-based Pub/Sub (Unit 2 MOM)
                topic = msg.get("topic")
                payload = msg.get("payload")
                self._dispatch_pub(topic, payload)
                sock.sendall(b'{"status":"OK"}\n')

            elif action == "SUBSCRIBE":
                # Register subscriber
                topic = msg.get("topic")
                with self._lock:
                    self.subscribers[topic].append(sock)
                    if topic not in client_subs:
                        client_subs.append(topic)
                sock.sendall(b'{"status":"SUBSCRIBED"}\n')

            elif action == "ENQUEUE":
                # Point-to-Point Queue (Unit 2 MOM: Persistent queue)
                q_name = msg.get("queue")
                payload = msg.get("payload")
                with self._lock:
                    self.queues[q_name].append(payload)
                sock.sendall(b'{"status":"ENQUEUED"}\n')

            elif action == "DEQUEUE":
                q_name = msg.get("queue")
                with self._lock:
                    if self.queues[q_name]:
                        item = self.queues[q_name].popleft()
                        resp = {"status": "OK", "item": item}
                    else:
                        resp = {"status": "EMPTY", "item": None}
                sock.sendall((json.dumps(resp) + "\n").encode('utf-8'))

            elif action == "QUEUE_LEN":
                q_name = msg.get("queue")
                with self._lock:
                    resp = {"status": "OK", "length": len(self.queues[q_name])}
                sock.sendall((json.dumps(resp) + "\n").encode('utf-8'))

        except Exception as e:
            err = json.dumps({"status": "ERROR", "error": str(e)}) + "\n"
            try:
                sock.sendall(err.encode('utf-8'))
            except Exception:
                pass

    def _dispatch_pub(self, topic: str, payload: Any) -> None:
        notification = json.dumps({"type": "EVENT", "topic": topic, "payload": payload}) + "\n"
        encoded = notification.encode('utf-8')
        
        with self._lock:
            # Deliver to exact topic subscribers or wildcard subscribers
            recipients = list(self.subscribers.get(topic, []))
            if "*" in self.subscribers:
                recipients.extend(self.subscribers["*"])

        dead_sockets = []
        for s in recipients:
            try:
                s.sendall(encoded)
            except Exception:
                dead_sockets.append(s)

        if dead_sockets:
            with self._lock:
                for topic_list in self.subscribers.values():
                    for ds in dead_sockets:
                        if ds in topic_list:
                            topic_list.remove(ds)

    def stop(self) -> None:
        self._running = False
        if self._server_sock:
            try:
                self._server_sock.close()
            except Exception:
                pass


class MessageBrokerClient:
    """
    Client for interacting with the Message-Oriented Middleware.
    Used by Driver, Customer, and Coordinator processes.
    """
    def __init__(self, host: str, port: int):
        self.host = host
        self.port = port
        self.sub_callbacks: Dict[str, List[Callable[[str, Any], None]]] = defaultdict(list)
        self._sub_sock: Optional[socket.socket] = None
        self._sub_thread: Optional[threading.Thread] = None
        self._running = False

    def publish(self, topic: str, payload: Any) -> bool:
        """Publishes an event to a topic asynchronously."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect((self.host, self.port))
            cmd = json.dumps({"action": "PUBLISH", "topic": topic, "payload": payload}) + "\n"
            s.sendall(cmd.encode('utf-8'))
            s.recv(1024)
            s.close()
            return True
        except Exception:
            return False

    def enqueue(self, queue_name: str, payload: Any) -> bool:
        """Enqueues an item into a point-to-point FIFO queue."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect((self.host, self.port))
            cmd = json.dumps({"action": "ENQUEUE", "queue": queue_name, "payload": payload}) + "\n"
            s.sendall(cmd.encode('utf-8'))
            s.recv(1024)
            s.close()
            return True
        except Exception:
            return False

    def dequeue(self, queue_name: str) -> Optional[Any]:
        """Polls an item from a FIFO queue."""
        try:
            s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            s.connect((self.host, self.port))
            cmd = json.dumps({"action": "DEQUEUE", "queue": queue_name}) + "\n"
            s.sendall(cmd.encode('utf-8'))
            resp_data = s.recv(4096).decode('utf-8').strip()
            s.close()
            if resp_data:
                resp = json.loads(resp_data)
                if resp.get("status") == "OK":
                    return resp.get("item")
            return None
        except Exception:
            return None

    def subscribe(self, topic: str, callback: Callable[[str, Any], None]) -> None:
        """Subscribes to a pub/sub topic with a listener callback."""
        self.sub_callbacks[topic].append(callback)
        if not self._sub_sock:
            self._start_subscriber_loop()
        
        # Send subscription request
        cmd = json.dumps({"action": "SUBSCRIBE", "topic": topic}) + "\n"
        try:
            self._sub_sock.sendall(cmd.encode('utf-8'))
        except Exception:
            pass

    def _start_subscriber_loop(self) -> None:
        self._running = True
        self._sub_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        self._sub_sock.connect((self.host, self.port))

        def reader():
            buffer = ""
            while self._running:
                try:
                    data = self._sub_sock.recv(4096)
                    if not data:
                        break
                    buffer += data.decode('utf-8')
                    while "\n" in buffer:
                        line, buffer = buffer.split("\n", 1)
                        line = line.strip()
                        if not line:
                            continue
                        msg = json.loads(line)
                        if msg.get("type") == "EVENT":
                            topic = msg.get("topic")
                            payload = msg.get("payload")
                            for cb in self.sub_callbacks.get(topic, []):
                                try:
                                    cb(topic, payload)
                                except Exception:
                                    pass
                            for cb in self.sub_callbacks.get("*", []):
                                try:
                                    cb(topic, payload)
                                except Exception:
                                    pass
                except Exception:
                    break

        self._sub_thread = threading.Thread(target=reader, daemon=True)
        self._sub_thread.start()

    def close(self) -> None:
        self._running = False
        if self._sub_sock:
            try:
                self._sub_sock.close()
            except Exception:
                pass
