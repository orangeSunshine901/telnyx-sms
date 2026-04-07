# Telnyx SMS App

A Node.js web app for sending and receiving SMS messages via the [Telnyx](https://telnyx.com) API. Features a chat-style browser UI with real-time inbound message delivery via WebSockets.

## Features

- Send SMS from your Telnyx number to any phone number
- Receive inbound SMS in real-time (no page refresh needed)
- Chat-style UI with sent/received message bubbles
- MMS media attachment support (logged server-side)
- In-memory message history for the current session

## Requirements

- Node.js 20+
- A [Telnyx account](https://telnyx.com) with:
  - An API key
  - A Telnyx phone number with SMS enabled
  - A messaging profile with a webhook URL configured

## Setup

**1. Install dependencies**

```bash
npm install
```

**2. Configure environment variables**

```bash
cp .env.example .env
```

Edit `.env` and fill in your credentials:

```env
PORT=3000
TELNYX_API_KEY=your_api_key_here
TELNYX_PHONE_NUMBER=+1XXXXXXXXXX
```

- `TELNYX_API_KEY` — found in the Telnyx portal under **API Keys**
- `TELNYX_PHONE_NUMBER` — the Telnyx number that will send/receive SMS (E.164 format, e.g. `+15005550006`)

**3. Start the server**

```bash
npm start
```

The app runs at `http://localhost:3000`.

## Receiving Inbound SMS (Webhook Setup)

Telnyx needs a public URL to deliver inbound messages. For local development, use [ngrok](https://ngrok.com):

```bash
ngrok http 3000
```

Then set your webhook URL in the Telnyx portal:

1. Go to **Messaging → Messaging Profiles**
2. Select your profile and open the **Inbound** settings
3. Set the webhook URL to:
   ```
   https://<your-ngrok-subdomain>.ngrok.io/webhooks
   ```

## API Endpoints

| Method | Path        | Description                        |
|--------|-------------|------------------------------------|
| POST   | `/webhooks` | Receives inbound SMS from Telnyx   |
| POST   | `/send`     | Sends an outbound SMS              |
| GET    | `/messages` | Returns in-memory message history  |

### `POST /send`

```json
{
  "to": "+15005550001",
  "text": "Hello!"
}
```

## Project Structure

```
├── server.js          # Express server, Socket.io, Telnyx API integration
├── public/
│   └── index.html     # Chat UI (served as static)
├── .env               # Environment variables (not committed)
├── .env.example       # Environment variable template
└── package.json
```

## Development

Use `--watch` for automatic restarts on file changes (Node 18+):

```bash
npm run dev
```

## Notes

- Messages are stored **in memory only** and will be lost when the server restarts.
- Outbound messages sent from the UI will also appear in real-time via Socket.io (no double-fetch needed).
- Port 5000 is reserved by macOS AirPlay Receiver on macOS 12+. Use port 3000 (the default) or set a different `PORT` in your `.env`.
