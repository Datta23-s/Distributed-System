# Formative Assessment 1 (FA-1) Mini Project Report
## Course: Distributed Systems
### Project Title: UrbanPulse Dispatch — Distributed Ride-Sharing Simulator

---

## 1. Executive Summary & Problem Statement

### 1.1 Problem Statement
Modern on-demand urban mobility systems (such as Uber, Lyft, and Grab) operate in high-density, unpredictable physical environments. Managing these platforms requires coordinating millions of moving edge nodes (vehicles and passengers) while maintaining:
* **High Availability & Fault Tolerance:** Nodes may suddenly disconnect due to network dropouts or dead batteries; rides must not be lost.
* **Low Latency & Distribution Transparency:** Customers should request rides without needing to know physical server ports, IP addresses, or underlying data serialization formats.
* **Continuous Streaming:** Real-time spatial telemetry must be streamed continuously without blocking request-reply transactions.
* **Decentralized Resiliency:** Edge vehicles should be able to exchange localized road hazard alerts without inundating the central dispatch server.

### 1.2 Project Scope & Objectives
**UrbanPulse Dispatch** is a multi-process distributed ride-sharing system engineered to simulate these real-world mechanics while demonstrating the fundamental concepts covered in **Unit 1 (Introduction to Distributed Systems)** and **Unit 2 (Communication)** of the Distributed Systems syllabus.

The project is implemented using **Node.js, Express, React, WebSockets, WebRTC, and TCP/UDP Sockets**, where each subsystem runs as an independent operating system process.

---

## 2. Distributed System Architecture

### 2.1 High-Level Architectural Diagram

```
                              ┌───────────────────────────────────┐
                              │      React Frontend (Port 5000)   │
                              │  - 2D Canvas Real-time Map        │
                              │  - WebRTC Voice & Data Modal      │
                              │  - Protocol Packet Flow Visualizer│
                              └─────────────────┬─────────────────┘
                                                │ HTTP REST / WebSockets (Port 5000)
                                                ▼
                              ┌───────────────────────────────────┐
                              │      Express Gateway Server       │
                              │  - REST to RPC Client Stub Bridge │
                              │  - WebSocket Telemetry Stream Hub │
                              │  - WebRTC SDP/ICE Signaling       │
                              └─────────────────┬─────────────────┘
                                                │
                 ┌──────────────────────────────┴──────────────────────────────┐
                 │ RPC (TCP: 9000)                             MOM (TCP: 9100) │
                 ▼                                                             ▼
  ┌───────────────────────────────┐                             ┌───────────────────────────────┐
  │   Coordinator Process Node    │                             │  Message Broker Process (MOM) │
  │ - RPC Server Skeleton (9000)  │◄───────────────────────────►│ - Point-to-Point FIFO Queues  │
  │ - Matchmaking Engine          │    MOM Pub/Sub Connection   │ - Topic Pub/Sub:              │
  │ - Heartbeat Fault Monitor     │                             │   * rides.status              │
  │ - Automatic Failover Engine   │                             │   * driver.telemetry          │
  └───────────────────────────────┘                             └──────────────┬────────────────┘
                                                                               │
                                 ┌─────────────────────────────────────────────┼──────────────────────────────┐
                                 │                                             │                              │
                          MOM/RPC│                                      MOM/RPC│                       MOM/RPC│
                                 ▼                                             ▼                              ▼
                          ┌──────────────┐                              ┌──────────────┐               ┌──────────────┐
                          │ Driver 1     │                              │ Driver 2     │               │ Driver 3     │
                          │ - Port: 9021 │◄────────────────────────────►│ - Port: 9022 │◄─────────────►│ - Port: 9023 │
                          │ - Pos: 20,30 │      P2P Gossip (UDP)        │ - Pos: 50,60 │  P2P (UDP)   │ - Pos: 80,40 │
                          └──────────────┘                              └──────────────┘               └──────────────┘
```

### 2.2 Layered Architecture Model (Unit 1: Architectures)
1. **Presentation Layer:** React 18 Single Page Application rendering the animated 2D city simulation canvas, active vehicle telemetry, interactive control panel, and audio waveform caller.
2. **Gateway & Signaling Layer:** Express.js web server providing REST endpoints for browser actions and WebSocket endpoints for high-frequency coordinate streaming and WebRTC session negotiation.
3. **Middleware Layer (`middleware/`):**
   * `naming.js`: Service Registry mapping logical names (`service://coordinator`) to endpoints.
   * `rpc.js`: Custom TCP RPC Client Stubs and Server Skeletons with binary-framed serialization.
   * `broker.js`: Message-Oriented Middleware managing queues and pub/sub routing.
   * `faultMonitor.js`: Periodic heartbeat tracker and crash detection watchdog.
   * `p2pMesh.js`: Peer-to-Peer UDP overlay mesh.
4. **Distributed Nodes Layer (`nodes/`):**
   * `coordinator.js`: The central dispatch, matchmaking, and failover engine.
   * `driver.js`: Mobile edge nodes with simulated physical kinematics and GPS telemetry.
   * `customer.js`: Customer client generating synchronous RPC requests and tracking trip progress.

---

## 3. Detailed Syllabus Mapping: Unit 1

### 3.1 Definition and Goals of Distributed Systems
* **Resource Accessibility:** The system allows customers to discover, share, and utilize a distributed pool of drivers located across different city zones.
* **Distribution Transparency:**
  * **Access Transparency:** Implemented in `middleware/rpc.js`. The caller invokes methods on the `RPCClientStub` identically to a local function call, hiding data marshalling, network socket creation, and wire framing.
  * **Location Transparency:** Implemented in `middleware/naming.js`. Nodes look up services using logical URIs (e.g., `service://coordinator`) rather than hardcoding physical IP addresses or ports.
  * **Migration Transparency:** Drivers move continuously across 2D coordinates `(x, y)` on the city grid without disrupting network socket bindings or active ride tracking.
  * **Failure Transparency:** Implemented in `middleware/faultMonitor.js` and `nodes/coordinator.js`. When Driver 2 crashes during an active trip, the Coordinator detects the failure and transparently transfers the ride to Driver 3 without the customer having to re-book.
* **Openness:** The system defines standardized JSON-RPC wire frames, REST payloads, and topic structures that allow new driver or customer implementations to join without modifying the coordinator.
* **Scalability:** The architecture scales horizontally; additional driver processes (`driver-4`, `driver-5`) can be started on arbitrary ports and will register dynamically with the cluster.

### 3.2 Types of Distributed Systems
* **Distributed Computing Systems:** Demonstrated by the Coordinator's parallel driver matchmaking algorithm that scores candidate drivers based on Euclidean distance.
* **Distributed Information Systems:** Demonstrated by the multi-step transactional ride lifecycle (`REQUESTED → ASSIGNED → PICKING_UP → ON_TRIP → COMPLETED`) where state changes are atomically propagated across the cluster.
* **Distributed Pervasive / Ubiquitous Systems:** Demonstrated by driver processes simulating mobile edge devices emitting continuous low-power telemetry and heartbeats.

### 3.3 Architectural Styles
* **Layered Architecture:** Clear decoupling between Presentation (React), Gateway (Express), Middleware (`rpc.js`, `broker.js`), and Node processes.
* **Object-Based Architecture:** RPC Client Stub invoking remote object procedures on the Server Skeleton.
* **Event-Based Architecture:** Decoupled Publish/Subscribe event bus in `middleware/broker.js`.
* **Hybrid Architecture:** The system combines a centralized Coordinator for ride dispatch with a pure decentralized Peer-to-Peer overlay mesh for driver hazard alerts.

### 3.4 Distributed Multimedia Systems
* Implemented via **WebRTC Audio Calling & DataChannel** (`public/js/WebRTCModal.jsx`). Once signaling is complete via WebSockets, audio streams and chat data flow directly peer-to-peer between customer and driver.
* Live audio frequency analysis is visualized using the browser's native **Web Audio API (`AnalyserNode`)** and rendered on a canvas waveform.

---

## 4. Detailed Syllabus Mapping: Unit 2

### 4.1 Fundamentals of Communication
* **Synchronous vs. Asynchronous Communication:**
  * *Synchronous:* RPC calls (`estimate_fare`, `request_ride`) where the customer thread blocks until the coordinator returns the result.
  * *Asynchronous:* MOM Queues and Pub/Sub topics (`rides.status`, `driver.telemetry`) where events are emitted without blocking the producer.
* **Transient vs. Persistent Communication:**
  * *Transient:* Telemetry streams and P2P UDP packets are dropped if the recipient is offline.
  * *Persistent:* Ride assignment queues buffer jobs until the assigned driver acknowledges them.

### 4.2 Remote Procedure Call (RPC)
The custom RPC framework in `middleware/rpc.js` implements:
1. **Client Stub (`RPCClientStub`):** Marshals procedure names and parameters into a wire packet, prepends a 4-byte big-endian length header, transmits over a TCP socket, and awaits the unmarshalled response.
2. **Server Skeleton (`RPCServerSkeleton`):** Listens on a dedicated TCP port (9000), decodes incoming frames, looks up the registered procedure in its method map, dynamically invokes the function, and marshals the return value.
3. **Parameter Passing:** Pass-by-value with JSON wire serialization.

### 4.3 Message-Oriented Communication (MOM)
The message broker in `middleware/broker.js` implements:
1. **Point-to-Point Queues:** FIFO persistent message queues (`ENQUEUE`, `DEQUEUE`) ensuring that each task is delivered to exactly one consumer.
2. **Publish/Subscribe Topics:** Topic-based multicast routing (`PUBLISH`, `SUBSCRIBE`) supporting topics like `rides.status`, `driver.telemetry`, and `driver.<id>.assignments`.

### 4.4 Stream-Oriented Communication
* Driver nodes emit high-frequency continuous GPS telemetry packets (2.5 Hz) over WebSockets.
* Telemetry packets include temporal timestamps and coordinates `(x, y)`, enabling smooth client-side trajectory interpolation and low-jitter rendering.

### 4.5 Peer-to-Peer (P2P) Messaging
* Implemented in `middleware/p2pMesh.js` using Node.js native **UDP sockets (`dgram`)**.
* Drivers form an unstructured overlay network.
* **Epidemic Gossip Protocol:** When a driver discovers a road hazard, it broadcasts a UDP packet to known peers.
* **Broadcast Storm Prevention:** Each peer maintains a `seenMessages` deduplication cache and decrements a Time-To-Live (TTL) counter with each hop.
* **Key Characteristic:** This hazard warning system functions completely independently of the central coordinator.

### 4.6 WebRTC
* Real-time peer-to-peer browser communication implementing `RTCPeerConnection` and `RTCDataChannel`.
* The Express server serves as the signaling gateway, relaying SDP Offers, SDP Answers, and ICE Candidates.
* Media and data packets flow directly between peers without server relay.

### 4.7 Self-Study: Names, Identifiers & Fault Tolerance
* **Names, Identifiers & Addresses:** Implemented in `middleware/naming.js`. Provides a `ServiceRegistry` resolving logical URIs to `host:port` pairs, and generates UUIDs for rides and transactions.
* **Fault Tolerance & Heartbeats:** Implemented in `middleware/faultMonitor.js`. Driver nodes emit periodic heartbeats every 1.0 second. The coordinator watchdog checks node liveness every 800ms; if a driver fails to report within 3.5 seconds, it is marked as `CRASHED` and an automatic failover sequence is initiated.

---

## 5. Fault Tolerance & Failover Analysis

### 5.1 Failure Scenario: Driver Crash During Active Trip
```
Customer                    Coordinator                   Driver 2 (Active)            Driver 3 (Idle)
   │                             │                               │                            │
   │                             ├────── Heartbeat Ping ────────►│ (Heartbeat received)       │
   │                             │                               │                            │
   │                             │                               💥 CRASH (Battery/Killed)    │
   │                             │                               X (Heartbeats stop)          │
   │                             │                                                            │
   │                     [3.5s Watchdog Timeout]                                              │
   │                     Node 'driver-2' DEAD!                                                │
   │                             │                                                            │
   │                             ├────── Query Active Rides ─────┐                            │
   │                             │◄───── Stranded Ride 'r-101' ──┘                            │
   │                             │                                                            │
   │                             ├────── Find Next Nearest Driver ───────────────────────────►│
   │                             │◄───── Match: Driver 3 ─────────────────────────────────────┤
   │                             │                                                            │
   │                             ├────── Reassign Ride 'r-101' via MOM ──────────────────────►│
   │                             │                                                            │
   │◄── Failover Notification ───┤                                                            │
   │   (New Driver: Driver 3)    │                                                            │
```

### 5.2 Failure Transparency Guarantees
1. **Zero Ride Data Loss:** The ride's origin, destination, and current state remain preserved in the Coordinator's active ride store.
2. **Transparent Handoff:** The customer is notified of the driver change with the new driver's coordinates immediately appearing on their tracking stream.
3. **Recovery Support:** If Driver 2 subsequently recovers, it re-registers as `AVAILABLE` without creating state inconsistencies.

---

## 6. Verification and Test Results

### 6.1 Automated Test Suite Execution
Automated unit tests were implemented in `test/test_distributed.js` covering all core distributed mechanisms:

```
> node test/test_distributed.js

🧪 Starting Distributed Systems Concept Test Suite...

▶ Test 1: Service Registry & Location Transparency
  ✅ PASSED: Name resolution & Unique ID generation working.

▶ Test 2: Remote Procedure Call (RPC)
  ✅ PASSED: RPC Client Stub packed params, Skeleton executed, Stub received return value.

▶ Test 3: Message-Oriented Middleware (MOM)
  ✅ PASSED: MOM Persistent Queues and Topic Pub/Sub working.

▶ Test 4: Peer-to-Peer (P2P) UDP Gossip Mesh
  ✅ PASSED: Decentralized P2P UDP Gossip hopped across nodes without central server.

▶ Test 5: Fault Tolerance & Heartbeat Failure Detection
  ✅ PASSED: Heartbeat failure detector recognized dead node and initiated failover.

======================================================
🎉 ALL 5 DISTRIBUTED SYSTEMS CONCEPT TESTS PASSED! 🎉
======================================================
```

---

## 7. Viva Voce Questions and Model Answers

### Q1: What makes this a truly Distributed System rather than just a web application?
**Answer:** In this project, the Coordinator, Customer, Driver 1, Driver 2, and Driver 3 run as separate operating system processes with distinct memory spaces and network ports. They communicate exclusively via network messages: TCP sockets for custom RPC, TCP for Message-Oriented queues and pub/sub, UDP sockets for direct P2P driver gossip, and WebRTC for peer-to-peer audio. There is no shared memory between nodes.

### Q2: Explain the internal mechanism of your RPC implementation.
**Answer:** In `middleware/rpc.js`, when a customer calls `estimate_fare`, the `RPCClientStub` serializes the procedure name and arguments into a JSON payload with a 4-byte big-endian length prefix. It connects over TCP to the Coordinator's `RPCServerSkeleton` on port 9000. The skeleton reads the framed bytes, unmarshals the parameters, calls the local JavaScript method dynamically, serializes the response, and sends it back. The stub unpacks the response and returns the result to the caller synchronously.

### Q3: How is Message-Oriented Middleware (MOM) different from RPC in your project?
**Answer:** RPC is 1-to-1, tightly coupled, and synchronous—the customer blocks waiting for an immediate fare estimate. MOM (implemented in `middleware/broker.js`) is asynchronous and decoupled in time and space. The coordinator publishes trip lifecycle events (`rides.status`) and continuous telemetry (`driver.telemetry`) to topics, allowing any number of interested subscribers to receive updates without blocking the sender.

### Q4: How does your system achieve Failure Transparency?
**Answer:** Active drivers send periodic heartbeats every 1.0s. The Coordinator runs a watchdog timer in `middleware/faultMonitor.js`. If a driver node fails to send a heartbeat within 3.5s, the coordinator flags the driver as `CRASHED`. If the driver had an active ride in progress, the coordinator automatically retrieves the ride, finds the next nearest healthy driver (e.g., Driver 3), reassigns the ride, and notifies the customer transparently without losing the trip.

### Q5: How is Peer-to-Peer (P2P) communication demonstrated without the central server?
**Answer:** In `middleware/p2pMesh.js`, each driver node listens on its own UDP port (9021, 9022, 9023). When Driver 1 detects a traffic hazard (e.g., waterlogging), it broadcasts a gossip packet directly to peer drivers over UDP. Peer drivers cache the message ID to avoid broadcast loops and forward it if TTL > 0. The central coordinator is completely bypassed.

### Q6: What is the role of the server in your WebRTC implementation?
**Answer:** The Express server acts solely as an initial signaling gateway (relaying SDP session offers, answers, and ICE candidate network descriptors over WebSockets). Once this handshake completes, the audio stream and DataChannel text messages flow directly peer-to-peer between the customer browser and the driver node.

---

## 8. Conclusion
The **UrbanPulse Dispatch** simulator successfully satisfies all requirements for Formative Assessment 1 (FA-1). It models a real-world ride-sharing problem while providing an explicit, tangible implementation of every theoretical concept in Units 1 and 2. Furthermore, its modular middleware architecture is prepared to incorporate Unit 3 and Unit 4 concepts (Logical Clocks, Distributed Mutual Exclusion, and Consensus) for FA-2.
