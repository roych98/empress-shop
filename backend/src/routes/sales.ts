import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth";
import { listSales, getSale, createSale } from "../controllers/sales";

const router = Router();

router.use(authMiddleware);

router.get("/", listSales);
router.get("/:id", getSale);
router.post("/", requireRole(["host"]), createSale);

export default router;

