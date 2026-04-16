// AI Assistance Disclosure:
// Tool: ChatGPT (model: GPT‑4 Turbo), date: 2026‑04-10
// Scope: Generated scaffolding for setting up websocket, redis and express [w.on("connection" / "message" / "close") etc]
// Author review: I added the functionalities and edited the cors

import cors from "cors";
import express from "express";
import http from "http";
import Redis from "ioredis";
import WebSocket, { Server as WebSocketServer } from "ws";
import { socketAuthMiddleware } from "./middleware/socketAuth";

// App setup
const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",")
  : [];

app.use(
  cors({
    origin: allowedOrigins,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json());

//Redis setup
const redis = new Redis({
  host: "message-redis",
  port: 6379,
});

redis.on("connect", () => {
  console.log("Connected to Redis");
});

redis.on("error", (err) => {
  console.error("Redis connection error:", err);
});

// Server setup
const server = http.createServer(app);
const port = 3019;

const wss = new WebSocketServer({ server });

const collaborationRooms: Map<string, Set<WebSocket>> = new Map();

wss.on("connection", async (ws: WebSocket, req: http.IncomingMessage) => {
  try {
    const user = await socketAuthMiddleware(req);

    if (!user || user == null) {
      console.log("Authentication failed: Invalid token");
      ws.close(1008, "Invalid token");
      return;
    }

    console.log("Authentication successful for user:", user.data.clerkUserId);
    ws.send(
      JSON.stringify({
        type: "auth",
        message: `Successfully authenticated`,
      }),
    );

    handleChat(ws);
  } catch (err) {
    console.error("Error during authentication:", err);
    ws.close(1008, "Error during authentication");
  }
});


async function resetMessageTimings(collaborationId: string) {
  await redis.expire(`collaborationRoom:${collaborationId}:messages`, 300);
}

// Send previous messages from Redis list
async function sendPreviousMessages(collaborationId: string, ws: WebSocket) {
  const messages = await redis.lrange(
    `collaborationRoom:${collaborationId}:messages`,
    0,
    -1,
  );

  messages.forEach((message: string) => {
    ws.send(message);
  });
}

function handleChat(ws: WebSocket) {
  console.log("User authenticated. Handle chat.");

  ws.on("message", async (message: WebSocket.Data) => {
    console.log(message.toString());

    try {
      const { collaborationId, type, text, messageId, replyMessage, userId } =
        JSON.parse(message.toString());

      // Join collaboration room by collaborationId and add user to collaboration room
      if (type === "join") {
        if (!collaborationRooms.has(collaborationId)) {
          collaborationRooms.set(collaborationId, new Set());
        }

        const room = collaborationRooms.get(collaborationId);
        if (room && !room.has(ws)) {
          room.add(ws);

          console.log(
            `User ${userId} joined collaboration room ${collaborationId}`,
          );
          ws.send(
            JSON.stringify({
              type: "info",
              message: `Welcome to collaboration ${collaborationId}`,
            }),
          );
          //Send previous messages
          await sendPreviousMessages(collaborationId, ws);
        } else {
          ws.send(
            JSON.stringify({
              type: "info",
              message: `User ${userId} is already in collaboration room ${collaborationId}`,
            }),
          );
        }
      }

      // Send message within the collaboration room
      if (type === "message") {
        const room = collaborationRooms.get(collaborationId);

        const messageData = JSON.stringify({
          from: userId,
          message: text,
          replyMessage: replyMessage,
          messageId: messageId,
        });
        await redis.rpush(
          `collaborationRoom:${collaborationId}:messages`,
          messageData,
        );

        await redis.expire(
          `collaborationRoom:${collaborationId}:messages`,
          7200,
        ); //Assume session max time is 2 hours

        if (room) {
          room.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(
                JSON.stringify({
                  from: userId,
                  message: text,
                  replyMessage: replyMessage,
                  messageId: messageId,
                }),
              );
            }
          });
        }
      }
    } catch (e) {
      console.log("Error: ", e);
    }
  });

  // User disconnect
  ws.on("close", () => {
    collaborationRooms.forEach((room, collaborationId) => {
      room.delete(ws);
      if (room.size === 0) {
        resetMessageTimings(collaborationId);
        collaborationRooms.delete(collaborationId);
      }
    });
    console.log("User disconnected");
  });
}


server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
