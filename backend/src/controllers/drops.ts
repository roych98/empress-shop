import { Response } from "express";
import mongoose from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import { WeaponDrop } from "../models/WeaponDrop";
import { Run } from "../models/Run";

export const listDropsForRun = async (req: AuthedRequest, res: Response) => {
  try {
    const { runId } = req.params;
    const drops = await WeaponDrop.find({ run: runId })
      .populate("ownerPlayer")
      .sort({ createdAt: -1 });
    return res.json(drops);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to list drops" });
  }
};

export const createDropForRun = async (
  req: AuthedRequest,
  res: Response
) => {
  try {
    const { runId } = req.params;
    const { ownerPlayerId, weaponType, mainRoll, secondaryRoll, notes } = req.body as {
      ownerPlayerId: string;
      weaponType: string;
      mainRoll: number;
      secondaryRoll: number;
      notes?: string;
    };

    const run = await Run.findById(runId);
    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    if (!ownerPlayerId) {
      return res
        .status(400)
        .json({ message: "ownerPlayerId is required" });
    }

    const isParticipant = run.participants.some(
      (p) => p.player.toString() === ownerPlayerId
    );

    if (!isParticipant) {
      return res.status(400).json({
        message: "Owner must be a participant in this run",
      });
    }

    const drop = await WeaponDrop.create({
      run: runId,
      ownerPlayer: new mongoose.Types.ObjectId(ownerPlayerId),
      weaponType,
      mainRoll,
      secondaryRoll,
      notes,
    });

    return res.status(201).json(drop);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to create drop" });
  }
};


export const disenchantDrop = async (req: AuthedRequest, res: Response) => {
  try {
    const { dropId } = req.params;
    const { disenchantInto } = req.body as {
      disenchantInto: "essence" | "stone";
    };

    if (!disenchantInto || !["essence", "stone"].includes(disenchantInto)) {
      return res.status(400).json({
        message: "disenchantInto must be 'essence' or 'stone'",
      });
    }

    const drop = await WeaponDrop.findById(dropId);
    if (!drop) {
      return res.status(404).json({ message: "Drop not found" });
    }

    if (drop.status === "sold") {
      return res.status(400).json({ message: "Cannot disenchant a sold item" });
    }

    if (drop.status === "disenchanted") {
      return res
        .status(400)
        .json({ message: "Item is already disenchanted" });
    }

    drop.status = "disenchanted";
    drop.disenchantedInto = disenchantInto;
    await drop.save();

    return res.json(drop);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to disenchant drop" });
  }
};
