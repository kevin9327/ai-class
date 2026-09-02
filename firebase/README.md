# Firebase(Spark 무료) 설정 메모

무료를 오래 쓰기 위한 선택: **Firebase Spark 플랜** — 카드 등록 없음, 무활동 정지 없음(Supabase는 7일), 한도를 넘으면 과금이 아니라 그냥 멈춤.
이 사이트 규모(회원 수십~수천 명, 하루 읽기 5만·쓰기 2만 한도)에서는 사실상 영구 무료.

## 구성
- Authentication: 이메일/비밀번호
- Firestore (asia-northeast3 서울, production 모드) + `firestore.rules`
  - `settings/site` : `{ freePeriod: true, admins: ["<운영자 uid>"] }` — 콘솔에서 직접 만든다
  - `users/{uid}` : 가입 시 사이트가 만든다
  - `enrollments/{uid_planCode}` : 「무료로 신청」 클릭 시 사이트가 만든다 (같은 구성 중복 불가는 문서 id로 보장)
- 웹 앱 firebaseConfig → `assets/config.js`의 `FIREBASE`

## 무료 한도를 지키는 설계
- 목록 조회는 `where` 하나만(복합 색인 불필요), 운영자 페이지는 `limit(500)`
- 실시간 리스너(onSnapshot) 안 씀 — 읽기 카운트가 새지 않음
- Cloud Functions 안 씀 — Functions는 Blaze(카드) 필요
- 이미지/파일 저장 안 씀 — Storage 한도와 무관

## 유료 전환 시
결제는 `config.js`의 `FREE_PERIOD:false` + 페이앱 체인(카드결제, 서버 불필요)으로 처리. Firebase는 그대로 회원·기록용.
