/* 사이트 전역 설정.
   이 사이트는 전면 무료 인강 + 외주·기업교육 접수 사이트다. 결제 기능은 없다.
   (유료 결제가 다시 필요해지면 git 이력의 2026-09-03 config.js/app.js에 페이앱·결제링크·카카오페이 체인이 남아 있다.)

   FIREBASE       Firebase 콘솔 → 프로젝트 설정 → 웹 앱의 firebaseConfig 값.
                  채우면 Google 로그인 · 「내 강의에 담기」 · 운영자 페이지가 켜진다.
                  Spark(무료) 플랜: 카드 없음, 무활동 정지 없음, 한도(하루 읽기 5만·쓰기 2만) 넘으면 과금이 아니라 그냥 멈춤.
                  Firestore 규칙(firebase/firestore.rules)은 settings/site.freePeriod == true 일 때만 「내 강의에 담기」를 허용한다.
   CONTACT_EMAIL  외주·기업교육·강의 질문을 받는 주소. 폼(FormSubmit)도 이 주소로 온다.
   CONTACT_HOURS  답변 시간대 안내 문구. */
window.SITE_CONFIG = {
  ALL_FREE: true,
  FIREBASE: {
    apiKey: "AIzaSyC96XpH9q309DCxdG9Gc6nfveMdDRK1Eg8",
    authDomain: "ai-class-7b852.firebaseapp.com",
    projectId: "ai-class-7b852",
    appId: "1:843390669153:web:12985d6d6e537a4b9e3520"
  },
  CONTACT_EMAIL: "petaflo.com@gmail.com",
  CONTACT_HOURS: "평일 저녁 · 주말"
};
