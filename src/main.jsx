import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CalendarClock,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  LogIn,
  LogOut,
  Mail,
  Megaphone,
  MessageCircle,
  Monitor,
  Plus,
  RotateCw,
  Send,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import "./styles.css";
import { cloudEnabled, groupCodeExists, loadCloudState, saveCloudState } from "./cloudStore";

const STORAGE_KEY = "daily-scheduler-attendance-v3";
const LEGACY_KEYS = ["daily-scheduler-attendance-v2", "daily-scheduler-attendance-v1"];
const DIRECTOR_USER = "GMPJ";
const DIRECTOR_PASSWORD = "6090";
const LEAVE_GRADES = ["國一", "國二", "國三"];

const defaultState = {
  groups: [{ code: "GMPJ", name: "GMPJ 團隊", createdAt: new Date().toISOString() }],
  employees: [
    { id: "emp-1", groupCode: "GMPJ", name: "林怡君", username: "staff01", password: "1234", email: "staff01@example.com", workStartTime: "09:00", weeklySchedule: defaultWeeklySchedule(), isManager: false, isCounter: false, createdAt: new Date().toISOString() },
    { id: "emp-2", groupCode: "GMPJ", name: "陳柏宇", username: "staff02", password: "1234", email: "staff02@example.com", workStartTime: "09:00", weeklySchedule: defaultWeeklySchedule(), isManager: false, isCounter: false, createdAt: new Date().toISOString() },
  ],
  directors: [{ id: "director-main", groupCode: "GMPJ", name: "主任", username: DIRECTOR_USER, password: DIRECTOR_PASSWORD, email: "director@example.com" }],
  schedules: [
    {
      id: "task-1",
      title: "早班交接與現場巡檢",
      detail: "確認今日重點、設備狀態與缺料項目，完成後回報主任。",
      type: "fixed",
      date: todayDate(),
      time: "09:00",
      audience: "all",
      groupCode: "GMPJ",
      channel: "大屏幕 + Email + 手機文字",
      createdBy: DIRECTOR_USER,
      createdAt: new Date().toISOString(),
    },
  ],
  attendance: [],
  scheduleResponses: [],
  leaveEntries: [],
  reportEntries: [],
  messages: [],
  boardPosts: [
    {
      id: "post-1",
      groupCode: "GMPJ",
      authorName: "主任",
      authorRole: "director",
      text: "留言板可用來回報現場狀況、討論排程細節或補充注意事項。",
      createdAt: new Date().toISOString(),
    },
  ],
};

function defaultWeeklySchedule() {
  return {
    1: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
    2: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
    3: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
    4: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
    5: [{ start: "09:00", end: "12:00" }, { start: "13:00", end: "18:00" }],
    0: [],
    6: [],
  };
}

function todayDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value || "0000";
  const month = parts.find((part) => part.type === "month")?.value || "00";
  const day = parts.find((part) => part.type === "day")?.value || "00";
  return `${year}-${month}-${day}`;
}

function nowTime() {
  return new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function nowStamp() {
  return new Date().toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function normalizeState(input) {
  const source = input || defaultState;
  const groups = Array.isArray(source.groups) ? source.groups : defaultState.groups;
  const employees = (Array.isArray(source.employees) ? source.employees : defaultState.employees).map((employee) => ({
    email: "",
    workStartTime: "09:00",
    groupCode: "GMPJ",
    weeklySchedule: defaultWeeklySchedule(),
    isManager: false,
    isCounter: false,
    ...employee,
  }));
  const directors = (Array.isArray(source.directors) ? source.directors : defaultState.directors).map((director) => ({
    email: "",
    groupCode: "GMPJ",
    ...director,
  }));
  const schedules = (Array.isArray(source.schedules) ? source.schedules : defaultState.schedules).map((item) => ({
    type: item.type || "temporary",
    date: item.date || todayDate(),
    time: item.time || "09:00",
    audience: item.audience || "all",
    channel: item.channel || "大屏幕 + Email + 手機文字",
    groupCode: item.groupCode || "GMPJ",
    ...item,
  }));
  const attendance = (source.attendance || []).map((record) => ({
    requestedClockOut: "",
    clockOutApproved: Boolean(record.clockOut),
    ...record,
  }));
  return {
    groups,
    employees,
    directors,
    schedules,
    attendance,
    scheduleResponses: source.scheduleResponses || [],
    leaveEntries: (source.leaveEntries || []).map((item) => ({
      leaveStartDate: item.leaveStartDate || item.leaveDate || item.date || todayDate(),
      leaveEndDate: item.leaveEndDate || item.leaveDate || item.date || todayDate(),
      className: item.className || item.grade || "",
      studentName: item.studentName || item.name || "",
      note: item.note || "",
      groupCode: item.groupCode || "GMPJ",
      createdBy: item.createdBy || "",
      ...item,
    })),
    reportEntries: source.reportEntries || [],
    messages: (source.messages || []).map((item) => ({ groupCode: item.groupCode || "GMPJ", ...item })),
    boardPosts: (source.boardPosts || defaultState.boardPosts).map((item) => ({ groupCode: item.groupCode || "GMPJ", createdBy: item.createdBy || "", ...item })),
  };
}

function readState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || LEGACY_KEYS.map((key) => localStorage.getItem(key)).find(Boolean);
    return normalizeState(raw ? JSON.parse(raw) : defaultState);
  } catch {
    return normalizeState(defaultState);
  }
}

function writeState(next) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

function scheduleDate(item) {
  return item.type === "fixed" ? todayDate() : item.date;
}

function responseDate(item) {
  return scheduleDate(item);
}

function scheduleDateTime(item) {
  return new Date(`${scheduleDate(item)}T${item.time}:00`);
}

function isVisibleTo(item, viewer) {
  if (item.groupCode && viewer.user?.groupCode && item.groupCode !== viewer.user.groupCode) return false;
  return viewer.role === "director" || item.audience === "all" || item.audience === viewer.user.id;
}

function isMessageVisible(message, viewer) {
  if (message.groupCode && viewer.user?.groupCode && message.groupCode !== viewer.user.groupCode) return false;
  return viewer.role === "director" || message.audience === "all" || message.audience === viewer.user.id;
}

function todayShiftStart(user) {
  const day = String(new Date().getDay());
  const segments = user.weeklySchedule?.[day] || [];
  return segments[0]?.start || user.workStartTime || "";
}

function statusForEmployee(attendance, employeeId) {
  const record = latestAttendanceRecord(attendance, employeeId);
  if (!record) return { label: "尚未上班", tone: "quiet", record: null };
  if (record.requestedClockOut && !record.clockOutApproved) return { label: "下班待核准", tone: "pending", record };
  if (record.clockIn && !record.clockOut) return { label: "上班中", tone: "active", record };
  return { label: "已下班", tone: "done", record };
}

function latestAttendanceRecord(attendance, employeeId) {
  return attendance
    .filter((item) => item.employeeId === employeeId && item.date === todayDate())
    .sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""))[0] || null;
}

function activeAttendanceRecords(attendance, employeeIds) {
  const activeIds = new Set(employeeIds);
  return employeeIds
    .map((employeeId) => latestAttendanceRecord(attendance, employeeId))
    .filter((record) => record && activeIds.has(record.employeeId) && record.clockIn && !record.clockOut);
}

function isScheduleDue(item) {
  return Date.now() >= scheduleDateTime(item).getTime();
}

function isLeaveEditor(user) {
  return Boolean(user?.role === "director" || user?.isCounter);
}

function scheduleCardState(item, response) {
  if (response?.completedAt) return "completed";
  if (isScheduleDue(item)) return "due";
  if (response?.receivedAt) return "received";
  return "default";
}

function confirmTwice(firstMessage, secondMessage) {
  return window.confirm(firstMessage) && window.confirm(secondMessage);
}

function useAppState() {
  const [state, setState] = useState(readState);
  const [cloudStatus, setCloudStatus] = useState(cloudEnabled ? "連線中" : "本機模式");
  const [cloudReady, setCloudReady] = useState(!cloudEnabled);
  const lastLocalWrite = useRef(0);
  const skipNextSave = useRef(false);

  useEffect(() => {
    let active = true;
    if (!cloudEnabled) return undefined;
    loadCloudState(readState())
      .then((cloudState) => {
        if (!active) return;
        const normalized = normalizeState(cloudState);
        skipNextSave.current = true;
        setState(normalized);
        writeState(normalized);
        setCloudStatus("雲端同步");
        setCloudReady(true);
      })
      .catch(() => {
        if (!active) return;
        setCloudStatus("雲端連線失敗，暫用本機");
        setCloudReady(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    writeState(state);
    if (!cloudEnabled || !cloudReady) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      saveCloudState(state).catch(() => setCloudStatus("雲端同步失敗"));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [state, cloudReady]);

  useEffect(() => {
    if (!cloudEnabled || !cloudReady) return;
    const syncFromCloud = () => {
      if (Date.now() - lastLocalWrite.current < 1200) return;
      return loadCloudState(readState())
        .then((cloudState) => {
          const normalized = normalizeState(cloudState);
          skipNextSave.current = true;
          setState(normalized);
          writeState(normalized);
          setCloudStatus("雲端同步");
        })
        .catch(() => setCloudStatus("雲端同步失敗"));
    };

    const timer = window.setInterval(() => {
      syncFromCloud();
    }, 1000);

    const handleFocus = () => syncFromCloud();
    const handleVisibility = () => {
      if (document.visibilityState === "visible") syncFromCloud();
    };
    const handleStorage = () => syncFromCloud();

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("storage", handleStorage);
    };
  }, [cloudReady]);

  function setSyncedState(next) {
    lastLocalWrite.current = Date.now();
    setState(next);
  }

  return [state, setSyncedState, cloudStatus];
}

function App() {
  const [state, setState, cloudStatus] = useAppState();
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("daily-scheduler-session") || "null");
    } catch {
      return null;
    }
  });
  const [notice, setNotice] = useState("");
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [heroNotice, setHeroNotice] = useState(null);
  const [dismissedNoticeIds, setDismissedNoticeIds] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("dismissed-app-notices") || "[]");
    } catch {
      return [];
    }
  });

  const appNotices = useMemo(() => {
    if (!session) return [];
    const scheduleNotices = state.schedules
      .filter((item) => isVisibleTo(item, session))
      .map((item) => {
        const diff = scheduleDateTime(item).getTime() - currentTime;
        const type = diff <= 0 && diff > -10 * 60 * 1000 ? "到點" : diff > 0 && diff <= 10 * 60 * 1000 ? "即將" : "排程";
        return {
          id: `schedule-${item.id}-${scheduleDate(item)}`,
          type,
          title: item.title,
          text: `${item.type === "fixed" ? "每日" : item.date} ${item.time}｜${item.detail}`,
          createdAt: `${scheduleDate(item)}T${item.time}:00`,
        };
      });
    const messageNotices = state.messages
      .filter((message) => isMessageVisible(message, session))
      .map((message) => ({
        id: `message-${message.id}`,
        type: "群發",
        title: message.title,
        text: message.text,
        createdAt: message.createdAt,
      }));
    return [...messageNotices, ...scheduleNotices].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [currentTime, session, state.messages, state.schedules]);

  const unreadNotices = appNotices.filter((item) => !dismissedNoticeIds.includes(item.id));

  useEffect(() => {
    if (!session) {
      setHeroNotice(null);
      return;
    }
    if (!appNotices.length) return;
    const upcomingSchedule = appNotices
      .filter((item) => item.id.startsWith("schedule-") && new Date(item.createdAt).getTime() >= currentTime)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())[0];
    if (upcomingSchedule) {
      setHeroNotice(upcomingSchedule);
      return;
    }
    if (!heroNotice || !appNotices.some((item) => item.id === heroNotice.id)) {
      setHeroNotice(appNotices[0]);
    }
  }, [appNotices, currentTime, heroNotice, session]);

  useEffect(() => {
    if (session) {
      localStorage.setItem("daily-scheduler-session", JSON.stringify(session));
    } else {
      localStorage.removeItem("daily-scheduler-session");
    }
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const users = session.role === "director" ? [...state.directors, ...state.employees.filter((employee) => employee.isManager)] : state.employees;
    const freshUser = users.find((user) => user.id === session.user.id);
    if (!freshUser) {
      setSession(null);
      setNotice("此帳號已不存在，已自動登出。");
      return;
    }
    if (JSON.stringify(freshUser) !== JSON.stringify(session.user)) {
      setSession({ ...session, user: freshUser });
    }
  }, [state.directors, state.employees, session]);

  useEffect(() => {
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);


  useEffect(() => {
    localStorage.setItem("dismissed-app-notices", JSON.stringify(dismissedNoticeIds));
  }, [dismissedNoticeIds]);

  useEffect(() => {
    if (!unreadNotices.length) return;
    setNotice(`有 ${unreadNotices.length} 則新通知，請查看通知中心。`);
    navigator.vibrate?.(150);
  }, [unreadNotices.length]);

  function logout() {
    setSession(null);
    setNotice("已登出。");
  }

  return (
    <main className="app-shell">
      <section className="hero-band">
        <div>
          <div className="eyebrow"><Sparkles size={16} /> 質感排程與考勤</div>
          <h1>每日重點、通知與上下班狀態集中管理</h1>
        </div>
        <div className="hero-highlight">
          <span className="hero-highlight-label">即時提醒</span>
          {heroNotice ? (
            <>
              <strong>{heroNotice.title}</strong>
              <p>{heroNotice.text}</p>
            </>
          ) : (
            <p>登入後會顯示最新排程與注意事項。</p>
          )}
        </div>
        {session && (
          <button className="icon-button ghost" onClick={logout} title="登出">
            <LogOut size={20} />
          </button>
        )}
      </section>

      {notice && <div className="toast">{notice}</div>}
      <div className={`sync-badge ${cloudEnabled ? "cloud" : "local"}`}>{cloudStatus}</div>

      {!session ? (
        <AuthPanel state={state} setState={setState} setSession={setSession} setNotice={setNotice} />
      ) : (
        <>
          <Billboard state={state} viewer={session} />
          <NoticeCenter notices={appNotices} unreadCount={unreadNotices.length} onClear={() => setDismissedNoticeIds(appNotices.map((item) => item.id))} />
          {session.role === "director" ? (
            <DirectorView state={state} setState={setState} session={session} setSession={setSession} setNotice={setNotice} />
          ) : (
            <EmployeeView state={state} setState={setState} session={session} setSession={setSession} setNotice={setNotice} />
          )}
          <BoardPanel state={state} setState={setState} session={session} setNotice={setNotice} />
        </>
      )}
    </main>
  );
}

function AuthPanel({ state, setState, setSession, setNotice }) {
  const [mode, setMode] = useState("login");
  const [role, setRole] = useState("employee");
  const [registerRole, setRegisterRole] = useState("employee");
  const [form, setForm] = useState({ name: "", username: "", password: "", email: "", groupCode: "", groupName: "" });

  async function submit(event) {
    event.preventDefault();
    const username = form.username.trim();
    const password = form.password.trim();
    const email = form.email.trim();
    const groupCode = form.groupCode.trim().toUpperCase();

    if (mode === "register") {
      if (!form.name.trim() || !username || !password || !email) {
        setNotice("請填寫姓名、帳號、密碼與電子郵件。");
        return;
      }
      const exists = [...state.employees, ...state.directors].some((user) => user.username === username);
      if (exists) {
        setNotice("這個帳號已經被使用。");
        return;
      }

      if (registerRole === "director") {
        if (!groupCode) {
          setNotice("主任註冊必須建立群組代碼。");
          return;
        }
        const usedInCloud = await groupCodeExists(groupCode);
        if (state.groups.some((group) => group.code === groupCode) || usedInCloud) {
          setNotice("這個群組代碼已經存在，請換一個。");
          return;
        }
        const director = { id: crypto.randomUUID(), groupCode, name: form.name.trim(), username, password, email };
        setState({
          ...state,
          groups: [...state.groups, { code: groupCode, name: form.groupName.trim() || `${form.name.trim()} 的群組`, createdAt: new Date().toISOString() }],
          directors: [...state.directors, director],
        });
        setSession({ role: "director", user: director });
        setNotice(`主任帳號已建立，群組代碼是 ${groupCode}。`);
        return;
      }

      if (!groupCode) {
        setNotice("請輸入主任提供的群組代碼。");
        return;
      }
      const employee = { id: crypto.randomUUID(), groupCode, name: form.name.trim(), username, password, email, workStartTime: "09:00", weeklySchedule: defaultWeeklySchedule(), createdAt: new Date().toISOString() };
      const groups = state.groups.some((group) => group.code === groupCode)
        ? state.groups
        : [...state.groups, { code: groupCode, name: `${groupCode} 群組`, createdAt: new Date().toISOString() }];
      setState({ ...state, groups, employees: [...state.employees, employee] });
      setSession({ role: "employee", user: employee });
      setNotice("員工帳號已建立，已加入群組。");
      return;
    }

    if (role === "director") {
      const director = state.directors.find((user) => user.username === username && user.password === password);
      const proxyDirector = state.employees.find((user) => user.isManager && user.username === username && user.password === password);
      const directorUser = director || proxyDirector;
      if (!directorUser) {
        setNotice("主任帳號或密碼不正確。預設主任帳號 GMPJ，密碼 6090。");
        return;
      }
      setSession({ role: "director", user: directorUser });
      setNotice("主任已登入。");
      return;
    }

    const employee = state.employees.find((user) => user.username === username && user.password === password);
    if (!employee) {
      setNotice("員工帳號或密碼不正確。");
      return;
    }
    setSession({ role: "employee", user: employee });
    setNotice("員工已登入。");
  }

  return (
    <section className="auth-layout">
      <div className="visual-panel">
        <div className="glass-meter">
          <CalendarClock size={38} />
          <strong>群組式排程管理</strong>
          <span>主任註冊建立群組代碼，員工用群組代碼加入。公開版資料先存在各自裝置，正式多人同步需接後端。</span>
        </div>
      </div>
      <form className="panel auth-panel" onSubmit={submit}>
        <div className="segmented">
          <button type="button" className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>
            <LogIn size={16} /> 登入
          </button>
          <button type="button" className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>
            <UserPlus size={16} /> 註冊
          </button>
        </div>

        {mode === "login" && (
          <div className="segmented slim">
            <button type="button" className={role === "employee" ? "selected" : ""} onClick={() => setRole("employee")}>員工端</button>
            <button type="button" className={role === "director" ? "selected" : ""} onClick={() => setRole("director")}>主任端</button>
          </div>
        )}

        {mode === "register" && (
          <div className="segmented slim">
            <button type="button" className={registerRole === "employee" ? "selected" : ""} onClick={() => setRegisterRole("employee")}>員工註冊</button>
            <button type="button" className={registerRole === "director" ? "selected" : ""} onClick={() => setRegisterRole("director")}>主任註冊</button>
          </div>
        )}

        {mode === "register" && (
          <label>
            姓名
            <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="例如：王小美" />
          </label>
        )}
        <label>
          帳號
          <input value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} placeholder={role === "director" ? "GMPJ" : "輸入員工帳號"} />
        </label>
        <label>
          密碼
          <input type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} placeholder={role === "director" ? "6090" : "輸入密碼"} />
        </label>
        {mode === "register" && (
          <label>
            電子郵件
            <input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} placeholder="name@example.com" />
          </label>
        )}
        {mode === "register" && (
          <label>
            群組代碼
            <input value={form.groupCode} onChange={(event) => setForm({ ...form, groupCode: event.target.value })} placeholder={registerRole === "director" ? "建立代碼，例如 ATEAM" : "輸入主任提供的代碼"} />
          </label>
        )}
        {mode === "register" && registerRole === "director" && (
          <label>
            群組名稱
            <input value={form.groupName} onChange={(event) => setForm({ ...form, groupName: event.target.value })} placeholder="例如：早班團隊" />
          </label>
        )}
        <button className="primary-action" type="submit">
          {mode === "register" ? "建立帳號" : "進入系統"} <ChevronRight size={18} />
        </button>
      </form>
    </section>
  );
}

function Billboard({ state, viewer }) {
  const nextItems = useMemo(() => {
    return state.schedules
      .filter((item) => isVisibleTo(item, viewer))
      .sort((a, b) => scheduleDateTime(a).getTime() - scheduleDateTime(b).getTime())
      .slice(0, 3);
  }, [state.schedules, viewer]);

  if (!nextItems.length) return null;
  const headline = nextItems[0];

  return (
    <section className="billboard">
      <div className="billboard-label"><Monitor size={18} /> 大屏幕橫幅</div>
      <div className="billboard-main">
        <strong>{headline.time}</strong>
        <span>{headline.title}</span>
      </div>
      <p>{headline.detail}</p>
    </section>
  );
}

function NoticeCenter({ notices, unreadCount, onClear }) {
  return (
    <section className={`notice-center ${unreadCount ? "has-unread" : ""}`}>
      <div className="notice-center-head">
        <div>
          <strong>通知中心</strong>
          <span>{unreadCount ? `${unreadCount} 則未讀` : "目前沒有未讀"}</span>
        </div>
        <button className="secondary-action" type="button" onClick={onClear}>全部已讀</button>
      </div>
      <div className="notice-strip">
        {notices.slice(0, 5).map((item) => (
          <article className="notice-pill" key={item.id}>
            <b>{item.type}</b>
            <span>{item.title}</span>
          </article>
        ))}
        {!notices.length && <span className="muted">目前沒有通知。</span>}
      </div>
    </section>
  );
}

function DirectorView({ state, setState, session, setSession, setNotice }) {
  const [task, setTask] = useState({ title: "", detail: "", type: "fixed", date: todayDate(), time: "09:00", audience: "all" });
  const [directorTab, setDirectorTab] = useState("dashboard");
  const [groupCodeDraft, setGroupCodeDraft] = useState(session.user.groupCode || "");
  const isProxyManager = Boolean(session.user.isManager);
  const groupEmployees = state.employees.filter((employee) => employee.groupCode === session.user.groupCode);
  const attendanceRows = groupEmployees.map((employee) => ({ employee, ...statusForEmployee(state.attendance, employee.id) }));
  const groupEmployeeIds = new Set(groupEmployees.map((employee) => employee.id));
  const pendingApprovals = state.attendance.filter((record) => groupEmployeeIds.has(record.employeeId) && record.requestedClockOut && !record.clockOutApproved);
  const activeStaff = activeAttendanceRecords(state.attendance, groupEmployees.map((employee) => employee.id));
  const leaveEntries = state.leaveEntries.filter((entry) => entry.groupCode === session.user.groupCode);
  const reportEntries = state.reportEntries.filter((entry) => entry.groupCode === session.user.groupCode);
  const canManageSchedules = Boolean(session.role === "director" || session.user.isManager);

  function addSchedule(event) {
    event.preventDefault();
    if (!task.title.trim() || !task.detail.trim()) {
      setNotice("請填寫事項標題與內容。");
      return;
    }
    const newSchedule = { ...task, groupCode: session.user.groupCode, id: crypto.randomUUID(), title: task.title.trim(), detail: task.detail.trim(), createdBy: session.user.username, createdAt: new Date().toISOString() };
    setState({
      ...state,
      schedules: [
        newSchedule,
        ...state.schedules,
      ],
    });
    setTask({ ...task, title: "", detail: "" });
    setNotice(task.type === "fixed" ? "固定排程已建立。" : "臨時排程已建立。");
  }

  function deleteSchedule(id) {
    setState({
      ...state,
      schedules: state.schedules.filter((item) => item.id !== id),
      scheduleResponses: state.scheduleResponses.filter((item) => item.scheduleId !== id),
    });
    setNotice("排程已刪除。");
  }

  function deleteEmployee(employeeId) {
    const employee = groupEmployees.find((item) => item.id === employeeId);
    if (!confirmTwice(
      `確定要刪除 ${employee?.name || "這位員工"} 的資料嗎？`,
      "請再次確認：刪除後會一併移除考勤、排程回覆，而且無法復原。"
    )) return;
    setState({
      ...state,
      employees: state.employees.filter((employee) => employee.id !== employeeId),
      attendance: state.attendance.filter((record) => record.employeeId !== employeeId),
      scheduleResponses: state.scheduleResponses.filter((response) => response.employeeId !== employeeId),
    });
    setNotice("員工資料已刪除。");
  }

  function toggleManager(employeeId) {
    const employee = groupEmployees.find((item) => item.id === employeeId);
    const nextValue = !employee?.isManager;
    if (nextValue && !window.confirm(`要讓 ${employee?.name || "這位員工"} 可以登入主任端並管理排程、核准下班嗎？`)) return;
    setState({
      ...state,
      employees: state.employees.map((employee) =>
        employee.id === employeeId ? { ...employee, isManager: nextValue } : employee
      ),
    });
    setNotice(nextValue ? "已賦予代理管理權。" : "已取消代理管理權。");
  }

  function toggleCounter(employeeId) {
    const employee = groupEmployees.find((item) => item.id === employeeId);
    const nextValue = !employee?.isCounter;
    setState({
      ...state,
      employees: state.employees.map((item) =>
        item.id === employeeId ? { ...item, isCounter: nextValue } : item
      ),
    });
    setNotice(nextValue ? "已賦予櫃台老師權限。" : "已取消櫃台老師權限。");
  }

  function addLeaveEntry(entry) {
    setState({
      ...state,
      leaveEntries: [
        {
          id: crypto.randomUUID(),
          groupCode: session.user.groupCode,
          createdBy: session.user.id,
          createdByName: session.user.name,
          createdByRole: session.role,
          createdAt: new Date().toISOString(),
          ...entry,
          leaveStartDate: entry.leaveStartDate || entry.leaveDate || todayDate(),
          leaveEndDate: entry.leaveEndDate || entry.leaveDate || todayDate(),
        },
        ...state.leaveEntries,
      ],
    });
  }

  function deleteLeaveEntry(entryId) {
    setState({
      ...state,
      leaveEntries: state.leaveEntries.filter((entry) => entry.id !== entryId),
    });
  }

  function updateLeaveEntry(entryId, patch) {
    setState({
      ...state,
      leaveEntries: state.leaveEntries.map((entry) => (entry.id === entryId ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry)),
    });
  }

  function addReportEntry(entry) {
    setState({
      ...state,
      reportEntries: [
        {
          id: crypto.randomUUID(),
          groupCode: session.user.groupCode,
          createdBy: session.user.id,
          createdByName: session.user.name,
          createdByRole: session.role,
          createdAt: new Date().toISOString(),
          ...entry,
        },
        ...state.reportEntries,
      ],
    });
  }

  function updateReportEntry(entryId, patch) {
    setState({
      ...state,
      reportEntries: state.reportEntries.map((entry) => (entry.id === entryId ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry)),
    });
  }

  function deleteReportEntry(entryId) {
    setState({
      ...state,
      reportEntries: state.reportEntries.filter((entry) => entry.id !== entryId),
    });
  }

  function updateEmployeeSchedule(employeeId, day, segmentIndex, field, value) {
    setState({
      ...state,
      employees: state.employees.map((employee) => {
        if (employee.id !== employeeId) return employee;
        const weeklySchedule = { ...defaultWeeklySchedule(), ...employee.weeklySchedule };
        const segments = [...(weeklySchedule[day] || [])];
        segments[segmentIndex] = { ...segments[segmentIndex], [field]: value };
        return { ...employee, weeklySchedule: { ...weeklySchedule, [day]: segments }, workStartTime: day === "1" && segmentIndex === 0 && field === "start" ? value : employee.workStartTime };
      }),
    });
  }

  function addShiftSegment(employeeId, day) {
    setState({
      ...state,
      employees: state.employees.map((employee) => {
        if (employee.id !== employeeId) return employee;
        const weeklySchedule = { ...defaultWeeklySchedule(), ...employee.weeklySchedule };
        return { ...employee, weeklySchedule: { ...weeklySchedule, [day]: [...(weeklySchedule[day] || []), { start: "09:00", end: "18:00" }] } };
      }),
    });
  }

  function removeShiftSegment(employeeId, day, segmentIndex) {
    setState({
      ...state,
      employees: state.employees.map((employee) => {
        if (employee.id !== employeeId) return employee;
        const weeklySchedule = { ...defaultWeeklySchedule(), ...employee.weeklySchedule };
        return { ...employee, weeklySchedule: { ...weeklySchedule, [day]: (weeklySchedule[day] || []).filter((_, index) => index !== segmentIndex) } };
      }),
    });
  }

  function approveClockOut(recordId) {
    setState({
      ...state,
      attendance: state.attendance.map((record) =>
        record.id === recordId ? { ...record, clockOut: record.requestedClockOut, clockOutApproved: true } : record
      ),
    });
    setNotice("已核准下班打卡。");
  }

  function rejectClockOut(recordId) {
    setState({
      ...state,
      attendance: state.attendance.map((record) =>
        record.id === recordId ? { ...record, requestedClockOut: "", clockOutApproved: false } : record
      ),
    });
    setNotice("已退回下班申請，員工狀態維持上班中。");
  }

  function addDirector(event) {
    event.preventDefault();
    if (!directorForm.name || !directorForm.username || !directorForm.password || !directorForm.email) {
      setNotice("請填寫新主任的姓名、帳號、密碼與電子郵件。");
      return;
    }
    const exists = [...state.employees, ...state.directors].some((user) => user.username === directorForm.username);
    if (exists) {
      setNotice("這個帳號已經被使用。");
      return;
    }
    setState({ ...state, directors: [...state.directors, { ...directorForm, groupCode: session.user.groupCode, id: crypto.randomUUID() }] });
    setDirectorForm({ name: "", username: "", password: "", email: "" });
    setNotice("已建立新主任帳號。");
  }

  function updateDirectorEmail(email) {
    const directors = state.directors.map((director) => (director.id === session.user.id ? { ...director, email } : director));
    const employees = state.employees.map((employee) => (employee.id === session.user.id ? { ...employee, email } : employee));
    const updatedUser = directors.find((director) => director.id === session.user.id) || employees.find((employee) => employee.id === session.user.id);
    setState({ ...state, directors, employees });
    setSession({ ...session, user: updatedUser });
  }

  async function updateGroupCode(event) {
    event.preventDefault();
    const nextCode = groupCodeDraft.trim().toUpperCase();
    const oldCode = session.user.groupCode;
    if (!nextCode) {
      setNotice("群組代碼不能空白。");
      return;
    }
    if (nextCode === oldCode) {
      setNotice("群組代碼沒有變更。");
      return;
    }
    const usedInCloud = await groupCodeExists(nextCode);
    if (state.groups.some((group) => group.code === nextCode) || usedInCloud) {
      setNotice("這個群組代碼已被使用，請換一個。");
      return;
    }
    const replaceGroup = (item) => item.groupCode === oldCode ? { ...item, groupCode: nextCode } : item;
    const groups = state.groups.map((group) => group.code === oldCode ? { ...group, code: nextCode, name: group.name || `${nextCode} 群組` } : group);
    const nextState = {
      ...state,
      groups,
      employees: state.employees.map(replaceGroup),
      directors: state.directors.map(replaceGroup),
      schedules: state.schedules.map(replaceGroup),
      reportEntries: state.reportEntries.map(replaceGroup),
      messages: state.messages.map(replaceGroup),
      boardPosts: state.boardPosts.map(replaceGroup),
    };
    const updatedUser = nextState.directors.find((director) => director.id === session.user.id) || nextState.employees.find((employee) => employee.id === session.user.id);
    setState(nextState);
    setSession({ ...session, user: updatedUser });
    setNotice(`群組代碼已改為 ${nextCode}。`);
  }

  function deleteCurrentDirector() {
    if (isProxyManager) {
      if (!confirmTwice("確定要刪除自己的員工帳號嗎？", "請再次確認：刪除後會立即登出，考勤與排程回覆也會一併移除。")) return;
      setState({
        ...state,
        employees: state.employees.filter((employee) => employee.id !== session.user.id),
        attendance: state.attendance.filter((record) => record.employeeId !== session.user.id),
        scheduleResponses: state.scheduleResponses.filter((response) => response.employeeId !== session.user.id),
      });
      setSession(null);
      setNotice("代理管理者帳號已刪除並登出。");
      return;
    }
    const groupDirectors = state.directors.filter((director) => director.groupCode === session.user.groupCode);
    if (groupDirectors.length <= 1 && groupEmployees.length > 0) {
      setNotice("此群組還有員工，至少需要保留一個主任帳號。");
      return;
    }
    if (!confirmTwice("確定要刪除自己的主任帳號嗎？", "請再次確認：刪除後會立即登出，且無法復原。")) return;
    setState({ ...state, directors: state.directors.filter((director) => director.id !== session.user.id) });
    setSession(null);
    setNotice("主任帳號已刪除並登出。");
  }

  return (
    <section className="dashboard-grid">
      <div className="panel director-home-panel">
        <SectionTitle icon={<ShieldCheck size={20} />} title="主任管理" />
        <div className="code-card">
          <span>群組代碼</span>
          <strong>{session.user.groupCode}</strong>
          <small>請把這組代碼提供給員工註冊加入。</small>
          <form className="code-edit-form" onSubmit={updateGroupCode}>
            <input value={groupCodeDraft} onChange={(event) => setGroupCodeDraft(event.target.value)} placeholder="修改群組代碼" />
            <button className="secondary-action" type="submit">更新代碼</button>
          </form>
        </div>
        <div className="segmented slim tab-switch">
          <button type="button" className={directorTab === "dashboard" ? "selected" : ""} onClick={() => setDirectorTab("dashboard")}>主任首頁</button>
          <button type="button" className={directorTab === "employees" ? "selected" : ""} onClick={() => setDirectorTab("employees")}>員工資料</button>
          <button type="button" className={directorTab === "account" ? "selected" : ""} onClick={() => setDirectorTab("account")}>帳號設定</button>
        </div>
      </div>

      {directorTab === "employees" && (
        <EmployeeSchedulePanel
          employees={groupEmployees}
          onDelete={deleteEmployee}
          onToggleManager={toggleManager}
          onToggleCounter={toggleCounter}
        />
      )}

      {directorTab === "dashboard" && (
        <>
      <div className="panel compose-panel">
        <SectionTitle icon={<Megaphone size={20} />} title="主任排程" />
        <form onSubmit={addSchedule} className="form-grid">
          <div className="segmented wide">
            <button type="button" className={task.type === "fixed" ? "selected" : ""} onClick={() => setTask({ ...task, type: "fixed" })}>
              <RotateCw size={16} /> 固定每日
            </button>
            <button type="button" className={task.type === "temporary" ? "selected" : ""} onClick={() => setTask({ ...task, type: "temporary" })}>
              <CalendarClock size={16} /> 臨時指定
            </button>
          </div>
          <label className="wide">
            事項標題
            <input value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} placeholder="例如：每日早會、臨時盤點" />
          </label>
          <label className="wide">
            內容
            <textarea value={task.detail} onChange={(event) => setTask({ ...task, detail: event.target.value })} placeholder="寫下員工需要收到的重點。" />
          </label>
          {task.type === "temporary" && (
            <label>
              日期
              <input type="date" value={task.date} onChange={(event) => setTask({ ...task, date: event.target.value })} />
            </label>
          )}
          <label>
            時間
            <input type="time" value={task.time} onChange={(event) => setTask({ ...task, time: event.target.value })} />
          </label>
          <label>
            對象
            <select value={task.audience} onChange={(event) => setTask({ ...task, audience: event.target.value })}>
              <option value="all">全體員工</option>
              {groupEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>{employee.name}</option>
              ))}
            </select>
          </label>
          <button className="primary-action" type="submit"><Plus size={18} /> 新增排程</button>
        </form>
      </div>

      <div className="panel">
        <SectionTitle icon={<Users size={20} />} title="員工清單與考勤" />
        <div className="employee-list">
          {attendanceRows.map(({ employee, label, tone, record }) => (
            <div className="employee-row" key={employee.id}>
              <div className="avatar">{employee.name.slice(0, 1)}</div>
              <div>
                <strong>{employee.name}</strong>
                <span>{employee.username}｜{employee.email || "未設定 Email"}｜上班 {record?.clockIn || "--"}｜下班 {record?.clockOut || record?.requestedClockOut || "--"}</span>
              </div>
              <b className={`status ${tone}`}>{label}</b>
            </div>
          ))}
        </div>
      </div>

      <ManpowerPanel employees={groupEmployees} activeStaff={activeStaff} totalStaff={groupEmployees.length} leaveEntries={leaveEntries} />

      <LeavePanel
        entries={leaveEntries}
        canEdit={true}
        onAddEntry={addLeaveEntry}
        onUpdateEntry={updateLeaveEntry}
        onDeleteEntry={deleteLeaveEntry}
        editorLabel="主任"
        viewer={session}
        setNotice={setNotice}
      />

      <ReportPanel
        entries={reportEntries}
        canEdit={true}
        onAddEntry={addReportEntry}
        onUpdateEntry={updateReportEntry}
        onDeleteEntry={deleteReportEntry}
        editorLabel="主任"
        viewer={session}
        setNotice={setNotice}
      />

      <BroadcastPanel state={state} setState={setState} session={session} setNotice={setNotice} />

      <div className="panel">
        <SectionTitle icon={<CheckCircle2 size={20} />} title="下班核准" />
        {pendingApprovals.length ? (
          <div className="employee-list">
            {pendingApprovals.map((record) => {
              const employee = state.employees.find((item) => item.id === record.employeeId);
              return (
                <div className="approval-row" key={record.id}>
                  <div>
                    <strong>{employee?.name || "未知員工"}</strong>
                    <span>{record.date}｜上班 {record.clockIn}｜申請下班 {record.requestedClockOut}</span>
                  </div>
                  <div className="inline-actions">
                    <button className="icon-button approve" onClick={() => approveClockOut(record.id)} title="核准"><Check size={18} /></button>
                    <button className="icon-button danger" onClick={() => rejectClockOut(record.id)} title="退回"><X size={18} /></button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="muted">目前沒有待核准的下班打卡。</p>
        )}
      </div>

      <ScheduleList state={state} setState={setState} viewer={{ role: "director", user: session.user }} setNotice={setNotice} onDelete={deleteSchedule} />

      <MessagePanel state={state} viewer={{ role: "director", user: session.user }} />
        </>
      )}

      {directorTab === "account" && (
        <>
      <div className="panel">
        <SectionTitle icon={<Mail size={20} />} title="主任 Email" />
        <label>
          電子郵件
          <input type="email" value={session.user.email || ""} onChange={(event) => updateDirectorEmail(event.target.value)} placeholder="director@example.com" />
        </label>
        <p className="muted">Email 會用在排程通知收件人與寄件紀錄。正式寄送需要接後端郵件服務；目前會先開啟系統郵件草稿。</p>
      </div>

      <div className="panel">
        <SectionTitle icon={<Trash2 size={20} />} title="刪除主任帳號" />
        <p className="muted">刪除後會立即登出。若此群組還有員工，系統會要求至少保留一個主任帳號。</p>
        <button className="secondary-action danger-action" type="button" onClick={deleteCurrentDirector}>
          <Trash2 size={16} /> 刪除我的主任帳號
        </button>
      </div>
        </>
      )}
    </section>
  );
}

const WEEK_DAYS = [
  ["1", "週一"],
  ["2", "週二"],
  ["3", "週三"],
  ["4", "週四"],
  ["5", "週五"],
  ["6", "週六"],
  ["0", "週日"],
];

function EmployeeSchedulePanel({ employees, onDelete, onToggleManager, onToggleCounter }) {
  return (
    <div className="panel schedule-admin-panel">
      <SectionTitle icon={<Users size={20} />} title="員工資料" />
      <div className="staff-admin-list">
        {employees.map((employee) => (
          <article className="staff-admin-card" key={employee.id}>
            <div className="staff-admin-head">
              <div>
                <strong>{employee.name}</strong>
                <span>{employee.username}｜{employee.email}</span>
              </div>
              <button className="icon-button danger" onClick={() => onDelete(employee.id)} title="刪除員工">
                <Trash2 size={18} />
              </button>
            </div>
            <div className="staff-meta-grid">
              <span>群組：{employee.groupCode}</span>
              <span>Email：{employee.email || "未設定"}</span>
              <span>建立時間：{employee.createdAt ? new Date(employee.createdAt).toLocaleString("zh-TW") : "--"}</span>
              <span>權限：{[
                employee.isManager ? "代理主任" : null,
                employee.isCounter ? "櫃台老師" : null,
              ].filter(Boolean).join("、") || "一般員工"}</span>
            </div>
            <div className="permission-actions">
              <button className={employee.isManager ? "secondary-action danger-action" : "secondary-action"} type="button" onClick={() => onToggleManager(employee.id)}>
                <ShieldCheck size={16} /> {employee.isManager ? "取消代理主任" : "賦予代理主任"}
              </button>
              <button className={employee.isCounter ? "secondary-action danger-action" : "secondary-action"} type="button" onClick={() => onToggleCounter(employee.id)}>
                <Users size={16} /> {employee.isCounter ? "取消櫃台老師" : "賦予櫃台老師"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function BroadcastPanel({ state, setState, session, setNotice }) {
  const [draft, setDraft] = useState({ title: "", text: "", audience: "all" });
  const [editingId, setEditingId] = useState("");
  const groupEmployees = state.employees.filter((employee) => employee.groupCode === session.user.groupCode);
  const messages = state.messages
    .filter((message) => message.groupCode === session.user.groupCode)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  function sendMessage(event) {
    event.preventDefault();
    if (!draft.title.trim() || !draft.text.trim()) {
      setNotice("請填寫注意事項標題與內容。");
      return;
    }
    const previous = editingId ? state.messages.find((item) => item.id === editingId) : null;
    const nextMessage = {
      ...(previous || {}),
      groupCode: session.user.groupCode,
      id: editingId || crypto.randomUUID(),
      title: draft.title.trim(),
      text: draft.text.trim(),
      audience: draft.audience,
      createdAt: previous?.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    setState({
      ...state,
      messages: editingId
        ? state.messages.map((item) => (item.id === editingId ? nextMessage : item))
        : [nextMessage, ...state.messages],
    });
    setDraft({ title: "", text: "", audience: "all" });
    setEditingId("");
    setNotice(editingId ? "注意事項已更新。" : "注意事項已送出。");
  }

  function startEdit(message) {
    setEditingId(message.id);
    setDraft({ title: message.title || "", text: message.text || "", audience: message.audience || "all" });
  }

  function cancelEdit() {
    setEditingId("");
    setDraft({ title: "", text: "", audience: "all" });
    setNotice("已取消編輯。");
  }

  function deleteMessage(messageId) {
    if (!window.confirm("確定要刪除這則注意事項嗎？")) return;
    setState({
      ...state,
      messages: state.messages.filter((item) => item.id !== messageId),
    });
    if (editingId === messageId) {
      setEditingId("");
      setDraft({ title: "", text: "", audience: "all" });
    }
    setNotice("注意事項已刪除。");
  }

  return (
    <div className="panel">
      <SectionTitle icon={<Send size={20} />} title="注意事項發送" />
      <form onSubmit={sendMessage} className="compact-stack">
        <input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="注意事項標題" />
        <textarea value={draft.text} onChange={(event) => setDraft({ ...draft, text: event.target.value })} placeholder="要發送給員工的注意事項內容" />
        <select value={draft.audience} onChange={(event) => setDraft({ ...draft, audience: event.target.value })}>
          <option value="all">全體員工</option>
          {groupEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.name}</option>
          ))}
        </select>
        <div className="action-row notice-actions">
          {editingId ? (
            <button className="secondary-action" type="button" onClick={cancelEdit}>取消編輯</button>
          ) : null}
          <button className="primary-action" type="submit"><Send size={18} /> {editingId ? "更新" : "發送"}</button>
        </div>
      </form>
      <div className="message-list broadcast-message-list">
        {messages.length ? messages.map((message) => (
          <article className="message-item" key={message.id}>
            <div>
              <strong>{message.title}</strong>
              <p>{message.text}</p>
              <small>{new Date(message.updatedAt || message.createdAt).toLocaleString("zh-TW")}｜{message.audience === "all" ? "全體員工" : "指定員工"}</small>
            </div>
            <div className="inline-actions">
              <button className="secondary-action small-action" type="button" onClick={() => startEdit(message)}>編輯</button>
              <button className="secondary-action danger-action small-action" type="button" onClick={() => deleteMessage(message.id)}>刪除</button>
            </div>
          </article>
        )) : <p className="muted">目前沒有注意事項。</p>}
      </div>
    </div>
  );
}

function EmployeeView({ state, setState, session, setSession, setNotice }) {
  const status = statusForEmployee(state.attendance, session.user.id);
  const groupEmployees = state.employees.filter((employee) => employee.groupCode === session.user.groupCode);
  const activeStaff = activeAttendanceRecords(state.attendance, groupEmployees.map((employee) => employee.id));
  const leaveEntries = state.leaveEntries.filter((entry) => entry.groupCode === session.user.groupCode);
  const reportEntries = state.reportEntries.filter((entry) => entry.groupCode === session.user.groupCode);
  const canEditLeave = isLeaveEditor(session.user);
  const canManageSchedules = Boolean(session.role === "director" || session.user.isManager);

  function clock(type) {
    const today = todayDate();
    const existing = latestAttendanceRecord(state.attendance, session.user.id);
    if (type === "in" && existing?.clockIn && !existing.clockOut) {
      setNotice("今天已經上班打卡。");
      return;
    }
    if (type === "out" && !existing?.clockIn) {
      setNotice("請先上班打卡。");
      return;
    }
    if (type === "out" && existing.clockOut) {
      setNotice("目前沒有上班中的紀錄，請先重新上班。");
      return;
    }
    if (type === "out" && existing?.requestedClockOut && !existing?.clockOutApproved) {
      setNotice("下班申請已送出，等待主任核准。");
      return;
    }
    const nextAttendance = type === "out"
      ? state.attendance.map((item) => item.id === existing.id ? { ...item, requestedClockOut: nowTime(), clockOutApproved: false } : item)
      : [{ id: crypto.randomUUID(), employeeId: session.user.id, date: today, clockIn: nowTime(), clockOut: "", requestedClockOut: "", clockOutApproved: false, createdAt: new Date().toISOString() }, ...state.attendance];
    setState({ ...state, attendance: nextAttendance });
    setNotice(type === "in" ? "上班打卡完成。" : "下班申請已送出，需主任核准後才算完成。");
  }

  function forceClockOut() {
    const existing = latestAttendanceRecord(state.attendance, session.user.id);
    if (!existing?.clockIn) {
      setNotice("請先上班打卡，才能強制下班。");
      return;
    }
    if (existing.clockOut) {
      setNotice("今天已經下班。");
      return;
    }
    const outTime = nowTime();
    setState({
      ...state,
      attendance: state.attendance.map((item) =>
        item.id === existing.id
          ? { ...item, requestedClockOut: outTime, clockOut: outTime, clockOutApproved: true, forcedClockOut: true }
          : item
      ),
    });
    setNotice("已強制下班，今日打卡已結束。");
  }

  function updateEmployee(field, value) {
    const employees = state.employees.map((employee) => (employee.id === session.user.id ? { ...employee, [field]: value } : employee));
    const updatedUser = employees.find((employee) => employee.id === session.user.id);
    setState({ ...state, employees });
    setSession({ ...session, user: updatedUser });
  }

  function deleteOwnEmployeeAccount() {
    if (!confirmTwice("確定要刪除自己的員工帳號嗎？", "請再次確認：刪除後會立即登出，考勤與排程回覆也會一併移除。")) return;
    setState({
      ...state,
      employees: state.employees.filter((employee) => employee.id !== session.user.id),
      attendance: state.attendance.filter((record) => record.employeeId !== session.user.id),
      scheduleResponses: state.scheduleResponses.filter((response) => response.employeeId !== session.user.id),
    });
    setSession(null);
    setNotice("員工帳號已刪除。");
  }

  function addLeaveEntry(entry) {
    setState({
      ...state,
      leaveEntries: [
        { id: crypto.randomUUID(), groupCode: session.user.groupCode, createdBy: session.user.id, createdByName: session.user.name, createdByRole: session.role, createdAt: new Date().toISOString(), ...entry },
        ...state.leaveEntries,
      ],
    });
  }

  function deleteLeaveEntry(entryId) {
    setState({
      ...state,
      leaveEntries: state.leaveEntries.filter((entry) => entry.id !== entryId),
    });
  }

  function updateLeaveEntry(entryId, patch) {
    setState({
      ...state,
      leaveEntries: state.leaveEntries.map((entry) => (entry.id === entryId ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry)),
    });
  }

  function addReportEntry(entry) {
    setState({
      ...state,
      reportEntries: [
        {
          id: crypto.randomUUID(),
          groupCode: session.user.groupCode,
          createdBy: session.user.id,
          createdByName: session.user.name,
          createdByRole: session.role,
          createdAt: new Date().toISOString(),
          ...entry,
        },
        ...state.reportEntries,
      ],
    });
  }

  function deleteReportEntry(entryId) {
    setState({
      ...state,
      reportEntries: state.reportEntries.filter((entry) => entry.id !== entryId),
    });
  }

  function updateReportEntry(entryId, patch) {
    setState({
      ...state,
      reportEntries: state.reportEntries.map((entry) => (entry.id === entryId ? { ...entry, ...patch, updatedAt: new Date().toISOString() } : entry)),
    });
  }

  return (
    <section className="dashboard-grid employee-dashboard">
      <div className="panel attendance-card">
        <SectionTitle icon={<Clock3 size={20} />} title={`${session.user.name} 的今日考勤`} />
        <div className="clock-face">
          <strong>{new Date().toLocaleDateString("zh-TW", { month: "long", day: "numeric", weekday: "long" })}</strong>
          <span className={`status ${status.tone}`}>{status.label}</span>
        </div>
        <div className="action-row">
          <button className="primary-action" onClick={() => clock("in")}><CheckCircle2 size={18} /> {status.record?.clockOut ? "重新上班" : "上班"}</button>
          <button className="secondary-action" onClick={() => clock("out")}><LogOut size={18} /> 下班申請</button>
        </div>
        <button className="secondary-action force-action" onClick={forceClockOut}>
          <LogOut size={18} /> 強制下班
        </button>
      </div>

      <ManpowerPanel employees={groupEmployees} activeStaff={activeStaff} totalStaff={groupEmployees.length} leaveEntries={leaveEntries} />

      {canManageSchedules && (
        <ScheduleEditorPanel state={state} setState={setState} viewer={session} setNotice={setNotice} />
      )}

      <LeavePanel
        entries={leaveEntries}
        canEdit={canEditLeave}
        onAddEntry={addLeaveEntry}
        onUpdateEntry={updateLeaveEntry}
        onDeleteEntry={deleteLeaveEntry}
        editorLabel={session.user.name}
        viewer={session}
      />

      <ReportPanel
        entries={reportEntries}
        canEdit={true}
        onAddEntry={addReportEntry}
        onUpdateEntry={updateReportEntry}
        onDeleteEntry={deleteReportEntry}
        editorLabel={session.user.name}
        viewer={session}
        setNotice={setNotice}
      />

      <ScheduleList state={state} setState={setState} viewer={session} setNotice={setNotice} canManage={canManageSchedules} />
      <MessagePanel state={state} viewer={session} />

      <div className="panel">
        <SectionTitle icon={<Mail size={20} />} title="聯絡資料" />
        <label>
          電子郵件
          <input type="email" value={session.user.email || ""} onChange={(event) => updateEmployee("email", event.target.value)} placeholder="name@example.com" />
        </label>
        <p className="muted">這裡保留聯絡資料與帳號刪除。排程與請假內容會直接同步到雲端，不再發送額外推播通知。</p>
        <button className="secondary-action danger-action" type="button" onClick={deleteOwnEmployeeAccount}>
          <Trash2 size={16} /> 刪除我的員工帳號
        </button>
      </div>
    </section>
  );
}

function ScheduleList({ state, setState, viewer, setNotice, onDelete, canManage = false }) {
  const schedules = useMemo(() => {
    return state.schedules
      .filter((item) => isVisibleTo(item, viewer))
      .sort((a, b) => scheduleDateTime(a).getTime() - scheduleDateTime(b).getTime());
  }, [state.schedules, viewer]);

  function messageText(item) {
    return `排程通知：${item.title}\n時間：${item.type === "fixed" ? "每日" : item.date} ${item.time}\n內容：${item.detail}`;
  }

  function findResponse(item, employeeId) {
    return state.scheduleResponses.find((response) => response.scheduleId === item.id && response.employeeId === employeeId && response.date === responseDate(item));
  }

  function upsertResponse(item, employeeId, patch) {
    const existing = findResponse(item, employeeId);
    const nextResponse = existing
      ? { ...existing, ...patch }
      : { id: crypto.randomUUID(), scheduleId: item.id, employeeId, date: responseDate(item), receivedAt: "", completedAt: "", ...patch };
    setState({
      ...state,
      scheduleResponses: existing
        ? state.scheduleResponses.map((response) => response.id === existing.id ? nextResponse : response)
        : [nextResponse, ...state.scheduleResponses],
    });
  }

  function markReceived(item) {
    upsertResponse(item, viewer.user.id, { receivedAt: nowStamp() });
    setNotice("已回覆收到，主任端會看得到。");
  }

  function markCompleted(item) {
    if (Date.now() < scheduleDateTime(item).getTime()) {
      setNotice("完成按鈕要到排程時間後才能按。");
      return;
    }
    const existing = findResponse(item, viewer.user.id);
    if (existing?.completedAt) {
      upsertResponse(item, viewer.user.id, { completedAt: "" });
      setNotice("已取消完成狀態，主任端會同步看到。");
      return;
    }
    upsertResponse(item, viewer.user.id, { completedAt: nowStamp(), receivedAt: existing?.receivedAt || nowStamp() });
    setNotice("已回覆完成，主任端會看得到。");
  }

  function shareText(item) {
    navigator.clipboard?.writeText(messageText(item));
    setNotice("已複製手機文字，可貼到 LINE、WhatsApp 或其他通訊 APP。");
  }

  function emailNotice(item) {
    const recipients = state.employees
      .filter((employee) => employee.groupCode === item.groupCode && (item.audience === "all" || item.audience === employee.id))
      .map((employee) => employee.email)
      .filter(Boolean);
    if (!recipients.length) {
      setNotice("尚未設定員工 Email，請先在員工端或主任端員工資料補上。");
      return;
    }
    window.location.href = `mailto:${recipients.join(",")}?subject=${encodeURIComponent(`排程通知：${item.title}`)}&body=${encodeURIComponent(messageText(item))}`;
    setNotice("已開啟 Email 草稿。正式自動寄送需接後端郵件服務。");
  }

  function responseSummary(item) {
    const targetEmployees = state.employees.filter((employee) => employee.groupCode === item.groupCode && (item.audience === "all" || item.audience === employee.id));
    const responses = targetEmployees.map((employee) => ({ employee, response: findResponse(item, employee.id) }));
    const received = responses.filter((item) => item.response?.receivedAt).length;
    const completed = responses.filter((item) => item.response?.completedAt).length;
    return { targetEmployees, responses, received, completed };
  }

  function resetTodayResponses(item) {
    if (!window.confirm(`確定要重製「${item.title}」今天的收到/完成紀錄嗎？`)) return;
    const date = responseDate(item);
    setState({
      ...state,
      scheduleResponses: state.scheduleResponses.filter((response) => response.scheduleId !== item.id || response.date !== date),
    });
    setNotice("已重製今日固定流程，員工可重新按收到與完成。");
  }

  return (
    <div className="panel schedule-panel">
      <SectionTitle icon={<ClipboardList size={20} />} title="排程事項" />
      <div className="task-list">
        {schedules.map((item) => {
          const employeeResponse = viewer.role === "employee" ? findResponse(item, viewer.user.id) : null;
          const canComplete = isScheduleDue(item);
          const summary = viewer.role === "director" ? responseSummary(item) : null;
          const cardState = viewer.role === "employee" ? scheduleCardState(item, employeeResponse) : canComplete ? "due" : "default";
          return (
            <article className={`task-card ${cardState === "due" ? "due-state" : ""} ${cardState === "received" ? "received-state" : ""} ${cardState === "completed" ? "completed-state" : ""}`} key={item.id}>
              <div className="task-main">
                <span className="schedule-kind">{item.type === "fixed" ? "每日固定" : "臨時指定"}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <small>{item.type === "fixed" ? "每日" : item.date} {item.time}</small>
                {viewer.role === "director" && (
                  <div className="response-report">
                    <strong>收到 {summary.received}/{summary.targetEmployees.length}｜完成 {summary.completed}/{summary.targetEmployees.length}</strong>
                    {summary.responses.map(({ employee, response }) => (
                      <span key={employee.id}>{employee.name}：收到 {response?.receivedAt || "--"}｜完成 {response?.completedAt || "--"}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="inline-actions">
                {viewer.role === "employee" && (
                  <>
                    <button className="secondary-action small-action" onClick={() => markReceived(item)} disabled={Boolean(employeeResponse?.receivedAt)}>
                      <Check size={16} /> {employeeResponse?.receivedAt ? "已收到" : "收到"}
                    </button>
                    <button className="primary-action small-action" onClick={() => markCompleted(item)} disabled={!canComplete}>
                      <CheckCircle2 size={16} /> {employeeResponse?.completedAt ? "取消完成" : "完成"}
                    </button>
                  </>
                )}
                <button className="icon-button" onClick={() => emailNotice(item)} title="建立 Email 草稿">
                  <Mail size={18} />
                </button>
                <button className="icon-button" onClick={() => shareText(item)} title="複製手機文字">
                  <MessageCircle size={18} />
                </button>
                {(viewer.role === "director" || canManage) && (
                  <>
                    {item.type === "fixed" && (
                      <button className="icon-button" onClick={() => resetTodayResponses(item)} title="重製今日流程">
                        <RotateCw size={18} />
                      </button>
                    )}
                    <button className="icon-button danger" onClick={() => onDelete(item.id)} title="刪除排程">
                      <Trash2 size={18} />
                    </button>
                  </>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

function MessagePanel({ state, viewer }) {
  const messages = state.messages.filter((message) => isMessageVisible(message, viewer)).slice(0, 6);
  return (
    <div className="panel">
      <SectionTitle icon={<Megaphone size={20} />} title="注意事項" />
      {messages.length ? (
        <div className="message-list">
          {messages.map((message) => (
            <article className="message-item" key={message.id}>
              <strong>{message.title}</strong>
              <p>{message.text}</p>
              <small>{new Date(message.createdAt).toLocaleString("zh-TW")}｜{message.audience === "all" ? "全體員工" : "指定員工"}</small>
            </article>
          ))}
        </div>
      ) : (
        <p className="muted">目前沒有注意事項。</p>
      )}
    </div>
  );
}

function BoardPanel({ state, setState, session, setNotice }) {
  const [text, setText] = useState("");

  function addPost(event) {
    event.preventDefault();
    if (!text.trim()) {
      setNotice("請先輸入留言內容。");
      return;
    }
    setState({
      ...state,
      boardPosts: [
        {
          id: crypto.randomUUID(),
          groupCode: session.user.groupCode,
          authorName: session.user.name,
          authorRole: session.role,
          createdBy: session.user.id,
          text: text.trim(),
          createdAt: new Date().toISOString(),
        },
        ...state.boardPosts,
      ],
    });
    setText("");
    setNotice("留言已送出。");
  }

  function deletePost(postId) {
    setState({
      ...state,
      boardPosts: state.boardPosts.filter((post) => post.id !== postId),
    });
  }

  return (
    <section className="panel board-panel">
      <SectionTitle icon={<MessageCircle size={20} />} title="留言板" />
      <form className="board-form" onSubmit={addPost}>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="留下問題、回報狀況或討論排程細節。" />
        <button className="primary-action" type="submit"><Send size={18} /> 送出留言</button>
      </form>
      <div className="board-list">
        {state.boardPosts.filter((post) => post.groupCode === session.user.groupCode).map((post) => (
          <article className="board-post" key={post.id}>
            <div>
              <strong>{post.authorName}</strong>
              <span>{post.authorRole === "director" ? "主任" : "員工"}｜{new Date(post.createdAt).toLocaleString("zh-TW")}</span>
            </div>
            <p>{post.text}</p>
            <div className="inline-actions board-actions">
              {(session.role === "director" || post.createdBy === session.user.id) && (
                <>
                  <button className="secondary-action small-action" type="button" onClick={() => {
                    const nextText = window.prompt("編輯留言內容", post.text);
                    if (nextText === null) return;
                    if (!nextText.trim()) {
                      setNotice("留言內容不能空白。");
                      return;
                    }
                    setState({
                      ...state,
                      boardPosts: state.boardPosts.map((item) => item.id === post.id ? { ...item, text: nextText.trim(), updatedAt: new Date().toISOString() } : item),
                    });
                    setNotice("留言已更新。");
                  }}>
                    編輯
                  </button>
                  <button className="secondary-action danger-action small-action" type="button" onClick={() => {
                    if (!window.confirm("確定要刪除這則留言嗎？")) return;
                    deletePost(post.id);
                    setNotice("留言已刪除。");
                  }}>
                    刪除
                  </button>
                </>
              )}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ManpowerPanel({ employees, activeStaff, totalStaff, leaveEntries }) {
  return (
    <div className="panel manpower-panel">
      <SectionTitle icon={<Users size={20} />} title="目前人力" />
      <div className="manpower-head">
        <strong>上班中 {activeStaff.length}/{totalStaff}</strong>
        <span>學生請假 {leaveEntries.length}</span>
      </div>
      <div className="tag-row">
        {activeStaff.length ? activeStaff.map((record) => (
          <span className="info-tag" key={`${record.employeeId}-${record.id}`}>{employees.find((employee) => employee.id === record.employeeId)?.name || record.employeeId}</span>
        )) : <span className="muted">目前沒有員工在班。</span>}
      </div>
    </div>
  );
}

function LeavePanel({ entries, canEdit, onAddEntry, onUpdateEntry, onDeleteEntry, editorLabel, viewer, setNotice }) {
  const [draft, setDraft] = useState({ leaveStartDate: todayDate(), leaveEndDate: todayDate(), className: "", studentName: "", note: "" });

  function submit(event) {
    event.preventDefault();
    if (!draft.leaveStartDate || !draft.leaveEndDate || !draft.className.trim() || !draft.studentName.trim()) {
      setNotice?.("請填寫請假開始日期、結束日期、班級和姓名。");
      return;
    }
    onAddEntry({
      leaveStartDate: draft.leaveStartDate,
      leaveEndDate: draft.leaveEndDate,
      className: draft.className.trim(),
      studentName: draft.studentName.trim(),
      note: draft.note.trim(),
    });
    setDraft({ leaveStartDate: todayDate(), leaveEndDate: todayDate(), className: "", studentName: "", note: "" });
  }

  return (
    <div className="panel leave-panel">
      <SectionTitle icon={<MessageCircle size={20} />} title="學生請假" />
      {canEdit ? (
        <form className="leave-form" onSubmit={submit}>
          <label>
            請假開始日期
            <input type="date" value={draft.leaveStartDate} onChange={(event) => setDraft({ ...draft, leaveStartDate: event.target.value })} />
          </label>
          <label>
            請假結束日期
            <input type="date" value={draft.leaveEndDate} onChange={(event) => setDraft({ ...draft, leaveEndDate: event.target.value })} />
          </label>
          <label>
            班級
            <input value={draft.className} onChange={(event) => setDraft({ ...draft, className: event.target.value })} placeholder="例如：國一甲" />
          </label>
          <label>
            姓名
            <input value={draft.studentName} onChange={(event) => setDraft({ ...draft, studentName: event.target.value })} placeholder="學生姓名" />
          </label>
          <label className="wide">
            事由
            <textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="例如：發燒、補習、家長接送..." />
          </label>
          <button className="primary-action" type="submit">由 {editorLabel} 新增請假</button>
        </form>
      ) : (
        <p className="muted">此區由櫃台或主任維護，其他人員只能查看。</p>
      )}
      <div className="leave-list">
        {entries.length ? entries.map((entry) => (
            <article className="leave-item" key={entry.id}>
            <div>
              <strong>{entry.studentName || "未命名"}｜{entry.className || "未填班級"}</strong>
              <p>{entry.leaveStartDate || "未填日期"} 到 {entry.leaveEndDate || "未填日期"}｜{entry.note || "無事由"}</p>
              <small>{entry.createdByName || "系統"}｜{new Date(entry.createdAt).toLocaleString("zh-TW")}</small>
            </div>
            <div className="inline-actions">
              {canEdit && (
                <>
                  <button className="secondary-action small-action" type="button" onClick={() => {
                    const nextLeaveStartDate = window.prompt("請假開始日期", entry.leaveStartDate || todayDate());
                    if (nextLeaveStartDate === null) return;
                    const nextLeaveEndDate = window.prompt("請假結束日期", entry.leaveEndDate || entry.leaveStartDate || todayDate());
                    if (nextLeaveEndDate === null) return;
                    const nextClassName = window.prompt("班級", entry.className || "");
                    if (nextClassName === null) return;
                    const nextStudentName = window.prompt("姓名", entry.studentName || "");
                    if (nextStudentName === null) return;
                    const nextNote = window.prompt("事由", entry.note || "");
                    if (nextNote === null) return;
                    if (!nextLeaveStartDate.trim() || !nextLeaveEndDate.trim() || !nextClassName.trim() || !nextStudentName.trim()) {
                      setNotice("請假開始日期、請假結束日期、班級、姓名都不能空白。");
                      return;
                    }
                    onUpdateEntry(entry.id, {
                      leaveStartDate: nextLeaveStartDate.trim(),
                      leaveEndDate: nextLeaveEndDate.trim(),
                      className: nextClassName.trim(),
                      studentName: nextStudentName.trim(),
                      note: nextNote.trim(),
                    });
                    setNotice("請假已更新。");
                  }}>
                    編輯
                  </button>
                  <button className="secondary-action danger-action small-action" type="button" onClick={() => {
                    if (!window.confirm("確定要刪除這筆請假嗎？")) return;
                    onDeleteEntry(entry.id);
                    setNotice("請假已刪除。");
                  }}>
                    刪除
                  </button>
                </>
              )}
            </div>
          </article>
        )) : <p className="muted">目前沒有請假資料。</p>}
      </div>
    </div>
  );
}

function ReportPanel({ entries, canEdit, onAddEntry, onUpdateEntry, onDeleteEntry, editorLabel, viewer, setNotice }) {
  const [draft, setDraft] = useState({ note: "" });

  function submit(event) {
    event.preventDefault();
    if (!draft.note.trim()) return;
    onAddEntry({
      note: draft.note.trim(),
    });
    setDraft({ note: "" });
  }

  return (
    <div className="panel report-panel">
      <SectionTitle icon={<MessageCircle size={20} />} title="未到班回報" />
      <p className="muted">這裡的內容會讓同群組所有人都看得到，格式和留言板一致，只是專門用來回報未到班。</p>
      {canEdit ? (
        <form className="board-form report-form" onSubmit={submit}>
          <label className="wide">
            回報內容
            <textarea value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} placeholder="例如：今天 08:30 前請到、未到班請回報原因。" />
          </label>
          <button className="primary-action" type="submit">由 {editorLabel} 發送回報</button>
        </form>
      ) : (
        <p className="muted">目前僅可查看，不可編輯。</p>
      )}
      <div className="report-list">
        {entries.length ? entries.map((entry) => (
          <article className="report-item" key={entry.id}>
            <div>
              <strong>未到班回報</strong>
              <p>{entry.note || entry.text}</p>
              <small>{entry.createdByName || "系統"}｜{new Date(entry.createdAt).toLocaleString("zh-TW")}</small>
            </div>
            <div className="inline-actions">
              {(viewer.role === "director" || entry.createdBy === viewer.user.id) && (
                <>
                  <button className="secondary-action small-action" type="button" onClick={() => {
                    const nextNote = window.prompt("回報內容", entry.note || entry.text || "");
                    if (nextNote === null) return;
                    if (!nextNote.trim()) {
                      window.alert("回報內容不能空白。");
                      return;
                    }
                    onUpdateEntry(entry.id, { note: nextNote.trim(), text: nextNote.trim() });
                    setNotice("回報已更新。");
                  }}>
                    編輯
                  </button>
                  <button className="secondary-action danger-action small-action" type="button" onClick={() => {
                    if (!window.confirm("確定要刪除這則回報嗎？")) return;
                    onDeleteEntry(entry.id);
                    setNotice("回報已刪除。");
                  }}>
                    刪除
                  </button>
                </>
              )}
            </div>
          </article>
        )) : <p className="muted">目前沒有未到班回報。</p>}
      </div>
    </div>
  );
}

function ScheduleEditorPanel({ state, setState, viewer, setNotice }) {
  const [task, setTask] = useState({ title: "", detail: "", type: "fixed", date: todayDate(), time: "09:00", audience: "all" });
  const groupEmployees = state.employees.filter((employee) => employee.groupCode === viewer.user.groupCode);

  function addSchedule(event) {
    event.preventDefault();
    if (!task.title.trim() || !task.detail.trim()) {
      setNotice("請填寫事項標題與內容。");
      return;
    }
    const newSchedule = { ...task, groupCode: viewer.user.groupCode, id: crypto.randomUUID(), title: task.title.trim(), detail: task.detail.trim(), createdBy: viewer.user.username, createdAt: new Date().toISOString() };
    setState({
      ...state,
      schedules: [newSchedule, ...state.schedules],
    });
    setTask({ ...task, title: "", detail: "" });
    setNotice(task.type === "fixed" ? "固定排程已建立。" : "臨時排程已建立。");
  }

  return (
    <div className="panel compose-panel">
      <SectionTitle icon={<Megaphone size={20} />} title="排成事項編輯" />
      <form onSubmit={addSchedule} className="form-grid">
        <div className="segmented wide">
          <button type="button" className={task.type === "fixed" ? "selected" : ""} onClick={() => setTask({ ...task, type: "fixed" })}>
            <RotateCw size={16} /> 固定每日
          </button>
          <button type="button" className={task.type === "temporary" ? "selected" : ""} onClick={() => setTask({ ...task, type: "temporary" })}>
            <CalendarClock size={16} /> 臨時指定
          </button>
        </div>
        <label className="wide">
          事項標題
          <input value={task.title} onChange={(event) => setTask({ ...task, title: event.target.value })} placeholder="例如：每日早會、臨時盤點" />
        </label>
        <label className="wide">
          內容
          <textarea value={task.detail} onChange={(event) => setTask({ ...task, detail: event.target.value })} placeholder="寫下員工需要收到的重點。" />
        </label>
        {task.type === "temporary" && (
          <label>
            日期
            <input type="date" value={task.date} onChange={(event) => setTask({ ...task, date: event.target.value })} />
          </label>
        )}
        <label>
          時間
          <input type="time" value={task.time} onChange={(event) => setTask({ ...task, time: event.target.value })} />
        </label>
        <label>
          對象
          <select value={task.audience} onChange={(event) => setTask({ ...task, audience: event.target.value })}>
            <option value="all">全體員工</option>
            {groupEmployees.map((employee) => (
              <option key={employee.id} value={employee.id}>{employee.name}</option>
            ))}
          </select>
        </label>
        <button className="primary-action" type="submit"><Plus size={18} /> 新增排程</button>
      </form>

      <ScheduleList state={state} setState={setState} viewer={viewer} setNotice={setNotice} canManage={true} />
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return <div className="section-title">{icon}<h2>{title}</h2></div>;
}

createRoot(document.getElementById("root")).render(<App />);
