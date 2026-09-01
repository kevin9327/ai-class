# NotebookLM 노트북 (동영상 생성용)

강의 1편 = 노트북 1개. 소스는 `scripts/lesson-N.md` 전문. 1~3강 8/31, 4~6강 9/1 생성.

| 강 | 노트북 | 자동 붙은 제목 |
|---|---|---|
| 1강 | [47c77cf3](https://notebook.google.com/notebook/47c77cf3-9472-492d-bfe6-2904696cf83c) | Strategic Selection Criteria for Generative AI Models |
| 2강 | [38484a5b](https://notebook.google.com/notebook/38484a5b-0a74-4ec1-8092-c0d946cee729) | Five Essential Prompts for Immediate Workplace Productivity |
| 3강 | [62c96aa1](https://notebook.google.com/notebook/62c96aa1-0483-42c8-a0d6-b4b43bfb7664) | Ten-Minute Blueprints for Efficient AI Report Writing |
| 4강 | [f2a85448](https://notebook.google.com/notebook/f2a85448-c40c-4e49-bf28-a260a2d519ba) | The Art of Transforming Meeting Transcripts into Actionable Records |
| 5강 | [f7f7f4b5](https://notebook.google.com/notebook/f7f7f4b5-b934-432a-803b-ea1a01fa21cd) | Mastering Incremental Excel Automation Logic |
| 6강 | [e328df1d](https://notebook.google.com/notebook/e328df1d-3fe6-41bf-a25e-15e091c5f7fe) | Secure AI Practices for Corporate Data Handling |

## 생성 설정 (전편 공통)

- 형식: **설명 동영상** (한국어를 지원하는 유일한 형식. Cinematic·Short는 영어 전용)
- 언어: **한국어**
- 시각적 스타일: **기본** (기업·기관 대상이라 담백한 쪽)
- AI 호스트 지시문: 원고 순서·표현 유지, 원고에 없는 내용·통계·제품명 금지,
  존댓말·과장 없이. **강별로 강조점을 다르게** 넣음 — 3강은 사실 확인 단계,
  4강은 결정/논의 구분, 5강은 넘길 일과 안 넘길 일, 6강은 넣으면 안 되는 자료.

## 남은 절차

1. 생성 완료(편당 30분 이상) → 스튜디오에서 **다운로드**(MP4)
2. `assets/video/lesson-N.mp4` 로 저장소에 넣기 (유튜브 아님 — 파일 선택 대화상자를 다룰 수 없어 자체 호스팅)
3. `assets/lessons.js` 의 해당 강 `mp4` 에 파일명, `len` 에 실제 길이 기입
3-1. 전 페이지 `?v=` 캐시 버전을 올릴 것 — 안 올리면 재방문자가 예전 목록을 봄
4. 커밋·푸시하면 본문 위에 플레이어가 붙고, 목록에도 자동으로 나타남
   (영상 있는 강만 노출되는 구조라 별도 문구 수정 불필요)

## 알아둘 것

- 무료 한도 **하루 3편**. 1~3강은 8/31, 4~6강은 9/1에 뽑았고 **7·8강은 다음 날**.
- 올리기 전에 **내용을 직접 확인**할 것. AI 생성물이라 수치·고유명사가 틀릴 수 있음.
- **워터마크 확인됨**: 우측 하단에 「Gemini Notebook」 표기가 찍힘. 무료 강의라 그대로 씀.
