import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Bell,
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

const STORAGE_KEY = "daily-scheduler-attendance-v3";
const LEGACY_KEYS = ["daily-scheduler-attendance-v2", "daily-scheduler-attendance-v1"];
const DIRECTOR_USER = "GMPJ";
const DIRECTOR_PASSWORD = "6090";

const defaultState = {
  groups: [{ code: "GMPJ", name: "GMPJ 團隊", createdAt: new Date().toISOString() }],
  employees: [
    { id: "emp-1", groupCode: "GMPJ", name: "林怡君", username: "staff01", password: "1234", email: "staff01@example.com", workStartTime: "09:00", weeklySchedule: defaultWeeklySchedule(), createdAt: new Date().toISOString() },
    { id: "emp-2", groupCode: "GMPJ", name: "陳柏宇", username: "staff02", password: "1234", email: "staff02@example.com", workStartTime: "09:00", weeklySchedule: defaultWeeklySchedule(), createdAt: new Date().toISOString() },
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
      channel: "大屏幕 + 手機訊息 + Email",
      createdBy: DIRECTOR_USER,
      createdAt: new Date().toISOString(),
    },
  ],
  attendance: [],
  scheduleResponses: [],
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
  return new Date().toISOString().slice(0, 10);
}

function nowTime() {
  return new Date().toLocaleTimeString("zh-TW", { hour: "2-digit", minute: "2-digit" });
}

function nowStamp() {
  return new Date().toLocaleString("zh-TW", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function normalizeState(input) {
  const source = input || defaultState;
  const groups = source.groups?.length ? source.groups : defaultState.groups;
  const employees = (source.employees?.length ? source.employees : defaultState.employees).map((employee) => ({
    email: "",
    workStartTime: "09:00",
    groupCode: "GMPJ",
    weeklySchedule: defaultWeeklySchedule(),
    ...employee,
  }));
  const directors = (source.directors?.length ? source.directors : defaultState.directors).map((director) => ({
    email: "",
    groupCode: "GMPJ",
    ...director,
  }));
  const schedules = (source.schedules?.length ? source.schedules : defaultState.schedules).map((item) => ({
    type: item.type || "temporary",
    date: item.date || todayDate(),
    time: item.time || "09:00",
    audience: item.audience || "all",
    channel: item.channel || "大屏幕 + 手機訊息 + Email",
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
    messages: (source.messages || []).map((item) => ({ groupCode: item.groupCode || "GMPJ", ...item })),
    boardPosts: (source.boardPosts || defaultState.boardPosts).map((item) => ({ groupCode: item.groupCode || "GMPJ", ...item })),
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
  const record = attendance.find((item) => item.employeeId === employeeId && item.date === todayDate());
  if (!record) return { label: "尚未上班", tone: "quiet", record: null };
  if (record.requestedClockOut && !record.clockOutApproved) return { label: "下班待核准", tone: "pending", record };
  if (record.clockIn && !record.clockOut) return { label: "上班中", tone: "active", record };
  return { label: "已下班", tone: "done", record };
}

function useAppState() {
  const [state, setState] = useState(readState);
  useEffect(() => writeState(state), [state]);
  return [state, setState];
}

function App() {
  const [state, setState] = useAppState();
  const [session, setSession] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem("daily-scheduler-session") || "null");
    } catch {
      return null;
    }
  });
  const [notice, setNotice] = useState("");

  useEffect(() => {
    sessionStorage.setItem("daily-scheduler-session", JSON.stringify(session));
  }, [session]);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (!session || !("Notification" in window) || Notification.permission !== "granted") return;
    const timer = window.setInterval(() => {
      const now = new Date();
      const sent = new Set(JSON.parse(sessionStorage.getItem("sent-schedule-notices") || "[]"));

      state.schedules.forEach((item) => {
        const itemKey = `${item.id}-${scheduleDate(item)}`;
        const diff = scheduleDateTime(item).getTime() - now.getTime();
        if (isVisibleTo(item, session) && diff <= 10 * 60 * 1000 && diff > -5 * 60 * 1000 && !sent.has(itemKey)) {
          new Notification(`排程提醒：${item.title}`, { body: `${item.time}｜${item.detail}` });
          sent.add(itemKey);
        }
      });

      if (session.role === "employee") {
        const startTime = todayShiftStart(session.user);
        if (!startTime) {
          sessionStorage.setItem("sent-schedule-notices", JSON.stringify([...sent]));
          return;
        }
        const startAt = new Date(`${todayDate()}T${startTime}:00`);
        const workKey = `work-start-${session.user.id}-${todayDate()}`;
        const workDiff = startAt.getTime() - now.getTime();
        if (workDiff <= 10 * 60 * 1000 && workDiff > -5 * 60 * 1000 && !sent.has(workKey)) {
          new Notification("上班提醒", { body: `距離 ${startTime} 上班時間剩約 10 分鐘。` });
          sent.add(workKey);
        }
      }

      sessionStorage.setItem("sent-schedule-notices", JSON.stringify([...sent]));
    }, 30000);
    return () => window.clearInterval(timer);
  }, [session, state.schedules]);

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
        {session && (
          <button className="icon-button ghost" onClick={logout} title="登出">
            <LogOut size={20} />
          </button>
        )}
      </section>

      {notice && <div className="toast">{notice}</div>}

      {!session ? (
        <AuthPanel state={state} setState={setState} setSession={setSession} setNotice={setNotice} />
      ) : (
        <>
          <Billboard state={state} viewer={session} />
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

  function submit(event) {
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
        if (state.groups.some((group) => group.code === groupCode)) {
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

      if (!groupCode || !state.groups.some((group) => group.code === groupCode)) {
        setNotice("請輸入有效的群組代碼。");
        return;
      }
      const employee = { id: crypto.randomUUID(), groupCode, name: form.name.trim(), username, password, email, workStartTime: "09:00", weeklySchedule: defaultWeeklySchedule(), createdAt: new Date().toISOString() };
      setState({ ...state, employees: [...state.employees, employee] });
      setSession({ role: "employee", user: employee });
      setNotice("員工帳號已建立。");
      return;
    }

    if (role === "director") {
      const director = state.directors.find((user) => user.username === username && user.password === password);
      if (!director) {
        setNotice("主任帳號或密碼不正確。預設主任帳號 GMPJ，密碼 6090。");
        return;
      }
      setSession({ role: "director", user: director });
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
          <span>主任註冊建立群組代碼，員工用群組代碼加入後接收排程與打卡。</span>
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

function DirectorView({ state, setState, session, setSession, setNotice }) {
  const [task, setTask] = useState({ title: "", detail: "", type: "fixed", date: todayDate(), time: "09:00", audience: "all", channel: "大屏幕 + 手機訊息 + Email" });
  const [directorForm, setDirectorForm] = useState({ name: "", username: "", password: "", email: "" });
  const groupEmployees = state.employees.filter((employee) => employee.groupCode === session.user.groupCode);
  const attendanceRows = groupEmployees.map((employee) => ({ employee, ...statusForEmployee(state.attendance, employee.id) }));
  const groupEmployeeIds = new Set(groupEmployees.map((employee) => employee.id));
  const pendingApprovals = state.attendance.filter((record) => groupEmployeeIds.has(record.employeeId) && record.requestedClockOut && !record.clockOutApproved);

  function addSchedule(event) {
    event.preventDefault();
    if (!task.title.trim() || !task.detail.trim()) {
      setNotice("請填寫事項標題與內容。");
      return;
    }
    setState({
      ...state,
      schedules: [
        { ...task, groupCode: session.user.groupCode, id: crypto.randomUUID(), title: task.title.trim(), detail: task.detail.trim(), createdBy: session.user.username, createdAt: new Date().toISOString() },
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
    setState({
      ...state,
      employees: state.employees.filter((employee) => employee.id !== employeeId),
      attendance: state.attendance.filter((record) => record.employeeId !== employeeId),
      scheduleResponses: state.scheduleResponses.filter((response) => response.employeeId !== employeeId),
    });
    setNotice("員工資料已刪除。");
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
    const updatedUser = directors.find((director) => director.id === session.user.id);
    setState({ ...state, directors });
    setSession({ ...session, user: updatedUser });
  }

  return (
    <section className="dashboard-grid">
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
          <label>
            通知方式
            <select value={task.channel} onChange={(event) => setTask({ ...task, channel: event.target.value })}>
              <option>大屏幕 + 手機訊息 + Email</option>
              <option>大屏幕橫幅</option>
              <option>Email</option>
              <option>手機訊息文字</option>
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

      <EmployeeSchedulePanel employees={groupEmployees} onDelete={deleteEmployee} onAddSegment={addShiftSegment} onRemoveSegment={removeShiftSegment} onUpdateSegment={updateEmployeeSchedule} />

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

      <ScheduleList state={state} setState={setState} viewer={{ role: "director" }} setNotice={setNotice} onDelete={deleteSchedule} />

      <MessagePanel state={state} viewer={{ role: "director", user: session.user }} />

      <div className="panel">
        <SectionTitle icon={<Mail size={20} />} title="主任 Email" />
        <label>
          電子郵件
          <input type="email" value={session.user.email || ""} onChange={(event) => updateDirectorEmail(event.target.value)} placeholder="director@example.com" />
        </label>
        <p className="muted">Email 會用在排程通知收件人與寄件紀錄。正式寄送需要接後端郵件服務；目前會先開啟系統郵件草稿。</p>
      </div>

      <div className="panel">
        <SectionTitle icon={<ShieldCheck size={20} />} title="建立主任端" />
        <form onSubmit={addDirector} className="compact-form">
          <input value={directorForm.name} onChange={(event) => setDirectorForm({ ...directorForm, name: event.target.value })} placeholder="主任姓名" />
          <input value={directorForm.username} onChange={(event) => setDirectorForm({ ...directorForm, username: event.target.value })} placeholder="主任帳號" />
          <input type="password" value={directorForm.password} onChange={(event) => setDirectorForm({ ...directorForm, password: event.target.value })} placeholder="主任密碼" />
          <input type="email" value={directorForm.email} onChange={(event) => setDirectorForm({ ...directorForm, email: event.target.value })} placeholder="主任 Email" />
          <button className="secondary-action" type="submit"><UserPlus size={16} /> 建立</button>
        </form>
      </div>
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

function EmployeeSchedulePanel({ employees, onDelete, onAddSegment, onRemoveSegment, onUpdateSegment }) {
  return (
    <div className="panel schedule-admin-panel">
      <SectionTitle icon={<Users size={20} />} title="員工資料與每週排班" />
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
            <div className="week-grid">
              {WEEK_DAYS.map(([day, label]) => {
                const segments = employee.weeklySchedule?.[day] || [];
                return (
                  <div className="day-card" key={day}>
                    <div className="day-title">
                      <b>{label}</b>
                      <button type="button" className="mini-button" onClick={() => onAddSegment(employee.id, day)}>加班段</button>
                    </div>
                    {segments.length ? (
                      segments.map((segment, index) => (
                        <div className="shift-row" key={`${day}-${index}`}>
                          <input type="time" value={segment.start} onChange={(event) => onUpdateSegment(employee.id, day, index, "start", event.target.value)} />
                          <input type="time" value={segment.end} onChange={(event) => onUpdateSegment(employee.id, day, index, "end", event.target.value)} />
                          <button type="button" className="icon-button danger tiny-icon" onClick={() => onRemoveSegment(employee.id, day, index)} title="刪除此班段">
                            <X size={15} />
                          </button>
                        </div>
                      ))
                    ) : (
                      <span className="muted">無排班</span>
                    )}
                  </div>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function BroadcastPanel({ state, setState, session, setNotice }) {
  const [message, setMessage] = useState({ title: "", text: "", audience: "all" });
  const groupEmployees = state.employees.filter((employee) => employee.groupCode === session.user.groupCode);

  function sendMessage(event) {
    event.preventDefault();
    if (!message.title.trim() || !message.text.trim()) {
      setNotice("請填寫群發消息標題與內容。");
      return;
    }
    setState({
      ...state,
      messages: [
        { ...message, groupCode: session.user.groupCode, id: crypto.randomUUID(), title: message.title.trim(), text: message.text.trim(), createdAt: new Date().toISOString() },
        ...state.messages,
      ],
    });
    setMessage({ title: "", text: "", audience: "all" });
    setNotice("群發消息已送出。");
  }

  return (
    <div className="panel">
      <SectionTitle icon={<Send size={20} />} title="群發消息" />
      <form onSubmit={sendMessage} className="compact-stack">
        <input value={message.title} onChange={(event) => setMessage({ ...message, title: event.target.value })} placeholder="消息標題" />
        <textarea value={message.text} onChange={(event) => setMessage({ ...message, text: event.target.value })} placeholder="要群發給員工的內容" />
        <select value={message.audience} onChange={(event) => setMessage({ ...message, audience: event.target.value })}>
          <option value="all">全體員工</option>
          {groupEmployees.map((employee) => (
            <option key={employee.id} value={employee.id}>{employee.name}</option>
          ))}
        </select>
        <button className="primary-action" type="submit"><Send size={18} /> 發送</button>
      </form>
    </div>
  );
}

function EmployeeView({ state, setState, session, setSession, setNotice }) {
  const status = statusForEmployee(state.attendance, session.user.id);
  const todaySegments = session.user.weeklySchedule?.[String(new Date().getDay())] || [];

  function clock(type) {
    const today = todayDate();
    const existing = state.attendance.find((item) => item.employeeId === session.user.id && item.date === today);
    if (type === "in" && existing?.clockIn) {
      setNotice("今天已經上班打卡。");
      return;
    }
    if (type === "out" && !existing?.clockIn) {
      setNotice("請先上班打卡。");
      return;
    }
    if (type === "out" && existing?.requestedClockOut && !existing?.clockOutApproved) {
      setNotice("下班申請已送出，等待主任核准。");
      return;
    }
    const nextAttendance = existing
      ? state.attendance.map((item) => item.id === existing.id ? { ...item, requestedClockOut: nowTime(), clockOutApproved: false } : item)
      : [{ id: crypto.randomUUID(), employeeId: session.user.id, date: today, clockIn: nowTime(), clockOut: "", requestedClockOut: "", clockOutApproved: false }, ...state.attendance];
    setState({ ...state, attendance: nextAttendance });
    setNotice(type === "in" ? "上班打卡完成。" : "下班申請已送出，需主任核准後才算完成。");
  }

  function updateEmployee(field, value) {
    const employees = state.employees.map((employee) => (employee.id === session.user.id ? { ...employee, [field]: value } : employee));
    const updatedUser = employees.find((employee) => employee.id === session.user.id);
    setState({ ...state, employees });
    setSession({ ...session, user: updatedUser });
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
          <button className="primary-action" onClick={() => clock("in")}><CheckCircle2 size={18} /> 上班</button>
          <button className="secondary-action" onClick={() => clock("out")}><LogOut size={18} /> 下班申請</button>
        </div>
      </div>

      <ScheduleList state={state} setState={setState} viewer={session} setNotice={setNotice} />
      <MessagePanel state={state} viewer={session} />
      <NotificationPanel setNotice={setNotice} />

      <div className="panel">
        <SectionTitle icon={<Mail size={20} />} title="我的通知設定" />
        <label>
          電子郵件
          <input type="email" value={session.user.email || ""} onChange={(event) => updateEmployee("email", event.target.value)} placeholder="name@example.com" />
        </label>
        <div className="today-shifts">
          <strong>今日班表</strong>
          {todaySegments.length ? todaySegments.map((segment, index) => (
            <span key={index}>{segment.start} - {segment.end}</span>
          )) : <span>今日無排班</span>}
        </div>
        <p className="muted">上班時間由主任端設定。開啟瀏覽器通知後，系統會在今日第一段上班前 10 分鐘提醒。</p>
      </div>
    </section>
  );
}

function ScheduleList({ state, setState, viewer, setNotice, onDelete }) {
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
    upsertResponse(item, viewer.user.id, { completedAt: nowStamp(), receivedAt: findResponse(item, viewer.user.id)?.receivedAt || nowStamp() });
    setNotice("已回覆完成，主任端會看得到。");
  }

  function shareText(item) {
    navigator.clipboard?.writeText(messageText(item));
    setNotice("已複製手機訊息文字，可貼到 LINE、WhatsApp 或其他通訊 APP。");
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

  return (
    <div className="panel schedule-panel">
      <SectionTitle icon={<ClipboardList size={20} />} title="排程事項" />
      <div className="task-list">
        {schedules.map((item) => {
          const employeeResponse = viewer.role === "employee" ? findResponse(item, viewer.user.id) : null;
          const canComplete = Date.now() >= scheduleDateTime(item).getTime();
          const summary = viewer.role === "director" ? responseSummary(item) : null;
          return (
            <article className="task-card" key={item.id}>
              <div className="task-main">
                <span className="schedule-kind">{item.type === "fixed" ? "每日固定" : "臨時指定"}</span>
                <h3>{item.title}</h3>
                <p>{item.detail}</p>
                <small>{item.type === "fixed" ? "每日" : item.date} {item.time}｜{item.channel}</small>
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
                    <button className="primary-action small-action" onClick={() => markCompleted(item)} disabled={!canComplete || Boolean(employeeResponse?.completedAt)}>
                      <CheckCircle2 size={16} /> {employeeResponse?.completedAt ? "已完成" : "完成"}
                    </button>
                  </>
                )}
                <button className="icon-button" onClick={() => emailNotice(item)} title="建立 Email 草稿">
                  <Mail size={18} />
                </button>
                <button className="icon-button" onClick={() => shareText(item)} title="複製手機訊息">
                  <MessageCircle size={18} />
                </button>
                {viewer.role === "director" && (
                  <button className="icon-button danger" onClick={() => onDelete(item.id)} title="刪除排程">
                    <Trash2 size={18} />
                  </button>
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
      <SectionTitle icon={<Megaphone size={20} />} title="群發消息" />
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
        <p className="muted">目前沒有群發消息。</p>
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
        { id: crypto.randomUUID(), groupCode: session.user.groupCode, authorName: session.user.name, authorRole: session.role, text: text.trim(), createdAt: new Date().toISOString() },
        ...state.boardPosts,
      ],
    });
    setText("");
    setNotice("留言已送出。");
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
          </article>
        ))}
      </div>
    </section>
  );
}

function NotificationPanel({ setNotice }) {
  async function requestPermission() {
    if (!("Notification" in window)) {
      setNotice("這個瀏覽器不支援系統通知。");
      return;
    }
    const permission = await Notification.requestPermission();
    setNotice(permission === "granted" ? "通知已開啟。排程前 10 分鐘與上班前 10 分鐘會提醒。" : "通知尚未開啟。");
  }

  return (
    <div className="panel">
      <SectionTitle icon={<Bell size={20} />} title="通知設定" />
      <p className="muted">目前提供大屏幕橫幅、瀏覽器通知、Email 草稿、手機訊息複製。真正背景推播到手機或自動寄 Email，需要接後端服務。</p>
      <button className="secondary-action" onClick={requestPermission}><Bell size={16} /> 開啟通知</button>
    </div>
  );
}

function SectionTitle({ icon, title }) {
  return <div className="section-title">{icon}<h2>{title}</h2></div>;
}

createRoot(document.getElementById("root")).render(<App />);
