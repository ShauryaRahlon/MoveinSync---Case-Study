# Metro Booking Service (MoveInSync Case Study)

This repository contains the full-stack implementation of a Metro Booking Service case study. The application provides a comprehensive solution for managing metro routes, finding optimal paths between stations, booking tickets, and verifying them securely via QR codes.

## Final Objectives Achieved (As Asked in the Case Study)

The application successfully met **100% (6/6)** of the stated final objectives:

1.  ✅ **Model the metro network as a graph:** Implemented in `Server/src/services/graph.ts` using an adjacency list where stations are nodes and lines/transfers are edges.
2.  ✅ **Compute optimal routes with proper interchange handling:** Accomplished using a customized **Dijkstra's Algorithm** with configurable penalty weights for transfers vs. stops (Minimum Stops, Minimum Transfers, and Balanced strategies). 
3.  ✅ **Support direct and multi-line journeys:** The routing algorithm inherently resolves direct paths and complex multi-line paths with precise transfer points documented.
4.  ✅ **Prevent booking creation when no path exists:** The `/booking/create` endpoint validates the pathfinding result and returns a `400 Bad Request` if no connectivity exists between the source and destination.
5.  ✅ **Generate a unique QR-compatible string per booking:** Handled by securely hashing the booking ID via an `HMAC-SHA256` signature, creating a tamper-resistant QR payload that is validated at simulated station scanners.
6.  ✅ **Operate entirely on internally managed metro data:** The backend is fully self-sufficient with an Admin API suite (`/metro/stops`, `/metro/routes`, `/metro/bulk-import`) strictly managing its PostgreSQL dataset populated initially via `seed-data.json`.

## Tech Stack

**Frontend**
*   **React** (with Vite)
*   **TypeScript**
*   **React Router DOM**
*   **Vanilla CSS**

**Backend & Infrastructure**
*   **Node.js & Express**
*   **TypeScript**
*   **PostgreSQL** (Hosted on Supabase)
*   **Prisma ORM**
*   **Redis** (Hosted on Upstash)
*   **JSON Web Tokens (JWT)** & **bcrypt**
*   **Nodemailer**

## OOP and SOLID Principles

This project leverages Object-Oriented Programming (OOP) and SOLID design principles to ensure a scalable, maintainable, and robust codebase.

### Object-Oriented Programming (OOP)
*   **Encapsulation:** In the frontend, React components encapsulate their isolated state and UI rendering logic. In the backend, data structures like the `MinHeap` class in the graph service hide internal state arrays (`private h: DijkstraState[]`) and expose only necessary public methods (`push()`, `pop()`, `size`).
*   **Abstraction:** The backend heavily utilizes Prisma ORM to abstract away raw SQL queries, allowing the application logic to interact with TypeScript objects and classes (`prisma.user.findUnique()`) rather than managing database connections directly.

### SOLID Principles
*   **Single Responsibility Principle (SRP):** The codebase is strictly modularized. Routes handle only HTTP request/response parsing (e.g., `routes/auth.ts`), services handle pure business logic and algorithms (e.g., `services/graph.ts`), and utilities handle isolated tasks (e.g., `utils/mailer.ts`).
*   **Open/Closed Principle (OCP):** The graph pathfinding algorithm uses an `OptimizationStrategy` enum (e.g., Minimum Stops, Minimum Transfers, Balanced). New routing behaviors can be added by simply expanding the enum and its corresponding cost object without modifying the core Dijkstra's traversal logic.
*   **Dependency Inversion Principle (DIP):** The Express controllers do not instantiate database connections directly. Instead, they depend on an exported, configured `prisma` client instance (`src/db.ts`). This allows the underlying database adapter to be swapped or mocked for testing without altering the route logic.

## System Architecture

The project follows a modern client-server architecture, decoupled into a frontend web application and a backend RESTful API service.

### Components

1.  **Frontend (Client)**
    *   **Framework:** React with Vite and TypeScript.
    *   **State Management:** React Context API for global state (Authentication, Toasts).
    *   **Routing:** React Router DOM (protected and public routes).
    *   **Styling:** Custom Vanilla CSS.
    *   **Role:** Provides the user interface for passengers to book tickets, view past bookings, and handle authentication. It communicates exclusively with the backend REST APIs.

2.  **Backend (Server)**
    *   **Framework:** Node.js with Express and TypeScript.
    *   **Authentication:** JSON Web Tokens (JWT) for stateless session management and Role-Based Access Control (Admin vs. User).
    *   **Security & Hashing:** bcrypt for password hashing, HMAC-SHA256 for tampering detection in QR codes.
    *   **Email Service:** Nodemailer for dispatching OTPs during user registration.
    *   **Role:** Handles business logic, pathfinding algorithms, authentication, and acts as the interface to the database and caching layers.

3.  **Database Layer**
    *   **Database:** PostgreSQL (hosted on Supabase).
    *   **ORM:** Prisma ORM for type-safe database access, schema definition, and migrations.
    *   **Schema Design:**
        *   `User`: Manages user credentials, roles, and OTP verification logic.
        *   `Stop` & `Route`: Represents metro stations and metro lines.
        *   `RouteStop`: A junction table managing the many-to-many relationship and tracking the sequence/order of stops within a specific line.
        *   `Booking`: Records generated tickets, timestamps, expiry, and associated QR validation strings.

4.  **Caching Layer**
    *   **Service:** Redis (hosted on Upstash).
    *   **Purpose:** The calculation of optimal routes using graph algorithms can be computationally expensive. Redis is used to cache the results of frequent queries (e.g., routing between two heavily trafficked stations), significantly reducing response times from 1-5ms (Dijkstra's execution) to <0.1ms (Cache hit).

## Core Systems and Algorithms

### 1. In-Memory Graph and Pathfinding Protocol
The core of the metro system is a graph data structure built and cached in-memory during server startup (`src/services/graph.ts`). 
*   **Nodes:** Metro Stops.
*   **Edges:** Connections between adjacent stops on the same line, and interchange edges representing transfers between lines at the same station.
*   **Algorithm:** Dijkstra's Algorithm.
*   **Routing Strategies:**
    *   *Minimum Stops:* Edge weights are heavily skewed to penalize traversing nodes, optimizing for the shortest physical distance.
    *   *Minimum Transfers:* Interchange edges are penalized heavily, optimizing for the fewest line changes.
    *   *Balanced (Default):* A tuned algorithm that provides a practical mix of low stops and minimal transfers.

### 2. Secure Ticketing and QR Validation
When a user books a ticket, the system generates a secure ticket string containing the Booking ID and context. 
*   **Tamper Resistance:** The booking data is hashed using an HMAC-SHA256 signature with a secret key. This ensures that if a user attempts to manually alter the QR code payload to bypass validation or change the destination, the validation endpoint (`/booking/validate-qr`) will instantly reject it.
*   **Ticket Expiry:** Bookings auto-expire 24 hours after creation, enforced via database timestamp comparisons during verification.

### 3. Asynchronous Operations & OTP Verifications
User registration follows a decoupled verification pattern. Upon registration, users are marked as `isVerified: false`. An asynchronous operation triggers a Nodemailer service to dispatch a 6-digit OTP mapping to their account, valid for 10 minutes. Only upon successful verification does the system grant login authorization.

## Folder Structure

```
├── Client/                 # React Frontend Interface
│   ├── src/
│   │   ├── pages/          # Core views (Login, Register, Dashboard, Book)
│   │   ├── api.ts          # Axios interceptors and API definitions
│   │   ├── auth.tsx        # JWT and LocalStorage Context Management
│   │   └── ...
│   └── .env                # Client environment configurations
│
├── Server/                 # Express Backend Service
│   ├── prisma/             # Schema definitions and migrations
│   ├── src/
│   │   ├── routes/         # Express routers (auth, metro, booking)
│   │   ├── services/       # Core business logic (Graph Builder, Routing)
│   │   ├── utils/          # Helpers (Mailer, Logger)
│   │   └── index.ts        # Server entry point
│   ├── seed-data.json      # Complete DMRC metro dataset for bulk import
│   └── .env                # Server properties, Redis URL, DB connection strings
│
└── Readme.md               # This documentation file
```

## Running the Project Locally

### Prerequisites
*   Node.js (v18+)
*   Running PostgreSQL & Redis instances (or use the provided hosted `.env` configurations)

### Setup

1. **Backend Initialization**
   Navigate to the Server directory, install dependencies, and run migrations.
   ```bash
   cd Server
   npm install
   npx prisma generate
   npx prisma db push
   npm run dev
   ```

2. **Frontend Initialization**
   Open a new terminal to start the client locally.
   ```bash
   cd Client
   npm install
   npm run dev
   ```

## REST API Endpoints

The backend exposes the following REST APIs. For a detailed breakdown of request/response bodies, refer to `Server/README.md`.

### 1. Root & Health
*   **`GET /`** - Root status check.
*   **`GET /test-health`** - Evaluates database connection health.

### 2. Authentication
*   **`POST /auth/register`** - Registers a new user and sends an OTP to their email.
*   **`POST /auth/verify`** - Verifies a user's account using the emailed OTP.
*   **`POST /auth/login`** - Authenticates a verified user and returns a JWT.

### 3. Metro Admin API (Stops)
*(Requires `Authorization: Bearer <JWT>` with ADMIN role)*
*   **`POST /metro/stops`** - Create a new metro stop.
*   **`GET /metro/stops`** - Retrieve all stops and their route memberships.
*   **`GET /metro/stops/:id`** - Get details for a specific stop.
*   **`PUT /metro/stops/:id`** - Update a stop's details (e.g., name).
*   **`DELETE /metro/stops/:id`** - Delete a stop.

### 4. Metro Admin API (Routes/Lines)
*(Requires `Authorization: Bearer <JWT>` with ADMIN role)*
*   **`POST /metro/routes`** - Create a new metro line (requires ordered list of stop IDs).
*   **`GET /metro/routes`** - List all routes and their sequenced stops.
*   **`GET /metro/routes/:id`** - Get a single route's details.
*   **`PUT /metro/routes/:id`** - Update a route's name, color, or stop order.
*   **`DELETE /metro/routes/:id`** - Delete a route.

### 5. Bulk Management
*   **`POST /metro/bulk-import`** - Import multiple stops and routes simultaneously using names. Stops are upserted.
*   **`POST /metro/refresh-graph`** - Rebuild the in-memory routing graph. Required if routes/stops are modified while the server is running.

### 6. Booking & Routing
*(Requires `Authorization: Bearer <JWT>` with any user role)*
*   **`GET /metro/find-route`** - Query optimal route between stops using `minimum_stops`, `minimum_transfers`, or `balanced` strategy.
*   **`POST /booking/create`** - Create a booking/ticket between two stops.
*   **`GET /booking/my-bookings`** - List all bookings belonging to the user.
*   **`GET /booking/:id`** - Get details of a specific booking.
*   **`GET /booking/:id/qr-image`** - Returns the generated PNG QR Code for the booking.
*   **`POST /booking/:id/cancel`** - Cancel a confirmed ticket.
*   **`POST /booking/validate-qr`** - Validate a ticket's payload to ensure integrity and calculate expiry status.
