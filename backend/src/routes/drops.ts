import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth";
import {
  listDropsForRun,
  createDropForRun,
  updateDrop,
  disenchantDrop,
} from "../controllers/drops";

const router = Router();

// Public read-only routes
router.get("/runs/:runId/drops", listDropsForRun);

// Protected write routes
router.post(
  "/runs/:runId/drops",
  authMiddleware,
  requireRole(["host", "runner"]),
  createDropForRun
);
router.put(
  "/:dropId",
  authMiddleware,
  requireRole(["host", "runner"]),
  updateDrop
);
router.post(
  "/:dropId/disenchant",
  authMiddleware,
  requireRole(["host", "runner"]),
  disenchantDrop
);

export default router;

