// Tiny DOM + text helpers. XSS-safe by default (§5 rule 8).

export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag)
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue
    if (k === "class") node.className = v
    else if (k === "style" && typeof v === "object") Object.assign(node.style, v)
    else if (k.startsWith("on") && typeof v === "function") {
      node.addEventListener(k.slice(2).toLowerCase(), v)
    } else if (k === "html") {
      // caller is responsible for safety when using html
      node.innerHTML = v
    } else if (k in node && k !== "list") {
      try {
        node[k] = v
      } catch {
        node.setAttribute(k, v)
      }
    } else {
      node.setAttribute(k, v)
    }
  }
  const kids = Array.isArray(children) ? children : [children]
  for (const c of kids) {
    if (c == null || c === false) continue
    node.appendChild(typeof c === "string" || typeof c === "number" ? document.createTextNode(String(c)) : c)
  }
  return node
}

export function $(sel, root = document) {
  return root.querySelector(sel)
}
export function $$(sel, root = document) {
  return Array.from(root.querySelectorAll(sel))
}

export function clear(node) {
  while (node.firstChild) node.removeChild(node.firstChild)
  return node
}

// Escape any dynamic text before it touches innerHTML.
export function escapeHtml(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
}

export function fmtTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n) => String(n).padStart(2, "0")
  return h > 0 ? `${pad(h)}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

export function fmtClock(ms) {
  return fmtTime(ms)
}

// SRT-style timestamp: 00:00:01,250
export function srtTime(ms) {
  const s = Math.max(0, ms) / 1000
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = Math.floor(s % 60)
  const mil = Math.floor((s - Math.floor(s)) * 1000)
  const pad = (n, l = 2) => String(n).padStart(l, "0")
  return `${pad(h)}:${pad(m)}:${pad(sec)},${pad(mil, 3)}`
}

export function vttTime(ms) {
  return srtTime(ms).replace(",", ".")
}

export function download(filename, content, mime = "text/plain;charset=utf-8") {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export function debounce(fn, wait = 200) {
  let t
  return (...args) => {
    clearTimeout(t)
    t = setTimeout(() => fn(...args), wait)
  }
}

export function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v))
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}
