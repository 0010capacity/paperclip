import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { ADVISORY_ACTIONS } from "@paperclipai/shared";
import { validate } from "../middleware/validate.js";
import { advisoryService } from "../services/advisory.js";
import { heartbeatService } from "../services/heartbeat.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

// Schemas for validation
const createAdvisorySchema = z.object({
  agentId: z.string().uuid(),
  action: z.enum(ADVISORY_ACTIONS),
  summary: z.string().min(1),
  linkedIssueIds: z.array(z.string().uuid()).optional(),
  linkedGoalIds: z.array(z.string().uuid()).optional(),
});

export function advisoryRoutes(db: Db) {
  const router = Router();
  const svc = advisoryService(db);
  const heartbeatSvc = heartbeatService(db);

  // Advisory 목록
  router.get("/companies/:companyId/advisories", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const advisories = await svc.list(companyId);
    res.json(advisories);
  });

  // Advisory 생성 (에이전트가 호출)
  router.post(
    "/companies/:companyId/advisories",
    validate(createAdvisorySchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const entry = await svc.create(companyId, req.body.agentId, req.body.action, {
        summary: req.body.summary,
        linkedIssueIds: req.body.linkedIssueIds ?? [],
        linkedGoalIds: req.body.linkedGoalIds ?? [],
      });

      res.status(201).json(entry);
    },
  );

  // Advisory → Proposal 승격 요청
  router.post("/advisories/:advisoryId/promote", async (req, res) => {
    const advisoryId = req.params.advisoryId as string;

    // advisory(activity_log 항목)를 찾아서 해당 에이전트를 wake
    const advisory = await svc.getById(advisoryId);

    if (!advisory) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    assertCompanyAccess(req, advisory.companyId);

    if (!advisory.agentId) {
      res.status(400).json({ error: "Advisory에 에이전트 정보가 없습니다." });
      return;
    }

    await heartbeatSvc.wakeup(advisory.agentId, {
      source: "on_demand",
      triggerDetail: "system",
      reason: "advisory_promote_requested",
      contextSnapshot: {
        advisoryId,
        originalSummary: advisory.details,
        wakeReason: "advisory_promote_requested",
      },
    });

    res.json({ ok: true, message: "에이전트에게 Proposal 생성을 요청했습니다." });
  });

  return router;
}
