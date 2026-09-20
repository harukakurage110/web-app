(() => {
  "use strict";

  const STORAGE_KEY = "infoI_demo";
  const UI_PANEL_KEY = "_lab_ui_panel";
  const PENDING_KEY = "_lab_pending_reload";

  const METHOD_NAMES = {
    memory: "In-Memory",
    cookie: "Cookie",
    local: "LocalStorage",
    session: "SessionStorage",
  };
  const METHOD_ICONS = {
    memory: "🧠",
    cookie: "🍪",
    local: "🗄️",
    session: "📎",
  };
  const LOCKER_EL_ID = {
    memory: "lockerMemory",
    cookie: "lockerCookie",
    local: "lockerLocal",
    session: "lockerSession",
  };

  // In-memory "storage" — a plain JS variable.
  // It only lives as long as this script is running in this tab.
  let memoryStore = {};

  let selectedMethod = null;
  let selectedAction = "reload";

  // ---------- generic helpers ----------

  function nowStr() {
    return new Date().toLocaleTimeString("ja-JP", { hour12: false });
  }

  function addLog(listEl, message) {
    const li = document.createElement("li");
    li.textContent = `[${nowStr()}] ${message}`;
    listEl.prepend(li);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }

  // ---------- cookie helpers ----------

  function setCookie(name, value, expiryOption) {
    let cookieStr = `${name}=${encodeURIComponent(value)}; path=/; SameSite=Lax`;
    if (expiryOption && expiryOption !== "session") {
      const seconds = parseInt(expiryOption, 10);
      const expires = new Date(Date.now() + seconds * 1000).toUTCString();
      cookieStr += `; expires=${expires}`;
    }
    document.cookie = cookieStr;
  }

  function getCookie(name) {
    const row = document.cookie.split("; ").find((r) => r.startsWith(name + "="));
    if (!row) return null;
    return decodeURIComponent(row.split("=").slice(1).join("="));
  }

  // ---------- reading current status ----------

  function getStatus() {
    return {
      memory: Object.prototype.hasOwnProperty.call(memoryStore, "value") ? memoryStore.value : null,
      cookie: getCookie(STORAGE_KEY),
      local: localStorage.getItem(STORAGE_KEY),
      session: sessionStorage.getItem(STORAGE_KEY),
    };
  }

  // ============================================================
  // STEP TABS
  // ============================================================

  const tabSave = document.getElementById("tab-save");
  const tabCheck = document.getElementById("tab-check");
  const panelSave = document.getElementById("panel-save");
  const panelCheck = document.getElementById("panel-check");

  function switchPanel(target) {
    const showCheck = target === "check";
    panelSave.hidden = showCheck;
    panelSave.classList.toggle("is-active", !showCheck);
    panelCheck.hidden = !showCheck;
    panelCheck.classList.toggle("is-active", showCheck);

    tabSave.classList.toggle("is-active", !showCheck);
    tabSave.setAttribute("aria-selected", String(!showCheck));
    tabCheck.classList.toggle("is-active", showCheck);
    tabCheck.setAttribute("aria-selected", String(showCheck));

    if (showCheck) refreshStatusGrid();
  }

  tabSave.addEventListener("click", () => switchPanel("save"));
  tabCheck.addEventListener("click", () => switchPanel("check"));

  // ============================================================
  // STEP 1: SAVE
  // ============================================================

  const methodPicker = document.getElementById("methodPicker");
  const dataInput = document.getElementById("dataInput");
  const cookieExpiry = document.getElementById("cookieExpiry");
  const expirySelect = document.getElementById("expirySelect");
  const saveBtn = document.getElementById("saveBtn");
  const saveLog = document.getElementById("saveLog");
  const serverNote = document.getElementById("serverNote");
  const nodeServer = document.getElementById("nodeServer");
  const nodeOperator = document.getElementById("nodeOperator");
  const canvas = document.getElementById("canvas");

  methodPicker.addEventListener("click", (e) => {
    const btn = e.target.closest(".method-btn");
    if (!btn) return;
    selectedMethod = btn.dataset.method;

    methodPicker.querySelectorAll(".method-btn").forEach((b) =>
      b.classList.toggle("is-selected", b === btn)
    );

    cookieExpiry.hidden = selectedMethod !== "cookie";
    saveBtn.disabled = false;
    saveBtn.textContent = `${METHOD_NAMES[selectedMethod]} に保存する`;
  });

  async function movePacket(fromEl, toEl, color, emoji) {
    return new Promise((resolve) => {
      const canvasRect = canvas.getBoundingClientRect();
      const fromRect = fromEl.getBoundingClientRect();
      const toRect = toEl.getBoundingClientRect();

      const packet = document.createElement("div");
      packet.className = "packet";
      packet.style.setProperty("--packet-color", color);
      packet.textContent = emoji;
      packet.style.left = fromRect.left - canvasRect.left + fromRect.width / 2 + "px";
      packet.style.top = fromRect.top - canvasRect.top + fromRect.height / 2 + "px";
      canvas.appendChild(packet);

      let done = false;
      const cleanup = () => {
        if (done) return;
        done = true;
        packet.remove();
        resolve();
      };

      if (prefersReducedMotion()) {
        setTimeout(cleanup, 40);
        return;
      }

      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          packet.style.left = toRect.left - canvasRect.left + toRect.width / 2 + "px";
          packet.style.top = toRect.top - canvasRect.top + toRect.height / 2 + "px";
        });
      });

      packet.addEventListener("transitionend", cleanup, { once: true });
      setTimeout(cleanup, 1300); // fallback safety net
    });
  }

  function flashNode(el) {
    el.classList.add("flash");
    setTimeout(() => el.classList.remove("flash"), 700);
  }

  async function animateSave(method) {
    const locker = document.getElementById(LOCKER_EL_ID[method]);
    const color = getComputedStyle(locker).getPropertyValue("--m-color").trim() || "#1B2A4A";

    await movePacket(nodeOperator, locker, color, "📦");
    flashNode(locker);

    if (method === "cookie") {
      serverNote.textContent = "🍪 今後のリクエストで自動的に送信されます";
      serverNote.className = "server-note is-sent";
      await movePacket(locker, nodeServer, color, "🍪");
      flashNode(nodeServer);
    } else {
      serverNote.textContent = `🚫 ${METHOD_NAMES[method]} は自動送信されません`;
      serverNote.className = "server-note is-blocked";
    }
  }

  saveBtn.addEventListener("click", async () => {
    if (!selectedMethod) return;
    const value = dataInput.value.trim();
    if (!value) {
      addLog(saveLog, "⚠️ 保存するデータを入力してください。");
      dataInput.focus();
      return;
    }

    saveBtn.disabled = true;

    if (selectedMethod === "memory") {
      memoryStore = { value };
    } else if (selectedMethod === "cookie") {
      setCookie(STORAGE_KEY, value, expirySelect.value);
    } else if (selectedMethod === "local") {
      localStorage.setItem(STORAGE_KEY, value);
    } else if (selectedMethod === "session") {
      sessionStorage.setItem(STORAGE_KEY, value);
    }

    const label = METHOD_NAMES[selectedMethod];
    addLog(saveLog, `${METHOD_ICONS[selectedMethod]} 「${value}」を ${label} に保存しました。`);
    if (selectedMethod === "cookie" && expirySelect.value !== "session") {
      addLog(saveLog, `⏳ このCookieは ${expirySelect.value} 秒後に自動的に消えます。`);
    }

    await animateSave(selectedMethod);
    saveBtn.disabled = false;
  });

  // ============================================================
  // STEP 2: CHECK
  // ============================================================

  const statusGrid = document.getElementById("statusGrid");
  const refreshBtn = document.getElementById("refreshBtn");
  const actionPicker = document.getElementById("actionPicker");
  const actionDesc = document.getElementById("actionDesc");
  const runBtn = document.getElementById("runBtn");
  const resultBlock = document.getElementById("resultBlock");
  const resultGrid = document.getElementById("resultGrid");
  const checkLog = document.getElementById("checkLog");

  const ACTIONS = {
    reload: {
      desc: "ページ全体を再読み込みします。JavaScriptが最初から実行し直されるため、プログラム内の変数はすべて作り直されます。",
      run: doReload,
    },
    newtab: {
      desc: "このページのURLをコピーします。自分でブラウザの新しいタブを開き、URLを貼り付けてアクセスしてみてください。それぞれ独立したタブとして扱われます。",
      run: doNewTab,
    },
    wait: {
      desc: "実際に10秒間、時間を経過させてから、保存したデータの状態をもう一度確認します。",
      run: doWait,
    },
    closeTab: {
      desc: "本来は「タブを閉じる」操作ですが、プログラムから実際にタブを閉じることはできません。そこで、タブを閉じたときに起こることをこの場でシミュレーション（模擬的に再現）します。",
      run: doCloseTab,
    },
    server: {
      desc: "このページから架空のサーバーへリクエストを送るシミュレーションを行います。実際に外部へは送信されません。",
      run: doServer,
    },
  };

  function refreshStatusGrid() {
    const status = getStatus();
    statusGrid.querySelectorAll("[data-value]").forEach((el) => {
      const key = el.dataset.value;
      const val = status[key];
      if (val === null || val === undefined || val === "") {
        el.textContent = "（空）";
        el.classList.add("is-empty");
      } else {
        el.textContent = val;
        el.classList.remove("is-empty");
      }
    });
    return status;
  }

  refreshBtn.addEventListener("click", () => {
    refreshStatusGrid();
    addLog(checkLog, "🔍 保存状況を再確認しました。");
  });

  actionPicker.addEventListener("click", (e) => {
    const btn = e.target.closest(".action-btn");
    if (!btn) return;
    selectedAction = btn.dataset.action;
    actionPicker.querySelectorAll(".action-btn").forEach((b) =>
      b.classList.toggle("is-active", b === btn)
    );
    actionDesc.textContent = ACTIONS[selectedAction].desc;
  });
  actionDesc.textContent = ACTIONS[selectedAction].desc;

  runBtn.addEventListener("click", () => {
    ACTIONS[selectedAction].run();
  });

  function renderDiffRows(before, after, { simulated = false } = {}) {
    resultBlock.hidden = false;
    resultGrid.innerHTML = "";

    if (simulated) {
      const note = document.createElement("p");
      note.className = "result-note";
      note.textContent = "※ この結果はシミュレーションによるものです。";
      resultGrid.appendChild(note);
    }

    Object.keys(METHOD_NAMES).forEach((key) => {
      const row = document.createElement("div");
      row.className = "result-row";
      row.style.setProperty("--m-color", `var(--c-${key})`);

      const name = document.createElement("span");
      name.className = "r-name";
      name.textContent = `${METHOD_ICONS[key]} ${METHOD_NAMES[key]}`;

      const statusEl = document.createElement("span");
      statusEl.className = "r-status";

      const beforeEmpty = before[key] === null || before[key] === undefined || before[key] === "";
      const afterEmpty = after[key] === null || after[key] === undefined || after[key] === "";

      if (beforeEmpty) {
        statusEl.textContent = "（もともと空）";
        statusEl.classList.add("na");
      } else if (afterEmpty) {
        statusEl.textContent = "❌ 消えました";
        statusEl.classList.add("gone");
      } else {
        statusEl.textContent = "✅ 残っています";
        statusEl.classList.add("kept");
      }

      row.appendChild(name);
      row.appendChild(statusEl);
      resultGrid.appendChild(row);
    });
  }

  function renderServerPreview(cookieVal) {
    resultBlock.hidden = false;
    resultGrid.innerHTML = "";

    const box = document.createElement("div");
    box.className = "request-preview";

    const cookieLine = cookieVal
      ? `<span class="rp-sent">Cookie: ${STORAGE_KEY}=${cookieVal}</span>  ← 自動的に付いていく`
      : `<span class="rp-blocked">Cookie: (保存されていないため付かない)</span>`;

    box.innerHTML =
      `GET /page HTTP/1.1\n` +
      `Host: example.github.io\n` +
      `${cookieLine}\n` +
      `<span class="rp-blocked">// LocalStorage / SessionStorage / In-Memory の値は含まれない</span>`;

    resultGrid.appendChild(box);

    const note = document.createElement("p");
    note.className = "result-note";
    note.textContent =
      "※ Cookieはブラウザが自動的にリクエストへ付けて送ります。それ以外は、プログラムが自分で読み出して送信しない限りサーバーには届きません。";
    resultGrid.appendChild(note);
  }

  // ---- action implementations ----

  function doReload() {
    const before = getStatus();
    sessionStorage.setItem(PENDING_KEY, JSON.stringify(before));
    sessionStorage.setItem(UI_PANEL_KEY, "check");
    addLog(checkLog, "🔄 ページを再読み込みします…");
    location.reload();
  }

  async function doNewTab() {
    const url = location.href;
    try {
      await navigator.clipboard.writeText(url);
      addLog(checkLog, `📋 URLをコピーしました。新しいタブを自分で開いて貼り付けてください。`);
    } catch {
      addLog(checkLog, `📋 URLをコピーできませんでした。手動でコピーしてください: ${url}`);
    }
    const li = document.createElement("li");
    li.textContent = url;
    checkLog.prepend(li);
  }

  function doWait() {
    const before = getStatus();
    let remaining = 10;
    runBtn.disabled = true;
    const originalText = runBtn.textContent;
    runBtn.textContent = `残り ${remaining} 秒…`;
    addLog(checkLog, "⏳ 10秒間、時間の経過を確認しています…");

    const timer = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        runBtn.textContent = `残り ${remaining} 秒…`;
      } else {
        clearInterval(timer);
        runBtn.textContent = originalText;
        runBtn.disabled = false;
        const after = getStatus();
        refreshStatusGrid();
        renderDiffRows(before, after);
        addLog(checkLog, "⏳ 10秒が経過しました。状態を比較しました。");
      }
    }, 1000);
  }

  function doCloseTab() {
    const before = getStatus();

    // Simulate what happens when this tab is closed:
    // in-memory variables are discarded and this tab's sessionStorage is dropped.
    memoryStore = {};
    sessionStorage.removeItem(STORAGE_KEY);

    const after = getStatus();
    refreshStatusGrid();
    renderDiffRows(before, after, { simulated: true });
    addLog(checkLog, "✖️（シミュレーション）タブを閉じた場合に起こることを再現しました。");
  }

  function doServer() {
    const cookieVal = getCookie(STORAGE_KEY);
    renderServerPreview(cookieVal);
    addLog(checkLog, "📡（シミュレーション）サーバーへのリクエストを再現しました。");
  }

  // ============================================================
  // INIT
  // ============================================================

  function init() {
    refreshStatusGrid();

    const pending = sessionStorage.getItem(PENDING_KEY);
    const uiPanel = sessionStorage.getItem(UI_PANEL_KEY);

    if (uiPanel === "check") {
      switchPanel("check");
      sessionStorage.removeItem(UI_PANEL_KEY);
    }

    if (pending) {
      sessionStorage.removeItem(PENDING_KEY);
      try {
        const before = JSON.parse(pending);
        const after = getStatus();
        refreshStatusGrid();
        renderDiffRows(before, after);
        addLog(checkLog, "🔄 再読み込みが完了しました。状態を比較しました。");
      } catch {
        /* ignore malformed snapshot */
      }
    }
  }

  document.addEventListener("DOMContentLoaded", init);
})();
