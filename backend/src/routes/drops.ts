import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth";
import {
  listDropsForRun,
  createDropForRun,
  disenchantDrop,
} from "../controllers/drops";

const router = Router();

router.use(authMiddleware);

router.get("/runs/:runId/drops", listDropsForRun);
router.post(
  "/runs/:runId/drops",
  requireRole(["host", "runner"]),
  createDropForRun
);
router.post(
  "/:dropId/disenchant",
  requireRole(["host", "runner"]),
  disenchantDrop
);

export default router;

