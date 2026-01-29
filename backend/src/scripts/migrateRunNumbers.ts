import mongoose from "mongoose";
import { Run } from "../models/Run";

// Allow overriding the MongoDB URI via command line argument or env var
const mongoUri = process.argv[2] || process.env.MONGO_URI || "mongodb://localhost:27017/empress";

async function migrateRunNumbers() {
  try {
    console.log(`Connecting to: ${mongoUri}`);
    await mongoose.connect(mongoUri);
    console.log("Connected to MongoDB");

    // Get all runs without a runNumber, sorted by creation date
    const runsWithoutNumber = await Run.find({
      $or: [{ runNumber: { $exists: false } }, { runNumber: null }],
    }).sort({ createdAt: 1 });

    if (runsWithoutNumber.length === 0) {
      console.log("No runs need migration");
      return;
    }

    console.log(`Found ${runsWithoutNumber.length} runs without runNumber`);

    // Get the highest existing runNumber
    const lastRun = await Run.findOne({ runNumber: { $exists: true, $ne: null } })
      .sort({ runNumber: -1 })
      .select("runNumber");
    
    let nextNumber = (lastRun?.runNumber ?? 0) + 1;

    // Assign run numbers
    for (const run of runsWithoutNumber) {
      run.runNumber = nextNumber;
      await run.save();
      console.log(`Assigned runNumber ${nextNumber} to run ${run._id}`);
      nextNumber++;
    }

    console.log("Migration complete!");
  } catch (err) {
    console.error("Migration failed:", err);
  } finally {
    await mongoose.disconnect();
  }
}

migrateRunNumbers();
