# MoveInSync Server

This is the backend server for the MoveInSync application, built with Node.js, Express, TypeScript, and Prisma ORM.

## Setup and Run


## API Endpoints

### 1. Root and Health Checks

* **GET `/`**
  Check if the server is running.
  **Response:** \`200 OK\`
  \`\`\`json
  {
      "message": "Hello World"
  }
  \`\`\`

* **GET `/test-health`**
  Check the database connection health.
  **Response:** \`200 OK\`
  \`\`\`json
  {
      "message": "Database is working",
      "time": "2026-02-22T..."
  }
  \`\`\`

### 2. Authentication

* **POST `/auth/register`**
  Registers a new user and sends a 6-digit OTP to their email for verification. 
  
  **Headers:** \`Content-Type: application/json\`
  **Request Body:**
  \`\`\`json
  {
    "email": "user@example.com",
    "password": "yourpassword",
    "name": "John Doe"
  }
  \`\`\`
  
  **Response:** \`201 Created\`
  \`\`\`json
  {
    "message": "OTP sent to email",
    "userId": 1
  }
  \`\`\`

* **POST `/auth/verify`**
  Verifies the user's account using the OTP sent to their email. The OTP is valid for 10 minutes.
  
  **Headers:** \`Content-Type: application/json\`
  **Request Body:**
  \`\`\`json
  {
    "email": "user@example.com",
    "otp": "123456" 
  }
  \`\`\`
  
  **Response:** \`200 OK\`
  \`\`\`json
  {
    "message": "Account verified!",
    "user": {
        "id": 1,
        "email": "user@example.com",
        "name": "John Doe",
        "isVerified": true,
        "...": "..."
    }
  }
  \`\`\`

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
        "id": "12345-abcde",
        "email": "user@example.com",
        "name": "John Doe"
    }
  }
  ```
