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

  /* ── 회원·DB: Firebase (Spark 무료 플랜 — 카드 없음·정지 없음·과금 불가) ─────
     config.FIREBASE(apiKey·authDomain·projectId·appId)가 채워지고 SDK가 로드되면 켜진다.
     Firestore: users/{uid} · enrollments/{uid_planCode} · settings/site(freePeriod, admins[]) */
  var fb = null;
  if (cfg.FIREBASE && cfg.FIREBASE.apiKey && window.firebase) {
    if (!window.firebase.apps.length) window.firebase.initializeApp(cfg.FIREBASE);
    fb = { auth: window.firebase.auth(), db: window.firebase.firestore ? window.firebase.firestore() : null };
  }
  /* 현재 로그인 사용자 — 세션 복원이 끝난 뒤 한 번 resolve (없으면 null) */
  function currentUser() {
    return new Promise(function (resolve) {
      if (!fb) { resolve(null); return; }
      var off = fb.auth.onAuthStateChanged(function (u) { off(); resolve(u); });
    });
  }
  var AUTH_MSG = {
    "auth/email-already-in-use": "이미 가입된 이메일입니다. 로그인 탭에서 로그인해주세요.",
    "auth/invalid-email": "이메일 형식을 확인해주세요.",
    "auth/weak-password": "비밀번호는 8자 이상으로 해주세요.",
    "auth/invalid-credential": "이메일 또는 비밀번호가 맞지 않습니다.",
    "auth/wrong-password": "이메일 또는 비밀번호가 맞지 않습니다.",
    "auth/user-not-found": "가입되지 않은 이메일입니다. 회원가입 탭에서 가입해주세요.",
    "auth/too-many-requests": "시도가 너무 많습니다. 잠시 후 다시 해주세요.",
    "auth/network-request-failed": "네트워크 오류입니다. 연결을 확인해주세요."
  };
  function authMsg(e) { return (e && AUTH_MSG[e.code]) || (e && e.message) || "오류가 발생했습니다."; }
  function tsMs(ts) { return ts && ts.toMillis ? ts.toMillis() : 0; }

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

    if (!fb) {
      el.innerHTML = '<a class="btn btn-ghost" href="' + REL + 'index.html#contact">수강 문의</a>';
      return;
    }

    currentUser().then(function (user) {
      if (user) {
        el.innerHTML =
          '<a href="' + REL + 'my.html">내 강의</a>' +
          '<button class="btn btn-ghost" id="logout-btn" type="button">로그아웃</button>';
        document.getElementById("logout-btn").addEventListener("click", function () {
          fb.auth.signOut().then(function () { location.href = REL + "index.html"; });
        });
      } else {
        el.innerHTML =
          '<a href="' + REL + 'login.html">로그인</a>' +
          '<a class="btn btn-primary" href="' + REL + 'login.html?tab=signup">회원가입</a>';
      }
    });
  }

  /* ── 토스 미설정 시 결제 체인 ───────────────────
     1) PAYAPP_USERID  → 페이앱 결제창 (카드·카카오페이·네이버페이). 사업자 없는 개인도 가능.
     2) PAY_LINKS[코드] → 결제 링크 새 창 (페이앱 블로그페이 주문서 등)
     3) KAKAOPAY_LINK  → 카카오페이 송금 링크 (수수료 0, 입금 수동 확인)
     4) 없음           → 문의 폼 */
  var PAYAPP_JS = "https://lite.payapp.kr/public/api/v2/payapp-lite.js";

  function won(n) { return n.toLocaleString("ko-KR") + "원"; }
  function planCode(courseId, planKey) { return courseId + "-" + planKey; }

  /* 결제창은 클릭 핸들러 안에서 동기로 열어야 팝업 차단을 피한다 → 스크립트를 페이지 로드 때 미리 받아둔다 */
  function preloadPayApp() {
    if (!cfg.PAYAPP_USERID || window.PayApp || document.getElementById("payapp-js")) return;
    var s = document.createElement("script");
    s.id = "payapp-js"; s.src = PAYAPP_JS; s.async = true;
    document.head.appendChild(s);
  }

  /* 결제 뒤 일정 요청 폼(#after-pay)을 펼치고 값을 채운다 */
  function showAfterPay(courseId, planKey, method, buyer) {
    var box = document.getElementById("after-pay");
    if (!box) return;
    var course = COURSES[courseId], plan = PLANS[planKey];
    function set(name, val) {
      var el = box.querySelector('[name="' + name + '"]');
      if (el && val) el.value = val;
    }
    set("강의", course.title + " — " + plan.name + " (" + won(plan.amount) + ")");
    set("결제수단", method);
    if (buyer) { set("이름", buyer.name); set("연락처", buyer.phone); set("이메일", buyer.email); }
    box.hidden = false;
    box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function openPayApp(courseId, planKey, buyer) {
    var course = COURSES[courseId], plan = PLANS[planKey];
    if (!window.PayApp) {
      payStatus("결제 모듈을 아직 불러오지 못했습니다. 잠시 후 다시 눌러주세요.", "error");
      preloadPayApp();
      return;
    }
    window.PayApp.setDefault("userid", cfg.PAYAPP_USERID);
    window.PayApp.setDefault("shopname", cfg.PAYAPP_SHOPNAME || "실무AI클래스");
    window.PayApp.payrequest({
      goodname: course.title + " — " + plan.name,
      price: String(plan.amount),
      recvphone: buyer.phone,
      memo: "실무AI클래스 수강료",
      smsuse: "n",       // 문자 결제요청을 보내지 않고
      redirectpay: "1",  // 결제창을 바로 연다
      var1: planCode(courseId, planKey),
      var2: buyer.name
    });
    payStatus("결제창이 열렸습니다. 결제를 마치면 아래 일정 요청을 보내주세요. 24시간 안에 연락드립니다.", "ok");
    showAfterPay(courseId, planKey, "페이앱 카드결제", buyer);
  }

  /* 페이앱은 구매자 휴대폰 번호가 필수 → 이름·번호를 받는 작은 폼을 플랜 아래 펼친다 */
  function askBuyer(courseId, planKey) {
    var host = document.getElementById("pay-status");
    if (!host) return;
    var old = document.getElementById("buyer-form");
    if (old) old.remove();
    var plan = PLANS[planKey];
    var f = document.createElement("form");
    f.className = "buyer-form"; f.id = "buyer-form";
    f.innerHTML =
      '<p class="buyer-title"><b>' + esc(plan.name) + '</b> · ' + won(plan.amount) + '</p>' +
      '<div class="buyer-grid">' +
        '<input type="text" name="buyer_name" placeholder="이름" autocomplete="name" required />' +
        '<input type="text" name="buyer_phone" placeholder="휴대폰 010-0000-0000" autocomplete="tel" inputmode="tel" required />' +
        '<button type="submit" class="btn btn-primary">결제창 열기</button>' +
      '</div>' +
      '<p class="buyer-note">결제창은 페이앱(payapp.kr)에서 열리며 카드·카카오페이·네이버페이를 쓸 수 있습니다. 번호는 결제 확인과 일정 연락에만 씁니다.</p>';
    host.insertAdjacentElement("beforebegin", f);
    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = f.elements.buyer_name.value.trim();
      var phone = f.elements.buyer_phone.value.replace(/[^0-9]/g, "");
      if (!name || !/^01[016789][0-9]{7,8}$/.test(phone)) {
        payStatus("이름과 휴대폰 번호를 확인해주세요.", "error");
        return;
      }
      openPayApp(courseId, planKey, { name: name, phone: phone });
    });
    f.elements.buyer_name.focus();
    payStatus("");
  }

  /* ── 무료 기간 모드 (config.FREE_PERIOD) ─────────
     결제 대신 "지금은 무료 기간입니다" 안내 후 신청 폼만 받는다. false로 바꾸면 아래 결제 체인으로 복귀. */
  function applyFreeForm(box) {
    if (!box || box.getAttribute("data-free") === "1") return;
    var h = box.querySelector("h3"), lead = box.querySelector(":scope > p");
    if (h) h.textContent = "무료 기간 신청";
    if (lead) lead.textContent = "결제 없이 신청만 남겨주시면 24시간 안에 연락드려 첫 수업 일정을 잡습니다.";
    function set(name, val) { var el = box.querySelector('[name="' + name + '"]'); if (el) el.value = val; }
    set("_subject", "[실무AI클래스] 무료 기간 신청");
    set("구분", "무료 기간 신청");
    set("_next", "https://kevin9327.github.io/ai-class/thanks.html");
    var nameLabel = box.querySelector('label[for="ap-name"]');
    if (nameLabel) nameLabel.textContent = "이름";
    var btn = box.querySelector('button[type="submit"]');
    if (btn) btn.textContent = "무료로 신청하기";
    box.setAttribute("data-free", "1");
  }

  function freeEnroll(courseId, planKey) {
    var box = document.getElementById("after-pay");
    if (!box) { location.href = REL + "index.html#contact"; return; }
    applyFreeForm(box);
    var note = cfg.FREE_PERIOD_NOTE || "지금은 무료 기간입니다. 결제 없이 아래 신청만 남겨주세요.";
    var code = planCode(courseId, planKey);

    /* 회원 시스템 없이: 신청 폼만 */
    if (!fb || !fb.db) {
      payStatus(note, "ok");
      showAfterPay(courseId, planKey, "무료 기간 (0원)");
      return;
    }

    /* 회원 시스템 있음: 로그인 계정에 신청을 기록(내 강의에 표시)하고 일정 폼을 펼친다 */
    currentUser().then(function (user) {
      if (!user) {
        payStatus("무료 기간입니다. 로그인하면(회원가입 10초) 신청이 계정에 기록됩니다. 잠시 후 로그인 화면으로 이동합니다.", "ok");
        setTimeout(function () {
          location.href = REL + "login.html?next=" + encodeURIComponent(location.pathname + "#plans");
        }, 1200);
        return;
      }
      payStatus("신청을 계정에 기록하는 중입니다…");
      var name = user.displayName || "";
      var ref = fb.db.collection("enrollments").doc(user.uid + "_" + code);
      ref.get().then(function (snap) {
        if (snap.exists) return true;
        return ref.set({
          uid: user.uid, email: user.email || "", name: name,
          courseId: courseId, planCode: code, amount: 0, status: "free",
          createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () { return false; });
      }).then(function (already) {
        payStatus(already ? "이미 신청된 구성입니다. 아래에 가능한 일정만 남겨주세요." : note, "ok");
        showAfterPay(courseId, planKey, "무료 기간 (0원) · 계정 " + (user.email || user.uid), { name: name, email: user.email });
      }).catch(function (e) {
        payStatus("신청 기록에 실패했습니다: " +
          (e && e.code === "permission-denied" ? "무료 기간이 끝났거나 권한이 없습니다." : (e && e.message)), "error");
      });
    });
  }

  function initFreePeriod() {
    if (!cfg.FREE_PERIOD) return;
    document.documentElement.setAttribute("data-free-period", "1");
    var badge = '<span class="free-badge">무료 기간</span>';

    /* 메인 강의 카드: 16% · 596,000 · 499,000원 → [무료 기간] 499,000원(취소선) 무료 */
    Array.prototype.forEach.call(document.querySelectorAll(".price-row"), function (row) {
      var now = row.querySelector(".now"), was = row.querySelector(".was"), sale = row.querySelector(".sale");
      if (!now) return;
      if (sale) { sale.outerHTML = badge; } else { row.insertAdjacentHTML("afterbegin", badge); }
      if (was) { was.textContent = now.textContent; }
      else { now.insertAdjacentHTML("beforebegin", '<span class="was">' + esc(now.textContent) + "</span>"); }
      now.textContent = "무료";
    });
    /* 상세 페이지 플랜: <small>596,000</small>499,000원 → <small>499,000원</small>무료 [무료 기간] */
    Array.prototype.forEach.call(document.querySelectorAll(".plan-box .amount"), function (amt) {
      var price = "";
      Array.prototype.forEach.call(amt.childNodes, function (n) { if (n.nodeType === 3) price += n.textContent; });
      amt.innerHTML = "<small>" + esc(price.trim()) + "</small>무료 " + badge;
    });
    Array.prototype.forEach.call(document.querySelectorAll("[data-enroll]"), function (b) { b.textContent = "무료로 신청"; });
    var note = document.querySelector(".course-grid + p.status");
    if (note) note.innerHTML = "<b>지금은 무료 기간입니다.</b> 1:1 4회 · 단회 · 소그룹 모두 결제 없이 신청만 남기시면 됩니다. 상세 페이지에서 구성을 고르세요.";
    applyFreeForm(document.getElementById("after-pay"));
    if (fb && location.hash === "#plans" && document.getElementById("pay-status")) {
      currentUser().then(function (u) {
        if (u) payStatus("로그인되었습니다. 원하는 구성의 「무료로 신청」을 눌러주세요.", "ok");
      });
    }
    var ps = document.getElementById("pay-status"), rn = ps && ps.nextElementSibling;
    if (rn && rn.classList.contains("notice")) rn.hidden = true; // free mode: refund notice is moot
  }

  function fallbackPay(courseId, planKey) {
    var plan = PLANS[planKey];
    var link = (cfg.PAY_LINKS || {})[planCode(courseId, planKey)];

    if (cfg.PAYAPP_USERID) { askBuyer(courseId, planKey); return; }

    if (link) {
      window.open(link, "_blank", "noopener");
      payStatus("새 창에서 결제를 마친 뒤, 아래 일정 요청을 보내주세요. 24시간 안에 연락드립니다.", "ok");
      showAfterPay(courseId, planKey, "결제 링크");
      return;
    }
    if (cfg.KAKAOPAY_LINK) {
      window.open(cfg.KAKAOPAY_LINK, "_blank", "noopener");
      payStatus("카카오페이로 " + won(plan.amount) + "을 보내신 뒤, 아래 일정 요청에 입금자명을 적어주세요. 확인 즉시 연락드립니다.", "ok");
      showAfterPay(courseId, planKey, "카카오페이 송금 " + won(plan.amount));
      return;
    }
    payStatus("온라인 결제를 준비하고 있습니다. 문의를 남겨주시면 결제 방법을 바로 안내해 드립니다.");
    setTimeout(function () { location.href = REL + "index.html#contact"; }, 1800);
  }

  /* ── 수강신청 ─────────────────────────────────
     무료 기간이면 계정에 기록(freeEnroll), 아니면 결제 체인(fallbackPay). */
  function enroll(courseId, planKey) {
    var course = COURSES[courseId], plan = PLANS[planKey];
    if (!course || !plan) return;
    if (cfg.FREE_PERIOD) { freeEnroll(courseId, planKey); return; }
    fallbackPay(courseId, planKey);
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
      if (!fb) {
        statusEl.textContent = "회원 시스템 오픈을 준비하고 있습니다. 조금만 기다려주세요.";
        return;
      }
      var email = document.getElementById("auth-email").value.trim();
      var pw = document.getElementById("auth-password").value;
      statusEl.removeAttribute("data-kind");
      statusEl.textContent = "처리 중입니다…";
      submitBtn.disabled = true;

      var p;
      if (mode === "signup") {
        var name = document.getElementById("auth-name").value.trim();
        p = fb.auth.createUserWithEmailAndPassword(email, pw).then(function (cred) {
          var u = cred.user;
          var tasks = [u.updateProfile({ displayName: name })];
          if (fb.db) {
            tasks.push(fb.db.collection("users").doc(u.uid).set({
              name: name, email: u.email || email,
              createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
            }));
          }
          return Promise.all(tasks);
        });
      } else {
        p = fb.auth.signInWithEmailAndPassword(email, pw);
      }
      p.then(afterLogin).catch(function (err) {
        submitBtn.disabled = false;
        statusEl.setAttribute("data-kind", "error");
        statusEl.textContent = authMsg(err);
      });
    });
  }

  /* ── 내 강의 (my.html) ─────────────────────────── */
  function initMyPage() {
    var listEl = document.getElementById("my-list");
    if (!listEl) return;

    if (!fb || !fb.db) {
      listEl.innerHTML = '<p class="empty">회원 시스템 오픈을 준비하고 있습니다.</p>';
      return;
    }

    currentUser().then(function (user) {
      if (!user) {
        location.href = REL + "login.html?next=" + encodeURIComponent(location.pathname);
        return;
      }
      /* where + orderBy는 복합 색인이 필요하므로 정렬은 클라이언트에서 */
      fb.db.collection("enrollments").where("uid", "==", user.uid).get().then(function (qs) {
        var rows = []; qs.forEach(function (d) { rows.push(d.data()); });
        rows.sort(function (x, y) { return tsMs(y.createdAt) - tsMs(x.createdAt); });
        if (!rows.length) {
          listEl.innerHTML = '<p class="empty">아직 신청 내역이 없습니다.<br/>강의 페이지에서 「무료로 신청」을 누르면 여기에 기록됩니다.</p>';
          return;
        }
        listEl.innerHTML = rows.map(renderRow).join("");
      }).catch(function (e) {
        listEl.innerHTML = '<p class="empty">내역을 불러오지 못했습니다. (' + esc(e.message) + ')</p>';
      });
    });
  }

  function statusPill(st) {
    return st === "paid" ? '<span class="pill ok">결제 완료</span>'
      : st === "free" ? '<span class="pill ok">무료 기간 신청</span>'
      : st === "done" ? '<span class="pill ok">수강 완료</span>'
      : st === "pending" ? '<span class="pill pending">결제 대기</span>'
      : '<span class="pill bad">' + esc(st || "") + '</span>';
  }
  function rowLabels(o) {
    var course = COURSES[o.courseId] || { title: o.courseId };
    var planKey = String(o.planCode || "").replace(o.courseId + "-", "");
    var plan = PLANS[planKey] || { name: o.planCode };
    return { course: course.title, plan: plan.name };
  }
  function renderRow(o) {
    var l = rowLabels(o);
    var amountText = o.status === "free" ? "무료" : Number(o.amount || 0).toLocaleString("ko-KR") + "원";
    var date = tsMs(o.createdAt) ? new Date(tsMs(o.createdAt)).toLocaleDateString("ko-KR") : "";
    return '<div class="order-item"><div class="meta"><b>' + esc(l.course) + "</b><span>" +
      esc(l.plan) + " · " + amountText + " · " + date + "</span></div>" + statusPill(o.status) + "</div>";
  }

  /* ── 운영자 페이지 (admin.html) — settings/site.admins 에 uid 가 있는 계정만 ── */
  function initAdminPage() {
    var root = document.getElementById("admin-root");
    if (!root) return;
    if (!fb || !fb.db) { root.innerHTML = '<p class="empty">회원 시스템이 아직 연결되지 않았습니다.</p>'; return; }

    currentUser().then(function (user) {
      if (!user) {
        location.href = REL + "login.html?next=" + encodeURIComponent(location.pathname);
        return;
      }
      fb.db.collection("settings").doc("site").get().then(function (snap) {
        var admins = (snap.exists && snap.data().admins) || [];
        if (admins.indexOf(user.uid) === -1) {
          root.innerHTML = '<p class="empty">운영자 권한이 없는 계정입니다.<br/><small>내 UID: <code>' + esc(user.uid) +
            '</code> — Firestore의 settings/site 문서 admins 배열에 이 값을 넣으면 열립니다.</small></p>';
          return;
        }
        return fb.db.collection("enrollments").orderBy("createdAt", "desc").limit(500).get().then(function (qs) {
          var rows = []; qs.forEach(function (d) { rows.push(d.data()); });
          renderAdmin(root, rows);
        });
      }).catch(function (e) {
        root.innerHTML = '<p class="empty">불러오지 못했습니다: ' + esc(e.message) + '</p>';
      });
    });
  }
  function renderAdmin(root, rows) {
    var body = rows.map(function (o) {
      var l = rowLabels(o);
      var ms = tsMs(o.createdAt);
      var when = ms ? new Date(ms).toLocaleString("ko-KR", { dateStyle: "short", timeStyle: "short" }) : "";
      return "<tr><td>" + esc(when) + "</td><td>" + esc(o.email || "") + "</td><td>" + esc(o.name || "") +
        "</td><td>" + esc(l.course) + "</td><td>" + esc(l.plan) + "</td><td>" + statusPill(o.status) + "</td></tr>";
    }).join("");
    var csvRows = [["일시", "이메일", "이름", "강의", "구성", "상태"]].concat(rows.map(function (o) {
      var l = rowLabels(o), ms = tsMs(o.createdAt);
      return [ms ? new Date(ms).toISOString() : "", o.email || "", o.name || "", l.course, l.plan, o.status || ""];
    }));
    var csv = csvRows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" });

    root.innerHTML =
      '<p class="admin-summary">신청 <b>' + rows.length + '</b>건 &nbsp;' +
      '<a class="btn btn-ghost" id="csv-dl" download="signups.csv">CSV 내려받기</a></p>' +
      '<div class="table-wrap"><table class="admin-table"><thead><tr>' +
      '<th>일시</th><th>이메일</th><th>이름</th><th>강의</th><th>구성</th><th>상태</th></tr></thead><tbody>' +
      (body || '<tr><td colspan="6" class="empty">아직 신청이 없습니다.</td></tr>') + "</tbody></table></div>";
    document.getElementById("csv-dl").href = URL.createObjectURL(blob);
  }

  /* ── 문의 폼 ─────────────────────────────────── */
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

    /* 영상이 붙은 강만 내보낸다. 강 번호는 원래 순번을 그대로 쓴다. */
    var all = window.LESSONS || [];
    var rows = [];
    all.forEach(function (L, i) {
      var ok = /^[A-Za-z0-9_.-]+\.mp4$/.test((L.mp4 || "").trim()) ||
               /^[A-Za-z0-9_-]{6,20}$/.test((L.yt || "").trim());
      if (ok) rows.push({ L: L, n: i + 1 });
    });

    if (!rows.length) {
      host.innerHTML = '<p class="empty">강의를 준비하고 있습니다.</p>';
      return;
    }

    /* 페이지 곳곳의 강 수를 실제 공개된 수에 맞춘다 */
    Array.prototype.forEach.call(document.querySelectorAll("[data-lesson-count]"), function (el) {
      el.textContent = rows.length;
    });

    var bodies = window.LESSON_BODIES || {};

    host.innerHTML = rows.map(function (row, i) {
      var L = row.L;
      var yt = (L.yt || "").trim();
      var mp4 = (L.mp4 || "").trim();
      var box = "";
      /* 파일명·유튜브 ID 형식만 통과시킨다. 둘 다 없으면 자리를 만들지 않는다. */
      if (/^[A-Za-z0-9_.-]+\.mp4$/.test(mp4)) {
        box = '<div class="video-box"><video controls preload="metadata" playsinline ' +
          'src="' + REL + 'assets/video/' + mp4 + '"></video></div>';
      } else if (/^[A-Za-z0-9_-]{6,20}$/.test(yt)) {
        box = '<div class="video-box"><iframe src="https://www.youtube-nocookie.com/embed/' + yt +
          '?rel=0" title="' + esc(L.title) + '" loading="lazy" allowfullscreen ' +
          'allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"></iframe></div>';
      }

      var bullets = (L.points || []).map(function (t) {
        return "<li>" + esc(t) + "</li>";
      }).join("");

      /* 본문은 scripts/lesson-N.md 에서 만들어진 것. 이미 이스케이프돼 있다. */
      var body = bodies[row.n] || "";

      return '<details class="lesson"' + (i === 0 ? " open" : "") + '>' +
        '<summary><span class="no">' + row.n + '강</span>' +
        '<span class="ttl">' + esc(L.title) + '</span>' +
        (L.len ? '<span class="len">' + esc(L.len) + '</span>' : '') +
        '</summary>' +
        '<div class="inner">' + box +
        '<p class="sum">' + esc(L.sum || "") + '</p>' +
        (bullets ? "<ul>" + bullets + "</ul>" : "") +
        (body ? '<div class="lesson-body">' + body + "</div>" : "") +
        "</div></details>";
    }).join("");
  }


  /* ── 프롬프트 라이브러리 ────────────── */
  function initPrompts() {
    var grid = document.getElementById("pl-grid");
    if (!grid) return;

    var rows = window.PROMPTS || [];
    var cats = window.PROMPT_CATS || [];
    var qEl = document.getElementById("pl-q");
    var clearEl = document.getElementById("pl-clear");
    var countEl = document.getElementById("pl-count");
    var catsEl = document.getElementById("pl-cats");
    var active = "";

    /* 분류 칩 */
    catsEl.innerHTML = ['<button type="button" class="pl-cat" data-cat="" aria-pressed="true">전체</button>']
      .concat(cats.map(function (c) {
        return '<button type="button" class="pl-cat" data-cat="' + esc(c) +
          '" aria-pressed="false">' + esc(c) + "</button>";
      })).join("");

    function draw() {
      var q = (qEl.value || "").trim().toLowerCase();
      clearEl.hidden = !q;

      var hits = rows.filter(function (r) {
        if (active && r.cat !== active) return false;
        if (!q) return true;
        return (r.title + " " + r.cat + " " + r.when + " " + r.text + " " + r.note)
          .toLowerCase().indexOf(q) !== -1;
      });

      countEl.textContent = q || active
        ? hits.length + "개 (전체 " + rows.length + "개 중)"
        : "전체 " + rows.length + "개";

      if (!hits.length) {
        grid.innerHTML = '<p class="empty">찾으시는 게 없습니다. 다른 말로 검색해 보시거나, ' +
          '아래 상담으로 남겨주시면 만들어 드립니다.</p>';
        return;
      }

      grid.innerHTML = hits.map(function (r, i) {
        return '<article class="pl-item" data-i="' + i + '">' +
          '<div class="pl-head"><h3>' + esc(r.title) + "</h3>" +
          '<span class="pl-tag">' + esc(r.cat) + "</span></div>" +
          '<p class="pl-when">' + esc(r.when) + "</p>" +
          '<div class="pl-body"><pre>' + esc(r.text) + "</pre></div>" +
          '<p class="pl-note">' + esc(r.note) + "</p>" +
          '<div class="pl-actions">' +
          '<button type="button" class="pl-copy">복사하기</button>' +
          "</div></article>";
      }).join("");

      /* 방금 그린 카드에 해당하는 원본을 물려둔다 */
      Array.prototype.forEach.call(grid.querySelectorAll(".pl-item"), function (el, i) {
        el.__row = hits[i];
      });
      markClipped();
    }

    /* 글자 수가 아니라 실제로 잘렸는지를 보고 '전체 보기'를 붙인다.
       한글은 줄바꿈이 달라서 글자 수로 재면 어긋난다. */
    function markClipped() {
      Array.prototype.forEach.call(grid.querySelectorAll(".pl-item"), function (el) {
        if (el.classList.contains("open")) return;
        var pre = el.querySelector("pre");
        var cut = pre.scrollHeight > pre.clientHeight + 2;
        el.classList.toggle("short", !cut);
        var more = el.querySelector(".pl-more");
        if (cut && !more) {
          el.querySelector(".pl-actions").insertAdjacentHTML("beforeend",
            '<button type="button" class="pl-more">전체 보기</button>');
        } else if (!cut && more) {
          more.remove();
        }
      });
    }

    function flash(btn, msg, cls) {
      if (btn.__t) { clearTimeout(btn.__t); } else { btn.__was = btn.textContent; }
      btn.textContent = msg;
      if (cls) btn.classList.add(cls);
      btn.__t = setTimeout(function () {
        btn.textContent = btn.__was;
        btn.classList.remove("done");
        btn.__t = null;
      }, 2400);
    }

    function copyText(item, btn) {
      var text = item.__row.text;
      function ok() { flash(btn, "복사했습니다", "done"); }

      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(ok, function () { legacy(text, ok, item, btn); });
      } else {
        legacy(text, ok, item, btn);
      }
    }

    /* 클립보드 권한이 없을 때 쓰는 옛 방식 */
    function legacy(text, ok, item, btn) {
      var ta = document.createElement("textarea");
      ta.value = text;
      ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:-1000px;opacity:0;";
      document.body.appendChild(ta);
      ta.select();
      var done = false;
      try { done = document.execCommand("copy"); } catch (e) { done = false; }
      document.body.removeChild(ta);
      if (done) { ok(); return; }
      selectPrompt(item, btn);
    }

    /* 그것마저 막히면 본문을 대신 선택해 준다. 알림창만 띄우고 끝내지 않는다. */
    function selectPrompt(item, btn) {
      item.classList.add("open");
      var more = item.querySelector(".pl-more");
      if (more) more.textContent = "접기";
      var pre = item.querySelector("pre");
      try {
        var range = document.createRange();
        range.selectNodeContents(pre);
        var sel = window.getSelection();
        sel.removeAllRanges();
        sel.addRange(range);
        pre.scrollIntoView({ block: "nearest" });
        flash(btn, "선택했습니다 — Ctrl+C");
      } catch (e) {
        flash(btn, "직접 선택해 복사해 주세요");
      }
    }

    grid.addEventListener("click", function (e) {
      var item = e.target.closest ? e.target.closest(".pl-item") : null;
      if (!item) return;
      if (e.target.classList.contains("pl-copy")) {
        copyText(item, e.target);
      } else if (e.target.classList.contains("pl-more")) {
        var open = item.classList.toggle("open");
        e.target.textContent = open ? "접기" : "전체 보기";
      }
    });

    catsEl.addEventListener("click", function (e) {
      var b = e.target.closest ? e.target.closest(".pl-cat") : null;
      if (!b) return;
      active = b.getAttribute("data-cat");
      Array.prototype.forEach.call(catsEl.querySelectorAll(".pl-cat"), function (x) {
        x.setAttribute("aria-pressed", x === b ? "true" : "false");
      });
      draw();
    });

    var timer = null;
    qEl.addEventListener("input", function () {
      clearTimeout(timer);
      timer = setTimeout(draw, 90);
    });
    clearEl.addEventListener("click", function () { qEl.value = ""; draw(); qEl.focus(); });

    /* ?q= 또는 #분류 로 바로 들어오는 경우 */
    var pq = new URLSearchParams(location.search).get("q");
    if (pq) qEl.value = pq;
    var hash = decodeURIComponent((location.hash || "").slice(1));
    if (hash && cats.indexOf(hash) !== -1) {
      active = hash;
      var btn = catsEl.querySelector('[data-cat="' + hash.replace(/"/g, '\\"') + '"]');
      if (btn) {
        catsEl.querySelector('[data-cat=""]').setAttribute("aria-pressed", "false");
        btn.setAttribute("aria-pressed", "true");
      }
    }
    draw();

    var rt = null;
    window.addEventListener("resize", function () {
      clearTimeout(rt);
      rt = setTimeout(markClipped, 150);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    initHeader();
    initEnrollButtons();
    initFreePeriod();
    preloadPayApp();
    initAuthPage();
    initMyPage();
    initAdminPage();
    initInquiryForm();
    initLessons();
    initPrompts();
  });

  window.App = { enroll: enroll, PLANS: PLANS, COURSES: COURSES };
})();
