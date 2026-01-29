import mongoose, { Schema, Document } from "mongoose";

export type UserRole = "host" | "runner" | "viewer";

export interface IUser extends Document {
  email: string;
  passwordHash: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email: { type: String, required: true, unique: true, lowercase: true },
    passwordHash: { type: String, required: true },
    role: {
      type: String,
      enum: ["host", "runner", "viewer"],
      default: "host",
    },
  },
  { timestamps: true }
);

export const User = mongoose.model<IUser>("User", UserSchema);

