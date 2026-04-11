import cors from "cors";
import express from "express";
import http from "http";
import WebSocket, { Server as WebSocketServer } from "ws";
import Redis from "ioredis";

const app = express();
const server = http.createServer(app);
const port = 3019;

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

app.use(
  cors({
    origin: [
      "http://localhost:3001",
      "http://localhost:5173",
      "http://localhost:3005",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  }),
);
app.use(express.json());

const wss = new WebSocketServer({ server });

const collaborationRooms: Map<string, Set<WebSocket>> = new Map();

wss.on("connection", (ws: WebSocket) => {
  console.log("New WebSocket connection established");
  console.log("Current connections:", wss.clients.size);
  console.log("Clients", wss.clients.entries.name);

  ws.on("message", async (message: WebSocket.Data) => {
    console.log(message.toString());
    const { collaborationId, testUser, type, text, messageId, replyMessage } =
      JSON.parse(message.toString());

    // Join collaboration room by collaborationId and add user to collaboration room
    if (type === "join") {
      if (!collaborationRooms.has(collaborationId)) {
        collaborationRooms.set(collaborationId, new Set());
      }

      const room = collaborationRooms.get(collaborationId);
      room?.add(ws);

      console.log(
        `User ${testUser} joined collaboration room ${collaborationId}`,
      );
      ws.send(
        JSON.stringify({
          type: "info",
          message: `Welcome to collaboration ${collaborationId}`,
        }),
      );

      //Send previous messages
      await sendPreviousMessages(collaborationId, ws);
    }

    // Send message within the collaboration room
    if (type === "private_message") {
      const room = collaborationRooms.get(collaborationId);

      const messageData = JSON.stringify({
        from: testUser,
        message: text,
        replyMessage: replyMessage,
      });
      await redis.rpush(
        `collaborationRoom:${collaborationId}:messages`,
        messageData,
      );

      await redis.expire(`collaborationRoom:${collaborationId}:messages`, 7200); //Assume session max time is 2 hours

      if (room) {
        room.forEach((client) => {
          if (client !== ws && client.readyState === WebSocket.OPEN) {
            client.send(
              JSON.stringify({
                from: testUser,
                message: text,
                replyMessage: replyMessage,
                messageId: messageId,
              }),
            );
          }
        });
      }
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

server.listen(port, () => {
  console.log("Server listening on http://localhost:3000");
});
