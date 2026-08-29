import { Router, type NextFunction, type RequestHandler, type Response } from "express";
import { hasPermission, requireAuth } from "../auth/middleware";
import type { AuthUser } from "../auth/types";
import { postgresPreviasRepository, type PreviasRepository } from "./repository";
import type { PreviaInput, ResolvedParticipant } from "./types";
import { parsePreviaInput, PreviaValidationError } from "./validation";

export function createPreviasRouter(
  repository: PreviasRepository = postgresPreviasRepository,
  authMiddleware: RequestHandler = requireAuth
): Router {
  const router = Router();

  router.use(authMiddleware);

  router.get("/", async (req, res, next) => {
    try {
      res.json({ previas: await repository.listVisible(req.user.id, isAdmin(req.user)) });
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const previa = await repository.findVisible(req.user.id, isAdmin(req.user), req.params.id);
      if (!previa) {
        res.status(404).json({ error: "previa_not_found" });
        return;
      }

      res.json({ previa });
    } catch (error) {
      next(error);
    }
  });

  router.post("/", async (req, res, next) => {
    try {
      if (!canCreatePrevia(req.user)) {
        res.status(403).json({ error: "forbidden" });
        return;
      }

      const input = parsePreviaInput(req.body);
      const duplicate = await repository.findByLegacyId(input.legacyId);
      if (duplicate) {
        res.status(409).json({ error: "previa_already_exists" });
        return;
      }

      const participants = await resolveAndValidateParticipants(repository, input);
      const previa = await repository.createPrevia(req.user.id, input, participants);
      res.status(201).json({ previa });
    } catch (error) {
      handlePreviasError(error, res, next);
    }
  });

  router.patch("/:id", async (req, res, next) => {
    try {
      const existing = await repository.findForMutation(req.user.id, isAdmin(req.user), req.params.id);
      if (!existing) {
        res.status(404).json({ error: "previa_not_found" });
        return;
      }

      const input = parsePreviaInput(req.body);
      const duplicate = await repository.findByLegacyId(input.legacyId);
      if (duplicate && duplicate.id !== existing.id) {
        res.status(409).json({ error: "previa_already_exists" });
        return;
      }

      const participants = await resolveAndValidateParticipants(repository, input);
      const previa = await repository.updatePrevia(existing.id, input, participants);
      if (!previa) {
        res.status(404).json({ error: "previa_not_found" });
        return;
      }

      res.json({ previa });
    } catch (error) {
      handlePreviasError(error, res, next);
    }
  });

  router.delete("/:id", async (req, res, next) => {
    try {
      const existing = await repository.findForMutation(req.user.id, isAdmin(req.user), req.params.id);
      if (!existing) {
        res.status(404).json({ error: "previa_not_found" });
        return;
      }

      await repository.deletePrevia(existing.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const previasRouter = createPreviasRouter();

async function resolveAndValidateParticipants(
  repository: PreviasRepository,
  input: PreviaInput
): Promise<ResolvedParticipant[]> {
  const participants = await repository.resolveParticipants(input.participantIds);
  if (participants.length !== input.participantIds.length) {
    throw new PreviaValidationError("participant_not_found");
  }

  const uniqueResolved = new Set(participants.map((participant) => participant.id));
  if (uniqueResolved.size !== participants.length) {
    throw new PreviaValidationError("duplicate_participants");
  }

  return participants;
}

function canCreatePrevia(user: AuthUser): boolean {
  return hasPermission(user, "create_previa");
}

function isAdmin(user: AuthUser): boolean {
  return user.role === "admin";
}

function handlePreviasError(error: unknown, res: Response, next: NextFunction): void {
  if (error instanceof PreviaValidationError) {
    res.status(400).json({ error: error.message });
    return;
  }

  next(error);
}
