import mongoose from "mongoose";
import { env } from "../config/env";

export const connectMongo = async () => {
  try {
    await mongoose.connect(env.mongoUri);
    // eslint-disable-next-line no-console
    console.log("Connected to MongoDB");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection error", err);
    process.exit(1);
  }
};

