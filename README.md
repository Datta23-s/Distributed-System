# ⚡ UrbanPulse Dispatch — Production-Oriented Uber-Style Ride-Hailing Platform & Distributed Core

> **Repository:** [https://github.com/Datta23-s/Distributed-System](https://github.com/Datta23-s/Distributed-System)  
> **Service Area:** Pune Metro, Maharashtra, India  
> **Currency:** Indian Rupee (INR ₹)  
> **Tech Stack:** Node.js (v18+), Express Gateway, Prisma ORM (SQLite / PostgreSQL), React 18, Leaflet Maps, WebSockets, WebRTC, TCP/UDP Sockets  
> **Architecture:** Full-Stack Mobility Application backed by a 30-Concept Distributed Systems Architecture  

---

## 🌟 Executive Summary & Product Architecture

**UrbanPulse Dispatch** is a real full-stack, Uber-style customer-facing ride-hailing web platform built for **Pune, Maharashtra, India**. It elevates academic distributed-systems research into an authentic, production-grade web application with three synchronized portals and a preserved engineering hub:

1. 🚗 **Customer Web Application:**
   - Interactive Leaflet Map for Pune Metro (Shivajinagar, Hinjewadi, Koregaon Park, Pune Airport PNQ, Swargate, Kothrud, Baner, Kharadi).
   - Real-time address autocomplete & reverse geocoding.
   - Dynamic server-side fare quotes for 4 vehicle categories (**UrbanPulse Moto**, **Pune Auto Rickshaw**, **UrbanPulse Go**, and **UrbanPulse Premier**).
   - Atomic ride booking with unique reference numbers (e.g. `UP-PUN-72819`).
   - Secure 4-digit **Trip PIN** verification before ride start.
   - Real-time vehicle telemetry and driver tracking on Leaflet map.
   - Itemized receipts (Base fare, distance rate, platform fees, 5% GST).
   - 5-Star driver rating and review submission.
   - Safety emergency panel (Pune Police 112, Women's Helpline 1091, Ambulance 108).

2. 🚕 **Driver Web Portal:**
   - Multi-persona switching (Rajesh Patil - Swift Dzire Cab, Santosh Jadhav - Bajaj Auto, Vikram Deshmukh - Splendor Bike).
   - Online / Offline availability toggle (`AVAILABLE` $\leftrightarrow$ `OFFLINE`).
   - Incoming ride request offer modal with real-time 30-second countdown bar.
   - Dispatch workflow: "En Route to Pickup" $\rightarrow$ "Arrived at Pickup" $\rightarrow$ 4-Digit Passenger PIN Verification $\rightarrow$ "Start Journey" $\rightarrow$ "Complete Journey".
   - Driver Earnings Dashboard with lifetime revenue in ₹, trip counters, and ride history ledger.

3. 📊 **Admin & Dispatch Operations Dashboard:**
   - Real-time operational KPI cards: Active Rides, Completed Trips, Cancelled Rides, Fleet Online, and Total Revenue in INR ₹.
   - Live Ride Monitoring & Search Table with status filtering.
   - Fleet Drivers Table with vehicle plate, license number, and approval status.
   - Dynamic Pricing & Surge Configuration editor with instant database persistence.
   - Passenger Support & Incident Tickets table with status resolution toggle.

4. 🔬 **Academic Systems Inspector (30 Live Concepts):**
   - 100% preservation of all 30 distributed-systems algorithms:
     - **Unit 1:** RPC Client/Skeleton, MOM Persistent Queues & Topic Pub/Sub, P2P UDP Gossip mesh, Heartbeat Failure Detector.
     - **Unit 3:** Lamport Logical Clocks, Vector Clocks, Decentralized UDP Beacons, Bully Leader Election, Ring Election, Ricart-Agrawala Mutual Exclusion, Cristian & Berkeley Physical Clock Sync, Chandy-Lamport Snapshots, Chandy-Misra-Haas Deadlock Detection.
     - **Unit 4:** Mini-HDFS Distributed Storage (NameNode + DataNodes), Distributed MapReduce, Serverless FaaS Runtime, Remote Object Registry (RMI), Gateway Load Balancer, Blockchain PoW Ledger, Dynamo Tunable Quorum KV Store.
     - **Unit 4 Advanced:** OpenTelemetry Tracing, Hystrix Circuit Breakers, CQRS & Event Sourcing, Token Bucket Rate Limiting, 2D R-Tree Geo-Spatial Indexing, Redis-Compatible Cache, gRPC Protocol Buffers Sidecar, and Chaos Monkey Fault Injection.

---

## 🗄️ Database Design & Models (Prisma ORM)

Persistent application records are managed through **Prisma ORM** with SQLite (`prisma/dev.db`) for immediate zero-config local runs on Windows, and seamless PostgreSQL compatibility for Docker deployments:

* **User**: Customer, Driver, and Admin credentials with salted bcrypt password hashing.
* **CustomerProfile**: Emergency contact name/phone, rider rating, total rides.
* **DriverProfile**: License number, status (`AVAILABLE`, `RESERVED`, `ON_TRIP`, `OFFLINE`), rating, total trips, lifetime earnings.
* **Vehicle**: Make, model, category (`BIKE`, `AUTO`, `ECONOMY`, `PREMIUM`), license plate, color, capacity, approval status.
* **FareConfiguration**: Configurable base fare, per km rate, per minute rate, minimum fare, cancellation fee, surge multiplier.
* **FareQuote**: Durable quotes with 15-minute expiration timestamp and fare breakdown.
* **Ride**: Authoritative state machine (`REQUESTED`, `SEARCHING`, `DRIVER_ASSIGNED`, `DRIVER_ARRIVING`, `DRIVER_ARRIVED`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`, `NO_DRIVER_AVAILABLE`), 4-digit numeric `tripPin`.
* **RideAssignment**: Atomic offers, accept/reject logs, 30s timeout timestamps.
* **RideStatusEvent**: Traceable audit log of every state change and transition timestamp.
* **Payment**: Cash and sandbox transactions with transaction reference codes.
* **Rating**: 1-to-5 star scores and textual feedback.
* **SupportTicket**: Categorized incident reports (`SAFETY_CONCERN`, `FARE_ISSUE`, `LOST_ITEM`).
* **IdempotencyRecord**: Cryptographic duplicate-request prevention.

---

## 🔑 Pre-Seeded Demo Accounts

The database includes pre-configured Pune demo accounts (Password for all: `Password@123`):

| Persona | Email | Role | Vehicle / Details |
|---|---|---|---|
| **Customer** | `customer@urbanpulse.in` | `CUSTOMER` | Aarav Sharma (FC Road, Shivajinagar, Pune) |
| **Driver 1 (Cab)** | `driver1@urbanpulse.in` | `DRIVER` | Rajesh Patil — Maruti Swift Dzire (`MH 12 QX 4501`) |
| **Driver 2 (Auto)** | `driver2@urbanpulse.in` | `DRIVER` | Santosh Jadhav — Bajaj RE Compact (`MH 12 AB 8821`) |
| **Driver 3 (Bike)** | `driver3@urbanpulse.in` | `DRIVER` | Vikram Deshmukh — Hero Splendor (`MH 14 BK 1902`) |
| **Admin** | `admin@urbanpulse.in` | `ADMIN` | Operations Dispatcher (Full administrative control) |

---

## 🚀 Windows PowerShell Commands

### 1. Install Dependencies
```powershell
npm install
```

### 2. Push Database Schema & Seed Data
```powershell
npx prisma db push
npm run seed
```

### 3. Run Automated Tests (46 Tests — 100% Pass)
```powershell
# Run API v1 ride-hailing tests
npm run test:api

# Run distributed systems concept tests
npm test

# Run ALL 46 tests
npm run test:all
```

### 4. Start the Application
```powershell
npm start
```
Open your browser at:
👉 **`http://localhost:5000`**

---

## 🔌 API v1 Endpoints Reference

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `POST` | `/api/v1/auth/register` | Register new customer or driver | None |
| `POST` | `/api/v1/auth/login` | Login and receive JWT token | None |
| `GET` | `/api/v1/auth/me` | Fetch authenticated session profile | Bearer Token |
| `GET` | `/api/v1/maps/search?q=...` | Search Pune landmarks & addresses | None |
| `POST` | `/api/v1/maps/route` | Calculate road distance, duration & polyline | None |
| `POST` | `/api/v1/fares/quote` | Generate vehicle quotes in INR (₹) | None |
| `POST` | `/api/v1/rides/book` | Create persistent ride & trigger dispatch | Customer Token |
| `GET` | `/api/v1/rides/active` | Get customer's current active ride | Customer Token |
| `POST` | `/api/v1/rides/:id/cancel` | Cancel ride with reason | Customer Token |
| `POST` | `/api/v1/rides/:id/rate` | Submit 5-star driver review | Customer Token |
| `GET` | `/api/v1/driver/profile` | Driver profile & vehicle info | Driver Token |
| `POST` | `/api/v1/driver/status` | Toggle status (`AVAILABLE` / `OFFLINE`) | Driver Token |
| `GET` | `/api/v1/driver/offers` | Get pending ride offer (30s window) | Driver Token |
| `POST` | `/api/v1/driver/assignments/:id/accept` | Atomically accept offer | Driver Token |
| `POST` | `/api/v1/driver/rides/:id/arrived` | Mark arrived at pickup location | Driver Token |
| `POST` | `/api/v1/driver/rides/:id/verify-pin` | Verify 4-digit passenger PIN & start | Driver Token |
| `POST` | `/api/v1/driver/rides/:id/complete` | Complete ride & generate receipt | Driver Token |
| `GET` | `/api/v1/admin/overview` | Live metrics & revenue in INR | Admin Token |
| `GET` | `/api/v1/admin/rides` | Live rides table with status filters | Admin Token |
| `PUT` | `/api/v1/admin/fares/:id` | Update vehicle base fare & surge | Admin Token |
| `GET` | `/api/v1/admin/health` | System health & circuit breaker status | Admin Token |

---

## 🐳 Docker Deployment

To build and run the multi-node distributed topology inside Docker containers:
```powershell
docker-compose -f deploy/docker-compose.yml up --build
```
This deploys the Coordinator, 3 Driver nodes, Serverless FaaS, and Express Gateway on an isolated bridge network (`172.28.0.0/16`).

---

## 🧪 Verification & Test Results

* **Distributed Systems Tests:** 30 / 30 Passed (`test/test_distributed.js`)
* **Ride-Hailing API v1 Tests:** 16 / 16 Passed (`test/test_api_v1.js`)
* **Total Passing Tests:** **46 / 46 (0 Failures)**
