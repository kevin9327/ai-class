/* 사이트 전역 설정 — 값을 채우는 순서대로 기능이 켜집니다.
   SUPABASE_URL/ANON_KEY: Supabase 프로젝트 생성 후 (로그인·내 강의·주문 활성화)
   TOSS_CLIENT_KEY: 토스페이먼츠 키 (카드결제창 활성화; test_ck_로 시작하면 테스트 결제)
   TOSS_ME: 토스아이디 링크 (카드결제 없을 때 송금 폴백; 예 "https://toss.me/아이디") */
window.SITE_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
  TOSS_CLIENT_KEY: "",
  TOSS_ME: "",
  CONTACT_EMAIL: "petaflo.com@gmail.com"
};
