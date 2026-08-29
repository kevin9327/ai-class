// 토스페이먼츠 결제 승인 edge function
// 필요한 시크릿: TOSS_SECRET_KEY (Supabase 대시보드 → Edge Functions → Secrets)
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 는 런타임이 자동 주입

import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { message: "POST만 허용됩니다." });

  let payload: { paymentKey?: string; orderId?: string; amount?: number };
  try {
    payload = await req.json();
  } catch {
    return json(400, { message: "잘못된 요청입니다." });
  }
  const { paymentKey, orderId, amount } = payload;
  if (!paymentKey || !orderId || !amount) {
    return json(400, { message: "결제 정보가 누락되었습니다." });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  // 호출자 확인 (프론트가 보낸 JWT)
  const jwt = (req.headers.get("Authorization") ?? "").replace("Bearer ", "");
  const { data: userData, error: userErr } = await admin.auth.getUser(jwt);
  if (userErr || !userData?.user) return json(401, { message: "로그인이 필요합니다." });
  const user = userData.user;

  // 주문 조회 + 플랜 금액 대조 (금액 위변조 차단)
  const { data: order, error: orderErr } = await admin
    .from("orders")
    .select("id, user_id, course_id, plan_code, status, plans(amount)")
    .eq("order_id", orderId)
    .single();

  if (orderErr || !order) return json(404, { message: "주문을 찾을 수 없습니다." });
  if (order.user_id !== user.id) return json(403, { message: "본인 주문이 아닙니다." });
  if (order.status === "paid") return json(200, { message: "이미 처리된 결제입니다." });

  const planAmount = (order.plans as unknown as { amount: number } | null)?.amount;
  if (!planAmount || planAmount !== amount) {
    return json(400, { message: "결제 금액이 상품 가격과 일치하지 않습니다." });
  }

  // 토스페이먼츠 승인
  const secretKey = Deno.env.get("TOSS_SECRET_KEY");
  if (!secretKey) return json(500, { message: "결제 설정이 완료되지 않았습니다." });

  const tossRes = await fetch("https://api.tosspayments.com/v1/payments/confirm", {
    method: "POST",
    headers: {
      Authorization: "Basic " + btoa(secretKey + ":"),
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ paymentKey, orderId, amount }),
  });
  const tossBody = await tossRes.json();

  if (!tossRes.ok) {
    await admin.from("orders").update({ status: "failed" }).eq("id", order.id);
    return json(402, { message: tossBody?.message ?? "결제 승인에 실패했습니다." });
  }

  // 주문 확정 + 수강권 발급
  await admin
    .from("orders")
    .update({ status: "paid", toss_payment_key: paymentKey })
    .eq("id", order.id);

  await admin.from("enrollments").insert({
    user_id: user.id,
    course_id: order.course_id,
    order_id: order.id,
  });

  return json(200, { message: "ok" });
});
