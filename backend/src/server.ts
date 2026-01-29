import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { connectMongo } from "./db/connection";
import authRoutes from "./routes/auth";
import playerRoutes from "./routes/players";
import runRoutes from "./routes/runs";
import dropRoutes from "./routes/drops";
import saleRoutes from "./routes/sales";
import statsRoutes from "./routes/stats";

const app = express();

app.use(
  cors({
    origin: env.corsOrigin,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.use("/auth", authRoutes);
app.use("/players", playerRoutes);
app.use("/runs", runRoutes);
app.use("/drops", dropRoutes);
app.use("/sales", saleRoutes);
app.use("/stats", statsRoutes);

const start = async () => {
  await connectMongo();
  app.listen(env.port, () => {
    // eslint-disable-next-line no-console
    console.log(`Backend listening on port ${env.port}`);
  });
};

void start();

