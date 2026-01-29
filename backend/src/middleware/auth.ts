import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env";
import { UserRole } from "../models/User";

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    role: UserRole;
    email: string;
  };
}

export const authMiddleware = (
  req: AuthedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(401).json({ message: "Missing Authorization header" });
  }

  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Invalid Authorization header" });
  }

  try {
    const payload = jwt.verify(token, env.jwtSecret) as {
      id: string;
      role: UserRole;
      email: string;
    };
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ message: "Invalid token" });
  }
};

export const requireRole = (roles: UserRole[]) => {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};

