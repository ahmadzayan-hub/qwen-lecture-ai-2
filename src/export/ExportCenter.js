// ExportCenter — MD / TXT / JSON / SRT / VTT / study / print-PDF.
// All exports are generated client-side from the current session + memory.

import { memory } from '../ai/Memory.js'
import { buildNotes } from '../study/StudyEngine.js'
import { escapeHTML } from '../utils/text.js'

function download (filename, text, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([text], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

function pad (n, w = 2) {
  return String(n).padStart(w, '0')
}
// ms -> SRT timestamp 00:00:00,000
function srtTime (ms) {
  const h = Math.floor(ms / 3600000)
  const m = Math.floor((ms % 3600000) / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const msr = Math.floor(ms % 1000)
  return `${pad(h)}:${pad(m)}:${pad(s)},${pad(msr, 3)}`
}
function vttTime (ms) {
  return srtTime(ms).replace(',', '.')
}

export const ExportCenter = {
  txt (segments) {
    const body = segments.map((s) => s.text).join('\n')
    download('lecture.txt', body)
  },

  json (session) {
    download('lecture.json', JSON.stringify({ ...session, memory: memory.snapshot() }, null, 2), 'application/json')
  },

  md (session) {
    const snap = memory.snapshot()
    let md = `# ${session.title || 'محاضرة'}\n\n`
    md += `## التفريغ\n\n`
    md += session.segments.map((s) => `- ${s.text}`).join('\n')
    if (snap.summary?.length) md += `\n\n## الملخص\n\n` + snap.summary.map((x) => `- ${x}`).join('\n')
    if (snap.definitions.length) md += `\n\n## التعريفات\n\n` + snap.definitions.map((x) => `- ${x}`).join('\n')
    if (snap.important.length) md += `\n\n## نقاط مهمة\n\n` + snap.important.map((x) => `- ${x}`).join('\n')
    if (snap.formulas.length) md += `\n\n## القوانين\n\n` + snap.formulas.map((x) => `- ${x}`).join('\n')
    download('lecture.md', md, 'text/markdown;charset=utf-8')
  },

  srt (segments) {
    const body = segments.map((s, i) => {
      const start = s.tStart ?? i * 3000
      const end = s.tEnd ?? start + 3000
      return `${i + 1}\n${srtTime(start)} --> ${srtTime(end)}\n${s.text}\n`
    }).join('\n')
    download('lecture.srt', body)
  },

  vtt (segments) {
    let body = 'WEBVTT\n\n'
    body += segments.map((s, i) => {
      const start = s.tStart ?? i * 3000
      const end = s.tEnd ?? start + 3000
      return `${vttTime(start)} --> ${vttTime(end)}\n${s.text}\n`
    }).join('\n')
    download('lecture.vtt', body)
  },

  study () {
    const sections = buildNotes()
    let md = `# مذكرة المذاكرة\n\n`
    for (const sec of sections) {
      md += `## ${sec.h}\n\n` + sec.items.map((x) => `- ${x}`).join('\n') + '\n\n'
    }
    download('study-notes.md', md, 'text/markdown;charset=utf-8')
  },

  // Print-to-PDF via a styled print window (RTL).
  printPDF (session) {
    const sections = buildNotes()
    const win = window.open('', '_blank')
    if (!win) return
    const secHTML = sections.map((sec) =>
      `<h2>${escapeHTML(sec.h)}</h2><ul>${sec.items.map((i) => `<li>${escapeHTML(i)}</li>`).join('')}</ul>`,
    ).join('')
    const transHTML = session.segments.map((s) => `<p>${escapeHTML(s.text)}</p>`).join('')
    win.document.write(`<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
<title>${escapeHTML(session.title || 'محاضرة')}</title>
<style>
  body{font-family:'Cairo',system-ui,sans-serif;padding:32px;line-height:1.7;color:#111}
  h1{font-size:24px} h2{font-size:18px;margin-top:24px;border-bottom:2px solid #8b5cf6;padding-bottom:4px}
  ul{padding-inline-start:20px} li{margin:4px 0}
  .transcript p{margin:6px 0;color:#333}
  @media print{ button{display:none} }
</style></head><body>
<h1>${escapeHTML(session.title || 'محاضرة')}</h1>
${secHTML}
<h2>التفريغ الكامل</h2><div class="transcript">${transHTML}</div>
<button onclick="window.print()" style="margin-top:24px;padding:8px 16px">طباعة / حفظ PDF</button>
</body></html>`)
    win.document.close()
  },
}
