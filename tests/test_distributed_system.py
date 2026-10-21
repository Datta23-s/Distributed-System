"""
Unit Test Suite for Distributed Systems Concepts (FA-1)
Tests:
1. Service Registry & Naming (Unit 2 Self-Study & Unit 1 Location Transparency)
2. Custom RPC Client Stub & Server Skeleton (Unit 2 Remote Procedure Call)
3. Message-Oriented Middleware: Pub/Sub & Queues (Unit 2 MOM)
4. Peer-to-Peer Gossip Overlay (Unit 2 P2P Messaging)
5. Heartbeat & Automatic Failover (Unit 2 Fault Tolerance & Unit 1 Failure Transparency)
"""

import time
import unittest

from middleware.naming import ServiceRegistry, generate_id
from middleware.rpc import RPCServerSkeleton, RPCClientStub
from middleware.broker import MessageBrokerServer, MessageBrokerClient
from middleware.p2p_mesh import P2PNode
from middleware.fault_monitor import HeartbeatMonitor


class TestDistributedSystems(unittest.TestCase):

    def test_01_service_registry(self):
        """Test Unit 2 Naming & Unit 1 Location Transparency."""
        reg = ServiceRegistry()
        reg.register("service://coordinator", "127.0.0.1", 9000, {"role": "master"})
        
        info = reg.lookup("service://coordinator")
        self.assertIsNotNone(info)
        self.assertEqual(info["host"], "127.0.0.1")
        self.assertEqual(info["port"], 9000)

        # Test ID generation
        uid = generate_id("test")
        self.assertTrue(uid.startswith("test-"))

    def test_02_rpc_client_stub_and_skeleton(self):
        """Test Unit 2 RPC: Marshalling, client stub and server skeleton execution."""
        server = RPCServerSkeleton("127.0.0.1", 9801)
        
        def calculate_fare(distance: float, surge: float = 1.0) -> dict:
            return {"fare": round((5.0 + distance * 2.0) * surge, 2)}
        
        server.register_procedure("calculate_fare", calculate_fare)
        server.start()
        time.sleep(0.1)

        try:
            client = RPCClientStub("127.0.0.1", 9801)
            result = client.call("calculate_fare", distance=10.5, surge=1.5)
            self.assertEqual(result["fare"], 39.0)
        finally:
            server.stop()

    def test_03_mom_pub_sub_and_queue(self):
        """Test Unit 2 Message-Oriented Middleware (Pub/Sub and Persistent Queue)."""
        broker_server = MessageBrokerServer("127.0.0.1", 9802)
        broker_server.start()
        time.sleep(0.1)

        try:
            client = MessageBrokerClient("127.0.0.1", 9802)
            
            # 1. Test Queue (Point-to-Point)
            client.enqueue("test_job_queue", {"task_id": "job-1", "action": "dispatch"})
            item = client.dequeue("test_job_queue")
            self.assertIsNotNone(item)
            self.assertEqual(item["task_id"], "job-1")

            # 2. Test Pub/Sub
            received_events = []
            client.subscribe("rides.status", lambda topic, payload: received_events.append(payload))
            time.sleep(0.1)
            
            client.publish("rides.status", {"status": "DISPATCHED", "ride_id": "r-100"})
            time.sleep(0.2)
            
            self.assertTrue(len(received_events) >= 1)
            self.assertEqual(received_events[0]["status"], "DISPATCHED")
            client.close()
        finally:
            broker_server.stop()

    def test_04_p2p_gossip_mesh(self):
        """Test Unit 2 P2P Messaging: Driver-to-Driver decentralized gossip."""
        node1 = P2PNode("driver-1", "127.0.0.1", 9803)
        node2 = P2PNode("driver-2", "127.0.0.1", 9804)
        node3 = P2PNode("driver-3", "127.0.0.1", 9805)

        # Connect overlay topology: Node1 -> Node2 -> Node3
        node1.add_peer("127.0.0.1", 9804)
        node2.add_peer("127.0.0.1", 9805)

        received_alerts = []
        node3.register_alert_callback(lambda alert: received_alerts.append(alert))

        node1.start()
        node2.start()
        node3.start()
        time.sleep(0.1)

        try:
            # Node1 originates a hazard broadcast. Should gossip through Node2 to Node3!
            node1.broadcast_hazard_alert("WATERLOGGING", (25, 40), "Road blocked on 5th Ave")
            time.sleep(0.3)

            self.assertTrue(len(received_alerts) >= 1)
            self.assertEqual(received_alerts[0]["hazard_type"], "WATERLOGGING")
            self.assertEqual(received_alerts[0]["origin_node"], "driver-1")
        finally:
            node1.stop()
            node2.stop()
            node3.stop()

    def test_05_heartbeat_and_crash_detection(self):
        """Test Unit 2 Fault Tolerance: Heartbeat monitor and automatic crash detection."""
        monitor = HeartbeatMonitor(heartbeat_timeout=0.6, check_interval=0.2)
        crashed_nodes = []
        monitor.register_failure_callback(lambda node_id, meta: crashed_nodes.append(node_id))
        
        monitor.record_heartbeat("driver-alpha", {"role": "driver"})
        monitor.start()

        time.sleep(0.2)
        self.assertEqual(monitor.get_node_status("driver-alpha"), "HEALTHY")

        # Stop sending heartbeats and wait for timeout
        time.sleep(0.8)
        self.assertEqual(monitor.get_node_status("driver-alpha"), "CRASHED")
        self.assertIn("driver-alpha", crashed_nodes)
        
        monitor.stop()


if __name__ == "__main__":
    unittest.main()
