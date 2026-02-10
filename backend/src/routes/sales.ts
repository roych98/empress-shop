import { Router } from "express";
import { authMiddleware, requireRole } from "../middleware/auth";
import { listSales, getSale, createSale, updateSale } from "../controllers/sales";

const router = Router();

// Public read-only routes
router.get("/", listSales);
router.get("/:id", getSale);

// Protected write routes
router.post("/", authMiddleware, requireRole(["host"]), createSale);
router.put("/:id", authMiddleware, requireRole(["host"]), updateSale);

export default router;

