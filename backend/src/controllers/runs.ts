import { Response } from "express";
import mongoose from "mongoose";
import { AuthedRequest } from "../middleware/auth";
import { Run, IRunParticipant, getNextRunNumber } from "../models/Run";
import { Player } from "../models/Player";
import { WeaponDrop } from "../models/WeaponDrop";
import { Sale } from "../models/Sale";
import {
  computeSaleSplit,
  computeTotalEntryFeeWS,
  ParticipantShareInput,
} from "../services/calculations";

export const listRuns = async (_req: AuthedRequest, res: Response) => {
  try {
    const runs = await Run.find()
      .populate("host")
      .populate("participants.player")
      .sort({ date: -1 });
    return res.json(runs);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to list runs" });
  }
};

export const createRun = async (req: AuthedRequest, res: Response) => {
  try {
    const {
      date,
      hostId,
      participants,
      essenceRequired = 2,
      stoneRequired = 2,
      essencePriceWS,
      stonePriceWS,
    } = req.body as {
      date?: string;
      hostId: string;
      participants: { playerId: string; shareModifier?: number }[];
      essenceRequired?: number;
      stoneRequired?: number;
      essencePriceWS: number;
      stonePriceWS: number;
    };

    if (!hostId || !essencePriceWS || !stonePriceWS) {
      return res.status(400).json({
        message: "hostId, essencePriceWS and stonePriceWS are required",
      });
    }

    const host = await Player.findById(hostId);
    if (!host) {
      return res.status(400).json({ message: "Invalid hostId" });
    }

    const totalEntryFeeWS = computeTotalEntryFeeWS({
      essenceRequired,
      stoneRequired,
      essencePriceWS,
      stonePriceWS,
    });

    const runNumber = await getNextRunNumber();

    const run = await Run.create({
      runNumber,
      date: date ? new Date(date) : new Date(),
      host: new mongoose.Types.ObjectId(hostId),
      participants: participants.map(
        (p): IRunParticipant => ({
          player: new mongoose.Types.ObjectId(p.playerId),
          shareModifier: p.shareModifier ?? 1,
        })
      ),
      essenceRequired,
      stoneRequired,
      essencePriceWS,
      stonePriceWS,
      totalEntryFeeWS,
      status: "open",
    });

    return res.status(201).json(run);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to create run" });
  }
};

export const getRun = async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const run = await Run.findById(id)
      .populate("host")
      .populate("participants.player");

    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    return res.json(run);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch run" });
  }
};

export const updateRun = async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const {
      date,
      hostId,
      participants,
      essenceRequired,
      stoneRequired,
      essencePriceWS,
      stonePriceWS,
      status,
    } = req.body as {
      date?: string;
      hostId?: string;
      participants?: { playerId: string; shareModifier?: number }[];
      essenceRequired?: number;
      stoneRequired?: number;
      essencePriceWS?: number;
      stonePriceWS?: number;
      status?: "open" | "settled";
    };

    const run = await Run.findById(id);
    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    if (date) {
      run.date = new Date(date);
    }
    if (hostId) {
      run.host = new mongoose.Types.ObjectId(hostId);
    }
    if (participants) {
      run.participants = participants.map((p) => ({
        player: new mongoose.Types.ObjectId(p.playerId),
        shareModifier: p.shareModifier ?? 1,
      }));
    }
    if (essenceRequired !== undefined) {
      run.essenceRequired = essenceRequired;
    }
    if (stoneRequired !== undefined) {
      run.stoneRequired = stoneRequired;
    }
    if (essencePriceWS !== undefined) {
      run.essencePriceWS = essencePriceWS;
    }
    if (stonePriceWS !== undefined) {
      run.stonePriceWS = stonePriceWS;
    }
    if (status) {
      run.status = status;
    }

    // recompute total entry fee if any relevant field changed
    if (
      essenceRequired !== undefined ||
      stoneRequired !== undefined ||
      essencePriceWS !== undefined ||
      stonePriceWS !== undefined
    ) {
      run.totalEntryFeeWS = computeTotalEntryFeeWS({
        essenceRequired: run.essenceRequired,
        stoneRequired: run.stoneRequired,
        essencePriceWS: run.essencePriceWS,
        stonePriceWS: run.stonePriceWS,
      });
    }

    await run.save();
    return res.json(run);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to update run" });
  }
};

export const deleteRun = async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const run = await Run.findById(id);
    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    // Delete all weapon drops for this run
    await WeaponDrop.deleteMany({ run: id });

    // Delete all sales for this run (removes owed WS since it's calculated from unpaid splits)
    await Sale.deleteMany({ run: id });

    // Delete the run itself
    await Run.findByIdAndDelete(id);

    return res.status(204).send();
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to delete run" });
  }
};

export const getRunSummary = async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const run = await Run.findById(id).populate("participants.player");
    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    const drops = await WeaponDrop.find({ run: id }).populate("ownerPlayer");
    const sales = await Sale.find({ run: id }).populate("drops");

    const owedByPlayer: Record<string, number> = {};
    sales.forEach((sale) => {
      sale.splitDetails.forEach((detail) => {
        const playerId = detail.player.toString();
        if (!detail.isPaid) {
          owedByPlayer[playerId] =
            (owedByPlayer[playerId] ?? 0) + detail.amountWS;
        }
      });
    });

    // Helper to get player _id whether populated or not
    const getPlayerId = (player: any): string => {
      if (player && player._id) {
        return player._id.toString();
      }
      return player?.toString() ?? "";
    };

    const participants: ParticipantShareInput[] = run.participants.map(
      (p) => ({
        playerId: getPlayerId(p.player),
        shareModifier: p.shareModifier ?? 1,
      })
    );

    const nameByPlayerId: Record<string, string> = {};
    run.participants.forEach((p) => {
      const id = getPlayerId(p.player);
      const populatedPlayer = p.player as any;
      const name = populatedPlayer?.name as string | undefined;
      if (name) {
        nameByPlayerId[id] = name;
      }
    });

    const totalSalesWS = sales.reduce(
      (sum, sale) => sum + sale.totalPriceWS,
      0
    );

    const totalNetAfterFeesWS = sales.reduce(
      (sum, sale) => sum + sale.netAfterFeesWS,
      0
    );

    // Calculate total value from disenchanted items
    let totalDisenchantedWS = 0;
    drops.forEach((drop) => {
      if (drop.status === "disenchanted" && drop.disenchantedInto) {
        if (drop.disenchantedInto === "essence") {
          totalDisenchantedWS += run.essencePriceWS;
        } else if (drop.disenchantedInto === "stone") {
          totalDisenchantedWS += run.stonePriceWS;
        }
      }
    });

    // Entry fee covered = sales revenue used for fees + disenchanted value
    const feesCoveredBySales = totalSalesWS - totalNetAfterFeesWS;
    const unpaidEntryFeeWS = Math.max(
      0,
      run.totalEntryFeeWS - feesCoveredBySales - totalDisenchantedWS
    );

    const { split } = computeSaleSplit(
      totalNetAfterFeesWS,
      0,
      participants
    );

    const perParticipantWithOwed = split.perParticipant.map((p) => ({
      ...p,
      playerName: nameByPlayerId[p.playerId],
      owedWS: roundToTwo(owedByPlayer[p.playerId] ?? 0),
    }));

    const totalOwedWS = Object.values(owedByPlayer).reduce(
      (sum, value) => sum + value,
      0
    );

    const splitsFullyPaid =
      roundToTwo(totalOwedWS) === 0 && split.perParticipant.length > 0;

    return res.json({
      run,
      drops,
      sales,
      totals: {
        totalEntryFeeWS: run.totalEntryFeeWS,
        totalSalesWS,
        totalNetAfterFeesWS,
        totalDisenchantedWS: roundToTwo(totalDisenchantedWS),
        unpaidEntryFeeWS,
      },
      perParticipant: perParticipantWithOwed,
      paymentStatus: {
        totalOwedWS: roundToTwo(totalOwedWS),
        splitsFullyPaid,
      },
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res
      .status(500)
      .json({ message: "Failed to fetch run summary" });
  }
};

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
