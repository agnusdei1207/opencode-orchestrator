# 로컬 검색 및 기억 감쇄 고도화 계획

Date: 2026-06-19
Scope: `opencode-orchestrator` — `src/core/knowledge/` 검색 파이프라인 + 기억 감쇄 시스템
Status: ⏳ PENDING — 구현 결정 대기
Author: 제안서 기반 계획 수립

## Metadata

| Field | Value |
| --- | --- |
| Created | 2026-06-19 15:11 |
| File Name | `PLAN_LocalSearchAndMemoryDecayEnhancement_2026-06-19.md` |
| Scope | 로컬 퍼스트 검색 고도화 (7건) + 기억 감쇄 시스템 (5건), 총 12건 |
| Change Type | Feature / Enhancement |
| Risk Level | MEDIUM–HIGH (단계별 점진 도입) |

## 1. 참조 문서

전체 제안서: [`LOCAL_SEARCH_ENHANCEMENT_PROPOSAL.md`](../../../../proposals/2026-06-19/LOCAL_SEARCH_ENHANCEMENT_PROPOSAL.md)

본 계획은 위 제안서의 12개 항목을 구현 단계로 편성한 실행 계획이다.
제안의 기술적 근거, 의사 코드, 논문 참조는 모두 원 제안서에 수록되어 있다.

## 2. 제안 요약

| # | 제안명 | 카테고리 | 난이도 | 대상 파일 | 상태 |
| --- | --- | --- | --- | --- | --- |
| 1 | PageRank 그래프 스코어링 | 검색 | 🟢 낮음 | `graph-parser.ts` | ⏳ PENDING — 결정 대기 |
| 2 | 위치 인덱스 + 구문 근접 보너스 | 검색 | 🟡 중간 | `hybrid-search.ts` | ⏳ PENDING — 결정 대기 |
| 3 | 코퍼스 기반 질의 확장 (PMI) | 검색 | 🟡 중간 | `hybrid-search.ts` | ⏳ PENDING — 결정 대기 |
| 4 | 로컬 해시 임베딩 (SimHash) | 검색 | 🟡 중간 | `hybrid-search.ts` | ⏳ PENDING — 결정 대기 |
| 5 | ONNX 경량 임베딩 | 검색 | 🟠 중간-높음 | `hybrid-search.ts` | ⏳ PENDING — 결정 대기 |
| 6 | 역할별 가중치 자율 학습 | 검색 | 🟡 중간 | `retrieval-weights.ts` | ⏳ PENDING — 결정 대기 |
| 7 | Learning-to-Rank (RRF 대체) | 검색 | 🔴 높음 | `hybrid-search.ts` | ⏳ PENDING — 결정 대기 |
| 8 | 접근 빈도 추적 | 감쇄 | 🟢 낮음 | `tag-indexer.ts`, `mission-memory.ts` | ⏳ PENDING — 결정 대기 |
| 9 | 적응형 지수 감쇄 (FadeMem) | 감쇄 | 🟡 중간 | `context-provider.ts` | ⏳ PENDING — 결정 대기 |
| 10 | 계층적 압축 파이프라인 | 감쇄 | 🟡 중간 | `memory-consolidation.ts` | ⏳ PENDING — 결정 대기 |
| 11 | 충돌 기반 망각 | 감쇄 | 🟠 중간-높음 | `memory-consolidation.ts` | ⏳ PENDING — 결정 대기 |
| 12 | A-Mem 자율 링킹 | 감쇄 | 🔴 높음 | `graph-parser.ts`, `mission-memory.ts` | ⏳ PENDING — 결정 대기 |

## 3. 영향 파일

| 파일 | 경로 | 변경 범위 | 관련 제안 |
| --- | --- | --- | --- |
| `hybrid-search.ts` | `src/core/knowledge/hybrid-search.ts` | lexicalSearch 확장, 채널 추가, 랭킹 교체 | 2, 3, 4, 5, 7 |
| `graph-parser.ts` | `src/core/knowledge/graph-parser.ts` | pagerank() 추가, 자율 링크 생성 | 1, 12 |
| `tag-indexer.ts` | `src/core/knowledge/tag-indexer.ts` | frontmatter access_count/last_accessed | 8 |
| `retrieval-weights.ts` | `src/core/knowledge/retrieval-weights.ts` | ROLE_WEIGHTS 자동 최적화 | 6 |
| `context-provider.ts` | `src/core/knowledge/context-provider.ts` | 감쇄 함수 적용, 시간 가중치 | 9 |
| `memory-consolidation.ts` | `src/core/knowledge/memory-consolidation.ts` | 4-Tier 압축, 충돌 감지 | 10, 11 |
| `mission-memory.ts` | `src/core/knowledge/mission-memory.ts` | 접근 기록, 자율 링크 | 8, 12 |

## 4. 구현 단계

### Phase 1: 기반 확장 (1–2주) — 제안 1, 4, 8

낮은 난이도 항목 우선. 기존 모듈에 함수를 추가하는 수준으로, 외부 의존성 없음.

| # | 마이크로태스크 | 예상 결과 | 검증 |
| --- | --- | --- | --- |
| 1.1 | `graph-parser.ts`에 `pagerank()` 구현 | 위키링크 그래프에서 PageRank 벡터 산출 | 단위 테스트: 알려진 그래프의 PageRank 값 일치 |
| 1.2 | `hybrid-search.ts`에 graph score 채널 연결 | RRF에 PageRank 채널 참여 | 통합 테스트: 그래프 점수가 최종 순위에 반영 |
| 1.3 | `builder-private` SimHash 로직을 TS로 포팅 | `simhash.ts` 모듈 생성 | 포팅 전후 동일 입력 → 동일 해시 |
| 1.4 | `hybrid-search.ts`에 Dense 채널 신설 | SimHash 유사도 기반 검색 채널 | 단위 테스트: 유사 문서 근접 순위 |
| 1.5 | `tag-indexer.ts` frontmatter에 `access_count`, `last_accessed` 추가 | 문서 접근 시 카운터 증가 및 타임스탬프 갱신 | 통합 테스트: 접근 후 frontmatter 값 변경 확인 |
| 1.6 | `mission-memory.ts`에서 접근 추적 호출 | 문서 조회 시 자동 추적 | e2e: 검색 → 접근 기록 증가 |

Progress:

- [ ] Phase 1
  - [ ] 1.1 PageRank 구현
  - [ ] 1.2 graph score 채널 연결
  - [ ] 1.3 SimHash TS 포팅
  - [ ] 1.4 Dense 채널 신설
  - [ ] 1.5 접근 빈도 frontmatter 확장
  - [ ] 1.6 접근 추적 호출 연결

### Phase 2: 검색 품질 향상 (2–4주) — 제안 2, 3, 9

기존 lexicalSearch 확장과 감쇄 곡선 도입. 중간 난이도.

| # | 마이크로태스크 | 예상 결과 | 검증 |
| --- | --- | --- | --- |
| 2.1 | 위치 인덱스 구축 (`term → [docId, positions]`) | 토큰 위치 정보 저장 | 단위 테스트: 위치 목록 정확성 |
| 2.2 | 구문 근접 보너스 계산 로직 추가 | 질의 토큰 간 거리 기반 보너스 점수 | 근접 토큰 문서의 점수 > 분산 토큰 문서 |
| 2.3 | PMI 동시출현 통계 모듈 구현 | 코퍼스에서 단어 쌍 PMI 계산 | 단위 테스트: 알려진 코퍼스의 PMI 값 |
| 2.4 | 질의 확장 로직 (`expandQuery()`) | 질의어에 PMI 상위 연관어 자동 추가 | 확장된 질의로 recall 향상 측정 |
| 2.5 | 적응형 지수 감쇄 함수 구현 | 태그별 감쇄 상수 `τ_tag`, 에빙하우스 곡선 | 단위 테스트: 시간 경과에 따른 감쇄 값 |
| 2.6 | `context-provider.ts`에 감쇄 가중치 적용 | 오래된 기억의 검색 순위 자연 하강 | 통합 테스트: 최신 문서 우선 순위 확인 |

Progress:

- [ ] Phase 2
  - [ ] 2.1 위치 인덱스 구축
  - [ ] 2.2 구문 근접 보너스
  - [ ] 2.3 PMI 동시출현 통계
  - [ ] 2.4 질의 확장 로직
  - [ ] 2.5 적응형 지수 감쇄
  - [ ] 2.6 감쇄 가중치 적용

### Phase 3: 고급 기능 (4–8주) — 제안 5, 6, 10, 11

외부 의존성(ONNX), 자동 학습, 압축 파이프라인. 중간-높음 난이도.

| # | 마이크로태스크 | 예상 결과 | 검증 |
| --- | --- | --- | --- |
| 3.1 | `onnxruntime-node` 의존성 추가 + all-MiniLM-L6-v2 INT8 모델 번들 | ONNX 런타임 로드 성공 | 로드 테스트: 모델 초기화 < 500ms |
| 3.2 | `embedder.ts` 모듈 구현 | 텍스트 → 384차원 벡터 변환 | 단위 테스트: 유사 문장 코사인 유사도 > 0.8 |
| 3.3 | `hybrid-search.ts`에 ONNX 임베딩 채널 통합 | semantic 채널 RRF 참여 | MRR@10 벤치마크 개선 |
| 3.4 | ROLE_WEIGHTS 자동 최적화 구현 | 역할별 검색 가중치 온라인 학습 | A/B 테스트: 기본값 대비 NDCG 개선 |
| 3.5 | 4-Tier 압축 파이프라인 구현 | Hot → Warm → Cold → Archive 자동 이동 | 통합 테스트: 접근 패턴에 따른 단계 전이 |
| 3.6 | 충돌 감지 로직 구현 | 신규 정보와 기존 기억의 모순 판별 | 단위 테스트: 알려진 충돌 쌍 감지율 |
| 3.7 | 충돌 기반 자동 교체 | 모순 시 구 기억 아카이브 + 신규 승격 | 통합 테스트: 교체 후 최신 정보 검색 확인 |

Progress:

- [ ] Phase 3
  - [ ] 3.1 ONNX 의존성 + 모델 번들
  - [ ] 3.2 embedder.ts 구현
  - [ ] 3.3 ONNX 채널 통합
  - [ ] 3.4 ROLE_WEIGHTS 자동 최적화
  - [ ] 3.5 4-Tier 압축 파이프라인
  - [ ] 3.6 충돌 감지 로직
  - [ ] 3.7 충돌 기반 자동 교체

### Phase 4: 연구 단계 (8주+) — 제안 7, 12

높은 난이도. RRF 전면 교체 및 자율 링킹은 Phase 1–3 결과에 의존.

| # | 마이크로태스크 | 예상 결과 | 검증 |
| --- | --- | --- | --- |
| 4.1 | LtR 학습 데이터 수집 파이프라인 | 클릭/사용 로그 기반 학습 쌍 생성 | 데이터 품질 검증: 양성/음성 쌍 비율 |
| 4.2 | LambdaMART 또는 경량 ranker 학습 | RRF 대체 랭킹 모델 | 오프라인 NDCG@10 > RRF 기준선 |
| 4.3 | `hybrid-search.ts` 랭킹 파이프라인 교체 | 학습 모델 기반 최종 순위 결정 | A/B 테스트: MRR@10 개선 |
| 4.4 | A-Mem 자율 링킹 엔진 구현 | NeurIPS 2025 제텔카스텐 패턴 | 자동 생성 `[[링크]]` 정확도 측정 |
| 4.5 | `graph-parser.ts` 자동 링크 통합 | 기존 위키링크 그래프와 병합 | 그래프 연결성 지표 개선 |
| 4.6 | `mission-memory.ts` 자율 링크 반영 | 미션 기억에 자동 링크 삽입 | e2e: 관련 기억 간 링크 자동 생성 확인 |

Progress:

- [ ] Phase 4
  - [ ] 4.1 LtR 학습 데이터 파이프라인
  - [ ] 4.2 경량 ranker 학습
  - [ ] 4.3 랭킹 파이프라인 교체
  - [ ] 4.4 A-Mem 자율 링킹 엔진
  - [ ] 4.5 자동 링크 그래프 통합
  - [ ] 4.6 자율 링크 미션 기억 반영

## 5. 위험 요소

| 위치 | 위험 | 심각도 | 완화 전략 |
| --- | --- | --- | --- |
| `hybrid-search.ts` | 채널 다수 추가 시 RRF 가중치 균형 붕괴 | HIGH | Phase별 채널 추가 후 벤치마크 회귀 테스트 |
| ONNX 모델 번들 | 바이너리 크기 증가 (~30MB INT8) | MEDIUM | 선택적 의존성(`optionalDependencies`), lazy load |
| `memory-consolidation.ts` | 4-Tier 압축 중 데이터 손실 | HIGH | 아카이브 단계 전 원본 백업, 압축 롤백 경로 확보 |
| 충돌 감지 | False positive로 유효 기억 삭제 | HIGH | 충돌 판정 threshold 보수적 설정, 삭제 대신 아카이브 |
| LtR 모델 | 학습 데이터 불충분 시 RRF 대비 회귀 | MEDIUM | RRF fallback 경로 유지, 최소 데이터 gate 설정 |
| 자율 링킹 | 잘못된 링크 생성으로 그래프 오염 | MEDIUM | 링크 confidence threshold, 주기적 링크 품질 감사 |
| 전역 | Phase 간 인터페이스 변경으로 하위 호환 깨짐 | MEDIUM | Phase 경계에서 public API 동결, 변경 시 deprecation 경로 |

## 6. 검증 기준

| 지표 | 기준선 측정 | Phase 1 목표 | Phase 2 목표 | Phase 3 목표 | Phase 4 목표 |
| --- | --- | --- | --- | --- | --- |
| MRR@10 | 현재 값 측정 필요 | ≥ 기준선 | +5% | +10% | +15% |
| NDCG@10 | 현재 값 측정 필요 | ≥ 기준선 | +5% | +10% | +15% |
| 검색 지연 (p95) | 현재 값 측정 필요 | ≤ 기준선 × 1.2 | ≤ 기준선 × 1.5 | ≤ 기준선 × 2.0 | ≤ 기준선 × 2.0 |
| 저장 공간 절감 | N/A | N/A | N/A | -20% (압축) | -30% (압축+아카이브) |
| 빌드 시간 증가 | 현재 값 측정 필요 | ≤ +5% | ≤ +10% | ≤ +20% | ≤ +25% |

## 7. 완료 기준

- [ ] 모든 Phase 완료 또는 명시적으로 연기됨
- [ ] 검증 명령 통과 (`npx tsc --noEmit`, `vitest run`, `cargo check --workspace`)
- [ ] 테스트 100% 통과, 회귀 0건
- [ ] MRR@10 / NDCG@10 목표 달성
- [ ] 연쇄 발견 항목 모두 폐쇄 또는 명시적 연기
- [ ] AGENT_MEMORY.md 업데이트

## 8. 현재 상태

- Active phase: 없음 — 구현 결정 대기 중
- Closed tasks: 없음
- Open chained tasks: 없음
- Blockers: 사용자 승인 대기

> **참고**: 본 계획의 모든 제안은 구현 결정 대기 상태이다.
> 각 Phase의 착수는 사용자의 명시적 승인 후 진행한다.
> 제안의 채택/보류/제외는 원 제안서의 세부 분석을 참조하여 결정한다.
