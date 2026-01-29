import mongoose, { Document, Schema } from "mongoose";

export interface IPlayer extends Document {
  name: string;
  user?: mongoose.Types.ObjectId;
  defaultCutPercent?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const PlayerSchema = new Schema<IPlayer>(
  {
    name: { type: String, required: true, trim: true },
    user: { type: Schema.Types.ObjectId, ref: "User" },
    defaultCutPercent: { type: Number, min: 0, max: 100 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

export const Player = mongoose.model<IPlayer>("Player", PlayerSchema);

