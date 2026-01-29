import mongoose from "mongoose";

export const connectMongo = async () => {
  const mongoUri = process.env.MONGO_URI;
  if (!mongoUri) {
    throw new Error("MONGO_URI environment variable is required");
  }
  try {
    await mongoose.connect(mongoUri);
    // eslint-disable-next-line no-console
    console.log("Connected to MongoDB");
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("MongoDB connection error", err);
    process.exit(1);
  }
};

