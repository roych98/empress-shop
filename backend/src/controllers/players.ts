import { Request, Response } from "express";
import { Player } from "../models/Player";
import { AuthedRequest } from "../middleware/auth";
import { Sale } from "../models/Sale";
import { WeaponDrop } from "../models/WeaponDrop";

export const listPlayers = async (_req: AuthedRequest, res: Response) => {
  try {
    const players = await Player.find().sort({ name: 1 });

    const owedByPlayer: Record<string, number> = {};
    const sales = await Sale.find({ "splitDetails.isPaid": false }).select(
      "splitDetails"
    );

    sales.forEach((sale) => {
      sale.splitDetails.forEach((detail) => {
        if (!detail.isPaid) {
          const playerId = detail.player.toString();
          owedByPlayer[playerId] =
            (owedByPlayer[playerId] ?? 0) + detail.amountWS;
        }
      });
    });

    const playersWithOwed = players.map((p) => {
      const id = p._id.toString();
      const owedWS = roundToTwo(owedByPlayer[id] ?? 0);
      return {
        ...p.toObject(),
        owedWS,
      };
    });

    return res.json(playersWithOwed);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to list players" });
  }
};

export const createPlayer = async (req: AuthedRequest, res: Response) => {
  try {
    const { name, userId, defaultCutPercent, notes } = req.body as {
      name: string;
      userId?: string;
      defaultCutPercent?: number;
      notes?: string;
    };

    if (!name) {
      return res.status(400).json({ message: "Name is required" });
    }

    const player = await Player.create({
      name,
      user: userId,
      defaultCutPercent,
      notes,
    });

    return res.status(201).json(player);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to create player" });
  }
};

export const updatePlayer = async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { name, userId, defaultCutPercent, notes } = req.body as {
      name?: string;
      userId?: string;
      defaultCutPercent?: number;
      notes?: string;
    };

    const player = await Player.findByIdAndUpdate(
      id,
      {
        $set: {
          ...(name !== undefined ? { name } : {}),
          ...(userId !== undefined ? { user: userId } : {}),
          ...(defaultCutPercent !== undefined ? { defaultCutPercent } : {}),
          ...(notes !== undefined ? { notes } : {}),
        },
      },
      { new: true }
    );

    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    return res.json(player);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to update player" });
  }
};

export const setPlayerSplitsPaid = async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;

    const player = await Player.findById(id);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Find all sales that have unpaid splits for this player
    const salesToUpdate = await Sale.find({
      "splitDetails.player": player._id,
      "splitDetails.isPaid": false,
    });

    const dropIds = new Set<string>();

    // Update each sale individually to ensure correct state
    for (const sale of salesToUpdate) {
      let changed = false;
      sale.splitDetails.forEach((detail) => {
        if (
          detail.player.toString() === player._id.toString() &&
          !detail.isPaid
        ) {
          detail.isPaid = true;
          changed = true;
        }
      });

      if (changed) {
        // Check if all splits are now paid
        const anyUnpaid = sale.splitDetails.some((d) => !d.isPaid);
        sale.isSettled = !anyUnpaid;
        await sale.save();

        // Collect drop IDs from this sale
        sale.drops.forEach((dropId) => {
          dropIds.add(dropId.toString());
        });
      }
    }

    // Mark drops as paid for this player
    if (dropIds.size > 0) {
      await WeaponDrop.updateMany(
        { _id: { $in: Array.from(dropIds) } },
        { $addToSet: { paidForPlayers: player._id } }
      );
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res
      .status(500)
      .json({ message: "Failed to mark player splits as paid" });
  }
};

const roundToTwo = (value: number): number =>
  Math.round((value + Number.EPSILON) * 100) / 100;
