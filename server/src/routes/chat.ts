import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { chatService } from "../services/chat.js";
import { heartbeatService } from "../services/heartbeat.js";
import { publishLiveEvent } from "../services/live-events.js";
import { agentService } from "../services/agents.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";

// Schemas for validation
const sendChatMessageSchema = z.object({
  content: z.string().min(1),
});

const resolveChatActionSchema = z.object({
  decision: z.enum(["confirmed", "rejected"]),
});

export function chatRoutes(db: Db) {
  const router = Router();
  const svc = chatService(db);
  const heartbeatSvc = heartbeatService(db);
  const agentsSvc = agentService(db);

  // 채팅 메시지 목록
  router.get("/companies/:companyId/chat", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);

    const limit = Number(req.query.limit) || 50;
    const messages = await svc.list(companyId, limit);
    // 시간순 정렬 (오래된 것 먼저)
    res.json(messages.reverse());
  });

  // 메시지 전송 (사용자 → 비서)
  router.post(
    "/companies/:companyId/chat",
    validate(sendChatMessageSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const actor = getActorInfo(req);
      const message = await svc.send(companyId, "user", actor.actorType === "user" ? actor.actorId : null, req.body);

      publishLiveEvent({
        companyId,
        type: "chat.message" as any,
        payload: { message },
      });

      // 비서 에이전트 wake
      const agents = await agentsSvc.list(companyId);
      const secretary = agents.find((a) => a.role === "ceo" || a.role === "general");
      if (secretary) {
        void heartbeatSvc.wakeup(secretary.id, {
          source: "on_demand",
          triggerDetail: "system",
          reason: "user_chat_message",
          contextSnapshot: {
            messageId: message.id,
            content: message.content,
            wakeReason: "user_chat_message",
          },
        }).catch(() => {});
      }

      res.status(201).json(message);
    },
  );

  // 인라인 액션 응답 (사용자가 승인/거부)
  router.post(
    "/chat/:messageId/action",
    validate(resolveChatActionSchema),
    async (req, res) => {
      const messageId = req.params.messageId as string;
      const message = await svc.getById(messageId);

      if (!message) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      assertCompanyAccess(req, message.companyId);

      const updated = await svc.resolveAction(messageId, req.body.decision);
      if (!updated) {
        res.status(404).json({ error: "Not found" });
        return;
      }

      publishLiveEvent({
        companyId: updated.companyId,
        type: "chat.action_resolved" as any,
        payload: {
          messageId: updated.id,
          decision: req.body.decision,
          actionPayload: updated.actionPayload,
        },
      });

      res.json(updated);
    },
  );

  return router;
}
