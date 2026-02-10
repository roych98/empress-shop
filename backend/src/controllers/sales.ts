import { Response } from "express";
import mongoose from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import { Sale } from "../models/Sale";
import { Run } from "../models/Run";
import { WeaponDrop } from "../models/WeaponDrop";
import {
  computeSaleSplit,
  ParticipantShareInput,
} from "../services/calculations";

export const listSales = async (_req: AuthedRequest, res: Response) => {
  try {
    const sales = await Sale.find()
      .populate({
        path: "run",
        populate: { path: "host" },
      })
      .populate("drops")
      .sort({ date: -1 });
    return res.json(sales);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to list sales" });
  }
};

export const getSale = async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const sale = await Sale.findById(id).populate("run").populate("drops");
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }
    return res.json(sale);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch sale" });
  }
};

export const createSale = async (req: AuthedRequest, res: Response) => {
  try {
    const { runId, dropIds, totalPriceWS, buyer, remainingUnpaidEntryFeeWS } =
      req.body as {
        runId: string;
        dropIds: string[];
        totalPriceWS: number;
        buyer: string;
        remainingUnpaidEntryFeeWS?: number;
      };

    if (!runId || !dropIds?.length || !totalPriceWS || !buyer) {
      return res.status(400).json({
        message: "runId, dropIds, totalPriceWS and buyer are required",
      });
    }

    const run = await Run.findById(runId);
    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    const participants: ParticipantShareInput[] = run.participants.map(
      (p) => ({
        playerId: p.player.toString(),
        shareModifier: p.shareModifier ?? 1,
      })
    );

    const { netAfterFeesWS, split } = computeSaleSplit(
      totalPriceWS,
      remainingUnpaidEntryFeeWS ?? 0,
      participants
    );

    const sale = await Sale.create({
      run: runId,
      drops: dropIds,
      totalPriceWS,
      buyer,
      netAfterFeesWS,
      splitDetails: split.perParticipant.map((s) => ({
        player: s.playerId,
        amountWS: s.amountWS,
        isPaid: false,
      })),
    });

    await WeaponDrop.updateMany(
      { _id: { $in: dropIds } },
      { $set: { status: "sold", sale: sale._id } }
    );

    const populated = await Sale.findById(sale._id)
      .populate("run")
      .populate("drops");

    return res.status(201).json(populated);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to create sale" });
  }
};

export const updateSale = async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { totalPriceWS, buyer, remainingUnpaidEntryFeeWS, dropIds } = req.body as {
      totalPriceWS?: number;
      buyer?: string;
      remainingUnpaidEntryFeeWS?: number;
      dropIds?: string[];
    };

    const sale = await Sale.findById(id).populate("run");
    if (!sale) {
      return res.status(404).json({ message: "Sale not found" });
    }

    const run = await Run.findById(sale.run);
    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    let needsRecalc = false;

    if (totalPriceWS !== undefined) {
      sale.totalPriceWS = totalPriceWS;
      needsRecalc = true;
    }
    if (buyer !== undefined) {
      sale.buyer = buyer;
    }
    if (remainingUnpaidEntryFeeWS !== undefined) {
      needsRecalc = true;
    }

    // If drops are being changed, update the sale's drops
    if (dropIds && dropIds.length > 0) {
      // Remove old drop associations
      await WeaponDrop.updateMany(
        { sale: sale._id },
        { $unset: { sale: "", status: "" } }
      );
      // Set new drops
      sale.drops = dropIds.map((id) => new mongoose.Types.ObjectId(id));
      // Mark new drops as sold
      await WeaponDrop.updateMany(
        { _id: { $in: dropIds } },
        { $set: { status: "sold", sale: sale._id } }
      );
      needsRecalc = true;
    }

    // Recalculate split if needed
    if (needsRecalc) {
      const participants: ParticipantShareInput[] = run.participants.map(
        (p) => ({
          playerId: p.player.toString(),
          shareModifier: p.shareModifier ?? 1,
        })
      );

      const { netAfterFeesWS, split } = computeSaleSplit(
        sale.totalPriceWS,
        remainingUnpaidEntryFeeWS ?? 0,
        participants
      );

      sale.netAfterFeesWS = netAfterFeesWS;
      sale.splitDetails = split.perParticipant.map((s) => ({
        player: new mongoose.Types.ObjectId(s.playerId),
        amountWS: s.amountWS,
        isPaid: false, // Reset payment status when recalculating
      }));
    }

    await sale.save();
    const populated = await Sale.findById(sale._id)
      .populate("run")
      .populate("drops");
    return res.json(populated);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to update sale" });
  }
};
