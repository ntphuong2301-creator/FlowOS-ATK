import { createServer } from "node:http";
import app from "./app.js";
import { khoiTaoSocket } from "./lib/socket.js";
import { logger } from "./lib/logger.js";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const httpServer = createServer(app);
khoiTaoSocket(httpServer);

httpServer.listen(port, () => {
  logger.info({ port }, "Server listening (HTTP + Socket.io)");
});

// Graceful shutdown — giải phóng port khi nhận SIGTERM/SIGINT
function shutdown(signal: string) {
  logger.info({ signal }, "Shutting down server...");
  httpServer.close(() => {
    logger.info("Server closed.");
    process.exit(0);
  });
  // Force exit sau 5 giây nếu server không đóng kịp
  setTimeout(() => process.exit(1), 5000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
