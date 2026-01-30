import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth";
import {
  listPlayers,
  createPlayer,
  updatePlayer,
  setPlayerSplitsPaid,
} from "../controllers/players";

const router = Router();

// Public read-only routes
router.get("/", listPlayers);

// Protected write routes
router.post("/", authMiddleware, requireRole(["host"]), createPlayer);
router.put("/:id", authMiddleware, requireRole(["host"]), updatePlayer);
router.post("/:id/splits/paid", authMiddleware, requireRole(["host"]), setPlayerSplitsPaid);

export default router;

