# MoveInSync Server

This is the backend server for the MoveInSync application, built with Node.js, Express, TypeScript, and Prisma ORM.

## Setup and Run


## API Endpoints

### 1. Root and Health Checks

* **GET `/`**
  Check if the server is running.
  **Response:** `200 OK`
  ```json
  {
      "message": "Hello World"
  }
  ```

* **GET `/test-health`**
  Check the database connection health.
  **Response:** `200 OK`
  ```json
  {
      "message": "Database is working",
      "time": "2026-02-22T..."
  }
  ```

### 2. Authentication

* **POST `/auth/register`**
  Registers a new user and sends a 6-digit OTP to their email for verification. 
  
  **Headers:** `Content-Type: application/json`
  **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword",
    "name": "John Doe"
  }
  ```
  
  **Response:** `201 Created`
  ```json
  {
    "message": "OTP sent to email",
    "userId": "uuid-here"
  }
  ```

* **POST `/auth/verify`**
  Verifies the user's account using the OTP sent to their email. The OTP is valid for 10 minutes.
  
  **Headers:** `Content-Type: application/json`
  **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "otp": "123456" 
  }
  ```
  
  **Response:** `200 OK`
  ```json
  {
    "message": "Account verified!",
    "user": {
        "id": "uuid-here",
        "email": "user@example.com",
        "name": "John Doe",
        "isVerified": true
    }
  }
  ```

* **POST `/auth/login`**
  Logs in an existing, verified user and returns a JSON Web Token (JWT) for authentication.
  
  **Headers:** `Content-Type: application/json`
  **Request Body:**
  ```json
  {
    "email": "user@example.com",
    "password": "yourpassword"
  }
  ```
  
  **Response:** `200 OK`
  ```json
  {
    "message": "Login successful",
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI...",
    "user": {
        "id": "uuid-here",
        "email": "user@example.com",
        "name": "John Doe"
    }
  }
  ```

---

### 3. Metro Admin API — Stops

> **Auth Required:** All metro endpoints require `Authorization: Bearer <JWT>` header with an **ADMIN** role user.

* **POST `/metro/stops`**
  Create a new metro stop.

  **Request Body:**
  ```json
  {
    "name": "Rajiv Chowk"
  }
  ```

  **Response:** `201 Created`
  ```json
  {
    "message": "Stop created successfully",
    "stop": {
      "id": "a1b2c3d4-...",
      "name": "Rajiv Chowk",
      "createdAt": "2026-02-23T..."
    }
  }
  ```

* **GET `/metro/stops`**
  List all stops with their route memberships.

  **Response:** `200 OK`
  ```json
  {
    "stops": [
      {
        "id": "a1b2c3d4-...",
        "name": "Rajiv Chowk",
        "createdAt": "2026-02-23T...",
        "routes": [
          {
            "sequenceOrder": 16,
            "route": { "id": "r1...", "name": "Yellow Line", "color": "#FFD700" }
          },
          {
            "sequenceOrder": 29,
            "route": { "id": "r2...", "name": "Blue Line", "color": "#0000FF" }
          }
        ]
      }
    ]
  }
  ```

* **GET `/metro/stops/:id`**
  Get a single stop by ID.

  **Response:** `200 OK` — Same structure as a single item from the list above.

  **Error:** `404` if stop not found.

* **PUT `/metro/stops/:id`**
  Update a stop's name.

  **Request Body:**
  ```json
  {
    "name": "Rajiv Chowk (Renamed)"
  }
  ```

  **Response:** `200 OK`
  ```json
  {
    "message": "Stop updated successfully",
    "stop": {
      "id": "a1b2c3d4-...",
      "name": "Rajiv Chowk (Renamed)",
      "createdAt": "..."
    }
  }
  ```

* **DELETE `/metro/stops/:id`**
  Delete a stop (cascades to RouteStop mappings).

  **Response:** `200 OK`
  ```json
  {
    "message": "Stop deleted successfully"
  }
  ```

---

### 4. Metro Admin API — Routes (Metro Lines)

* **POST `/metro/routes`**
  Create a new metro line with an ordered list of stop IDs.

  **Request Body:**
  ```json
  {
    "name": "Yellow Line",
    "color": "#FFD700",
    "stopIds": ["<stop-uuid-1>", "<stop-uuid-2>", "<stop-uuid-3>"]
  }
  ```

  **Response:** `201 Created`
  ```json
  {
    "message": "Route created successfully",
    "route": {
      "id": "r1...",
      "name": "Yellow Line",
      "color": "#FFD700",
      "createdAt": "2026-02-23T...",
      "stops": [
        {
          "sequenceOrder": 1,
          "stop": { "id": "...", "name": "Samaypur Badli", "createdAt": "..." }
        },
        {
          "sequenceOrder": 2,
          "stop": { "id": "...", "name": "Rajiv Chowk", "createdAt": "..." }
        }
      ]
    }
  }
  ```

* **GET `/metro/routes`**
  List all routes with their ordered stops.

  **Response:** `200 OK`
  ```json
  {
    "routes": [
      {
        "id": "r1...",
        "name": "Yellow Line",
        "color": "#FFD700",
        "stops": [
          { "sequenceOrder": 1, "stop": { "id": "...", "name": "Samaypur Badli" } },
          { "sequenceOrder": 2, "stop": { "id": "...", "name": "Rohini Sector 18-19" } }
        ]
      }
    ]
  }
  ```

* **GET `/metro/routes/:id`**
  Get a single route by ID with ordered stops.

  **Response:** `200 OK` — Same structure as a single item from the list above.

  **Error:** `404` if route not found.

* **PUT `/metro/routes/:id`**
  Update a route's name, color, and/or reorder stops. At least one field required.

  **Request Body:**
  ```json
  {
    "name": "Yellow Line (Updated)",
    "color": "#FFEA00",
    "stopIds": ["<stop-uuid-3>", "<stop-uuid-1>", "<stop-uuid-2>"]
  }
  ```

  **Response:** `200 OK`
  ```json
  {
    "message": "Route updated successfully",
    "route": { "...": "..." }
  }
  ```

* **DELETE `/metro/routes/:id`**
  Delete a route (cascades to RouteStop mappings).

  **Response:** `200 OK`
  ```json
  {
    "message": "Route deleted successfully"
  }
  ```

---

### 5. Bulk Import

* **POST `/metro/bulk-import`**
  Import multiple stops and routes at once using stop **names** (not IDs). Stops are upserted (created if new, skipped if existing). Routes are created or updated. Safe to re-run.

  **Request Body:**
  ```json
  {
    "stops": ["Rajiv Chowk", "Kashmere Gate", "Chandni Chowk", "New Delhi"],
    "routes": [
      {
        "name": "Yellow Line",
        "color": "#FFD700",
        "stops": ["Rajiv Chowk", "Chandni Chowk", "Kashmere Gate"]
      },
      {
        "name": "Blue Line",
        "color": "#0000FF",
        "stops": ["Rajiv Chowk", "New Delhi"]
      }
    ]
  }
  ```

  **Response:** `201 Created`
  ```json
  {
    "message": "Bulk import successful",
    "stopsCreated": 4,
    "routesCreated": 2,
    "stops": [
      { "id": "...", "name": "Rajiv Chowk" },
      { "id": "...", "name": "Kashmere Gate" },
      { "id": "...", "name": "Chandni Chowk" },
      { "id": "...", "name": "New Delhi" }
    ],
    "routes": [
      { "id": "...", "name": "Yellow Line", "color": "#FFD700" },
      { "id": "...", "name": "Blue Line", "color": "#0000FF" }
    ]
  }
  ```

  > **Note:** A full Delhi Metro seed dataset is available in `seed-data.json` at the project root. Stops appearing in multiple routes (e.g., Rajiv Chowk in Yellow + Blue line) are automatically identified as **interchange stations**.

---

### 6. Route Finding (Graph-Based)

> **Auth Required:** `Authorization: Bearer <JWT>` — any authenticated user (no admin needed).

The metro graph is built **once** on server startup and cached in memory. Route computation uses Dijkstra's algorithm with interchange penalties.

* **GET `/metro/find-route?from=<stopId>&to=<stopId>&strategy=<strategy>`**
  Find the optimal route between two stops.

  **Query Parameters:**
  | Param | Required | Description |
  |-------|----------|-------------|
  | `from` | Yes | Source stop UUID |
  | `to` | Yes | Destination stop UUID |
  | `strategy` | No | `minimum_stops`, `minimum_transfers`, or `balanced` (default) |

  **Strategy Behavior:**
  | Strategy | What it optimizes |
  |----------|-------------------|
  | `minimum_stops` | Fewest total stations (ignores transfers) |
  | `minimum_transfers` | Avoids line changes even if more stops |
  | `balanced` | Best mix of fewer stops + fewer transfers |

  **Example Request:**
  ```
  GET http://localhost:3000/metro/find-route?from=d695fbb3-2b86-48fc-b46d-6b09bc66d936&to=1d29c982-eb36-48c3-a32b-4f1be1477dde&strategy=minimum_transfers
  ```

  **Response:** `200 OK`
  ```json
  {
    "strategy": "minimum_transfers",
    "route": {
      "source": "Adarsh Nagar",
      "destination": "Akshardham",
      "totalStops": 18,
      "totalTransfers": 1,
      "segments": [
        {
          "line": {
            "id": "1b9f55f3-d8c0-4a0f-b94a-8cda1123293c",
            "name": "Yellow Line",
            "color": "#FFD700"
          },
          "from": "Adarsh Nagar",
          "to": "Rajiv Chowk",
          "stops": [
            "Adarsh Nagar", "Azadpur", "Model Town", "GTB Nagar",
            "Vishwavidyalaya", "Vidhan Sabha", "Civil Lines",
            "Kashmere Gate", "Chandni Chowk", "Chawri Bazar",
            "New Delhi", "Rajiv Chowk"
          ],
          "stopCount": 12
        },
        {
          "interchange": "Barakhamba Road",
          "fromLine": "Yellow Line",
          "toLine": "Blue Line"
        },
        {
          "line": {
            "id": "3246e8aa-94c6-4e5b-94ff-7c554dc206ea",
            "name": "Blue Line",
            "color": "#0000FF"
          },
          "from": "Barakhamba Road",
          "to": "Akshardham",
          "stops": [
            "Barakhamba Road", "Mandi House", "Pragati Maidan",
            "Indraprastha", "Yamuna Bank", "Akshardham"
          ],
          "stopCount": 6
        }
      ]
    }
  }
  ```

  **No path found response:** `200 OK`
  ```json
  {
    "path": null,
    "message": "No route found between \"Stop A\" and \"Stop B\""
  }
  ```

---

### 7. Graph Management (Admin Only)

* **POST `/metro/refresh-graph`**
  Rebuild the in-memory metro graph from the database. Call this after adding/removing stops or routes via the admin APIs.

  **Response:** `200 OK`
  ```json
  {
    "message": "Metro graph rebuilt successfully"
  }
  ```

  > **Note:** The graph is automatically built on server startup. You only need this endpoint if you modify metro data while the server is running.

---

### 8. Booking Service

> **Auth Required:** `Authorization: Bearer <JWT>` — any authenticated user.

Bookings auto-expire after **24 hours** (like DMRC). Status flow: `CONFIRMED → EXPIRED` (auto) or `CONFIRMED → CANCELLED` (manual).

* **POST `/booking/create`**
  Create a booking between two stops. System finds the optimal route, saves it, and generates a tamper-resistant QR string.

  **Request Body:**
  ```json
  {
    "sourceStopId": "d695fbb3-2b86-48fc-b46d-6b09bc66d936",
    "destinationStopId": "1d29c982-eb36-48c3-a32b-4f1be1477dde",
    "strategy": "balanced"
  }
  ```

  **Response:** `201 Created`
  ```json
  {
    "message": "Booking created successfully",
    "booking": {
      "id": "26f8202d-b96c-4e11-a83a-e8ccaee01323",
      "userId": "...",
      "sourceStopId": "...",
      "destinationStopId": "...",
      "qrString": "MIS_26f8202d-b96c-4e11-a83a-e8ccaee01323_a1b2c3...",
      "routeDetails": {
        "source": "Adarsh Nagar",
        "destination": "Akshardham",
        "totalStops": 18,
        "totalTransfers": 1,
        "segments": [ "..." ]
      },
      "status": "CONFIRMED",
      "expiresAt": "2026-02-24T04:00:00.000Z",
      "createdAt": "2026-02-23T04:00:00.000Z",
      "sourceStop": { "id": "...", "name": "Adarsh Nagar" },
      "destinationStop": { "id": "...", "name": "Akshardham" }
    }
  }
  ```

  > If no route exists between the stops, returns `400` and **no booking is created**.

* **GET `/booking/my-bookings`**
  List all bookings for the current user (newest first). Expired bookings are auto-marked.

  **Response:** `200 OK`
  ```json
  {
    "bookings": [ { "...booking objects..." } ]
  }
  ```

* **GET `/booking/:id`**
  Get a specific booking. Users can only see their own bookings.

  **Response:** `200 OK` — Same structure as the booking object above.

* **GET `/booking/:id/qr-image`**
  Returns the actual QR code as a **PNG image** (300×300px). In Postman you'll see the image directly in the response.

  ```
  GET http://localhost:3000/booking/26f8202d-b96c-4e11-a83a-e8ccaee01323/qr-image
  ```

  **Response:** `200 OK` with `Content-Type: image/png`

* **POST `/booking/:id/cancel`**
  Cancel a confirmed booking. Users can only cancel their own bookings.

  **Response:** `200 OK`
  ```json
  {
    "message": "Booking cancelled successfully",
    "booking": { "status": "CANCELLED", "..." : "..." }
  }
  ```

* **POST `/booking/validate-qr`**
  Validate a QR string. Checks HMAC signature to detect tampering, and checks booking status/expiry.

  **Request Body:**
  ```json
  {
    "qrString": "MIS_26f8202d-b96c-4e11-a83a-e8ccaee01323_a1b2c3..."
  }
  ```

  **Valid ticket response:**
  ```json
  {
    "valid": true,
    "message": "Valid ticket",
    "booking": { "..." : "..." }
  }
  ```

  **Tampered QR response:**
  ```json
  {
    "valid": false,
    "message": "QR string has been tampered with"
  }
  ```

  **Expired/Cancelled response:**
  ```json
  {
    "valid": false,
    "message": "Booking has expired"
  }
  ```

---

### Error Responses

| Status | Meaning | Example Cause |
|--------|---------|---------------|
| `400` | Bad request | Missing fields, same source & dest, no route, already cancelled |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Accessing another user's booking, non-admin on admin endpoints |
| `404` | Not found | Stop, route, or booking ID doesn't exist |
| `409` | Conflict | Duplicate stop name or route name |
| `500` | Internal server error | Unexpected server error |
| `503` | Service unavailable | Metro graph not loaded yet |

