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

router.use(authMiddleware);

router.get("/", listRuns);
router.post("/", requireRole(["host"]), createRun);
router.get("/:id", getRun);
router.put("/:id", requireRole(["host"]), updateRun);
router.delete("/:id", requireRole(["host"]), deleteRun);
router.get("/:id/summary", getRunSummary);
router.post("/:id/splits/paid", requireRole(["host"]), setRunSplitsPaid);

export default router;

