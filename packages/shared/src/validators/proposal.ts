import { z } from "zod";

// 공통 필드
const ProposalPayloadBaseSchema = z.object({
  summary: z.string().min(1).max(500),
  rationale: z.string().min(1),
  details: z.string().optional(),

  estimatedCost: z
    .object({
      monthlyCents: z.number().int().nonnegative().optional(),
      oneTimeCents: z.number().int().nonnegative().optional(),
      costJustification: z.string().min(1),
    })
    .optional(),

  linkedIssueIds: z.array(z.string().uuid()).optional(),
  linkedGoalIds: z.array(z.string().uuid()).optional(),

  urgency: z.enum(["low", "medium", "high"]).optional(),

  fromMeetingContext: z
    .object({
      meetingType: z.enum(["daily", "weekly", "monthly"]),
      meetingId: z.string().uuid().optional(),
    })
    .optional(),

  onApproveAction: z
    .discriminatedUnion("type", [
      z.object({
        type: z.literal("create_goal"),
        goal: z.object({
          title: z.string().min(1),
          level: z.enum(["company", "team", "agent", "task"]),
          description: z.string().optional(),
          parentId: z.string().uuid().optional(),
        }),
      }),
      z.object({
        type: z.literal("create_project"),
        project: z.object({
          title: z.string().min(1),
          description: z.string().optional(),
          goalId: z.string().uuid().optional(),
        }),
      }),
      z.object({
        type: z.literal("update_budget"),
        agentId: z.string().uuid(),
        newBudgetMonthlyCents: z.number().int().positive(),
      }),
      z.object({
        type: z.literal("create_hire_approval"),
        hirePayload: z.record(z.unknown()),
      }),
      z.object({
        type: z.literal("none"),
      }),
    ])
    .optional(),
});

export const ProposalPayloadSchema = ProposalPayloadBaseSchema;
export type ProposalPayload = z.infer<typeof ProposalPayloadSchema>;

// 유형별 검증기 (type-narrowed)
export const ProposeGoalPayloadSchema = ProposalPayloadBaseSchema.extend({
  onApproveAction: z.object({
    type: z.literal("create_goal"),
    goal: z.object({
      title: z.string().min(1),
      level: z.enum(["company", "team", "agent", "task"]),
      description: z.string().optional(),
      parentId: z.string().uuid().optional(),
    }),
  }),
});

export const RequestBudgetPayloadSchema = ProposalPayloadBaseSchema.extend({
  onApproveAction: z.object({
    type: z.literal("update_budget"),
    agentId: z.string().uuid(),
    newBudgetMonthlyCents: z.number().int().positive(),
  }),
});
