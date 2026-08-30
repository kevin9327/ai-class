/* 실무AI클래스 공통 스크립트
   각 페이지는 이 파일보다 먼저 window.REL("./" 또는 "../")을 선언한다. */
(function () {
  "use strict";

  var cfg = window.SITE_CONFIG || {};
  var REL = window.REL || "./";

  var COURSES = {
    "vibe-coding": { title: "클로드 코드로 시작하는 바이브코딩" },
    "automation": { title: "반복 업무 자동화 실전" },
    "ai-content": { title: "AI 콘텐츠 제작 실전" }
  };

  var PLANS = {
    pack4: { name: "1:1 라이브 4회 패키지 (회당 2시간)", amount: 499000, was: 596000 },
    single: { name: "단회 체험 2시간", amount: 149000 },
    group: { name: "소그룹 3~5인 · 1인 2시간", amount: 89000 }
  };

  var sb = null;
  if (cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY && window.supabase) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY);
  }

  /* 사이트 루트 절대경로 (예: /ai-class/) — 결제 리다이렉트 URL 계산용 */
  function siteRoot() {
    return location.pathname
      .replace(/(courses|pay)\/[^\/]*$/, "")
      .replace(/[^\/]*$/, "");
  }

  function payStatus(msg, kind) {
    var el = document.getElementById("pay-status");
    if (!el) { if (msg) alert(msg); return; }
    el.textContent = msg || "";
    if (kind) { el.setAttribute("data-kind", kind); } else { el.removeAttribute("data-kind"); }
  }

  /* ── 헤더 로그인 상태 ───────────────────────── */
  function initHeader() {
    var el = document.getElementById("nav-auth");
    if (!el) return;

    if (!sb) {
      el.innerHTML = '<a class="btn btn-ghost" href="' + REL + 'index.html#contact">수강 문의</a>';
      return;
    }

    sb.auth.getUser().then(function (res) {
      var user = res.data && res.data.user;
      if (user) {
        el.innerHTML =
          '<a href="' + REL + 'my.html">내 강의</a>' +
          '<button class="btn btn-ghost" id="logout-btn" type="button">로그아웃</button>';
        document.getElementById("logout-btn").addEventListener("click", function () {
          sb.auth.signOut().then(function () { location.href = REL + "index.html"; });
        });
      } else {
        el.innerHTML =
          '<a href="' + REL + 'login.html">로그인</a>' +
          '<a class="btn btn-primary" href="' + REL + 'login.html?tab=signup">회원가입</a>';
      }
    });
  }

  /* ── 토스 송금 폴백 ─────────────────────────── */
  function fallbackPay(planKey) {
    var plan = PLANS[planKey];
    if (cfg.TOSS_ME) {
      var url = cfg.TOSS_ME.replace(/\/+$/, "") + "/" + plan.amount;
      window.open(url, "_blank", "noopener");
      payStatus("토스 앱에서 " + plan.amount.toLocaleString("ko-KR") +
        "원을 보내신 뒤, 문의 폼이나 이메일로 입금자명을 남겨주세요. 확인 즉시 연락드립니다.", "ok");
    } else {
      payStatus("카드 결제 오픈을 준비하고 있습니다. 문의를 남겨주시면 결제 방법을 바로 안내해 드립니다.");
      setTimeout(function () { location.href = REL + "index.html#contact"; }, 1800);
    }
  }

  /* ── 수강신청(결제) ─────────────────────────── */
  function enroll(courseId, planKey) {
    var course = COURSES[courseId];
    var plan = PLANS[planKey];
    if (!course || !plan) return;

    if (!sb) { fallbackPay(planKey); return; }

    sb.auth.getUser().then(function (res) {
      var user = res.data && res.data.user;
      if (!user) {
        var next = location.pathname + "#plans";
        location.href = REL + "login.html?next=" + encodeURIComponent(next);
        return;
      }

      var orderId = "AIC" + Date.now() + Math.random().toString(36).slice(2, 8).toUpperCase();
      var row = {
        order_id: orderId,
        user_id: user.id,
        course_id: courseId,
        plan_code: courseId + "-" + planKey,
        amount: plan.amount,
        status: "pending"
      };

      sb.from("orders").insert(row).then(function (r) {
        if (r.error) {
          payStatus("주문 생성에 실패했습니다: " + r.error.message, "error");
          return;
        }

        if (cfg.TOSS_CLIENT_KEY && window.TossPayments) {
          window.TossPayments(cfg.TOSS_CLIENT_KEY).requestPayment("카드", {
            amount: plan.amount,
            orderId: orderId,
            orderName: course.title + " — " + plan.name,
            customerEmail: user.email,
            successUrl: location.origin + siteRoot() + "pay/success.html",
            failUrl: location.origin + siteRoot() + "pay/fail.html"
          }).catch(function (e) {
            if (e && e.code !== "USER_CANCEL") {
              payStatus("결제창을 열지 못했습니다: " + (e.message || e.code), "error");
            }
          });
        } else {
          fallbackPay(planKey);
        }
      });
    });
  }

  /* 수강신청 버튼 배선: <button data-enroll data-course="..." data-plan-key="..."> */
  function initEnrollButtons() {
    var btns = document.querySelectorAll("[data-enroll]");
    Array.prototype.forEach.call(btns, function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        enroll(btn.getAttribute("data-course"), btn.getAttribute("data-plan-key"));
      });
    });
  }

  /* ── 로그인 페이지 ─────────────────────────── */
  function initAuthPage() {
    var form = document.getElementById("auth-form");
    if (!form) return;

    var params = new URLSearchParams(location.search);
    var mode = params.get("tab") === "signup" ? "signup" : "login";
    var tabs = { login: document.getElementById("tab-login"), signup: document.getElementById("tab-signup") };
    var nameField = document.getElementById("name-field");
    var submitBtn = document.getElementById("auth-submit");
    var statusEl = document.getElementById("auth-status");

    function setMode(m) {
      mode = m;
      tabs.login.classList.toggle("active", m === "login");
      tabs.signup.classList.toggle("active", m === "signup");
      nameField.hidden = m !== "signup";
      submitBtn.textContent = m === "signup" ? "가입하기" : "로그인";
      statusEl.textContent = "";
    }
    tabs.login.addEventListener("click", function () { setMode("login"); });
    tabs.signup.addEventListener("click", function () { setMode("signup"); });
    setMode(mode);

    function afterLogin() {
      var next = params.get("next") || "";
      var root = siteRoot();
      // 오픈 리다이렉트 방지: 이 사이트 경로만 허용
      if (next.indexOf(root) !== 0 || next.indexOf("//") !== -1) next = REL + "my.html";
      location.href = next;
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!sb) {
        statusEl.textContent = "회원 시스템 오픈을 준비하고 있습니다. 조금만 기다려주세요.";
        return;
      }
      var email = document.getElementById("auth-email").value.trim();
      var pw = document.getElementById("auth-password").value;
      statusEl.removeAttribute("data-kind");
      statusEl.textContent = "처리 중입니다…";

      if (mode === "signup") {
        var name = document.getElementById("auth-name").value.trim();
        sb.auth.signUp({ email: email, password: pw, options: { data: { name: name } } })
          .then(function (r) {
            if (r.error) { statusEl.setAttribute("data-kind", "error"); statusEl.textContent = r.error.message; return; }
            if (r.data && r.data.session) { afterLogin(); }
            else { statusEl.setAttribute("data-kind", "ok"); statusEl.textContent = "가입 확인 메일을 보냈습니다. 메일함을 확인해주세요."; }
          });
      } else {
        sb.auth.signInWithPassword({ email: email, password: pw })
          .then(function (r) {
            if (r.error) { statusEl.setAttribute("data-kind", "error"); statusEl.textContent = "로그인에 실패했습니다. 이메일과 비밀번호를 확인해주세요."; return; }
            afterLogin();
          });
      }
    });
  }

  /* ── 내 강의 페이지 ─────────────────────────── */
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function initMyPage() {
    var listEl = document.getElementById("my-list");
    if (!listEl) return;

    if (!sb) {
      listEl.innerHTML = '<p class="empty">회원 시스템 오픈을 준비하고 있습니다.</p>';
      return;
    }

    sb.auth.getUser().then(function (res) {
      var user = res.data && res.data.user;
      if (!user) {
        location.href = REL + "login.html?next=" + encodeURIComponent(location.pathname);
        return;
      }

      sb.from("orders")
        .select("order_id, course_id, plan_code, amount, status, created_at")
        .order("created_at", { ascending: false })
        .then(function (r) {
          if (r.error) { listEl.innerHTML = '<p class="empty">내역을 불러오지 못했습니다.</p>'; return; }
          var rows = r.data || [];
          if (!rows.length) {
            listEl.innerHTML = '<p class="empty">아직 수강 내역이 없습니다.<br/>토스 송금으로 결제하신 경우, 확인 후 이곳에 표시됩니다.</p>';
            return;
          }
          listEl.innerHTML = rows.map(function (o) {
            var course = COURSES[o.course_id] || { title: o.course_id };
            var planKey = o.plan_code.replace(o.course_id + "-", "");
            var plan = PLANS[planKey] || { name: o.plan_code };
            var pill = o.status === "paid"
              ? '<span class="pill ok">결제 완료</span>'
              : o.status === "pending"
                ? '<span class="pill pending">결제 대기</span>'
                : '<span class="pill bad">실패</span>';
            var date = new Date(o.created_at).toLocaleDateString("ko-KR");
            return '<div class="order-item"><div class="meta"><b>' + esc(course.title) + "</b><span>" +
              esc(plan.name) + " · " + Number(o.amount).toLocaleString("ko-KR") + "원 · " + date +
              "</span></div>" + pill + "</div>";
          }).join("");
        });
    });
  }

  /* ── 결제 성공 페이지 ───────────────────────── */
  function initSuccessPage() {
    var box = document.getElementById("confirm-result");
    if (!box) return;

    var p = new URLSearchParams(location.search);
    var paymentKey = p.get("paymentKey");
    var orderId = p.get("orderId");
    var amount = Number(p.get("amount"));

    function fail(msg) {
      box.innerHTML = '<div class="icon">⚠️</div><h1>결제 확인에 실패했습니다</h1><p>' + esc(msg) +
        '<br/>결제가 이중으로 청구되지는 않습니다. 문의를 남겨주시면 바로 확인해 드립니다.</p>' +
        '<a class="btn btn-primary" href="' + REL + 'index.html#contact">문의하기</a>';
    }

    if (!paymentKey || !orderId || !amount) { fail("결제 정보가 올바르지 않습니다."); return; }
    if (!sb) { fail("시스템 설정이 완료되지 않았습니다."); return; }

    sb.auth.getSession().then(function (res) {
      var session = res.data && res.data.session;
      if (!session) { fail("로그인 세션이 만료되었습니다. 로그인 후 다시 시도해주세요."); return; }

      fetch(cfg.SUPABASE_URL + "/functions/v1/confirm-payment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + session.access_token,
          "apikey": cfg.SUPABASE_ANON_KEY
        },
        body: JSON.stringify({ paymentKey: paymentKey, orderId: orderId, amount: amount })
      })
        .then(function (r) { return r.json().then(function (j) { return { ok: r.ok, body: j }; }); })
        .then(function (r) {
          if (!r.ok) { fail(r.body && r.body.message || "승인 처리 중 오류가 발생했습니다."); return; }
          box.innerHTML = '<div class="icon">🎉</div><h1>결제가 완료되었습니다</h1>' +
            '<p>수강권이 발급되었습니다. 24시간 안에 연락드려 첫 일정을 잡겠습니다.</p>' +
            '<a class="btn btn-primary" href="' + REL + 'my.html">내 강의 보기</a>';
        })
        .catch(function () { fail("네트워크 오류가 발생했습니다."); });
    });
  }

  /* ── 문의 폼 (FormSubmit) ───────────────────── */
  function initInquiryForm() {
    var form = document.getElementById("inquiry");
    if (!form) return;
    var statusEl = document.getElementById("status");
    var submitBtn = document.getElementById("submit");

    form.addEventListener("submit", function (e) {
      var gaps = [];
      if (!document.getElementById("name").value.trim()) gaps.push("이름");
      if (!document.getElementById("contact").value.trim()) gaps.push("연락 받을 곳");
      if (!document.getElementById("stuck").value.trim()) gaps.push("궁금한 점");
      if (gaps.length) {
        e.preventDefault();
        statusEl.setAttribute("data-kind", "error");
        statusEl.textContent = gaps.join(", ") + " 항목을 채워주세요.";
        return;
      }
      statusEl.removeAttribute("data-kind");
      statusEl.textContent = "보내는 중입니다…";
      submitBtn.disabled = true;
    });
  }


  /* ── 무료 영상 강의 목록 ────────────── */
  function initLessons() {
    var host = document.getElementById("lesson-list");
    if (!host) return;

    var rows = window.LESSONS || [];
    if (!rows.length) {
      host.innerHTML = '<p class="empty">강의를 준비하고 있습니다.</p>';
      return;
    }

    host.innerHTML = rows.map(function (L, i) {
      var yt = (L.yt || "").trim();
      /* 유튜브 ID 형식만 통과시킨다 */
      var box = /^[A-Za-z0-9_-]{6,20}$/.test(yt)
        ? '<div class="video-box"><iframe src="https://www.youtube-nocookie.com/embed/' + yt +
          '?rel=0" title="' + esc(L.title) + '" loading="lazy" allowfullscreen ' +
          'allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>'
        : '<div class="video-box pending"><b>준비 중입니다</b>' +
          '<span>영상이 올라오면 이 자리에서 바로 보실 수 있습니다.</span></div>';

      var bullets = (L.points || []).map(function (t) {
        return "<li>" + esc(t) + "</li>";
      }).join("");

      return '<details class="lesson"' + (i === 0 ? " open" : "") + '>' +
        '<summary><span class="no">' + (i + 1) + '강</span>' +
        '<span class="ttl">' + esc(L.title) + '</span>' +
        (L.len ? '<span class="len">' + esc(L.len) + '</span>' : '') +
        '</summary>' +
        '<div class="inner">' + box +
        '<p class="sum">' + esc(L.sum || "") + '</p>' +
        (bullets ? "<ul>" + bullets + "</ul>" : "") +
        '</div></details>';
    }).join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initEnrollButtons();
    initAuthPage();
    initMyPage();
    initSuccessPage();
    initInquiryForm();
    initLessons();
  });

  window.App = { enroll: enroll, PLANS: PLANS, COURSES: COURSES };
})();
