# OmniTech AI Agent Powerhouse: Production Implementation Guide

## 1. Introduction

Welcome to your private guide for deploying the OmniTech AI Agent Powerhouse. This document provides the complete roadmap to transform the application prototype into a fully operational, revenue-generating tool for both outbound sales and inbound support.

Following this guide will enable you to:
-   **Activate Live AI Calling:** Connect the AI agent to a real phone number to make and receive calls.
-   **Build a Secure Backend:** Create the necessary infrastructure to manage your data and integrate with third-party services securely.
-   **Deploy the Application:** Host the dashboard on the web for your team to access from anywhere.
-   **Take Full Control:** Implement and own the entire system within your business operations.

---
## 2. System Architecture Overview

The complete system consists of three main components that work together:

1.  **Frontend Application (This Project):** The React-based user interface your team will use. It handles displaying prospects, initiating actions, and showing call transcripts.

2.  **Backend Service (You Will Build This):** The secure central server that acts as the brain of the operation. It will connect to a database, manage business logic, and securely handle all communication with third-party APIs.

3.  **Third-Party APIs (You Will Integrate These):**
    -   **Google Gemini:** Powers the conversational AI for the agent.
    -   **Twilio:** Provides the telephony infrastructure to connect the AI to the telephone network.
    -   **Google Calendar:** Schedules meetings on your company calendar.

### How a Call Works
1.  **Outbound:** An agent clicks "Start Call" on the frontend. This tells the **Backend** to make an API call to **Twilio**. Twilio calls the prospect and, upon connection, opens a real-time audio stream to your **Backend**. Your Backend then streams this audio to **Google Gemini** and streams Gemini's voice response back to Twilio, creating a seamless conversation.
2.  **Inbound:** A customer calls your **Twilio** phone number. Twilio notifies your **Backend** of the incoming call and immediately opens the same audio stream, connecting the caller to the **Google Gemini** AI for support.

---
## 3. Prerequisites & Credentials Checklist

This is the most critical step. You must gather the following "secrets." They are the keys to your system.

> **IMPORTANT SECURITY NOTICE:** This guide uses placeholders like `YOUR_..._KEY`. For your company's security, you must generate your own unique keys from each service. **Never share these keys publicly or commit them to your code repository.** They should only be stored as secure environment variables on your backend server.

### Your Credentials Checklist:
-   [ ] **Google Gemini API Key:**
    -   **Go to:** [Google AI Studio](https://aistudio.google.com/)
    -   **Action:** Create a project and click "Create API Key".
    -   **Placeholder:** `YOUR_GEMINI_API_KEY`

-   [ ] **Twilio Account Credentials & Phone Number:**
    -   **Go to:** [Twilio Console](https://www.twilio.com/console)
    -   **Action:**
        1.  On the main dashboard, find your **Account SID** and **Auth Token**.
        2.  Navigate to "Phone Numbers" > "Manage" > "Buy a number" to purchase a number for your AI agent.
    -   **Placeholders:** `YOUR_TWILIO_ACCOUNT_SID`, `YOUR_TWILIO_AUTH_TOKEN`, `YOUR_TWILIO_PHONE_NUMBER`

-   [ ] **Google Cloud Service Account (for Google Calendar):**
    -   **Go to:** [Google Cloud Console](https://console.cloud.google.com/)
    -   **Action:**
        1.  Create a new project (e.g., "OmniTech-AI-Agent").
        2.  In the search bar, find and enable the **Google Calendar API**.
        3.  Go to "Credentials", click "Create Credentials", and choose **Service Account**.
        4.  Give it a name (e.g., "calendar-manager"), click "Create and Continue", grant it a role of "Project > Editor", and click "Done".
        5.  Click on the newly created service account, go to the "Keys" tab, click "Add Key" -> "Create new key", select **JSON**, and download the file.
        6.  Open your OmniTech Sales Google Calendar. Go to Settings > "Share with specific people or groups", add the `client_email` from the downloaded JSON file, and give it "Make changes to events" permissions.
    -   **Placeholder:** `path/to/your-google-service-account.json`

-   [ ] **Database Connection String:**
    -   **Action:** Set up a production-grade database. We recommend a managed PostgreSQL provider like **Supabase** or **AWS RDS**. After setup, you will get a connection URL.
    -   **Placeholder:** `YOUR_DATABASE_CONNECTION_URL`

---
## 4. Building Your Backend Service

The mock API in `services/apiService.ts` must be replaced by a real backend. We recommend **Node.js with the Express.js framework**.

### Step 1: Database Schema
Create tables in your database that match the types in `types.ts`.

-   **`Users`:** `id`, `name`, `email`, `role`, `passwordHash` (use `bcrypt` to hash passwords).
-   **`Prospects`:** `id`, `company`, `contact`, `phone`, `status`, etc.
-   **`CallLogs`:** `id`, `prospectId`, `timestamp`, `summary`, `disposition`, `transcription` (JSON), `meetingDetails` (JSON).

### Step 2: Implement API Endpoints
Create these endpoints in your Express app. Each should connect to your database.

-   `POST /api/login`: Authenticates against the `Users` table, returns a JWT.
-   `GET /api/prospects`: Returns all prospects.
-   `PUT /api/prospects/:id`: Updates a prospect's status.
-   `POST /api/call-logs`: Creates a new call log.
-   `POST /api/schedule-meeting`: Uses your Google Service Account key to create a calendar event.
-   `POST /api/send-sms`: Uses your Twilio credentials to send an SMS.
-   ...and so on for all functions in `apiService.ts`.

---
## 5. Activating Live Telephony with Twilio

This is where the magic happens. You need to build new endpoints to handle the real-time flow of audio.

### Step 1: Create an Outbound Call Trigger
-   **Endpoint:** `POST /api/prospects/:id/call`
-   **Action:** This endpoint is called from the frontend's "Start Call" button. It uses the Twilio SDK to initiate a call.
-   **Code (Node.js/Express):**
    ```javascript
    app.post('/api/prospects/:id/call', async (req, res) => {
        const prospect = await db.getProspectById(req.params.id);
        const twilioClient = require('twilio')(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

        await twilioClient.calls.create({
            to: prospect.phone,
            from: process.env.TWILIO_PHONE_NUMBER,
            // This URL tells Twilio what to do when the call connects.
            url: 'https://YOUR_DEPLOYED_BACKEND_URL/api/twiml/connect-stream'
        });
        res.status(200).send({ message: 'Call initiated' });
    });
    ```

### Step 2: Create the TwiML Webhook
-   **Endpoint:** `POST /api/twiml/connect-stream`
-   **Action:** When Twilio connects the call, it requests this URL. Your endpoint must respond with TwiML (XML) instructions telling Twilio to open a bi-directional audio stream.
-   **Code (Node.js/Express):**
    ```javascript
    app.post('/api/twiml/connect-stream', (req, res) => {
        res.type('text/xml');
        res.send(`
            <Response>
                <Connect>
                    <Stream url="wss://${req.headers.host}/api/audiostream" />
                </Connect>
            </Response>
        `);
    });
    ```
    _Note: `req.headers.host` dynamically provides your backend's domain._

### Step 3: The WebSocket Audio Stream
-   **Endpoint:** `wss://YOUR_DEPLOYED_BACKEND_URL/api/audiostream`
-   **Action:** This is the most advanced part. Your backend needs a WebSocket server (`ws` library in Node.js).
-   **Flow:**
    1.  When Twilio connects to this WebSocket, your backend simultaneously initiates a `live.connect` session with the Gemini API.
    2.  Your server receives audio packets from Twilio, converts them from Twilio's format (µ-law) to the format Gemini needs (16-bit PCM), and forwards them to Gemini using `session.sendRealtimeInput`.
    3.  Your server receives audio packets back from Gemini in the `onmessage` callback, converts them back to µ-law, and sends them to Twilio over the WebSocket.

### Step 4: Configure Inbound Calls
-   **Go to:** Your Twilio Phone Number's configuration page in the console.
-   **Action:** Under "A CALL COMES IN", select "Webhook" and enter `https://YOUR_DEPLOYED_BACKEND_URL/api/twiml/connect-stream`.
-   Now, when anyone calls your Twilio number, it will instantly connect them to your Gemini AI agent.

---
## 6. Deployment & Go-Live

### User Login
The mock login credentials are in `apiService.ts` (`agent@omnitech.com` / `password`). Your real backend should query the `Users` table you created, which will contain the hashed passwords for your actual employees.

### Step 1: Deploy the Backend
1.  **Host:** Use a service like **Google Cloud Run** or **Heroku**.
2.  **Environment Variables:** This is critical. In your hosting service's settings, add all the secrets you gathered in Part 3. Your code should access them via `process.env`.
    -   `GEMINI_API_KEY=YOUR_GEMINI_API_KEY`
    -   `TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID`
    -   `TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN`
    -   `TWILIO_PHONE_NUMBER=YOUR_TWILIO_PHONE_NUMBER`
    -   `DATABASE_URL=YOUR_DATABASE_CONNECTION_URL`
    -   `GOOGLE_APPLICATION_CREDENTIALS=./path/to/your-google-service-account.json`

### Step 2: Deploy the Frontend
1.  **Host:** Use a static hosting service like **Vercel** or **Netlify**. Connect it to your Git repository.
2.  **Connect to Backend:** Set an environment variable in your frontend hosting service (e.g., `VITE_API_URL` or `REACT_APP_API_URL`) to point to your deployed backend's URL. You will need to update the `apiService.ts` file to use this variable instead of the mock data.

You are now ready to launch the OmniTech AI Agent Powerhouse.
