# 실무AI클래스 — 강의 플랫폼 개편 설계

날짜: 2026-08-30 · 상태: 승인됨 (대화에서 2단계 승인: 플랫폼 룩 개편 → 로그인·실결제 추가)

## 목표

문의 랜딩 페이지를 실제 강의 플랫폼(인프런류 커머스 룩)으로 개편한다.
회원 가입/로그인, 강의별 상세페이지, 카드결제(토스페이먼츠), 구매 내역(내 강의)을 갖춘다.
전 구간 무료 티어로 운영한다.

## 아키텍처

| 층 | 선택 | 비고 |
|---|---|---|
| 프론트 | 정적 HTML/CSS/JS, GitHub Pages (기존 저장소 kevin9327/ai-class) | 프레임워크 없음 |
| 인증·DB | Supabase 무료 티어 (Auth 이메일 로그인 + Postgres) | 카카오/구글 로그인은 v2 |
| 결제 | 토스페이먼츠 v1 SDK `requestPayment` → Supabase Edge Function `confirm-payment`가 승인 API 호출 | 테스트 키로 전 플로우 구동, 심사 후 라이브 키 교체 |
| 병행 결제 | 토스아이디 송금 링크 (config의 TOSS_ME) | PG 심사 기간의 실결제 수단 |
| keep-alive | GitHub Actions cron이 매일 Supabase REST 핑 | 무료 티어 7일 무접속 일시정지 방지 |

## 페이지 구성

```
index.html                메인: 헤더/히어로/강의 카드 3/수강 방식/강사/FAQ/문의 폼(FormSubmit 유지)/푸터
courses/vibe-coding.html  클로드 코드로 시작하는 바이브코딩
courses/automation.html   반복 업무 자동화 실전
courses/ai-content.html   AI 콘텐츠 제작 실전
login.html                로그인/회원가입 (이메일+비밀번호, next 리다이렉트는 상대경로만 허용)
my.html                   내 강의: 수강권·주문 내역 (로그인 필요)
pay/success.html          결제 승인 처리 (edge function 호출) 및 결과 표시
pay/fail.html             결제 실패 안내
privacy.html              개인정보처리방침 (회원 수집 시 법적 필수)
thanks.html / paid.html   기존 유지
assets/{style.css, app.js, config.js, img/*}
supabase/schema.sql       DB 스키마+RLS+시드
supabase/functions/confirm-payment/index.ts
.github/workflows/keepalive.yml
```

## 상품·가격

각 강의 공통 3플랜 (기존 가격과 정합):
- `pack4` 1:1 라이브 온라인 4회(회당 2시간) **499,000원** (정가 596,000원 표기)
- `single` 단회 체험 2시간 **149,000원**
- `group` 소그룹(3~5인) 1인 2시간 **89,000원**

가격의 원본은 DB `plans` 테이블. 결제 승인 시 서버가 plans 금액과 대조해 위변조를 차단한다.

## DB (Postgres + RLS)

- `courses(id text pk, title, price, active)` — 공개 읽기
- `plans(code text pk, course_id fk, name, amount)` — 공개 읽기 (코드는 `{course}-{plan}` 형태)
- `orders(id uuid, order_id text unique, user_id, course_id, plan_code, amount, status pending|paid|failed, toss_payment_key, created_at)` — 본인 읽기/pending 삽입만, 갱신은 서비스 롤만
- `enrollments(id, user_id, course_id, order_id, status, created_at)` — 본인 읽기만, 삽입은 서비스 롤만
- `profiles(id fk auth.users, name)` — 본인 읽기/쓰기

## 결제 흐름

수강신청 → 미로그인 시 login.html?next= → 클라이언트가 pending 주문 삽입 →
토스 결제창(requestPayment) → successUrl=pay/success.html →
success.html이 JWT 첨부해 edge function 호출 → 함수가 주문·소유자·plans 금액 검증 →
토스 승인 API → 성공 시 주문 paid + 수강권 삽입 → "내 강의"에 표시.

**단계적 활성화(그레이스풀 폴백)**: config.js 값이 비어 있는 동안 —
Supabase 미설정이면 로그인·신청 버튼이 "오픈 준비 중 → 토스 송금/문의" 안내로,
TOSS_CLIENT_KEY 미설정이면 신청이 토스아이디 송금 링크(금액 자동입력)로 폴백.

## 정직성 원칙

가짜 수강평·별점·누적 수강생 수 금지. 실제 후기가 생기면 그때 추가.

## 함정 기록

- Supabase 무료 내장 메일은 시간당 수 통 제한 → v1은 이메일 확인 OFF로 운영, 추후 SMTP(Resend 등) 연결
- 무료 프로젝트 7일 무접속 일시정지 → keepalive cron (공개 저장소 60일 무활동 시 cron 비활성화됨도 유의)
- GitHub Pages 기본 경로 `/ai-class/` → 모든 링크·리소스는 상대경로

## 남은 사용자 몫 (계정이라 본인만 가능)

1. supabase.com 가입(GitHub 클릭)·로그인 → 프로젝트 생성/설정은 Claude가 브라우저로 진행
2. 토스페이먼츠 개발자센터 가입 → 테스트 키 발급
3. petaflo.com@gmail.com에서 FormSubmit 인증 클릭 (기존 건)
