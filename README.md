# ⚡ UrbanPulse Dispatch - Distributed Ride-Sharing Platform (FA-1)

> **Formative Assessment 1 (FA-1) Mini Project**  
> **Course:** Distributed Systems  
> **Topic:** Unified Distributed Ride-Sharing Platform & Protocol Simulator (Uber-Style Architecture)  
> **Tech Stack:** Node.js, Express, React, WebSockets, WebRTC, TCP Sockets, UDP Datagrams  
> **Architecture:** Multi-Node Distributed OS Processes communicating over Localhost Network Ports  

---

## 📖 Product Overview & Distributed Architecture

**UrbanPulse Dispatch** is an enterprise-grade ride-hailing simulator built on real distributed systems primitives. Unlike simple mocks or academic demos, UrbanPulse Dispatch runs real independent processes communicating over raw TCP sockets, UDP datagrams, WebSockets, and WebRTC channels.

Every ride booked through the platform traverses an authentic **6-stage distributed pipeline**:
1. **Quote:** Synchronous RPC over TCP (`:9000`) with measured network latency injection.
2. **Match:** Coordinator queries in-memory Service Registry (`middleware/naming.js`).
3. **Dispatch:** Asynchronous Message-Oriented Middleware queue (`:9100`) assigns the driver.
4. **In Trip:** Real-time vehicle telemetry streamed via WebSockets at 2.5 Hz.
5. **Complete:** Ride receipt automatically written to **Mini-HDFS** (`:9200`), mined into the **Blockchain Ledger** (`:9600`) via Proof-of-Work, and synced to the **Replicated Quorum KV Store** (`:9700`).
6. **Analytics Refresh:** MapReduce batch jobs compute updated revenue and trips per zone.

---

## 🚀 Quick Start (Running the Simulator)

### Prerequisites
* **Node.js** (v18 or higher — tested with v24.12.0)
* **npm** (v9 or higher — tested with v11.6.2)

### Step 1: Install Dependencies
```bash
npm install
```

### Step 2: Launch All Distributed Nodes
```bash
npm start
```
This launches all platform processes:
1. **Coordinator Node** (RPC Skeleton `:9000`, MOM Broker `:9100`, NameNode `:9200`, MapReduce Master)
2. **Driver 1 Node** (P2P Gossip UDP `:9021`, Control TCP `:9031`, Beacon UDP `:9041`, DataNode `:9301`, Object Skeleton `:9501`)
3. **Driver 2 Node** (P2P Gossip UDP `:9022`, Control TCP `:9032`, Beacon UDP `:9042`, DataNode `:9302`, Object Skeleton `:9502`)
4. **Driver 3 Node** (P2P Gossip UDP `:9023`, Control TCP `:9033`, Beacon UDP `:9043`, DataNode `:9303`, Object Skeleton `:9503`)
5. **Serverless FaaS Runtime** (Port `:9400`)
6. **Object Registry / RMI** (Port `:9500`)
7. **Blockchain Ledger Node** (Port `:9600`)
8. **Dynamo Quorum KV Store** (Port `:9700`)
9. **Express Gateway Cluster** (Reverse Proxy `:5000`, Multi-instance Backends `:5001-5003`)

### Step 3: Open Dashboard
Open your browser at:
👉 **`http://localhost:5000`**

---

## 🧪 Running Automated Unit Tests

UrbanPulse Dispatch includes a 100% comprehensive test suite covering all 20 distributed systems concepts:
```bash
npm test
```

### Verified Test Suite (All 20 Passing):
* `Test 1:` **Service Registry & Location Transparency** (Name resolution & unique ID generation)
* `Test 2:` **Remote Procedure Call (RPC)** (Client Stub parameter packing $\leftrightarrow$ Skeleton execution)
* `Test 3:` **Message-Oriented Middleware (MOM)** (Persistent Queues & Topic Pub/Sub)
* `Test 4:` **Peer-to-Peer (P2P) UDP Gossip Mesh** (Decentralized hazard diffusion)
* `Test 5:` **Fault Tolerance** (Heartbeat failure detection & crash watchdog)
* `Test 6:` **Lamport Logical Clocks** (Monotonic clock tick, send/receive wire piggybacking)
* `Test 7:` **Vector Clocks & Causality** (Fidge/Mattern detection of BEFORE, AFTER, CONCURRENT, EQUAL)
* `Test 8:` **Decentralized Beacon Protocol** (UDP 1s beacons, live neighbour table, timeout expiry)
* `Test 9:` **Bully Leader Election** (TCP ELECTION / OK / COORDINATOR probes, highest-ID winner)
* `Test 10:` **Ring Leader Election** (Logical token ring, candidate list circulation, $2N$ message complexity)
* `Test 11:` **Distributed Mutual Exclusion** (Ricart-Agrawala deferred replies & Token Ring circulation)
* `Test 12:` **Physical Clock Synchronization** (Cristian's $RTT/2$ delay compensation & Berkeley average)
* `Test 13:` **Chandy-Lamport Distributed Snapshot** (Consistent cut across 5 nodes, FIFO markers)
* `Test 14:` **Chandy-Misra-Haas Deadlock Detection** (Edge-chasing probe circulation, victim preemption)
* `Test 15:` **Mini-HDFS Distributed Storage** (512-byte chunking, 2x replication, failover reads, re-replication)
* `Test 16:` **Distributed MapReduce** (Data locality mappers, partitioning shuffle, reduce aggregations)
* `Test 17:` **Serverless FaaS Runtime** (Container lifecycle, micro-VM cold boot vs warm reuse)
* `Test 18:` **Distributed Objects & RMI** (Remote Object References, native ES6 Proxy traps, TCP skeleton)
* `Test 19:` **Gateway Load Balancer & Caching** (Round-Robin vs Least-Connections, health check removal, ETag 304 caching)
* `Test 20:` **Blockchain Ledger & Dynamo Quorum KV Store** (SHA-256 PoW mining, majority consensus repair, tunable quorum $N/R/W$, Read Repair)

---

## 🧭 Product Navigation & Feature Layout

The user interface is organized into **5 unified product tabs**, topped by a persistent status bar:

### Persistent Top Bar
* **Leader Badge:** Displays active coordinator status (`Coordinator (primary)` or failover leader).
* **Cluster Health Dots:** Real-time liveness dots for 8 nodes: Coordinator (`C`), Drivers 1-3 (`D1-D3`), Customer (`U`), Gateway instances (`G1-G3`).
* **Physical Clock Skew:** Live physical drift monitor ($\pm 4\text{ms}$).
* **Gateway Indicator:** Active load-balanced Express instance serving requests (`gw-1 :5001`).
* **✨ Guided Demo:** Triggers the automated 8-step viva walkthrough dock.
* **🏷️ Concepts Toggle:** Toggles academic distributed systems concept chips (`ON`/`OFF`).

---

### Tab 1: 🚖 Dispatch
* **2D City Canvas Grid:** Interactive map rendering pickup, dropoff, drivers, and zone shortcuts (`🏡 Uptown`, `🏙️ Downtown`, `✈️ Airport`, `💻 Tech Park`, `⚓ Harbour`).
* **Booking Card:** Editable pickup/dropoff coordinates, "Set via Map" mode, "Get Quote" (RPC with latency), "Request Ride" (MOM queue), and "WebRTC Call" button.
* **6-Stage Distributed Ride Pipeline:** Stepper tracking Quote $\to$ Match $\to$ Dispatch $\to$ In Trip $\to$ Complete $\to$ Analytics Refresh.
* **3-View Live Activity Feed:**
  * *Plain English:* Human-readable ride timeline.
  * *Lamport Order:* Monotonically ordered events sorted by logical timestamp ($L$).
  * *Raw Packets:* Scrollable protocol frames with JSON payload inspection.

---

### Tab 2: 🚗 Fleet & Resources
* **Driver Node Cards (`driver-1`, `driver-2`, `driver-3`):**
  * Displays GPS coordinates, UDP gossip port (`:9021-3`), beacon port (`:9041-3`), and RMI skeleton port (`:9501-3`).
  * Real-time beacon neighbours list with dynamic timeouts.
  * Direct action buttons: **Crash / Recover Node** and **📢 P2P Gossip Hazard**.
* **Exclusive Resource Queues (Mutual Exclusion):**
  * Manages contention for **Airport Pickup Bay** and **Fleet EV Supercharger**.
  * Side-by-side comparison of **Ricart-Agrawala** ($2(N-1)$ messages), **Token Ring** ($0$ to $N$ hops), and **Lodha-Kshemkalyani**.
  * Interactive Request / Release Critical Section controls.
* **Physical Clock Synchronization:**
  * Compares **Cristian's Algorithm** ($RTT/2$ delay compensation) vs **Berkeley Algorithm** (master average convergence).
  * Visualizes per-node drift rates and offsets before and after synchronization.
* **Decentralized Neighbour Discovery:**
  * Displays live neighbour tables updated via 1-second UDP datagram beacons.

---

### Tab 3: 🛡️ Reliability
* **Fault Tolerance & Failover Demonstration Box:**
  * One-click simulation crashing Driver 2 during active rides; Coordinator detects missed heartbeats (>3.5s) and automatically re-dispatches to Driver 3.
* **Leader Election (Bully vs Ring):**
  * Interactive election trigger simulating coordinator crash.
  * Live trace of `ELECTION`, `OK`, and `COORDINATOR` probe messages.
  * Algorithmic complexity comparison table (Message Complexity, Failure Handling, Best/Worst Case).
* **Chandy-Lamport Distributed Snapshot:**
  * Captures a causally consistent cut across all 5 nodes without pausing execution.
  * Displays recorded process states (bank balances, ride state) and in-flight FIFO channel states.
* **Chandy-Misra-Haas Edge-Chasing Deadlock Detection:**
  * Induces circular resource contention between nodes.
  * Circulates $O(1)$ lightweight `PROBE(init, sender, receiver)` messages along Wait-For-Graph edges.
  * Visualizes probe hops and automatically preempts victim to resolve deadlock.

---

### Tab 4: 📁 Records & Analytics
* **Unified Cluster Summary Card:** Live metrics for DFS replication ($2\times$), MapReduce engine, Blockchain ledger blocks, and Quorum consistency level.
* **Mini-HDFS Distributed Storage:**
  * Splits fleet records into 512-byte blocks replicated $2\times$ across DataNodes (`:9301-9303`).
  * Live file selector and custom file write form.
  * DataNode status cards with chunk counts and crash/recover buttons.
  * NameNode chunk placement map and fault-tolerant read viewer with replica routing trace.
  * One-click re-replication restoring under-replicated chunks.
* **Distributed MapReduce Analytics Engine:**
  * Parallel batch processing with **Data Locality** (mappers execute on DataNodes storing chunks).
  * Visual 3-phase progress bars: Map $\to$ Shuffle & Partition $\to$ Reduce Aggregation.
  * Aggregated analytics table (fares and completed trips per zone/driver).
* **Immutable Blockchain / DLT Ledger:**
  * SHA-256 hash-chained trip ledger with Proof-of-Work mining target (`'000'` prefix).
  * 4-node integrity status grid (`coordinator`, `driver-1`, `driver-2`, `driver-3`).
  * Tamper injection on Driver 2 breaking cryptographic hash binding.
  * Majority consensus repair ($3 > 1$) restoring the corrupted ledger.
* **Replicated Quorum Key-Value Store (Dynamo-Style):**
  * Tunable $(N=3, R, W)$ quorum sliders with live Consistency Model badge.
  * 3 replica node cards showing stored keys, vector clock versions, and partition toggles.
  * Quorum write and quorum read with automatic asynchronous Read Repair.

---

### Tab 5: 🔍 System Inspector
* **Subtab 1: Network Topology & Wire Flow:** Interactive animated SVG topology rendering active RPC calls, MOM topics, and P2P gossip mesh links.
* **Subtab 2: Load Balancer, Serverless & Objects:**
  * *Serverless FaaS Runtime:* Micro-VM cold start ($300-800\text{ms}$) vs warm container reuse ($5-15\text{ms}$).
  * *Distributed Objects (RMI):* ES6 Proxy stubs intercepting local calls (`driverProxy.getLocation()`) and dispatching transparently to remote RPC skeletons.
  * *Gateway Load Balancer:* Reverse proxy fronting Express instances (`:5001-5003`), Round-Robin vs Least-Connections policy, and HTTP ETag caching.
* **Subtab 3: Causality & Lamport Event Log:**
  * Causality inspector evaluating pairwise Fidge/Mattern vector clocks ($A \to B$ vs $A \parallel B$).
  * Live concurrency simulator demonstrating simultaneous UDP hazard broadcasts with verified concurrent verdict.
  * Global ordered event log sorted by Lamport timestamp ($L$).
* **Subtab 4: Raw Wire Packets:** Full scrollable stream of protocol packets with metadata.
* **Subtab 5: Reference Architecture:** Syllabus and viva master guide with concept-to-code mapping.

---

## 🎓 8-Step Viva Walkthrough (Guided Demo Mode)

Clicking the **`✨ Guided Demo`** button in the persistent top bar opens the floating tour dock, guiding examiners through all key distributed systems concepts:

| Step # | Topic / Concept | Active Tab | What to Tell the Examiner (Viva Script) | Interactive Action |
| :---: | :--- | :---: | :--- | :--- |
| **1** | **Client-Server RPC Booking & Dynamic Pricing** | `DISPATCH` | *"The customer client stub marshals coordinates into a JSON-RPC frame over TCP:9000. Notice the measured 24ms RTT and Lamport timestamp tick piggybacked on the network packet."* | Request RPC Fare Quote |
| **2** | **MOM Pub/Sub Queue & P2P UDP Gossip Mesh** | `DISPATCH` | *"MOM decouples in time and space: rides persist in the FIFO queue even if drivers drop. Meanwhile, road hazard alerts diffuse in O(log N) rounds over decentralized UDP datagrams without coordinator routing."* | Dispatch Ride & Broadcast P2P Hazard |
| **3** | **Heartbeat Failure Detection & Bully Leader Election** | `RELIABILITY` | *"Nodes maintain liveness via 1s UDP beacons. If coordinator heartbeats cease >3.5s, live drivers exchange ELECTION/OK probes and the highest-ID driver announces leadership and rebinds the service registry."* | Trigger Leader Election Walkthrough |
| **4** | **Distributed Mutual Exclusion (Airport Bay)** | `FLEET` | *"Drivers coordinate exclusive entry to Airport Bay without a central lock server. In Ricart-Agrawala, nodes with higher Lamport timestamps defer replies until exiting the critical section."* | Request Exclusive Airport Bay Entry |
| **5** | **Chandy-Lamport Snapshot & Deadlock Detection** | `RELIABILITY` | *"Chandy-Lamport captures a causally consistent cut without freezing execution using FIFO markers. Chandy-Misra-Haas uses O(1) edge-chasing probes to detect distributed deadlocks."* | Capture Chandy-Lamport Snapshot |
| **6** | **Distributed Storage (Mini-HDFS) & MapReduce** | `RECORDS` | *"Mini-HDFS replicates chunks 2x across DataNodes. MapReduce exploits data locality by dispatching compute tasks to the specific DataNodes holding the chunks, preventing network saturation."* | Submit Distributed MapReduce Job |
| **7** | **Immutable Blockchain (PoW) & Consensus Repair** | `RECORDS` | *"Each block cryptographically binds to the previous hash. When tampering is injected on Driver 2, the hash chain breaks. Majority voting (3 honest vs 1 corrupt) allows honest nodes to outvote and repair Driver 2."* | Mine PoW Block & Verify Consensus |
| **8** | **Amazon Dynamo Quorum KV Store & Read Repair** | `RECORDS` | *"When R + W > N (e.g. 2 + 2 > 3), strict quorum overlap guarantees strong consistency. Reading from a stale replica triggers asynchronous Read Repair to propagate the latest vector clock version."* | Execute Quorum Write & Read Repair |

---

## 🌐 Complete Network Port Architecture Map

| Service / Process | Port(s) | Transport | Role & Responsibilities |
| :--- | :--- | :--- | :--- |
| **Express Gateway (Reverse Proxy)** | `5000` | HTTP / WS | Web dashboard, REST API bridge, WebSocket stream, WebRTC signaling |
| **Gateway LB Backend Instances** | `5001-5003` | HTTP | Multi-instance Express backends with ETag caching |
| **Coordinator Node (RPC Skeleton)** | `9000` | TCP | Matchmaking, fare calculation, RPC skeleton |
| **MOM Message Broker** | `9100` | TCP | Persistent FIFO queues (`rides.requests`), pub/sub topics (`rides.status`) |
| **Mini-HDFS NameNode (Master)** | `9200` | TCP / Internal | Namespace metadata, chunk placement, re-replication |
| **Mini-HDFS DataNodes (1, 2, 3)** | `9301-9303` | TCP | 512-byte block storage daemons (`./data/<nodeId>/chunks/`) |
| **Serverless FaaS Runtime** | `9400` | HTTP | Micro-VM container lifecycle, cold start vs warm container reuse |
| **Distributed Object Registry (RMI)** | `9500` | TCP / Internal | Remote Object References (`obj://driver-X`), ES6 Proxy stubs |
| **Driver Object Skeletons (1, 2, 3)** | `9501-9503` | TCP | Dedicated RMI skeleton ports per driver node |
| **Blockchain Distributed Ledger** | `9600` | Internal / TCP | SHA-256 hash chaining, PoW nonce mining, majority consensus |
| **Replicated Quorum KV Store** | `9700` | Internal / TCP | Amazon Dynamo style tunable $N/R/W$, Vector Clock Read Repair |
| **Driver P2P Mesh (1, 2, 3)** | `9021-9023` | UDP Datagram | Epidemic hazard gossip overlay mesh |
| **Driver Control Sockets (1, 2, 3)** | `9031-9033` | TCP Sockets | Bully/Ring election, mutex replies, Chandy-Lamport markers |
| **Driver UDP Beacons (1, 2, 3)** | `9041-9043` | UDP Broadcast | 1-second decentralized neighbour discovery beacons |

---

## 📚 Complete Syllabus Concept to Code Mapping

### Unit 1: Introduction to Distributed Systems
* **Distribution Transparency:**
  * *Access Transparency:* Client Stub abstracts network serialization (`middleware/rpc.js`).
  * *Location Transparency:* Services looked up via `service://coordinator` (`middleware/naming.js`).
  * *Migration Transparency:* Drivers move dynamically across grid coordinates while network connections persist.
  * *Failure Transparency:* Coordinator automatically re-dispatches rides when drivers crash (`middleware/faultMonitor.js`).
* **Types of Distributed Systems:**
  * *Distributed Computing:* Parallel nearest-driver matchmaking algorithm.
  * *Distributed Information:* Multi-state transactional ride lifecycle.
  * *Distributed Pervasive Systems:* Edge vehicle nodes streaming continuous GPS telemetry.
* **Architectures:**
  * *Layered Architecture:* React UI $\rightarrow$ Express Gateway $\rightarrow$ Middleware $\rightarrow$ Distributed Nodes.
  * *Hybrid Architecture:* Centralized dispatch + decentralized P2P Driver Gossip mesh.
* **Distributed Multimedia:**
  * WebRTC voice calling + continuous real-time telemetry streaming (`public/js/WebRTCModal.jsx`).

### Unit 2: Communication
* **Fundamentals of Communication:**
  * *Synchronous:* RPC calls for instant fare quotes and booking.
  * *Asynchronous:* MOM Queues and Pub/Sub for trip updates.
* **Remote Procedure Call (RPC):**
  * Custom `RPCClientStub` and `RPCServerSkeleton` over TCP with length-prefixed JSON frames (`middleware/rpc.js`).
* **Message-Oriented Middleware (MOM):**
  * Persistent FIFO Queues + Pub/Sub Topics (`rides.status`, `driver.telemetry`) in `middleware/broker.js`.
* **Stream-Oriented Communication:**
  * High-frequency GPS telemetry stream (2.5 Hz) from drivers to UI over WebSockets.
* **Peer-to-Peer (P2P) Messaging:**
  * Driver nodes form a UDP overlay mesh (`middleware/p2pMesh.js`) gossiping road hazards without coordinator intervention.
* **WebRTC:**
  * Direct browser-to-driver audio call with live waveform visualization and DataChannel text chat.
* **Names & Fault Tolerance:**
  * Service Registry in `middleware/naming.js`.
  * Heartbeat Monitor (missed pings $>3.5\text{s}$) triggering automatic failover in `middleware/faultMonitor.js`.

### Unit 3: Synchronization
* **Logical Clocks (Lamport Timestamps):**
  * Implemented in `middleware/lamport.js`. Monotonic partial ordering ($L = \max(L_{\text{local}}, L_{\text{msg}}) + 1$).
* **Vector Clocks (Causality Tracking):**
  * Implemented in `middleware/vectorClock.js`. Detects concurrent independent events ($A \parallel B$) vs causal chains ($A \to B$).
* **Decentralized Discovery & Beacons:**
  * Implemented in `middleware/beacon.js`. 1s UDP beacons with 3s timeout expiry.
* **Leader Election (Bully & Ring):**
  * Implemented in `middleware/election.js`. Garcia-Molina Bully algorithm and Token Ring election with $2N$ complexity.
* **Distributed Mutual Exclusion:**
  * Implemented in `middleware/mutex.js`. Ricart-Agrawala ($2(N-1)$ messages, deferred replies), Token Ring, and Lodha-Kshemkalyani fair mutex.
* **Physical Clock Synchronization:**
  * Implemented in `middleware/clockSync.js`. Cristian's ($RTT/2$ delay compensation) and Berkeley multi-node average convergence.
* **Global State & Distributed Snapshot:**
  * Implemented in `middleware/snapshot.js`. Chandy-Lamport FIFO markers over TCP control ports (`9030-9033`) validating consistent cuts.
* **Distributed Deadlock Detection & Resolution:**
  * Implemented in `middleware/deadlock.js`. Chandy-Misra-Haas edge-chasing probe circulation, victim preemption, and Knapp's 4-family classification.

### Unit 4: Emerging Distributed Paradigms
* **Distributed File Systems (Mini-HDFS):**
  * Implemented in `services/dfs/nameNode.js` & `services/dfs/dataNode.js`.
  * Splits files into fixed 512-byte chunks and replicates $2\times$ across DataNodes (`:9301-9303`).
  * Resilient reads failover across surviving replicas on node crash; autonomous re-replication restores $2\times$ invariant.
* **Distributed Data Processing (MapReduce):**
  * Implemented in `services/mapreduce/mapReduceMaster.js` & `services/mapreduce/jobs.js`.
  * Master orchestrates Map (data locality over DFS chunks), Shuffle & Partition (grouping intermediate key-values), and Reduce (parallel aggregation).
* **Serverless FaaS Runtime:**
  * Implemented in `services/serverless/serverlessRuntime.js` (Port `9400`).
  * Micro-VM container lifecycle with cold-boot initialization ($300-800\text{ms}$) vs warm container reuse ($5-15\text{ms}$).
  * Auto-triggered via MOM broker topic events (`rides.status`) to execute `generateReceipt` asynchronously.
* **Distributed Objects & Remote Method Invocation (RMI):**
  * Implemented in `middleware/objectRegistry.js` (Port `9500`).
  * Remote Object References (`obj://driver-X`) wrapped via native ES6 `Proxy` stubs with full call chain visualization.
* **Gateway Load Balancer & HTTP Caching:**
  * Implemented in `services/gateway-lb/loadBalancer.js` (Port `5000`, backends `5001-5003`).
  * Round-Robin vs Least-Connections balancing, health check removal, and MD5 ETag caching (`304 Not Modified`).
* **Distributed Ledger & Blockchain (DLT):**
  * Implemented in `services/ledger/blockchainLedger.js` (Port `9600`).
  * SHA-256 hash chaining, Proof-of-Work nonce mining with `'000'` target, tamper injection, and majority consensus repair ($3 > 1$).
* **Replicated KV Store (Amazon Dynamo Quorum):**
  * Implemented in `services/kvstore/quorumKvStore.js` (Port `9700`).
  * Tunable $(N=3, R, W)$ quorum consensus, vector clock conflict resolution, automatic Read Repair, and network partition simulation.
* **Industry Architecture Mapping:**
  * Interactive Matrix mapping UrbanPulse modules to Hadoop HDFS, Kubernetes, AWS Lambda, Cloudflare Edge, and Megaport Overlays.

---

## 👥 Authors & Academic Context
* **Project:** Formative Assessment 1 (FA-1) Mini Project
* **Course:** Distributed Systems
* **Repository:** UrbanPulse Dispatch Platform
