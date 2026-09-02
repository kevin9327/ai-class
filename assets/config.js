/* 사이트 전역 설정 — 값을 채우는 순서대로 기능이 켜집니다.
   FREE_PERIOD     true면 모든 강의·플랜이 결제 대신 "지금은 무료 기간입니다" 안내 + 신청 폼(메일 수신)으로 진행.
                   false로 바꾸면 아래 결제 체인으로 복귀. FREE_PERIOD_NOTE = 클릭 시 보여줄 문장.
   PAYAPP_USERID   페이앱(payapp.kr) 판매자 아이디 = 판매자센터 로그인 아이디.
                   채우면 수강신청 버튼이 카드·카카오페이·네이버페이 결제창을 엽니다.
                   사업자 없는 개인도 가입 가능(카드 4.0%, D+3 정산).
   PAYAPP_SHOPNAME 결제창에 표시할 상점명
   PAY_LINKS       플랜별 결제 링크(페이앱 블로그페이 주문서 URL 등). PAYAPP_USERID가 비어 있을 때 새 창으로 엽니다.
                   키 = "강의-플랜": (vibe-coding|automation|ai-content) × (pack4|single|group)
   KAKAOPAY_LINK   카카오페이 앱 '코드로 송금받기' 링크(https://qr.kakaopay.com/…). 위 둘이 없을 때 송금 폴백(수수료 0).
   FIREBASE        Firebase 콘솔 → 프로젝트 설정 → 웹 앱의 firebaseConfig 값. 채우면 회원가입·로그인·내 강의·운영자 페이지가 켜진다.
                   Spark(무료) 플랜: 카드 없음, 무활동 정지 없음, 한도(하루 읽기 5만·쓰기 2만) 넘으면 과금이 아니라 그냥 멈춤. */
window.SITE_CONFIG = {
  FREE_PERIOD: true,
  FREE_PERIOD_NOTE: "지금은 무료 기간입니다. 결제 없이 아래 신청만 남겨주시면 24시간 안에 연락드립니다.",
  PAYAPP_USERID: "",
  PAYAPP_SHOPNAME: "실무AI클래스",
  PAY_LINKS: {
    "vibe-coding-pack4": "", "vibe-coding-single": "", "vibe-coding-group": "",
    "automation-pack4": "",  "automation-single": "",  "automation-group": "",
    "ai-content-pack4": "",  "ai-content-single": "",  "ai-content-group": ""
  },
  KAKAOPAY_LINK: "",
  FIREBASE: {
    apiKey: "AIzaSyC96XpH9q309DCxdG9Gc6nfveMdDRK1Eg8",
    authDomain: "ai-class-7b852.firebaseapp.com",
    projectId: "ai-class-7b852",
    appId: "1:843390669153:web:12985d6d6e537a4b9e3520"
  },
  CONTACT_EMAIL: "petaflo.com@gmail.com"
};
