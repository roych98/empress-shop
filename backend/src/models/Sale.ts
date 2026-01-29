import mongoose, { Document, Schema } from "mongoose";

export interface ISaleSplitDetail {
  player: mongoose.Types.ObjectId;
  amountWS: number;
  isPaid: boolean;
}

export interface ISale extends Document {
  run: mongoose.Types.ObjectId;
  drops: mongoose.Types.ObjectId[];
  totalPriceWS: number;
  buyer: string;
  date: Date;
  netAfterFeesWS: number;
  splitDetails: ISaleSplitDetail[];
  isSettled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SaleSplitDetailSchema = new Schema<ISaleSplitDetail>(
  {
    player: { type: Schema.Types.ObjectId, ref: "Player", required: true },
    amountWS: { type: Number, required: true }, // Can be negative when entry fee > sale price
    isPaid: { type: Boolean, default: false },
  },
  { _id: false }
);

const SaleSchema = new Schema<ISale>(
  {
    run: { type: Schema.Types.ObjectId, ref: "Run", required: true },
    drops: [
      {
        type: Schema.Types.ObjectId,
        ref: "WeaponDrop",
        required: true,
      },
    ],
    totalPriceWS: { type: Number, required: true, min: 0 },
    buyer: { type: String, required: true, trim: true },
    date: { type: Date, required: true, default: () => new Date() },
    netAfterFeesWS: { type: Number, required: true }, // Can be negative when entry fee > sale price
    splitDetails: { type: [SaleSplitDetailSchema], default: [] },
    isSettled: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const Sale = mongoose.model<ISale>("Sale", SaleSchema);

