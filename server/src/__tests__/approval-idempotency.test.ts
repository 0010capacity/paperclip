import { afterEach, describe, expect, it, vi } from "vitest";
import type { Db } from "@paperclipai/db";
import { approvalService, type ApprovalResolutionResult } from "../services/approvals.js";

// Mock the agent service to avoid side effects in tests
vi.mock("../services/agents.js", () => ({
  agentService: () => ({
    activatePendingApproval: vi.fn().mockResolvedValue(undefined),
    create: vi.fn().mockResolvedValue({ id: "new-agent-id" }),
    terminate: vi.fn().mockResolvedValue(undefined),
  }),
}));

// Mock the hire hook to avoid side effects
vi.mock("../services/hire-hook.js", () => ({
  notifyHireApproved: vi.fn().mockResolvedValue(undefined),
}));

function createMockApproval(status: string, type: string = "generic") {
  return {
    id: "approval-1",
    companyId: "company-1",
    type,
    status,
    payload: {},
    requestedByAgentId: null,
    requestedByUserId: null,
    decisionNote: null,
    decidedByUserId: null,
    decidedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe("approval resolution idempotency", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("approve", () => {
    it("returns stateChanged=true when transitioning from pending to approved", async () => {
      const mockApproval = createMockApproval("pending");
      const db = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([mockApproval]),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () =>
                Promise.resolve([
                  {
                    ...mockApproval,
                    status: "approved",
                    decidedByUserId: "user-1",
                    decidedAt: new Date(),
                  },
                ]),
            }),
          }),
        }),
      } as unknown as Db;

      const svc = approvalService(db);
      const result = await svc.approve("approval-1", "user-1");

      expect(result.stateChanged).toBe(true);
      expect(result.approval.status).toBe("approved");
    });

    it("returns stateChanged=false when already approved (idempotent)", async () => {
      const mockApproval = {
        ...createMockApproval("approved"),
        decidedByUserId: "user-1",
        decidedAt: new Date(),
      };
      const db = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([mockApproval]),
          }),
        }),
      } as unknown as Db;

      const svc = approvalService(db);
      const result = await svc.approve("approval-1", "user-2");

      expect(result.stateChanged).toBe(false);
      expect(result.approval.status).toBe("approved");
      // Should preserve original decision info
      expect(result.approval.decidedByUserId).toBe("user-1");
    });

    it("returns stateChanged=true when transitioning from revision_requested to approved", async () => {
      const mockApproval = createMockApproval("revision_requested");
      const db = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([mockApproval]),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () =>
                Promise.resolve([
                  {
                    ...mockApproval,
                    status: "approved",
                    decidedByUserId: "user-1",
                    decidedAt: new Date(),
                  },
                ]),
            }),
          }),
        }),
      } as unknown as Db;

      const svc = approvalService(db);
      const result = await svc.approve("approval-1", "user-1");

      expect(result.stateChanged).toBe(true);
      expect(result.approval.status).toBe("approved");
    });

    it("throws error when trying to approve a rejected approval", async () => {
      const mockApproval = {
        ...createMockApproval("rejected"),
        decidedByUserId: "user-1",
        decidedAt: new Date(),
      };
      const db = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([mockApproval]),
          }),
        }),
      } as unknown as Db;

      const svc = approvalService(db);
      await expect(svc.approve("approval-1", "user-2")).rejects.toThrow(
        "Only pending or revision requested approvals can be approved",
      );
    });
  });

  describe("reject", () => {
    it("returns stateChanged=true when transitioning from pending to rejected", async () => {
      const mockApproval = createMockApproval("pending");
      const db = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([mockApproval]),
          }),
        }),
        update: () => ({
          set: () => ({
            where: () => ({
              returning: () =>
                Promise.resolve([
                  {
                    ...mockApproval,
                    status: "rejected",
                    decidedByUserId: "user-1",
                    decidedAt: new Date(),
                  },
                ]),
            }),
          }),
        }),
      } as unknown as Db;

      const svc = approvalService(db);
      const result = await svc.reject("approval-1", "user-1");

      expect(result.stateChanged).toBe(true);
      expect(result.approval.status).toBe("rejected");
    });

    it("returns stateChanged=false when already rejected (idempotent)", async () => {
      const mockApproval = {
        ...createMockApproval("rejected"),
        decidedByUserId: "user-1",
        decidedAt: new Date(),
      };
      const db = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([mockApproval]),
          }),
        }),
      } as unknown as Db;

      const svc = approvalService(db);
      const result = await svc.reject("approval-1", "user-2");

      expect(result.stateChanged).toBe(false);
      expect(result.approval.status).toBe("rejected");
      // Should preserve original decision info
      expect(result.approval.decidedByUserId).toBe("user-1");
    });

    it("throws error when trying to reject an approved approval", async () => {
      const mockApproval = {
        ...createMockApproval("approved"),
        decidedByUserId: "user-1",
        decidedAt: new Date(),
      };
      const db = {
        select: () => ({
          from: () => ({
            where: () => Promise.resolve([mockApproval]),
          }),
        }),
      } as unknown as Db;

      const svc = approvalService(db);
      await expect(svc.reject("approval-1", "user-2")).rejects.toThrow(
        "Only pending or revision requested approvals can be rejected",
      );
    });
  });
});
