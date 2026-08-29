import { Router, type RequestHandler } from "express";
import { requireAuth } from "../auth/middleware";
import type { MoneyMovement, MovementInput } from "./types";
import { postgresMoneyRepository, type MoneyRepository } from "./repository";
import { parseInitialBalance, parseMovementInput, parseMovementPatch, ValidationError } from "./validation";

export function createMoneyRouter(
  repository: MoneyRepository = postgresMoneyRepository,
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", async (req, res, next) => {
    try {
      res.json(await repository.getUserMoney(req.user.id));
    } catch (error) {
      next(error);
    }
  });

  router.put("/initial-balance", async (req, res, next) => {
    try {
      const amount = parseInitialBalance(req.body);
      const initialBalance = await repository.upsertInitialBalance(req.user.id, amount);
      res.json({ initialBalance });
    } catch (error) {
      handleRouteError(error, res, next);
    }
  });

  router.post("/movements", async (req, res, next) => {
    try {
      const input = parseMovementInput(req.body);
      const movement = await repository.createMovement(req.user.id, input);
      res.status(201).json({ movement });
    } catch (error) {
      handleRouteError(error, res, next);
    }
  });

  router.patch("/movements/:id", async (req, res, next) => {
    try {
      const existing = await repository.findMovementForUser(req.user.id, req.params.id);
      if (!existing) {
        res.status(404).json({ error: "movement_not_found" });
        return;
      }

      const input = parseMovementPatch(req.body, toMovementInput(existing));
      const movement = await repository.updateMovement(req.user.id, req.params.id, input);
      if (!movement) {
        res.status(404).json({ error: "movement_not_found" });
        return;
      }

      res.json({ movement });
    } catch (error) {
      handleRouteError(error, res, next);
    }
  });

  router.delete("/movements/:id", async (req, res, next) => {
    try {
      const deleted = await repository.deleteMovement(req.user.id, req.params.id);
      if (!deleted) {
        res.status(404).json({ error: "movement_not_found" });
        return;
      }

      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const moneyRouter = createMoneyRouter();

function toMovementInput(movement: MoneyMovement): MovementInput {
  return {
    type: movement.type,
    amount: movement.amount,
    category: movement.category,
    description: movement.description,
    movementDate: movement.movementDate,
  };
}

function handleRouteError(error: unknown, res: import("express").Response, next: import("express").NextFunction): void {
  if (error instanceof ValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  next(error);
}
