import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getProfileStats } from "../controllers/stats";

const router = Router();

router.use(authMiddleware);

router.get("/profile", getProfileStats);

export default router;
