import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { Sale } from "../models/Sale";
import { Run } from "../models/Run";
import { WeaponDrop } from "../models/WeaponDrop";
import { Player } from "../models/Player";

interface MonthlyEarning {
  month: string;
  grossWS: number;
  netWS: number;
  salesCount: number;
  runsCount: number;
}

interface RunEarning {
  runId: string;
  runNumber: number;
  date: string;
  entryFeeWS: number;
  grossWS: number;
  netWS: number;
  salesCount: number;
  dropsCount: number;
  cumulativeNetWS: number;
}

export const getProfileStats = async (req: AuthedRequest, res: Response) => {
  try {
    const { playerId } = req.query as { playerId?: string };

    // If playerId is provided, calculate player-specific stats
    if (playerId) {
      return getPlayerStats(req, res, playerId);
    }

    // Otherwise, calculate global stats (all players combined)
    const sales = await Sale.find()
      .populate({
        path: "run",
        select: "date runNumber totalEntryFeeWS",
      })
      .sort({ date: 1 });

    const runs = await Run.find()
      .populate("host")
      .sort({ date: 1 });

    // Get drops count per run
    const dropsCounts = await WeaponDrop.aggregate([
      { $group: { _id: "$run", count: { $sum: 1 } } },
    ]);
    const dropsCountMap = new Map<string, number>();
    dropsCounts.forEach((d) => {
      dropsCountMap.set(d._id.toString(), d.count);
    });

    // Calculate totals
    let totalGrossWS = 0;
    let totalNetWS = 0;
    sales.forEach((sale) => {
      totalGrossWS += sale.totalPriceWS;
      totalNetWS += sale.netAfterFeesWS;
    });

    // Group by month for monthly earnings
    const monthlyMap = new Map<string, MonthlyEarning>();
    
    sales.forEach((sale) => {
      const d = new Date(sale.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(monthKey) || {
        month: monthKey,
        grossWS: 0,
        netWS: 0,
        salesCount: 0,
        runsCount: 0,
      };
      existing.grossWS += sale.totalPriceWS;
      existing.netWS += sale.netAfterFeesWS;
      existing.salesCount += 1;
      monthlyMap.set(monthKey, existing);
    });

    // Count runs per month
    runs.forEach((run) => {
      const d = new Date(run.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(monthKey);
      if (existing) {
        existing.runsCount += 1;
      } else {
        monthlyMap.set(monthKey, {
          month: monthKey,
          grossWS: 0,
          netWS: 0,
          salesCount: 0,
          runsCount: 1,
        });
      }
    });

    // Get monthly stats sorted
    const monthlyEarnings = Array.from(monthlyMap.values()).sort(
      (a, b) => a.month.localeCompare(b.month)
    );

    // Calculate per-run earnings
    const runEarningsMap = new Map<string, RunEarning>();
    
    // Initialize with all runs
    runs.forEach((run) => {
      runEarningsMap.set(run._id.toString(), {
        runId: run._id.toString(),
        runNumber: run.runNumber ?? 0,
        date: run.date.toISOString(),
        entryFeeWS: run.totalEntryFeeWS,
        grossWS: 0,
        netWS: 0,
        salesCount: 0,
        dropsCount: dropsCountMap.get(run._id.toString()) ?? 0,
        cumulativeNetWS: 0,
      });
    });

    // Add sales data to runs
    sales.forEach((sale) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runData = sale.run as any;
      if (runData && runData._id) {
        const runIdStr = runData._id.toString();
        const existing = runEarningsMap.get(runIdStr);
        if (existing) {
          existing.grossWS += sale.totalPriceWS;
          existing.netWS += sale.netAfterFeesWS;
          existing.salesCount += 1;
        }
      }
    });

    // Sort by date and calculate cumulative
    const runEarnings = Array.from(runEarningsMap.values()).sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    let runCumulativeNet = 0;
    runEarnings.forEach((run) => {
      runCumulativeNet += run.netWS;
      run.cumulativeNetWS = Math.round(runCumulativeNet * 100) / 100;
      run.grossWS = Math.round(run.grossWS * 100) / 100;
      run.netWS = Math.round(run.netWS * 100) / 100;
    });

    return res.json({
      totals: {
        grossWS: Math.round(totalGrossWS * 100) / 100,
        netWS: Math.round(totalNetWS * 100) / 100,
        totalSales: sales.length,
        totalRuns: runs.length,
      },
      monthlyEarnings,
      runEarnings,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch profile stats" });
  }
};

// Get stats for a specific player
const getPlayerStats = async (
  _req: AuthedRequest,
  res: Response,
  playerId: string
) => {
  try {
    // Verify player exists
    const player = await Player.findById(playerId);
    if (!player) {
      return res.status(404).json({ message: "Player not found" });
    }

    // Get runs where this player participated
    const runs = await Run.find({
      "participants.player": playerId,
    })
      .populate("host")
      .sort({ date: 1 });

    const runIds = runs.map((r) => r._id);

    // Get sales from those runs that have splits for this player
    const sales = await Sale.find({
      run: { $in: runIds },
      "splitDetails.player": playerId,
    })
      .populate({
        path: "run",
        select: "date runNumber totalEntryFeeWS",
      })
      .sort({ date: 1 });

    // Get drops count per run for this player
    const dropsCounts = await WeaponDrop.aggregate([
      { $match: { run: { $in: runIds } } },
      { $group: { _id: "$run", count: { $sum: 1 } } },
    ]);
    const dropsCountMap = new Map<string, number>();
    dropsCounts.forEach((d) => {
      dropsCountMap.set(d._id.toString(), d.count);
    });

    // Calculate player's totals from their split details
    let totalGrossWS = 0;
    let totalNetWS = 0;
    let totalSalesCount = 0;

    sales.forEach((sale) => {
      const playerSplit = sale.splitDetails.find(
        (sd) => sd.player.toString() === playerId
      );
      if (playerSplit) {
        totalNetWS += playerSplit.amountWS;
        totalSalesCount += 1;
      }
      // For gross, we count the full sale amount divided by participants for simplicity
      // Or we can show the player's share
      totalGrossWS += sale.totalPriceWS / (sale.splitDetails.length || 1);
    });

    // Group by month for monthly earnings (player's share)
    const monthlyMap = new Map<string, MonthlyEarning>();

    sales.forEach((sale) => {
      const playerSplit = sale.splitDetails.find(
        (sd) => sd.player.toString() === playerId
      );
      if (!playerSplit) return;

      const d = new Date(sale.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(monthKey) || {
        month: monthKey,
        grossWS: 0,
        netWS: 0,
        salesCount: 0,
        runsCount: 0,
      };
      existing.grossWS += sale.totalPriceWS / (sale.splitDetails.length || 1);
      existing.netWS += playerSplit.amountWS;
      existing.salesCount += 1;
      monthlyMap.set(monthKey, existing);
    });

    // Count runs per month
    runs.forEach((run) => {
      const d = new Date(run.date);
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const existing = monthlyMap.get(monthKey);
      if (existing) {
        existing.runsCount += 1;
      } else {
        monthlyMap.set(monthKey, {
          month: monthKey,
          grossWS: 0,
          netWS: 0,
          salesCount: 0,
          runsCount: 1,
        });
      }
    });

    const monthlyEarnings = Array.from(monthlyMap.values()).sort(
      (a, b) => a.month.localeCompare(b.month)
    );

    // Calculate per-run earnings for this player
    const runEarningsMap = new Map<string, RunEarning>();

    // Initialize with player's runs
    runs.forEach((run) => {
      runEarningsMap.set(run._id.toString(), {
        runId: run._id.toString(),
        runNumber: run.runNumber ?? 0,
        date: run.date.toISOString(),
        entryFeeWS: run.totalEntryFeeWS,
        grossWS: 0,
        netWS: 0,
        salesCount: 0,
        dropsCount: dropsCountMap.get(run._id.toString()) ?? 0,
        cumulativeNetWS: 0,
      });
    });

    // Add player's share from sales to runs
    sales.forEach((sale) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const runData = sale.run as any;
      if (!runData || !runData._id) return;

      const runIdStr = runData._id.toString();
      const existing = runEarningsMap.get(runIdStr);
      if (!existing) return;

      const playerSplit = sale.splitDetails.find(
        (sd) => sd.player.toString() === playerId
      );
      if (playerSplit) {
        existing.grossWS += sale.totalPriceWS / (sale.splitDetails.length || 1);
        existing.netWS += playerSplit.amountWS;
        existing.salesCount += 1;
      }
    });

    // Sort by date and calculate cumulative
    const runEarnings = Array.from(runEarningsMap.values()).sort(
      (a, b) => a.date.localeCompare(b.date)
    );

    let runCumulativeNet = 0;
    runEarnings.forEach((run) => {
      runCumulativeNet += run.netWS;
      run.cumulativeNetWS = Math.round(runCumulativeNet * 100) / 100;
      run.grossWS = Math.round(run.grossWS * 100) / 100;
      run.netWS = Math.round(run.netWS * 100) / 100;
    });

    return res.json({
      player: {
        _id: player._id,
        name: player.name,
      },
      totals: {
        grossWS: Math.round(totalGrossWS * 100) / 100,
        netWS: Math.round(totalNetWS * 100) / 100,
        totalSales: totalSalesCount,
        totalRuns: runs.length,
      },
      monthlyEarnings,
      runEarnings,
    });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res.status(500).json({ message: "Failed to fetch player stats" });
  }
};
