import mongoose, { Document, Schema } from "mongoose";

export type WeaponType =
  | "Knuckle"
  | "Gun"
  | "Claw"
  | "Dagger"
  | "Wand"
  | "Staff"
  | "Bow"
  | "Crossbow"
  | "1h sword"
  | "2h sword"
  | "1h bw"
  | "2h bw"
  | "1h axe"
  | "2h axe"
  | "Polearm"
  | "Spear";

export type WeaponDropStatus = "unsold" | "listed" | "sold" | "disenchanted";
export type DisenchantType = "essence" | "stone";

export interface IWeaponDrop extends Document {
  run: mongoose.Types.ObjectId;
  ownerPlayer: mongoose.Types.ObjectId;
  weaponType: WeaponType;
  mainRoll: number;
  secondaryRoll: number;
  notes?: string;
  status: WeaponDropStatus;
  sale?: mongoose.Types.ObjectId;
  disenchantedInto?: DisenchantType;
  paidForPlayers?: mongoose.Types.ObjectId[];
  createdAt: Date;
  updatedAt: Date;
}

const WeaponDropSchema = new Schema<IWeaponDrop>(
  {
    run: { type: Schema.Types.ObjectId, ref: "Run", required: true },
    ownerPlayer: {
      type: Schema.Types.ObjectId,
      ref: "Player",
      required: true,
    },
    weaponType: {
      type: String,
      required: true,
      enum: [
        "Knuckle",
        "Gun",
        "Claw",
        "Dagger",
        "Wand",
        "Staff",
        "Bow",
        "Crossbow",
        "1h sword",
        "2h sword",
        "1h bw",
        "2h bw",
        "1h axe",
        "2h axe",
        "Polearm",
        "Spear",
      ],
    },
    mainRoll: { type: Number, required: true, min: -5, max: 5 },
    secondaryRoll: { type: Number, required: true, min: -1, max: 1 },
    notes: { type: String, trim: true },
    status: {
      type: String,
      enum: ["unsold", "listed", "sold", "disenchanted"],
      default: "unsold",
    },
    sale: { type: Schema.Types.ObjectId, ref: "Sale" },
    disenchantedInto: {
      type: String,
      enum: ["essence", "stone"],
    },
    paidForPlayers: [
      {
        type: Schema.Types.ObjectId,
        ref: "Player",
      },
    ],
  },
  { timestamps: true }
);

export const WeaponDrop = mongoose.model<IWeaponDrop>(
  "WeaponDrop",
  WeaponDropSchema
);

