import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth";
import {
  listRuns,
  createRun,
  getRun,
  updateRun,
  deleteRun,
  getRunSummary,
} from "../controllers/runs";
import { setRunSplitsPaid } from "../controllers/runSplits";

const router = Router();

// Public read-only routes
router.get("/", listRuns);
router.get("/:id", getRun);
router.get("/:id/summary", getRunSummary);

// Protected write routes
router.post("/", authMiddleware, requireRole(["host"]), createRun);
router.put("/:id", authMiddleware, requireRole(["host"]), updateRun);
router.delete("/:id", authMiddleware, requireRole(["host"]), deleteRun);
router.post("/:id/splits/paid", authMiddleware, requireRole(["host"]), setRunSplitsPaid);

export default router;

