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

### Error Responses

| Status | Meaning | Example Cause |
|--------|---------|---------------|
| `400` | Bad request | Missing required fields, invalid stop IDs |
| `401` | Unauthorized | Missing or invalid JWT token |
| `403` | Forbidden | Non-admin user accessing admin endpoints |
| `404` | Not found | Stop or route ID doesn't exist |
| `409` | Conflict | Duplicate stop name or route name |
| `500` | Internal server error | Unexpected server error |
