import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth";
import {
  listPlayers,
  createPlayer,
  updatePlayer,
  setPlayerSplitsPaid,
} from "../controllers/players";

const router = Router();

router.use(authMiddleware);

router.get("/", listPlayers);
router.post("/", requireRole(["host"]), createPlayer);
router.put("/:id", requireRole(["host"]), updatePlayer);
router.post("/:id/splits/paid", requireRole(["host"]), setPlayerSplitsPaid);

export default router;

