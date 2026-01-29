import mongoose, { Document, Schema } from "mongoose";

export type RunStatus = "open" | "settled";

export interface IRunParticipant {
  player: mongoose.Types.ObjectId;
  shareModifier?: number;
}

export interface IRun extends Document {
  runNumber: number;
  date: Date;
  host: mongoose.Types.ObjectId;
  participants: IRunParticipant[];
  essenceRequired: number;
  stoneRequired: number;
  essencePriceWS: number;
  stonePriceWS: number;
  totalEntryFeeWS: number;
  status: RunStatus;
  createdAt: Date;
  updatedAt: Date;
}

const RunParticipantSchema = new Schema<IRunParticipant>(
  {
    player: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    shareModifier: { type: Number, default: 1 },
  },
  { _id: false }
);

const RunSchema = new Schema<IRun>(
  {
    runNumber: { type: Number, unique: true },
    date: { type: Date, required: true, default: () => new Date() },
    host: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    participants: { type: [RunParticipantSchema], default: [] },
    essenceRequired: { type: Number, default: 2, min: 0 },
    stoneRequired: { type: Number, default: 2, min: 0 },
    essencePriceWS: { type: Number, required: true, min: 0 },
    stonePriceWS: { type: Number, required: true, min: 0 },
    totalEntryFeeWS: { type: Number, required: true, min: 0 },
    status: {
      type: String,
      enum: ["open", "settled"],
      default: "open",
    },
  },
  { timestamps: true }
);

// Helper function to get next run number
export const getNextRunNumber = async (): Promise<number> => {
  const lastRun = await Run.findOne().sort({ runNumber: -1 }).select("runNumber");
  return (lastRun?.runNumber ?? 0) + 1;
};

export const Run = mongoose.model<IRun>("Run", RunSchema);

