import { Router } from "express";
import type { Db } from "@paperclipai/db";
import { z } from "zod";
import { validate } from "../middleware/validate.js";
import { meetingService } from "../services/meetings.js";
import { heartbeatService } from "../services/heartbeat.js";
import { publishLiveEvent } from "../services/live-events.js";
import { assertCompanyAccess, getActorInfo } from "./authz.js";
import { logActivity } from "../services/activity-log.js";

// Schemas for validation
const createMeetingSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["sync", "async"]),
  participantAgentIds: z.array(z.string().uuid()).default([]),
  scheduledAt: z.string().datetime().nullable().optional(),
  initiatedByAgentId: z.string().uuid().optional(),
});

const concludeMeetingSchema = z.object({
  summary: z.string().nullable().optional(),
  actionItemIssueIds: z.array(z.string().uuid()).optional(),
});

const createMeetingMessageSchema = z.object({
  content: z.string().min(1),
  contentType: z.enum(["text", "action_request", "action_result"]).optional(),
  actionPayload: z.record(z.unknown()).nullable().optional(),
  senderAgentId: z.string().uuid().optional(),
});

const addParticipantSchema = z.object({
  agentId: z.string().uuid().nullable().optional(),
});

export function meetingRoutes(db: Db) {
  const router = Router();
  const svc = meetingService(db);
  const heartbeatSvc = heartbeatService(db);

  // 회의 목록
  router.get("/companies/:companyId/meetings", async (req, res) => {
    const companyId = req.params.companyId as string;
    assertCompanyAccess(req, companyId);
    const result = await svc.list(companyId);
    res.json(result);
  });

  // 회의 생성
  router.post(
    "/companies/:companyId/meetings",
    validate(createMeetingSchema),
    async (req, res) => {
      const companyId = req.params.companyId as string;
      assertCompanyAccess(req, companyId);

      const initiatedById = req.body.initiatedByAgentId ?? null;
      const meeting = await svc.create(companyId, req.body, initiatedById);

      // 참여 에이전트 wake
      const wakeReason =
        req.body.type === "sync" ? "sync_meeting_started" : "async_meeting_invited";
      for (const agentId of req.body.participantAgentIds) {
        void heartbeatSvc.wakeup(agentId, {
          source: "on_demand",
          triggerDetail: "system",
          reason: wakeReason,
          contextSnapshot: {
            meetingId: meeting.id,
            meetingTitle: meeting.title,
            wakeReason,
          },
        }).catch(() => {
          // wake 실패가 회의 생성을 막지 않음
        });
      }

      // 라이브 이벤트 브로드캐스트
      publishLiveEvent({
        companyId,
        type: "meeting.started" as any,
        payload: {
          meetingId: meeting.id,
          title: meeting.title,
          type: meeting.type,
          participantAgentIds: req.body.participantAgentIds,
        },
      });

      // 활동 로그
      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "meeting.created",
        entityType: "meeting",
        entityId: meeting.id,
        details: { title: meeting.title, type: meeting.type },
      });

      res.status(201).json(meeting);
    },
  );

  // 회의 상세
  router.get("/meetings/:meetingId", async (req, res) => {
    const meetingId = req.params.meetingId as string;
    const meeting = await svc.get(meetingId);
    if (!meeting) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    assertCompanyAccess(req, meeting.companyId);
    res.json(meeting);
  });

  // 회의 종료
  router.post(
    "/meetings/:meetingId/conclude",
    validate(concludeMeetingSchema),
    async (req, res) => {
      const meetingId = req.params.meetingId as string;
      const meeting = await svc.get(meetingId);
      if (!meeting) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      assertCompanyAccess(req, meeting.companyId);

      if (meeting.status === "concluded" || meeting.status === "cancelled") {
        res.status(409).json({ error: "이미 종료된 회의입니다." });
        return;
      }

      const updated = await svc.conclude(meetingId, req.body);

      publishLiveEvent({
        companyId: meeting.companyId,
        type: "meeting.concluded" as any,
        payload: {
          meetingId: updated.id,
          summary: updated.summary,
        },
      });

      const actor = getActorInfo(req);
      await logActivity(db, {
        companyId: meeting.companyId,
        actorType: actor.actorType,
        actorId: actor.actorId,
        agentId: actor.agentId,
        action: "meeting.concluded",
        entityType: "meeting",
        entityId: updated.id,
        details: { summary: updated.summary },
      });

      res.json(updated);
    },
  );

  // 회의 취소
  router.delete("/meetings/:meetingId", async (req, res) => {
    const meetingId = req.params.meetingId as string;
    const meeting = await svc.get(meetingId);
    if (!meeting) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    assertCompanyAccess(req, meeting.companyId);

    const updated = await svc.cancel(meetingId);

    const actor = getActorInfo(req);
    await logActivity(db, {
      companyId: meeting.companyId,
      actorType: actor.actorType,
      actorId: actor.actorId,
      agentId: actor.agentId,
      action: "meeting.cancelled",
      entityType: "meeting",
      entityId: updated.id,
    });

    res.json(updated);
  });

  // 발언 목록
  router.get("/meetings/:meetingId/messages", async (req, res) => {
    const meetingId = req.params.meetingId as string;
    const meeting = await svc.get(meetingId);
    if (!meeting) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    assertCompanyAccess(req, meeting.companyId);

    const messages = await svc.listMessages(meetingId);
    res.json(messages);
  });

  // 발언 추가
  router.post(
    "/meetings/:meetingId/messages",
    validate(createMeetingMessageSchema),
    async (req, res) => {
      const meetingId = req.params.meetingId as string;
      const meeting = await svc.get(meetingId);
      if (!meeting) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      assertCompanyAccess(req, meeting.companyId);

      if (meeting.status === "concluded" || meeting.status === "cancelled") {
        res.status(409).json({ error: "종료된 회의에는 발언할 수 없습니다." });
        return;
      }

      const senderAgentId = req.body.senderAgentId ?? null;
      const message = await svc.addMessage(meetingId, senderAgentId, req.body);

      publishLiveEvent({
        companyId: meeting.companyId,
        type: "meeting.message" as any,
        payload: { message },
      });

      // 동기 회의인 경우 다른 참여자들 wake
      if (meeting.type === "sync" && senderAgentId) {
        const participants = await svc.getParticipants(meetingId);
        for (const p of participants) {
          if (p.agentId && p.agentId !== senderAgentId) {
            void heartbeatSvc.wakeup(p.agentId, {
              source: "on_demand",
              triggerDetail: "system",
              reason: "sync_meeting_message",
              contextSnapshot: {
                meetingId: meeting.id,
                messageId: message.id,
                wakeReason: "sync_meeting_message",
              },
            }).catch(() => {});
          }
        }
      }

      res.status(201).json(message);
    },
  );

  // 참여자 목록
  router.get("/meetings/:meetingId/participants", async (req, res) => {
    const meetingId = req.params.meetingId as string;
    const meeting = await svc.get(meetingId);
    if (!meeting) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    assertCompanyAccess(req, meeting.companyId);

    const participants = await svc.getParticipants(meetingId);
    res.json(participants);
  });

  // 참여자 추가
  router.post(
    "/meetings/:meetingId/participants",
    validate(addParticipantSchema),
    async (req, res) => {
      const meetingId = req.params.meetingId as string;
      const meeting = await svc.get(meetingId);
      if (!meeting) {
        res.status(404).json({ error: "Not found" });
        return;
      }
      assertCompanyAccess(req, meeting.companyId);

      const participant = await svc.addParticipant(meetingId, req.body.agentId ?? null);
      res.status(201).json(participant);
    },
  );

  return router;
}
