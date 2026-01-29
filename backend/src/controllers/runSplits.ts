import { Response } from "express";
import { AuthedRequest } from "../middleware/auth";
import { Run } from "../models/Run";
import { Sale } from "../models/Sale";

export const setRunSplitsPaid = async (req: AuthedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { paid } = req.body as { paid?: boolean };
    const isPaid = paid ?? true;

    const run = await Run.findById(id);
    if (!run) {
      return res.status(404).json({ message: "Run not found" });
    }

    await Sale.updateMany(
      { run: id },
      { $set: { "splitDetails.$[].isPaid": isPaid, isSettled: isPaid } }
    );

    return res.status(200).json({ success: true });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error(err);
    return res
      .status(500)
      .json({ message: "Failed to update split payment status" });
  }
};

