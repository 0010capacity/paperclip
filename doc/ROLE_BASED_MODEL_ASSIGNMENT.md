# Role-Based Model Assignment

> **관련 문서**
> - 전략 부서 역할(CSO, FuturesResearcher, BusinessAnalyst) 정의: `doc/AUTONOMOUS-COMPANY-ROADMAP.md` §Phase 2
> - 이 문서는 어댑터/모델 선택 시스템의 정본(canonical spec)이다.
>   ROADMAP의 `§4.10`은 이 문서를 참조한다.

## Overview

에이전트 역할에 따라 서로 다른 모델과 프로바이더를 할당하는 시스템.

**핵심 아이디어**:
- 실무진(개발자, 마케터): 비용 효율적인 모델 사용
- 의사결정자(CEO, CSO, CTO): 고품질 비싼 모델 사용
- 부서별 최적 프로바이더: 재무→OpenAI, 마케팅→Google, 코딩→Zai/Anthropic
- 전략 부서(Phase 2 신규): CSO, FuturesResearcher, BusinessAnalyst

## Current Status

### ✅ 이미 구현됨 (Backend)

1. **에이전트별 어댑터 설정**
   - 각 에이전트는 `adapterType`과 `adapterConfig`를 독립적으로 보유
   - DB 스키마에 이미 존재

2. **OpenCode 모델 전달**
   ```typescript
   // packages/adapters/opencode-local/src/server/execute.ts
   const model = asString(config.model, "").trim();
   if (model) args.push("--model", model);  // provider/model 형식
   ```

3. **모델 목록 조회 API**
   ```typescript
   // packages/adapters/opencode-local/src/server/models.ts
   export async function listOpenCodeModels(): Promise<AdapterModel[]>
   ```

### ❌ 구현 필요 (Frontend)

1. 어댑터 선택 UI 개선
2. OpenCode 선택 시 모델/프로바이더 선택 UI
3. 모델 목록 캐싱 및 검색

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Agent Configuration                       │
├─────────────────────────────────────────────────────────────────┤
│  adapterType: "opencode_local" | "claude_local" | "codex_local" │
│  adapterConfig: {                                                │
│    model: "provider/model",     // opencode_local only          │
│    variant: "low" | "medium" | "high",                          │
│    ...                                                           │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

## Example Configuration

### 역할별 모델 매트릭스

#### V1 기본 역할

| Role | Adapter | Model | Reason |
|------|---------|-------|--------|
| CEO | opencode_local | anthropic/claude-opus-4 | 최고 품질 의사결정, 회의 총괄 |
| CFO | opencode_local | openai/gpt-4o | 재무 분석 최적화 |
| CMO | opencode_local | google/gemini-pro | 창의적 콘텐츠 |
| CTO | opencode_local | anthropic/claude-sonnet-4 | 기술 아키텍처 결정 |
| Developer A | opencode_local | zai/zai-coding | 비용 효율적 코딩 |
| Developer B | claude_local | (default) | Claude Code 직접 |
| Marketing Staff | opencode_local | google/gemini-flash | 저비용 대량 작업 |
| Support | opencode_local | openai/gpt-4o-mini | 저비용 반복 응대 |

#### Phase 2 신규 — 전략 부서 역할

> 전략 부서 역할의 정의와 capabilities는 `AUTONOMOUS-COMPANY-ROADMAP.md §2.2` 참조.

| Role | Adapter | Model | Reason |
|------|---------|-------|--------|
| CSO | opencode_local | anthropic/claude-sonnet-4 | 전략적 사고, 시장 분석 |
| FuturesResearcher | opencode_local | anthropic/claude-sonnet-4 | 트렌드 분석, 시나리오 플래닝 |
| BusinessAnalyst | opencode_local | openai/gpt-4o | KPI 분석, 리포트 생성 |

### 설정 예시

```json
{
  "name": "CEO Agent",
  "role": "ceo",
  "adapterType": "opencode_local",
  "adapterConfig": {
    "model": "anthropic/claude-opus-4",
    "variant": "max",
    "timeoutSec": 1800,
    "instructionsFilePath": "/agents/ceo/instructions.md"
  }
}
```

```json
{
  "name": "Developer Agent",
  "role": "developer",
  "adapterType": "opencode_local",
  "adapterConfig": {
    "model": "zai/zai-coding",
    "variant": "medium",
    "timeoutSec": 3600
  }
}
```

## Implementation Plan

### Phase 1: UI 개선 (Frontend)

#### 1.1 어댑터 선택 컴포넌트

```tsx
// ui/src/components/AgentAdapterSelector.tsx

interface Props {
  adapterType: string;
  adapterConfig: Record<string, unknown>;
  onChange: (type: string, config: Record<string, unknown>) => void;
}

// 어댑터 타입 선택
<select value={adapterType} onChange={...}>
  <option value="claude_local">Claude Code (Local)</option>
  <option value="opencode_local">OpenCode (Multi-Provider)</option>
  <option value="codex_local">Codex (OpenAI)</option>
  <option value="process">Process (Shell)</option>
</select>
```

#### 1.2 모델 선택 컴포넌트 (OpenCode 전용)

```tsx
// ui/src/components/OpenCodeModelSelector.tsx

interface Props {
  model: string;
  onChange: (model: string) => void;
}

// 1. 프로바이더 그룹핑
const providers = groupBy(models, m => m.id.split('/')[0]);
// anthropic: [claude-opus-4, claude-sonnet-4, ...]
// openai: [gpt-4o, gpt-4-turbo, ...]
// google: [gemini-pro, gemini-flash, ...]
// zai: [zai-coding, ...]

// 2. 계층적 선택 UI
<select provider>
  <option>Anthropic</option>
  <option>OpenAI</option>
  <option>Google</option>
  <option>Zai</option>
</select>

<select model>
  {/* 선택된 프로바이더의 모델 목록 */}
</select>
```

#### 1.3 모델 목록 API 연동

```typescript
// ui/src/api/adapters.ts

export async function getOpenCodeModels(): Promise<AdapterModel[]> {
  const response = await fetch('/api/adapters/opencode_local/models');
  return response.json();
}
```

```typescript
// server/src/routes/adapters.ts (신규)

router.get('/adapters/opencode_local/models', async (req, res) => {
  const models = await listOpenCodeModels();
  res.json(models);
});
```

### Phase 2: 모델 추천 시스템 (Optional)

#### 2.1 역할별 기본 모델 매핑

```typescript
// packages/shared/src/role-model-defaults.ts

// V1 기본 역할
export const ROLE_MODEL_DEFAULTS: Record<string, { adapter: string; model: string }> = {
  ceo:       { adapter: 'opencode_local', model: 'anthropic/claude-opus-4' },
  cto:       { adapter: 'opencode_local', model: 'anthropic/claude-sonnet-4' },
  cfo:       { adapter: 'opencode_local', model: 'openai/gpt-4o' },
  cmo:       { adapter: 'opencode_local', model: 'google/gemini-pro' },
  developer: { adapter: 'opencode_local', model: 'zai/zai-coding' },
  marketing: { adapter: 'opencode_local', model: 'google/gemini-flash' },
  support:   { adapter: 'opencode_local', model: 'openai/gpt-4o-mini' },

  // Phase 2 신규 — 전략 부서 역할 (AUTONOMOUS-COMPANY-ROADMAP.md §2.2)
  cso:                { adapter: 'opencode_local', model: 'anthropic/claude-sonnet-4' },
  futures_researcher: { adapter: 'opencode_local', model: 'anthropic/claude-sonnet-4' },
  business_analyst:   { adapter: 'opencode_local', model: 'openai/gpt-4o' },
};
```

#### 2.2 에이전트 생성 시 자동 추천

```tsx
// 에이전트 생성 시 역할 선택 → 기본 모델 자동 설정
const handleRoleChange = (role: string) => {
  const defaults = ROLE_MODEL_DEFAULTS[role];
  if (defaults) {
    setAdapterType(defaults.adapter);
    setAdapterConfig({ ...adapterConfig, model: defaults.model });
  }
};
```

> **참고**: 역할 선택 UI에 Phase 2 전략 부서 역할
> (`cso`, `futures_researcher`, `business_analyst`)을 표시할 때는
> "전략 부서 (Phase 2)" 그룹으로 묶어 표현한다.

### Phase 3: 비용 모니터링 (Future)

- 에이전트별 토큰 사용량 추적
- 모델별 비용 계산
- 예산 알림 시스템

## Technical Details

### OpenCode 모델 형식

```
provider/model-id

Examples:
- anthropic/claude-sonnet-4-5
- openai/gpt-4o
- google/gemini-3.1-pro-preview
- zai/zai-coding
```

### 모델 검증 흐름

```
1. 에이전트 생성/수정 시
   ↓
2. adapterConfig.model 값 확인
   ↓
3. ensureOpenCodeModelConfiguredAndAvailable() 호출
   ↓
4. opencode models 명령으로 사용 가능한 모델인지 검증
   ↓
5. 검증 실패 시 에러 반환 (사용 가능한 모델 목록 포함)
```

### 캐싱 전략

```typescript
// 60초 TTL 캐시
const MODELS_CACHE_TTL_MS = 60_000;

// command + cwd + env 기반 캐시 키
function discoveryCacheKey(command, cwd, env) {
  // 프로바이더 인증 상태도 env 해시에 포함
}
```

## Migration Guide

### 기존 에이전트 마이그레이션

기존 `claude_local` 어댑터를 사용하는 에이전트는 그대로 동작.

새로운 모델 설정이 필요한 경우:

1. 어댑터를 `opencode_local`로 변경
2. 모델 선택 (`anthropic/claude-sonnet-4-5` 권장)
3. 기존 세션은 초기화됨 (세션 미지원)

### 호환성 매트릭스

| Old Adapter | New Adapter | Session Support | Migration |
|-------------|-------------|-----------------|-----------|
| claude_local | claude_local | ✅ 유지 | 변경 없음 |
| claude_local | opencode_local | ⚠️ 초기화 | 수동 전환 |
| codex_local | codex_local | ✅ 유지 | 변경 없음 |

## Files to Modify

### Backend (없음 - 이미 구현됨)

### Frontend (신규/수정)

| File | Action | Description |
|------|--------|-------------|
| `ui/src/components/AgentAdapterSelector.tsx` | 신규 | 어댑터 선택 컴포넌트 |
| `ui/src/components/OpenCodeModelSelector.tsx` | 신규 | 모델 선택 컴포넌트 |
| `ui/src/api/adapters.ts` | 수정 | 모델 목록 API 추가 |
| `ui/src/pages/AgentForm.tsx` | 수정 | 새 컴포넌트 통합 |
| `server/src/routes/adapters.ts` | 수정 | 모델 목록 엔드포인트 추가 |

### Shared (신규)

| File | Action | Description |
|------|--------|-------------|
| `packages/shared/src/role-model-defaults.ts` | 신규 | 역할별 기본 모델 매핑 |

## Testing Checklist

- [ ] 어댑터 타입 변경 시 UI 반응
- [ ] OpenCode 선택 시 모델 목록 로드
- [ ] 프로바이더별 모델 필터링
- [ ] 모델 검증 에러 처리
- [ ] 기존 에이전트 호환성
- [ ] 세션 유지/초기화 동작

## References

- `packages/adapters/opencode-local/src/server/execute.ts` - 실행 로직
- `packages/adapters/opencode-local/src/server/models.ts` - 모델 검증
- `packages/adapters/opencode-local/src/index.ts` - 설정 문서
