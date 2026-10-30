"use strict";

require("dotenv").config();

const app = require("./app");
const { connectDatabase, prisma } = require("./config/prisma");

const PORT = Number(process.env.PORT || 3000);

async function startServer() {
  await connectDatabase();

  const server = app.listen(PORT, () => {
    console.log(`Global Network Kenya is running at http://localhost:${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
  });

  server.on("error", async (error) => {
    console.error("Server startup error:", error);
    await prisma.$disconnect();
    process.exitCode = 1;
  });

  function shutdown(signal) {
    console.log(`${signal} received. Shutting down server...`);

    server.close(async (error) => {
      if (error) {
        console.error("HTTP server shutdown failed:", error);
        process.exitCode = 1;
      } else {
        console.log("HTTP server closed.");
      }

      await prisma.$disconnect();
    });

    setTimeout(() => {
      console.error("Shutdown timed out.");
      process.exit(1);
    }, 10000).unref();
  }

  process.once("SIGINT", () => shutdown("SIGINT"));
  process.once("SIGTERM", () => shutdown("SIGTERM"));
}

startServer().catch(async (error) => {
  console.error("Application startup failed:", error);
  await prisma.$disconnect();
  process.exitCode = 1;
});
