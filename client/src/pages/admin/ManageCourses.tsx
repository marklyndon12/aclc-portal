import { useMemo, useState, type FormEvent } from "react";
import { BookOpen, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import type { Course } from "../../types";

interface Draft {
  course_code: string;
  course_name: string;
  subject_code: string;
  credits: string;
  year_level: string;
  section_name: string;
  teacher_name: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
}

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const emptyDraft: Draft = {
  course_code: "",
  course_name: "",
  subject_code: "",
  credits: "3",
  year_level: "1st Year",
  section_name: "",
  teacher_name: "",
  day: "Monday",
  start_time: "",
  end_time: "",
  room: "",
};

function findConflict(
  courses: Course[],
  draft: Draft,
  editingId: number | null
): Course | null {
  if (!draft.start_time || !draft.end_time) return null;
  const room = draft.room.trim().toLowerCase();

  return (
    courses.find((course) => {
      if (course.course_id === editingId) return false;
      if (course.day !== draft.day) return false;
      if (!course.start_time || !course.end_time) return false;
      if (!(course.start_time < draft.end_time && course.end_time > draft.start_time)) {
        return false;
      }

      const sameTeacher =
        Boolean(draft.teacher_name) && course.teacher_name === draft.teacher_name;
      const sameSection =
        Boolean(draft.section_name) && course.section_name === draft.section_name;
      const sameRoom =
        Boolean(room) && (course.room ?? "").trim().toLowerCase() === room;

      return sameTeacher || sameSection || sameRoom;
    }) ?? null
  );
}

export default function ManageCourses() {
  const { data, setData } = useAdminData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.courses.filter(
      (course) =>
        !term ||
        course.course_code.toLowerCase().includes(term) ||
        course.course_name.toLowerCase().includes(term) ||
        (course.teacher_name ?? "").toLowerCase().includes(term) ||
        (course.section_name ?? "").toLowerCase().includes(term)
    );
  }, [data.courses, query]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (course: Course) => {
    setDraft({
      course_code: course.course_code,
      course_name: course.course_name,
      subject_code: course.subject_code ?? "",
      credits: String(course.credits ?? 3),
      year_level: course.year_level ?? "1st Year",
      section_name: course.section_name ?? "",
      teacher_name: course.teacher_name ?? "",
      day: course.day ?? "Monday",
      start_time: course.start_time ?? "",
      end_time: course.end_time ?? "",
      room: course.room ?? "",
    });
    setEditingId(course.course_id);
    setOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = draft.course_code.trim();
    const name = draft.course_name.trim();

    if (!code || !name) {
      toast.error("Course code and name are required");
      return;
    }
    if (!draft.start_time || !draft.end_time) {
      toast.error("Start and end times are required");
      return;
    }
    if (draft.start_time >= draft.end_time) {
      toast.error("End time must be after start time");
      return;
    }

    const duplicate = data.courses.some(
      (course) =>
        course.course_code.toLowerCase() === code.toLowerCase() &&
        course.course_id !== editingId
    );
    if (duplicate) {
      toast.error("That course code already exists");
      return;
    }

    const conflict = findConflict(data.courses, draft, editingId);
    if (conflict) {
      toast.error(
        `Schedule conflict with ${conflict.course_code} (${conflict.start_time}-${conflict.end_time})`
      );
      return;
    }

    const credits = Number(draft.credits) || 0;
    const enrolled = data.students.filter(
      (student) => student.section === draft.section_name
    ).length;

    setData((previous) => {
      if (editingId) {
        return {
          ...previous,
          courses: previous.courses.map((course) =>
            course.course_id === editingId
              ? {
                  ...course,
                  course_code: code,
                  course_name: name,
                  subject_code: draft.subject_code || null,
                  credits,
                  year_level: draft.year_level,
                  section_name: draft.section_name || null,
                  teacher_name: draft.teacher_name || null,
                  day: draft.day,
                  start_time: draft.start_time,
                  end_time: draft.end_time,
                  room: draft.room.trim() || null,
                  enrolled,
                }
              : course
          ),
        };
      }

      const newCourse: Course = {
        course_id: Date.now(),
        course_code: code,
        course_name: name,
        subject_code: draft.subject_code || null,
        credits,
        year_level: draft.year_level,
        section_name: draft.section_name || null,
        teacher_name: draft.teacher_name || null,
        day: draft.day,
        start_time: draft.start_time,
        end_time: draft.end_time,
        room: draft.room.trim() || null,
        enrolled,
      };

      return { ...previous, courses: [newCourse, ...previous.courses] };
    });

    toast.success(editingId ? `Updated ${code}` : `Created ${code}`);
    setOpen(false);
  };

  const handleDelete = (course: Course) => {
    const attendance = data.attendance.filter(
      (record) => record.course_id === course.course_id
    ).length;
    const grades = data.grades.filter(
      (record) => record.course_id === course.course_id
    ).length;

    if (attendance > 0 || grades > 0) {
      toast.error(
        `Cannot delete ${course.course_code}: ${attendance} attendance and ${grades} grade record(s) exist`
      );
      return;
    }

    if (!window.confirm(`Delete course ${course.course_code}?`)) return;
    setData((previous) => ({
      ...previous,
      courses: previous.courses.filter((item) => item.course_id !== course.course_id),
    }));
    toast.success(`Removed ${course.course_code}`);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">
            Course offerings
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Manage Courses</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Assign subjects, sections, teachers, rooms, and schedules. Overlapping
            teacher, section, or room slots are blocked.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-accent">
          <Plus size={16} />
          Add course
        </button>
      </section>

      <div className="relative max-w-md">
        <Search
          size={16}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search code, course, teacher, or section"
          aria-label="Search courses"
          className="input-glass pl-9"
        />
      </div>

      <div className="glass overflow-hidden bg-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Section</th>
                <th className="px-4 py-3 font-semibold">Teacher</th>
                <th className="px-4 py-3 font-semibold">Schedule</th>
                <th className="px-4 py-3 font-semibold">Enrolled</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((course) => (
                  <tr
                    key={course.course_id}
                    className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-semibold text-accent">
                      {course.course_code}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-100">{course.course_name}</p>
                      <p className="text-xs text-gray-500">
                        {course.subject_code ?? "No subject"} · {course.credits ?? 0} units
                      </p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {course.section_name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {course.teacher_name ?? "Unassigned"}
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {course.day} · {course.start_time}-{course.end_time}
                      <span className="block text-xs text-gray-500">
                        {course.room ?? "No room"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{course.enrolled}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(course)}
                          aria-label={`Edit ${course.course_code}`}
                          title="Edit"
                          className="icon-btn"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(course)}
                          aria-label={`Delete ${course.course_code}`}
                          title="Delete"
                          className="icon-btn hover:border-red-400/40 hover:bg-red-500/20 hover:text-red-300"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <BookOpen size={22} className="mx-auto text-gray-500" />
                    <p className="mt-2 text-sm text-gray-300">No courses found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit course" : "Add course"}
        description="Temporary admin data is saved in this browser."
        size="xl"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassInput
              label="Course code"
              value={draft.course_code}
              onChange={(event) =>
                setDraft({ ...draft, course_code: event.target.value })
              }
              placeholder="Enter course code"
              required
            />
            <GlassInput
              label="Course name"
              value={draft.course_name}
              onChange={(event) =>
                setDraft({ ...draft, course_name: event.target.value })
              }
              placeholder="Enter course name"
              required
            />
            <GlassSelect
              label="Subject"
              value={draft.subject_code}
              onChange={(event) => {
                const subject = data.subjects.find(
                  (item) => item.subject_code === event.target.value
                );
                setDraft({
                  ...draft,
                  subject_code: event.target.value,
                  course_name:
                    draft.course_name || (subject ? subject.subject_name : draft.course_name),
                  year_level: subject ? subject.year_level : draft.year_level,
                });
              }}
            >
              <option value="">No subject</option>
              {data.subjects.map((subject) => (
                <option key={subject.subject_id} value={subject.subject_code}>
                  {subject.subject_code} — {subject.subject_name}
                </option>
              ))}
            </GlassSelect>
            <GlassInput
              label="Credits"
              type="number"
              min={1}
              max={12}
              value={draft.credits}
              onChange={(event) => setDraft({ ...draft, credits: event.target.value })}
            />
            <GlassSelect
              label="Year level"
              value={draft.year_level}
              onChange={(event) =>
                setDraft({ ...draft, year_level: event.target.value })
              }
            >
              {YEAR_LEVELS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </GlassSelect>
            <GlassSelect
              label="Section"
              value={draft.section_name}
              onChange={(event) =>
                setDraft({ ...draft, section_name: event.target.value })
              }
            >
              <option value="">Unassigned</option>
              {data.sections.map((section) => (
                <option key={section.section_id} value={section.section_name}>
                  {section.section_name}
                </option>
              ))}
            </GlassSelect>
            <GlassSelect
              label="Teacher"
              value={draft.teacher_name}
              onChange={(event) =>
                setDraft({ ...draft, teacher_name: event.target.value })
              }
            >
              <option value="">Unassigned</option>
              {data.teachers.map((teacher) => (
                <option key={teacher.teacher_id} value={teacher.full_name}>
                  {teacher.full_name}
                </option>
              ))}
            </GlassSelect>
            <GlassSelect
              label="Day"
              value={draft.day}
              onChange={(event) => setDraft({ ...draft, day: event.target.value })}
            >
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </GlassSelect>
            <GlassInput
              label="Room"
              value={draft.room}
              onChange={(event) => setDraft({ ...draft, room: event.target.value })}
              placeholder="Enter room"
            />
            <GlassInput
              label="Start time"
              type="time"
              value={draft.start_time}
              onChange={(event) =>
                setDraft({ ...draft, start_time: event.target.value })
              }
              required
            />
            <GlassInput
              label="End time"
              type="time"
              value={draft.end_time}
              onChange={(event) => setDraft({ ...draft, end_time: event.target.value })}
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" className="btn-accent">
              Save changes
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
