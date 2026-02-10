import { Response } from "express";
import mongoose from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import { WeaponDrop } from "../models/WeaponDrop";
import { Run } from "../models/Run";
import { Sale } from "../models/Sale";
import {
  computeSaleSplit,
  ParticipantShareInput,
} from "../services/calculations";

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

export const updateDrop = async (req: AuthedRequest, res: Response) => {
  try {
    const { dropId } = req.params;
    const { ownerPlayerId, weaponType, mainRoll, secondaryRoll, notes, status } = req.body as {
      ownerPlayerId?: string;
      weaponType?: string;
      mainRoll?: number;
      secondaryRoll?: number;
      notes?: string;
      status?: "unsold" | "listed" | "sold" | "disenchanted";
    };

    const drop = await WeaponDrop.findById(dropId).populate("run");
    if (!drop) {
      return res.status(404).json({ message: "Drop not found" });
    }

    const run = await Run.findById(drop.run);
    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    if (ownerPlayerId) {
      const isParticipant = run.participants.some(
        (p) => p.player.toString() === ownerPlayerId
      );
      if (!isParticipant) {
        return res.status(400).json({
          message: "Owner must be a participant in this run",
        });
      }
      drop.ownerPlayer = new mongoose.Types.ObjectId(ownerPlayerId);
    }

    if (weaponType) {
      drop.weaponType = weaponType as any;
    }
    if (mainRoll !== undefined) {
      drop.mainRoll = mainRoll;
    }
    if (secondaryRoll !== undefined) {
      drop.secondaryRoll = secondaryRoll;
    }
    if (notes !== undefined) {
      drop.notes = notes || undefined;
    }
    if (status) {
      const oldStatus = drop.status;
      drop.status = status;
      
      // If changing from disenchanted to another status, clear disenchantedInto
      if (oldStatus === "disenchanted" && status !== "disenchanted") {
        drop.disenchantedInto = undefined;
      }
      
      // If changing from sold/disenchanted to unsold/listed, remove sale association
      if ((oldStatus === "sold" || oldStatus === "disenchanted") && 
          (status === "unsold" || status === "listed")) {
        drop.sale = undefined;
      }
      
      // If changing to disenchanted, ensure disenchantedInto is set (or will be set by disenchant action)
      // If changing to sold, ensure it has a sale association (or will be set by sale creation)
    }

    await drop.save();

    // Find all sales that contain this drop and recalculate them
    // This ensures data consistency when drop details are corrected
    const linkedSales = await Sale.find({ drops: drop._id }).populate("run");
    
    if (linkedSales.length > 0) {
      // Group sales by run to recalculate more efficiently
      const salesByRun = new Map<string, typeof linkedSales>();
      for (const sale of linkedSales) {
        const runId = typeof sale.run === 'string' ? sale.run : sale.run._id.toString();
        if (!salesByRun.has(runId)) {
          salesByRun.set(runId, []);
        }
        salesByRun.get(runId)!.push(sale);
      }

      // Recalculate all sales for each affected run
      for (const [runId, sales] of salesByRun.entries()) {
        const saleRun = await Run.findById(runId);
        if (!saleRun) continue;

        const participants: ParticipantShareInput[] = saleRun.participants.map(
          (p) => ({
            playerId: p.player.toString(),
            shareModifier: p.shareModifier ?? 1,
          })
        );

        // Get all sales for this run, sorted chronologically
        const allSalesForRun = await Sale.find({ run: runId })
          .sort({ date: 1, createdAt: 1 });

        // Recalculate each sale in chronological order
        let cumulativeSalesTotal = 0;
        for (const sale of allSalesForRun) {
          const remainingUnpaidEntryFeeWS = Math.max(
            0,
            saleRun.totalEntryFeeWS - cumulativeSalesTotal
          );

          const { netAfterFeesWS, split } = computeSaleSplit(
            sale.totalPriceWS,
            remainingUnpaidEntryFeeWS,
            participants
          );

          sale.netAfterFeesWS = netAfterFeesWS;
          sale.splitDetails = split.perParticipant.map((s) => ({
            player: new mongoose.Types.ObjectId(s.playerId),
            amountWS: s.amountWS,
            isPaid: false, // Reset payment status when recalculating
          }));

          await sale.save();
          cumulativeSalesTotal += sale.totalPriceWS;
        }
      }
    }

    const populated = await WeaponDrop.findById(drop._id).populate("ownerPlayer");
    return res.json(populated);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to update drop" });
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
