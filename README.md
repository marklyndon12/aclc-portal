# ACLC Web Portal

Role-based educational management portal for ACLC College built with React (TSX), Node.js/Express, and Supabase (PostgreSQL).

This README is the single source of truth for the build plan. It covers the architecture, role functionality, database rules, API surface, and the phased roadmap.

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Database | Supabase (PostgreSQL) |
| Backend API | Node.js + Express + TypeScript |
| Frontend | React + TypeScript (TSX) + Vite |
| Styling | TailwindCSS (v3.4) + lucide-react icons |
| Routing | React Router DOM |
| Auth | bcryptjs password hashing + 32-char hex session token |
| QR | qrcode.react (student) + html5-qrcode (teacher scanner) |
| Validation | zod (server) |
| Toasts | sonner |

---

## 2. Architecture

```
React (Vite + TSX + Tailwind + React Router)
        |  fetch + Bearer token (localStorage)
        v
Express API (TypeScript, Supabase service_role client)
        |
        v
Supabase Postgres (existing schema + additive indexes)
```

The browser never talks to Supabase directly for privileged data. The server holds `SUPABASE_SERVICE_ROLE_KEY`; the client holds only `VITE_API_URL`.

---

## 3. Finalized Decisions

| Decision | Choice |
|---|---|
| Project location | `Desktop/aclc-portal` |
| Database | Keep schema, wipe all rows (`RESTART IDENTITY CASCADE`) |
| Seed data | None; only a one-time bootstrap admin CLI |
| Password storage | bcrypt hashes |
| Backend language | TypeScript |
| Scope | Full portal, delivered in phases |
| Room conflicts | Add optional `room` column to `courses` |
| Schedule source of truth | `courses` table |
| Delete behavior | Block deletion when dependents exist |
| Grading | Average of non-null terms; pass at >= 75 |
| QR freshness | 20 seconds max age, reject > 5 seconds in the future |
| Session polling | Every 10 seconds |

---

## 4. Repository Structure

```
aclc-portal/
├─ package.json                 # root scripts (dev, build, typecheck)
├─ .gitignore
├─ README.md
├─ client/
│  ├─ .env.example              # VITE_API_URL=http://localhost:4000
│  ├─ index.html
│  ├─ package.json
│  ├─ vite.config.ts
│  ├─ tsconfig.json
│  ├─ tailwind.config.js
│  ├─ postcss.config.js
│  └─ src/
│     ├─ main.tsx
│     ├─ App.tsx
│     ├─ index.css
│     ├─ lib/api.ts
│     ├─ context/AuthContext.tsx
│     ├─ hooks/useSessionBouncer.tsx
│     ├─ components/
│     │  ├─ ProtectedRoute.tsx
│     │  ├─ RoleRoute.tsx
│     │  ├─ DashboardLayout.tsx
│     │  ├─ SessionExpiredModal.tsx
│     │  └─ Modal.tsx
│     ├─ pages/
│     │  ├─ Login.tsx
│     │  ├─ admin/    AdminDashboard, ManageUsers, ManageStudents,
│     │  │            ManageTeachers, ManageSections, ManageSubjects,
│     │  │            ManageCourses, ManageSchedule, AdminAttendance,
│     │  │            AdminGrades, ManageAnnouncements
│     │  ├─ teacher/  TeacherDashboard, TeacherClasses, TeacherAttendance,
│     │  │            TeacherGrades, TeacherQuizzes, TeacherAttendanceLog
│     │  └─ student/  StudentDashboard, StudentSchedule, StudentGrades,
│     │               StudentAttendance, StudentQuizzes, LiveQrModal
│     └─ types/index.ts
└─ server/
   ├─ .env.example
   ├─ package.json
   ├─ tsconfig.json
   ├─ scripts/
   │  ├─ reset-db.sql
   │  ├─ additive-migration.sql
   │  └─ create-admin.ts
   └─ src/
      ├─ index.ts
      ├─ config/env.ts
      ├─ lib/supabaseAdmin.ts
      ├─ lib/grades.ts
      ├─ middleware/auth.ts
      ├─ middleware/error.ts
      └─ routes/
         ├─ auth.routes.ts
         ├─ admin.routes.ts
         ├─ teacher.routes.ts
         ├─ student.routes.ts
         ├─ attendance.routes.ts
         ├─ grades.routes.ts
         ├─ quizzes.routes.ts
         └─ announcements.routes.ts
```

---

## 5. Roles and Capabilities

| Resource | Admin | Teacher (own courses) | Student (self only) |
|---|---|---|---|
| `users` | Create / Read / Update / Delete | Read self | Read self |
| `students` | Full CRUD | Read roster only | Read self |
| `teachers` | Full CRUD | Read self | - |
| `sections` | Full CRUD | Read | Read (own) |
| `subjects` | Full CRUD | Read | Read (via course) |
| `courses` | Full CRUD + assign teacher | Read own | Read own section |
| `classes` / schedule | Full CRUD | Read own | Read own section |
| `grades` | Read all + override | Read/Write own courses | Read self |
| `attendance` | Read all + override | Write own courses | Read self |
| `attendance_teachers` | Full | Write self | - |
| `quizzes` / questions | Read | Full CRUD own courses | Read assigned + submit |
| `announcements` | Full CRUD | Read | Read |
| Session token | Self | Self | Self |
| Dynamic QR | - | Validate | Generate |

Enforcement rule: the UI hides actions, but the Node API is the source of truth. Every route uses `requireAuth` + `requireRole([...])`, and teacher/student routes derive identity from the session token. Client-supplied `student_id` / `teacher_id` values are never trusted.

---

## 6. Admin (The Orchestrator)

### Pages

```
/admin/dashboard          overview, stats, quick actions
/admin/users              all accounts, role filter, create/edit/delete
/admin/students           student profiles + section assignment
/admin/teachers           teacher profiles + department/specialization
/admin/sections           section management
/admin/subjects           subject catalog
/admin/courses            course + teacher + section + room assignment
/admin/schedule           weekly timetable / conflict checks
/admin/attendance         attendance monitoring + overrides
/admin/grades             grade oversight + overrides
/admin/announcements      announcement CRUD
```

### User Provisioning

- One modal: `username`, `password`, `role`, then role-specific fields.
- `POST /api/admin/users`:
  1. Validate with zod.
  2. bcrypt-hash the password (cost 10-12).
  3. Insert the `users` row with the chosen role.
  4. Insert the `students` or `teachers` profile with the same `user_id`, username, and bcrypt hash.
  5. Prefer an RPC `create_account(...)` for atomicity; fall back to sequential insert + cleanup.
- Admin accounts have no profile table, only a role.

### Profile Management

- Students: `student_number`, `full_name`, `year_level`, `section`, `course_year`.
- Teachers: `full_name`, `department`, `specialization`.
- Editing username or password keeps `users` and the profile columns in sync.

### Course and Schedule Management

- Course form: `course_code` (unique), `course_name`, `credits`, `subject_code`, `year_level`, section, teacher, `day`, `start_time`, `end_time`, optional `room`.
- On save the server writes `courses.teacher_id` = teacher's `users.user_id` (text) and `courses.teacher_name` for display.
- Times are normalized to zero-padded `HH:MM`.
- `courses` is the single source of truth for schedules and conflict checks.

### Conflict Prevention

Overlap rule for the same `day` and `start < new_end AND end > new_start`:

- Teacher: same `teacher_id`
- Section: same `section_name`
- Room: same non-null `room`

Responses:

- Exact slot duplicate is caught by a DB unique constraint -> Postgres `23505` -> `409 SCHEDULE_CONFLICT`.
- Overlap -> `409` with `{ conflicts: [{ type, course_code, start_time, end_time }] }`.
- `POST /api/admin/courses/check-conflict` supports live validation before submit.

### Delete Behavior

Every delete route counts dependents first and returns `409 DELETE_BLOCKED` with a readable list. No cascade deletes.

- Student: blocked by grades, attendance, submissions.
- Teacher: blocked by assigned courses and attendance_teachers.
- Course: blocked by grades, attendance, quizzes, classes.
- User: blocked if the linked profile has dependents.

### Announcements

- CRUD with `audience` = Everyone / Students / Teachers.

### Admin API

```
GET    /api/admin/stats
GET    /api/admin/users              POST/PATCH/DELETE /api/admin/users(/:id)
GET    /api/admin/students           POST/PATCH/DELETE /api/admin/students(/:id)
GET    /api/admin/teachers           POST/PATCH/DELETE /api/admin/teachers(/:id)
GET    /api/admin/sections           POST/PATCH/DELETE /api/admin/sections(/:id)
GET    /api/admin/subjects           POST/PATCH/DELETE /api/admin/subjects(/:id)
GET    /api/admin/courses            POST/PATCH/DELETE /api/admin/courses(/:id)
GET    /api/admin/classes            POST/PATCH/DELETE /api/admin/classes(/:id)
POST   /api/admin/courses/check-conflict
GET    /api/admin/attendance?course_id&date&section
PUT    /api/admin/grades/:id
GET    /api/announcements            POST/PATCH/DELETE /api/admin/announcements(/:id)
```

---

## 7. Teacher (The Facilitator)

### Pages

```
/teacher/dashboard        my classes, today's schedule, recent scans
/teacher/classes          assigned courses only
/teacher/attendance       QR scanner + manual attendance + logs
/teacher/grades           per-course grade grid
/teacher/quizzes          quizzes, questions, submissions
/teacher/attendance-log   own daily time-in/time-out
/teacher/announcements
```

### Course Scoping

- `GET /api/teacher/courses` returns only rows where `courses.teacher_id = req.user.user_id`.
- Every write route calls `assertCourseOwnership(courseId, user)` before touching grades, attendance, or quizzes.

### QR Attendance Scanner

- Teacher selects a course and opens Scanner Mode.
- `html5-qrcode` uses `facingMode: environment`; start/stop lifecycle is handled on mount/unmount.
- A scan cooldown ref prevents duplicate scans.
- `POST /api/attendance/scan { course_id, payload }`:
  1. Split the payload on `|` into `studentId` and `ts`.
  2. Reject if `now - ts > 20` or `ts - now > 5` -> `400 { code: "QR_EXPIRED" }`.
  3. Verify the course belongs to the teacher.
  4. Verify the student is in the course's section roster.
  5. Upsert `attendance` on `(student_id, course_id, attendance_date)` with `Present`.
  6. Return `{ student_name, status, time }`.
- UI shows a green success toast, a red "Expired QR / Screenshot detected" toast, an "already marked present" notice, and a recent scans list.
- Manual fallback: search by student number and mark present.

### Grade Management

- Select course -> roster loads from the course section.
- Editable `prelim`, `midterm`, `prefinal`, `final`.
- Server computes `grade_value`, `gpa`, `remarks`, and `status`.
- Bulk upsert on `(student_id, course_id)`; values validated to 0-100.

### Quizzes

- Create a quiz for an owned course (title, instructions, deadline, term/type).
- Add questions (multiple choice, true/false, short answer) with points and correct answers.
- View submissions, auto-grade objective items, manually grade short answers.

### Teacher Daily Attendance

- Uses `attendance_teachers`; upsert on `(teacher_id, date)`.

### Teacher API

```
GET  /api/teacher/me
GET  /api/teacher/courses
GET  /api/teacher/courses/:id/roster
GET  /api/teacher/schedule/today
POST /api/attendance/scan
POST /api/teacher/attendance/manual
GET  /api/teacher/attendance?course_id&date
POST /api/teacher/grades/:courseId/bulk
GET  /api/teacher/quizzes                 POST/PATCH/DELETE /api/teacher/quizzes(/:id)
GET  /api/teacher/quizzes/:id/questions   POST /api/teacher/quizzes/:id/questions
GET  /api/teacher/quizzes/:id/submissions
PATCH /api/teacher/submissions/:id/grade
GET  /api/teacher/attendance-logs         POST /api/teacher/attendance-logs
GET  /api/announcements
```

---

## 8. Student (The End-User)

### Pages

```
/student/dashboard        profile, today's schedule, recent grades, QR button
/student/schedule         weekly timetable by section
/student/grades           per-subject breakdown + GPA/remarks
/student/attendance       own attendance history per course
/student/quizzes          available quizzes + take + results
/student/announcements
```

### Automatic Schedule

- Backend reads `students.section`, then queries `courses WHERE section_name = section AND day = today`, sorted by `start_time`.
- No enrollment UI. Admin assignment is the only source.
- Weekly view groups by `day` with normalized casing.

### Live QR Identity

- Student opens the "Live QR ID" modal.
- `payload = "${student.student_id}|${Math.floor(Date.now() / 1000)}"` lives in React state.
- A `useEffect` interval updates the payload every 15 seconds; `qrcode.react` redraws; a countdown ring shows the next refresh.
- No network is required; the device clock is used and the server validates freshness.
- Uses `students.student_id` (bigint) because `attendance.student_id` is a bigint FK.

### Performance Tracking

- `GET /api/student/grades` returns records by `user_id` (and `student_id`) with `prelim`, `midterm`, `prefinal`, `final`, `gpa`, `remarks`, `status`.

### Attendance History

- `GET /api/student/attendance` returns per-course records with a present/absent summary.

### Quizzes

- List quizzes for the student's section/courses, check deadlines, submit answers, view score/status.
- Only allowed writes: quiz submission and password change.

### Student API

```
GET  /api/student/me
GET  /api/student/schedule?day=Monday
GET  /api/student/grades
GET  /api/student/attendance
GET  /api/student/quizzes
GET  /api/student/quizzes/:id
POST /api/student/quizzes/:id/submit
GET  /api/student/quizzes/:id/result
GET  /api/announcements
POST /api/auth/change-password
```

---

## 9. Authentication and Single Active Device

- `POST /api/auth/login` verifies the bcrypt hash, generates `crypto.randomBytes(16).toString("hex")` (32 chars), saves it to `users.session_token`, and returns the token plus the role profile.
- `GET /api/auth/session` is polled by the bouncer every 10 seconds; returns `200` or `401`.
- `useSessionBouncer` on a mismatch runs `localStorage.clear()`, shows the "Session Expired" modal, and navigates to `/login`.
- Role redirect after login: admin, teacher, or student dashboard.
- Middleware chain: `requireAuth` -> `requireRole([...])` -> resource ownership check.
- Login is rate-limited. Tokens and passwords are never logged.

---

## 10. Grading Rules

- `terms = [prelim, midterm, prefinal, final]`
- Average is computed from non-null terms.
- `grade_value` = term average; `gpa` = same average unless a 1.00-5.00 scale is configured.
- `remarks` and `status` = `Passed` if average >= 75, else `Failed`.
- If no term has a value: `status = "Pending"`, `grade_value = 0`.
- Values are validated to 0-100; bulk upsert on `(student_id, course_id)`.

---

## 11. Database Reset (destructive, run once)

Run in the Supabase SQL Editor:

```sql
BEGIN;
TRUNCATE TABLE
  public.student_answers,
  public.student_quiz_submissions,
  public.quiz_questions,
  public.quizzes,
  public.attendance,
  public.attendance_teachers,
  public.grades,
  public.classes,
  public.courses,
  public.students,
  public.teachers,
  public.subjects,
  public.sections,
  public.announcements,
  public.users
RESTART IDENTITY CASCADE;
COMMIT;
```

After the wipe there are no accounts. Create the first admin with the bootstrap CLI:

```bash
cd server
npm run create-admin
```

The script prompts for a username and password, bcrypt-hashes the password, and inserts an `admin` row into `users`.

---

## 12. Additive Migration (safe, keeps existing data structure)

```sql
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS room text;

CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_course_date_uk
  ON public.attendance (student_id, course_id, attendance_date);
CREATE UNIQUE INDEX IF NOT EXISTS attendance_teachers_teacher_date_uk
  ON public.attendance_teachers (teacher_id, date);
CREATE UNIQUE INDEX IF NOT EXISTS grades_student_course_uk
  ON public.grades (student_id, course_id);

CREATE UNIQUE INDEX IF NOT EXISTS courses_teacher_slot_uk
  ON public.courses (teacher_id, day, start_time) WHERE teacher_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS courses_section_slot_uk
  ON public.courses (section_name, day, start_time) WHERE section_name IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS courses_room_slot_uk
  ON public.courses (room, day, start_time) WHERE room IS NOT NULL;

CREATE INDEX IF NOT EXISTS classes_section_day_idx ON public.classes (section_id, day);
```

Optional hardening: enable RLS on all tables with no anon policies. The API uses the service role, so it still works while direct anon access is denied.

---

## 13. Canonical Data Conventions

| Relationship | Convention |
|---|---|
| Auth identity | `users.user_id` (uuid), role in `users.roles` |
| Student profile | `students.user_id -> users.user_id`; `students.section` matches `sections.section_name` / `courses.section_name` |
| Teacher profile | `teachers.user_id -> users.user_id`; `teachers.teacher_id` (bigint) used by classes/attendance_teachers |
| `courses.teacher_id` (text) | Store the teacher's `users.user_id` string; fill `teacher_name` for display |
| `grades` | Keep `student_id` (bigint) and `user_id` (uuid) in sync; unique `(student_id, course_id)` |
| `attendance` | `student_id` = `students.student_id`; unique per course per day |
| `quizzes.teacher_id` | `users.user_id` |
| `student_quiz_submissions.student_id` | `students.user_id` |
| Passwords | bcrypt hash in `users.password` and the duplicated profile password columns |

---

## 14. Environment Variables

`server/.env`:

```env
PORT=4000
CLIENT_ORIGIN=http://localhost:5173
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_ANON_KEY=YOUR_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY
QR_MAX_AGE_SECONDS=20
QR_MAX_FUTURE_SECONDS=5
```

`client/.env`:

```env
VITE_API_URL=http://localhost:4000
```

The `SUPABASE_SERVICE_ROLE_KEY` is required for login (session token persistence) and all admin writes. Keep it server-side only and never commit it.

---

## 15. Phase Roadmap

- [ ] **Phase 0** - Scaffold monorepo, environment files, Supabase clients, verify dev/build.
- [ ] **Phase 1** - Wipe database, apply additive migration, bootstrap admin CLI.
- [ ] **Phase 2** - Auth API, middleware, role guards, login/session/logout.
- [ ] **Phase 3** - Client auth context, login page, protected/role routes, session bouncer.
- [ ] **Phase 4** - Admin user provisioning + students/teachers/sections/subjects.
- [ ] **Phase 5** - Admin courses/schedule + conflict handling + announcements.
- [ ] **Phase 6** - Student dashboard, schedule, grades, live QR.
- [ ] **Phase 7** - Teacher course scoping, QR scanner, attendance, manual fallback.
- [ ] **Phase 8** - Teacher grade grid + student attendance history.
- [ ] **Phase 9** - Quizzes (teacher CRUD/grading, student take/results).
- [ ] **Phase 10** - QA: role matrix, ownership/IDOR tests, bouncer kick-out, expired QR, conflict UI, typecheck/build.

---

## 16. Security Notes

- `service_role` key stays on the server only.
- bcrypt cost 10-12.
- zod validation on every write endpoint.
- helmet, CORS restricted to the client origin, and express-rate-limit on login.
- Student routes derive identity from the session token (no IDOR).
- Teacher routes verify course ownership before every write.
- QR timestamps are checked for both age and future-dating; attendance is unique per course per day.
- localStorage is used for the token per the single-device requirement. This carries XSS risk; a future upgrade can move to httpOnly cookies.
