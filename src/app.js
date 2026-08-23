import "./styles.css"
import { Matcher } from "./response/NameMatcher.js"

const app = document.getElementById("app")
const aliases = ["Ahmed", "Ahmad", "أحمد", "Ahmed Zaian", "أحمد زيان"]
let listening = false
let alerting = false
let seconds = 0
let timer

Matcher.configure("Ahmed Zaian", aliases.join(","))

const events = [
  ["15:32", "Lecture started", "system"],
  ["15:47", "Audio health check passed", "system"],
  ["16:04", "Name detected — awaiting confirmation", "attendance"],
]
const transcript = [
  ["16:03:41", "Today we will compare responsible AI operating models.", false],
  ["16:03:48", "The most important thing is to keep a human in the loop.", false],
  ["16:04:02", "Ahmed Zaian, are you with us?", true],
]

function render() {
  app.innerHTML = `
    <div class="hader-shell">
      <header class="hader-topbar">
        <div class="brand-lockup"><div class="brand-mark">ح</div><div><div class="brand-name">HADER <span>AI</span></div><div class="brand-ar" dir="rtl">حاضر</div></div></div>
        <div class="topbar-status"><span class="status-dot ${listening ? "live" : ""}"></span><span>${listening ? "LIVE MONITORING" : "STANDBY"}</span><span class="divider"></span><span class="muted">MBA AI Strategy</span></div>
        <div class="top-actions"><button class="icon-btn" id="themeBtn" aria-label="Toggle theme">◐</button><button class="avatar">AZ</button></div>
      </header>
      <div class="hader-layout">
        <aside class="sidebar"><nav><div class="nav-label">WORKSPACE</div>${nav("⌁", "Live Lecture", true)}${nav("◷", "Sessions")}${nav("⌁", "Detection History")}${nav("▣", "Courses")}${nav("⌘", "Devices")}${nav("✦", "AI Notes")}</nav><div class="sidebar-bottom">${nav("⚙", "Settings")}<div class="privacy-note"><span>●</span><div><b>Privacy mode</b><small>No raw audio stored</small></div></div></div></aside>
        <main class="main-content">
          <div class="page-heading"><div><p class="eyebrow">TUESDAY · 23 AUGUST 2026</p><h1>Live lecture</h1><p class="subhead">Hader listens for your name so you never miss your moment.</p></div><button class="btn ${listening ? "btn-stop" : "btn-primary"}" id="listenBtn">${listening ? "■  Stop lecture mode" : "▶  Start lecture mode"}</button></div>
          <section class="preflight panel"><div class="preflight-title"><span class="check-ring">✓</span><div><b>${listening ? "Monitoring is active" : "Ready when you are"}</b><small>${listening ? "Audio signal and detection engine are running" : "Run a quick check before joining your lecture"}</small></div></div><div class="checks"><span>✓ Audio permission</span><span>✓ Alert sound</span><span class="${listening ? "good" : "warn"}">${listening ? "✓ Qwen fallback ready" : "! Cloud ASR not connected"}</span><span>✓ Aliases configured</span></div></section>
          <div class="live-grid">
            <section class="presence-card panel"><div class="card-kicker"><span class="live-pulse"></span> PRESENCE GUARD <span class="chip">P0 CORE</span></div><div class="presence-center"><div class="presence-orb ${listening ? "orb-listening" : ""}"><div class="orb-inner">${listening ? "حاضر" : "جاهز"}</div></div><h2>${listening ? "Listening for your name" : "Start to monitor"}</h2><p>${listening ? "Your name is protected in this lecture" : "System audio or microphone · no recording"}</p></div><div class="signal-row"><span class="signal-bars"><i></i><i></i><i></i><i></i><i></i></span><span>${listening ? "Audio signal detected" : "Audio source waiting"}</span><span class="signal-value">${listening ? "−18 dB" : "—"}</span></div><div class="source-row"><button class="source selected" id="systemBtn">▣ <b>System audio</b><small>Teams window</small></button><button class="source" id="micBtn">♩ <b>Microphone</b><small>Nearby speaker</small></button></div></section>
            <section class="transcript-card panel"><div class="section-head"><div><div class="card-kicker">LIVE TRANSCRIPT</div><h3>What Hader hears</h3></div><span class="engine-pill"><span class="status-dot ${listening ? "live" : ""}"></span>${listening ? "Local fallback" : "Offline"}</span></div><div class="transcript-list">${transcript.map(t => `<div class="transcript-line ${t[2] ? "match" : ""}"><time>${t[0]}</time><p dir="auto">${t[1]}</p>${t[2] ? '<span class="match-tag">NAME MATCH</span>' : ""}</div>`).join("")}</div><div class="transcript-footer"><span>● Partial transcript updates live</span><button class="text-btn">View full transcript →</button></div></section>
          </div>
          <div class="lower-grid"><section class="timeline panel"><div class="section-head"><div><div class="card-kicker">SESSION TIMELINE</div><h3>Today&apos;s lecture</h3></div><button class="text-btn">See history →</button></div><div class="timeline-list">${events.map(e => `<div class="timeline-item"><span class="timeline-dot ${e[2]}"></span><time>${e[0]}</time><span>${e[1]}</span>${e[2] === "attendance" ? '<b class="confidence">94%</b>' : ""}</div>`).join("")}</div></section><section class="companion panel"><div class="section-head"><div><div class="card-kicker">ALERT COMPANION</div><h3>Android device</h3></div><span class="connected">● Connected</span></div><div class="phone-row"><div class="phone-icon">⌁</div><div><b>Pixel 7 · Alert device</b><small>Last seen just now · battery 84%</small></div><button class="icon-btn">⋯</button></div><button class="btn btn-wide" id="testBtn">♬ Test alert</button></section></div>
          <footer class="trust-footer"><span>🔒 Your audio is processed transiently</span><span>Detection latency <b>—</b></span><span>Session ${listening ? "active" : "not started"}</span></footer>
        </main>
      </div>
      <nav class="mobile-nav"><a class="active">⌂<small>Home</small></a><a>◉<small>Live</small></a><a>◷<small>History</small></a><a>⌘<small>Devices</small></a><a>⚙<small>Settings</small></a></nav>
      ${alerting ? alertOverlay() : ""}
    </div>`
  bind()
}
function nav(icon, label, active = false) { return `<button class="nav-item ${active ? "active" : ""}"><span>${icon}</span>${label}</button>` }
function alertOverlay() { return `<div class="alert-backdrop"><div class="alert-modal" role="alertdialog" aria-modal="true"><div class="alert-siren">!</div><p class="eyebrow urgent">URGENT · PRESENCE GUARD</p><h2 dir="rtl">تم نداء اسمك</h2><h1>Your name was called</h1><p class="heard">“Ahmed Zaian, are you with us?”</p><div class="alert-meta"><span>CONFIDENCE <b>96%</b></span><span>EVENT <b>ATTENDANCE CALL</b></span><span>WAITING <b>00:${String(seconds).padStart(2, "0")}</b></span></div><button class="confirm-btn" id="confirmBtn">حاضر <span>I&apos;M HERE</span></button><div class="alert-actions"><button id="falseBtn">False alarm</button><button id="snoozeBtn">Snooze 10 sec</button></div></div></div>` }
function bind() {
  document.getElementById("listenBtn").onclick = () => { listening = !listening; render() }
  document.getElementById("testBtn").onclick = () => { alerting = true; seconds = 0; timer = setInterval(() => { seconds++; const time = document.querySelector(".alert-meta b:last-child"); if (time) time.textContent = `00:${String(seconds).padStart(2, "0")}` }, 1000); render() }
  document.getElementById("confirmBtn")?.addEventListener("click", () => { clearInterval(timer); alerting = false; events.unshift(["16:04", "You confirmed presence · 2.8s reaction", "attendance"]); render() })
  document.getElementById("falseBtn")?.addEventListener("click", () => { clearInterval(timer); alerting = false; render() })
  document.getElementById("snoozeBtn")?.addEventListener("click", () => { const b = document.getElementById("snoozeBtn"); b.textContent = "Alarm snoozed · 10s"; setTimeout(() => { if (alerting) render() }, 10000) })
  document.getElementById("systemBtn").onclick = () => capture("system")
  document.getElementById("micBtn").onclick = () => capture("mic")
}
async function capture(mode) { try { const stream = mode === "system" ? await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true }) : await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); stream.getTracks().filter(t => t.kind === "video").forEach(t => t.stop()); listening = true; render() } catch { alert("Audio permission was not granted. Choose a source and try again.") } }
render()
