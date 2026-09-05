/* 실무AI클래스 공통 스크립트 — 전면 무료 인강 + 외주·기업교육 접수
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
  /* 「내 강의에 담기」가 남기는 문서의 planCode 접미사. Firestore 규칙(validPlan)이 이 형태를 요구한다. */
  var FREE_PLAN = "pack4";
  var PLAN_LABEL = { pack4: "무료 코스", single: "무료 코스", group: "무료 코스" };

  /* ── 회원·DB: Firebase (Spark 무료 플랜) ─────
     config.FIREBASE가 채워지고 SDK가 로드되면 켜진다.
     Firestore: users/{uid} · enrollments/{uid_planCode} · settings/site(freePeriod, admins[], adminEmails[]) */
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

  /* 운영자 판정 — settings/site.admins(uid) 또는 adminEmails(이메일, 인증된 계정만). 규칙(firestore.rules)과 같은 기준. */
  function isAdminUser(user) {
    if (!fb || !fb.db || !user) return Promise.resolve(false);
    return fb.db.collection("settings").doc("site").get().then(function (snap) {
      var d = snap.exists ? snap.data() : {};
      var byUid = (d.admins || []).indexOf(user.uid) !== -1;
      var byEmail = !!user.emailVerified && (d.adminEmails || []).indexOf(String(user.email || "").toLowerCase()) !== -1;
      return byUid || byEmail;
    }).catch(function () { return false; });
  }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[c];
    });
  }

  /* 사이트 루트 절대경로 (예: /ai-class/) — 로그인 후 복귀 URL 검증용 */
  function siteRoot() {
    return location.pathname
      .replace(/(courses|pay)\/[^\/]*$/, "")
      .replace(/[^\/]*$/, "");
  }

  function sideStatus(msg, kind) {
    var el = document.getElementById("pay-status");
    if (!el) { if (msg) alert(msg); return; }
    el.innerHTML = msg || "";
    if (kind) { el.setAttribute("data-kind", kind); } else { el.removeAttribute("data-kind"); }
  }

  /* ── 헤더 로그인 상태 ───────────────────────── */
  function initHeader() {
    var el = document.getElementById("nav-auth");
    if (!el) return;

    if (!fb) { el.innerHTML = ""; return; }

    currentUser().then(function (user) {
      if (user) {
        el.innerHTML =
          '<a href="' + REL + 'my.html">내 강의</a>' +
          '<button class="btn btn-ghost" id="logout-btn" type="button">로그아웃</button>';
        document.getElementById("logout-btn").addEventListener("click", function () {
          fb.auth.signOut().then(function () { location.href = REL + "index.html"; });
        });
      } else {
        el.innerHTML = '<a href="' + REL + 'login.html">로그인</a>';
      }
    });
  }

  /* ── 「내 강의에 담기」 ─────────────────────────
     강의는 로그인 없이 전부 볼 수 있다. 담기만 계정에 기록한다. */
  function enroll(courseId) {
    var course = COURSES[courseId];
    if (!course) return;
    if (!fb || !fb.db) {
      sideStatus("담기 기능은 잠시 꺼져 있습니다. 강의는 그대로 보실 수 있습니다.");
      return;
    }
    var code = courseId + "-" + FREE_PLAN;
    currentUser().then(function (user) {
      if (!user) {
        location.href = REL + "login.html?next=" + encodeURIComponent(location.pathname + "#plans");
        return;
      }
      sideStatus("담는 중입니다…");
      var ref = fb.db.collection("enrollments").doc(user.uid + "_" + code);
      ref.get().then(function (snap) {
        if (snap.exists) return true;
        return ref.set({
          uid: user.uid, email: user.email || "", name: user.displayName || "",
          courseId: courseId, planCode: code, amount: 0, status: "free",
          createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        }).then(function () { return false; });
      }).then(function (already) {
        sideStatus((already ? "이미 담겨 있습니다. " : "담았습니다. ") +
          '<a href="' + REL + 'my.html">내 강의 보기 →</a>', "ok");
      }).catch(function (e) {
        sideStatus("담지 못했습니다: " + esc(e && e.code === "permission-denied" ? "권한이 없습니다." : (e && e.message)), "error");
      });
    });
  }

  function initEnrollButtons() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-enroll]"), function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        enroll(btn.getAttribute("data-course"));
      });
    });
    if (fb && location.hash === "#plans" && document.getElementById("pay-status")) {
      currentUser().then(function (u) {
        if (u) sideStatus("로그인되었습니다. 「내 강의에 담기」를 다시 눌러주세요.", "ok");
      });
    }
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

    /* 가입 직후·Google 로그인 뒤 users/{uid} 프로필을 남긴다 (이미 있으면 덮어쓰기 — 규칙상 본인만) */
    function ensureProfile(u, name) {
      if (!fb.db) return Promise.resolve();
      return fb.db.collection("users").doc(u.uid).set({
        name: name || u.displayName || "", email: u.email || "",
        createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
      }).catch(function () { /* 프로필 실패는 로그인 자체를 막지 않는다 */ });
    }

    /* 이미 로그인된 상태로 로그인 페이지에 오면 바로 next로 */
    if (fb) {
      currentUser().then(function (u) { if (u) afterLogin(); });
    }

    var gbtn = document.getElementById("google-btn");
    if (gbtn) {
      if (!fb) { gbtn.disabled = true; }
      gbtn.addEventListener("click", function () {
        if (!fb) return;
        statusEl.removeAttribute("data-kind");
        statusEl.textContent = "Google 창을 여는 중입니다…";
        var provider = new window.firebase.auth.GoogleAuthProvider();
        fb.auth.signInWithPopup(provider).then(function (cred) {
          return ensureProfile(cred.user).then(afterLogin);
        }).catch(function (err) {
          if (err && (err.code === "auth/popup-blocked" || err.code === "auth/operation-not-supported-in-this-environment")) {
            // signInWithRedirect는 사이트 도메인(github.io)≠authDomain(firebaseapp.com)이라 Chrome에서 결과를 못 돌려받음(0903 실측) → 안내만
            statusEl.setAttribute("data-kind", "error");
            statusEl.textContent = "브라우저가 로그인 창(팝업)을 막았습니다. 주소창의 팝업 차단 아이콘에서 허용한 뒤 다시 눌러주세요.";
            return;
          }
          if (err && err.code === "auth/popup-closed-by-user") { statusEl.textContent = ""; return; }
          statusEl.setAttribute("data-kind", "error");
          statusEl.textContent = authMsg(err);
        });
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!fb) {
        statusEl.textContent = "회원 시스템 오픈을 준비하고 있습니다. 강의는 로그인 없이 보실 수 있습니다.";
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
          listEl.innerHTML = '<p class="empty">아직 담은 코스가 없습니다.<br/>코스 페이지에서 「내 강의에 담기」를 누르면 여기에 모입니다.</p>';
          return;
        }
        listEl.innerHTML = rows.map(renderRow).join("");
      }).catch(function (e) {
        listEl.innerHTML = '<p class="empty">내역을 불러오지 못했습니다. (' + esc(e.message) + ')</p>';
      });
      isAdminUser(user).then(function (ok) {
        if (!ok) return;
        listEl.insertAdjacentHTML("afterend",
          '<p class="status" style="margin-top:22px;">운영자 계정입니다 · <a href="' + REL + 'admin.html" style="color:var(--brand);font-weight:700;">담기 현황 보기</a></p>');
      });
    });
  }

  function statusPill(st) {
    return st === "free" ? '<span class="pill ok">담김</span>'
      : st === "done" ? '<span class="pill ok">완료</span>'
      : st === "paid" ? '<span class="pill ok">결제 완료</span>'
      : st === "pending" ? '<span class="pill pending">대기</span>'
      : '<span class="pill bad">' + esc(st || "") + '</span>';
  }
  function courseLink(courseId) {
    return REL + "courses/" + courseId + ".html";
  }
  function rowLabels(o) {
    var course = COURSES[o.courseId] || { title: o.courseId };
    var planKey = String(o.planCode || "").replace(o.courseId + "-", "");
    return { course: course.title, plan: PLAN_LABEL[planKey] || o.planCode };
  }
  function renderRow(o) {
    var l = rowLabels(o);
    var date = tsMs(o.createdAt) ? new Date(tsMs(o.createdAt)).toLocaleDateString("ko-KR") : "";
    var href = COURSES[o.courseId] ? courseLink(o.courseId) : "#";
    return '<div class="order-item"><div class="meta"><b><a href="' + esc(href) + '">' + esc(l.course) + "</a></b><span>" +
      esc(l.plan) + " · " + date + "</span></div>" + statusPill(o.status) + "</div>";
  }

  /* ── 운영자 페이지 (admin.html) — settings/site.admins / adminEmails 계정만 ── */
  function initAdminPage() {
    var root = document.getElementById("admin-root");
    if (!root) return;
    if (!fb || !fb.db) { root.innerHTML = '<p class="empty">회원 시스템이 아직 연결되지 않았습니다.</p>'; return; }

    currentUser().then(function (user) {
      if (!user) {
        location.href = REL + "login.html?next=" + encodeURIComponent(location.pathname);
        return;
      }
      isAdminUser(user).then(function (ok) {
        if (!ok) {
          root.innerHTML = '<p class="empty">운영자 권한이 없는 계정입니다.<br/><small>로그인 계정: ' + esc(user.email || "") +
            (user.email && !user.emailVerified ? " (이메일 미인증 — Google 계정으로 로그인하면 바로 인증됩니다)" : "") +
            '<br/>내 UID: <code>' + esc(user.uid) + '</code></small></p>';
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
    var csvRows = [["일시", "이메일", "이름", "코스", "구성", "상태"]].concat(rows.map(function (o) {
      var l = rowLabels(o), ms = tsMs(o.createdAt);
      return [ms ? new Date(ms).toISOString() : "", o.email || "", o.name || "", l.course, l.plan, o.status || ""];
    }));
    var csv = csvRows.map(function (r) {
      return r.map(function (c) { return '"' + String(c).replace(/"/g, '""') + '"'; }).join(",");
    }).join("\r\n");
    var blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });

    root.innerHTML =
      '<p class="admin-summary">담기 <b>' + rows.length + '</b>건 &nbsp;' +
      '<a class="btn btn-ghost" id="csv-dl" download="signups.csv">CSV 내려받기</a></p>' +
      '<div class="table-wrap"><table class="admin-table"><thead><tr>' +
      '<th>일시</th><th>이메일</th><th>이름</th><th>코스</th><th>구성</th><th>상태</th></tr></thead><tbody>' +
      (body || '<tr><td colspan="6" class="empty">아직 담은 사람이 없습니다.</td></tr>') + "</tbody></table></div>";
    document.getElementById("csv-dl").href = URL.createObjectURL(blob);
  }

  /* ── 문의·견적 폼 (FormSubmit) — required 필드 기준으로 검사 ─── */
  function initInquiryForm() {
    var form = document.getElementById("inquiry");
    if (!form) return;
    var statusEl = document.getElementById("status");
    var submitBtn = document.getElementById("submit");

    form.addEventListener("submit", function (e) {
      var gaps = [];
      Array.prototype.forEach.call(form.querySelectorAll("[required]"), function (el) {
        if (!String(el.value || "").trim()) {
          var lab = form.querySelector('label[for="' + el.id + '"]');
          gaps.push(lab ? lab.textContent.replace(/\s*선택\s*$/, "").trim() : el.name);
        }
      });
      if (gaps.length) {
        e.preventDefault();
        if (statusEl) { statusEl.setAttribute("data-kind", "error"); statusEl.textContent = gaps.join(", ") + " 항목을 채워주세요."; }
        return;
      }
      if (statusEl) { statusEl.removeAttribute("data-kind"); statusEl.textContent = "보내는 중입니다…"; }
      if (submitBtn) submitBtn.disabled = true;
    });
  }

  /* ── 이메일 눌러서 복사 ─────────────────────── */
  function initCopyEmail() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (btn) {
      var hint = btn.querySelector(".hint");
      var original = hint ? hint.textContent : "";
      btn.addEventListener("click", function () {
        var text = btn.getAttribute("data-copy");
        function done(ok) {
          if (!hint) return;
          hint.textContent = ok ? "복사했습니다" : "직접 선택해 복사해주세요";
          btn.classList.toggle("done", !!ok);
          setTimeout(function () { hint.textContent = original; btn.classList.remove("done"); }, 2200);
        }
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(false); });
        } else {
          done(false);
        }
      });
    });
  }

  /* ── 무료 영상 강의 ────────────────────────── */
  function publishedLessons() {
    var all = window.LESSONS || [];
    var rows = [];
    all.forEach(function (L, i) {
      var ok = /^[A-Za-z0-9_.-]+\.mp4$/.test((L.mp4 || "").trim()) ||
               /^[A-Za-z0-9_-]{6,20}$/.test((L.yt || "").trim());
      if (ok) rows.push({ L: L, n: i + 1 });
    });
    return rows;
  }
  function syncLessonCount(n) {
    Array.prototype.forEach.call(document.querySelectorAll("[data-lesson-count]"), function (el) {
      el.textContent = n;
    });
  }

  /* 홈의 강의 목록: lessons.js가 있으면 실제 길이까지 채운다 */
  function initHomeLessons() {
    var host = document.getElementById("home-lessons");
    if (!host || !window.LESSONS) return;
    var rows = publishedLessons();
    if (!rows.length) return;
    syncLessonCount(rows.length);
    host.innerHTML = rows.map(function (row) {
      var L = row.L;
      return '<li><a href="' + REL + 'lessons.html#l' + row.n + '">' +
        '<span class="no">' + row.n + '강</span>' +
        '<span class="ttl">' + esc(L.title) + '</span>' +
        (L.len ? '<span class="len">' + esc(L.len) + '</span>' : '') +
        '</a></li>';
    }).join("");
  }

  function initLessons() {
    var host = document.getElementById("lesson-list");
    if (!host) return;

    var rows = publishedLessons();
    if (!rows.length) {
      host.innerHTML = '<p class="empty">강의를 준비하고 있습니다.</p>';
      return;
    }
    syncLessonCount(rows.length);

    var bodies = window.LESSON_BODIES || {};
    var wanted = (location.hash.match(/^#l(\d+)$/) || [])[1];
    var openN = wanted ? Number(wanted) : rows[0].n;

    host.innerHTML = rows.map(function (row) {
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

      var bullets = (L.points || []).map(function (t) { return "<li>" + esc(t) + "</li>"; }).join("");
      /* 본문은 scripts/lesson-N.md 에서 만들어진 것. 이미 이스케이프돼 있다. */
      var body = bodies[row.n] || "";

      return '<details class="lesson" id="l' + row.n + '"' + (row.n === openN ? " open" : "") + '>' +
        '<summary><span class="no">' + row.n + '강</span>' +
        '<span class="ttl">' + esc(L.title) + '</span>' +
        (L.len ? '<span class="len">' + esc(L.len) + '</span>' : '') +
        '</summary>' +
        '<div class="inner">' + box +
        '<p class="sum">' + esc(L.sum || "") + '</p>' +
        (bullets ? "<ul>" + bullets + "</ul>" : "") +
        (body ? '<div class="lesson-body">' + body + "</div>" : "") +
        '<div class="lesson-foot">' +
          '<span>이 편의 내용을 직접 만들 시간이 없다면</span>' +
          '<a href="' + REL + 'outsourcing.html">대신 만들어 드립니다 →</a>' +
        '</div>' +
        "</div></details>";
    }).join("");

    /* 왼쪽 목차 */
    var toc = document.getElementById("lesson-toc");
    if (toc) {
      toc.innerHTML = rows.map(function (row) {
        return '<li><a href="#l' + row.n + '" data-n="' + row.n + '"' + (row.n === openN ? ' aria-current="true"' : '') + '>' +
          '<span class="no">' + row.n + '</span><span>' + esc(row.L.title) + '</span></a></li>';
      }).join("");
      toc.addEventListener("click", function (e) {
        var a = e.target.closest ? e.target.closest("a[data-n]") : null;
        if (!a) return;
        e.preventDefault();
        openLesson(Number(a.getAttribute("data-n")));
        history.replaceState(null, "", "#l" + a.getAttribute("data-n"));
      });
    }

    function openLesson(n) {
      var d = document.getElementById("l" + n);
      if (!d) return;
      d.open = true;
      d.scrollIntoView({ behavior: "smooth", block: "start" });
      if (toc) {
        Array.prototype.forEach.call(toc.querySelectorAll("a[data-n]"), function (x) {
          if (Number(x.getAttribute("data-n")) === n) x.setAttribute("aria-current", "true");
          else x.removeAttribute("aria-current");
        });
      }
    }
    /* 열린 편이 바뀌면 목차 하이라이트도 따라간다 */
    host.addEventListener("toggle", function (e) {
      var d = e.target;
      if (!d.open || !toc) return;
      var n = Number((d.id || "").replace("l", ""));
      Array.prototype.forEach.call(toc.querySelectorAll("a[data-n]"), function (x) {
        if (Number(x.getAttribute("data-n")) === n) x.setAttribute("aria-current", "true");
        else x.removeAttribute("aria-current");
      });
    }, true);

    if (wanted) {
      setTimeout(function () { openLesson(openN); }, 60);
    }
    window.addEventListener("hashchange", function () {
      var m = location.hash.match(/^#l(\d+)$/);
      if (m) openLesson(Number(m[1]));
    });
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
          '문의로 남겨주시면 만들어 드립니다.</p>';
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
    initAuthPage();
    initMyPage();
    initAdminPage();
    initInquiryForm();
    initCopyEmail();
    initHomeLessons();
    initLessons();
    initPrompts();
  });

  window.App = { enroll: enroll, COURSES: COURSES };
})();
