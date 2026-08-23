"use client"

/**
 * Course profiles.
 *
 * A lecturer's habits change how names are called ("Mr Zayan?" vs "أحمد؟"),
 * so each course keeps its own sensitivity, language and extra keywords.
 * Loading a profile applies it to the next session.
 */

import { useCallback, useEffect, useState } from "react"
import { BookOpen, Check, Plus, Trash2, X } from "lucide-react"
import { useHader } from "@/components/providers/hader-provider"
import { Button, Card, Kicker } from "@/components/ui/status"
import type { LectureProfile, Sensitivity } from "@/lib/types"
import { cn } from "@/lib/utils"

const KEY = "hader.courses.v1"

function read(): LectureProfile[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as LectureProfile[]) : []
  } catch {
    return []
  }
}

export default function CoursesPage() {
  const { lecture, setLecture } = useHader()
  const [courses, setCourses] = useState<LectureProfile[]>([])
  const [keyword, setKeyword] = useState("")

  useEffect(() => setCourses(read()), [])

  const persist = useCallback((next: LectureProfile[]) => {
    setCourses(next)
    try {
      localStorage.setItem(KEY, JSON.stringify(next))
    } catch {
      /* best effort */
    }
  }, [])

  const saveCurrent = () => {
    if (!lecture.course.trim()) return
    const profile: LectureProfile = { ...lecture, id: lecture.course.trim().toLowerCase() }
    persist([profile, ...courses.filter((c) => c.id !== profile.id)])
  }

  return (
    <div className="flex flex-col gap-4">
      <header>
        <Kicker>Courses</Kicker>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Lecture profiles</h1>
        <p className="mt-1 text-pretty text-xs leading-relaxed text-muted-foreground">
          Save a course with its language, sensitivity and the phrases that lecturer uses, then load it
          before the lecture starts.
        </p>
      </header>

      {/* Active profile editor */}
      <Card className="border-primary/30 bg-primary/5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full border border-primary/40 bg-primary/10 text-primary">
            <BookOpen className="size-4" aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <Kicker>Active profile</Kicker>
            <p className="truncate text-sm font-bold">{lecture.course || "Untitled course"}</p>
            <p className="text-[11px] text-muted-foreground">
              {lecture.lecturer || "No lecturer"} · {lecture.language} · {lecture.sensitivity} sensitivity
            </p>
          </div>
          <Button variant="primary" onClick={saveCurrent} disabled={!lecture.course.trim()}>
            <Plus className="size-3.5" aria-hidden />
            Save as profile
          </Button>
        </div>

        <div className="mt-4">
          <Kicker>Sensitivity for this course</Kicker>
          <div className="mt-2 flex gap-2">
            {(["low", "balanced", "high"] as Sensitivity[]).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setLecture({ ...lecture, sensitivity: value })}
                className={cn(
                  "min-h-11 flex-1 rounded-lg border px-3 text-xs font-semibold capitalize",
                  lecture.sensitivity === value
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border hover:bg-secondary",
                )}
              >
                {value}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <Kicker>Extra trigger keywords</Kicker>
          <p className="mt-1 text-pretty text-[11px] leading-relaxed text-muted-foreground">
            Phrases this lecturer uses when calling on students, such as a student ID or “group two”.
          </p>
          <form
            className="mt-2 flex gap-2"
            onSubmit={(event) => {
              event.preventDefault()
              const value = keyword.trim()
              if (!value || lecture.keywords.includes(value)) return
              setLecture({ ...lecture, keywords: [...lecture.keywords, value] })
              setKeyword("")
            }}
          >
            <input
              value={keyword}
              dir="auto"
              onChange={(event) => setKeyword(event.target.value)}
              aria-label="Add trigger keyword"
              placeholder="group two"
              className="min-h-11 flex-1 rounded-lg border border-border bg-secondary/40 px-3 text-xs outline-none focus-visible:ring-2 focus-visible:ring-[var(--ring)]"
            />
            <Button type="submit">Add</Button>
          </form>
          {lecture.keywords.length > 0 && (
            <ul className="mt-2 flex flex-wrap gap-2">
              {lecture.keywords.map((item) => (
                <li key={item}>
                  <button
                    type="button"
                    dir="auto"
                    onClick={() =>
                      setLecture({ ...lecture, keywords: lecture.keywords.filter((k) => k !== item) })
                    }
                    aria-label={`Remove ${item}`}
                    className="flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-secondary/50 px-3 text-[11px] font-medium hover:border-destructive/50 hover:text-destructive"
                  >
                    {item}
                    <X className="size-3" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </Card>

      {/* Saved */}
      <Card>
        <Kicker>Saved profiles</Kicker>
        {courses.length === 0 ? (
          <p className="mt-3 text-pretty text-[11px] leading-relaxed text-muted-foreground">
            None yet. Fill in the active profile above and save it.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col divide-y divide-border">
            {courses.map((course) => {
              const active = course.id === lecture.course.trim().toLowerCase()
              return (
                <li key={course.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-xs font-bold">{course.course}</p>
                    <p className="truncate text-[11px] text-muted-foreground">
                      {course.lecturer || "No lecturer"} · {course.language} · {course.sensitivity}
                      {course.keywords.length ? ` · ${course.keywords.length} keywords` : ""}
                    </p>
                  </div>
                  <Button onClick={() => setLecture(course)} disabled={active}>
                    {active ? <Check className="size-3.5" aria-hidden /> : null}
                    {active ? "Loaded" : "Load"}
                  </Button>
                  <Button
                    variant="ghost"
                    aria-label={`Delete ${course.course}`}
                    onClick={() => persist(courses.filter((c) => c.id !== course.id))}
                  >
                    <Trash2 className="size-3.5" aria-hidden />
                  </Button>
                </li>
              )
            })}
          </ul>
        )}
      </Card>
    </div>
  )
}
