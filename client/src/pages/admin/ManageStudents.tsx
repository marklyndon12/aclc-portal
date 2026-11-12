import { useMemo, useState, type FormEvent } from "react";
import { GraduationCap, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import { api, ApiError } from "../../lib/api";
import type { AdminDataState } from "../../data/adminSeed";
import type { AdminStudentRow } from "../../types";

type RemoteData = Omit<AdminDataState, "version">;

interface Draft {
  username: string;
  password: string;
  full_name: string;
  student_number: string;
  course_id: string; // "" = no course yet
  section: string; // "Unassigned" or a section name
  year_level: string;
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const emptyDraft: Draft = {
  username: "",
  password: "",
  full_name: "",
  student_number: "",
  course_id: "",
  section: "Unassigned",
  year_level: "1st Year",
};

export default function ManageStudents() {
  const { data, replaceData } = useAdminData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  // Sections of the chosen course only
  const sectionOptions = useMemo(
    () =>
      draft.course_id
        ? data.sections.filter((section) => String(section.course_id) === draft.course_id)
        : [],
    [data.sections, draft.course_id]
  );
  const chosenSection = data.sections.find((section) => section.section_name === draft.section);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.students.filter(
      (row) =>
        !term ||
        row.full_name.toLowerCase().includes(term) ||
        row.student_number.toLowerCase().includes(term) ||
        row.section.toLowerCase().includes(term) ||
        row.course_year.toLowerCase().includes(term)
    );
  }, [data.students, query]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row: AdminStudentRow) => {
    const section = data.sections.find((item) => item.section_name === row.section);
    const course =
      data.courses.find((item) => item.course_code === row.course_year) ??
      data.courses.find((item) => item.course_id === section?.course_id);
    setDraft({
      username: row.username,
      password: "",
      full_name: row.full_name,
      student_number: row.student_number,
      course_id: course ? String(course.course_id) : "",
      section: row.section,
      year_level: row.year_level,
    });
    setEditingId(row.student_id);
    setOpen(true);
  };

  const changeCourse = (courseId: string) => {
    const stillFits = data.sections.some(
      (section) =>
        section.section_name === draft.section && String(section.course_id) === courseId
    );
    setDraft({ ...draft, course_id: courseId, section: stillFits ? draft.section : "Unassigned" });
  };

  const changeSection = (sectionName: string) => {
    const section = data.sections.find((item) => item.section_name === sectionName);
    setDraft({
      ...draft,
      section: sectionName,
      year_level: section?.year_level || draft.year_level,
    });
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = draft.username.trim();
    const fullName = draft.full_name.trim();
    const studentNumber = draft.student_number.trim();

    if (!username || !fullName || !studentNumber) {
      toast.error("Username, full name, and student number are required");
      return;
    }
    if (!editingId && draft.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    if (editingId && draft.password && draft.password.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }

    const course = data.courses.find((item) => String(item.course_id) === draft.course_id);

    setSaving(true);
    try {
      const payload = {
        username,
        full_name: fullName,
        student_number: studentNumber,
        year_level: draft.year_level,
        section: draft.section,
        course_year: course?.course_code ?? "",
        ...(draft.password ? { password: draft.password } : {}),
      };
      const remote = editingId
        ? await api.patch<RemoteData>(`/api/admin/students/${editingId}`, payload)
        : await api.post<RemoteData>("/api/admin/students", payload);
      replaceData(remote);
      toast.success(editingId ? `Updated ${fullName}` : `Added ${fullName}`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save student");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: AdminStudentRow) => {
    if (!window.confirm(`Delete student ${row.full_name}?`)) return;
    try {
      replaceData(await api.delete<RemoteData>(`/api/admin/students/${row.student_id}`));
      toast.success(`Removed ${row.full_name}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete student");
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
            Student records
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Manage Students</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            A student&apos;s course and year come from their section. Pick the course first,
            then one of its sections.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-accent">
          <Plus size={16} />
          Add student
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
          placeholder="Search name, student number, course, or section"
          aria-label="Search students"
          className="input-glass pl-9"
        />
      </div>

      <div className="glass overflow-hidden bg-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Student number</th>
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Year</th>
                <th className="px-4 py-3 font-semibold">Section</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row.student_id}
                    className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-mono text-xs text-accent">
                      {row.student_number}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-100">{row.full_name}</p>
                      <p className="text-xs text-gray-500">@{row.username}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">
                      {row.course_year && row.course_year !== "N/A" ? row.course_year : "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{row.year_level}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {row.section === "Unassigned" ? (
                        <span className="badge border-amber-400/30 bg-amber-400/10 text-amber-300">
                          Unassigned
                        </span>
                      ) : (
                        row.section
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          aria-label={`Edit ${row.full_name}`}
                          title="Edit"
                          className="icon-btn"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          aria-label={`Delete ${row.full_name}`}
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
                  <td colSpan={6} className="px-4 py-12 text-center">
                    <GraduationCap size={22} className="mx-auto text-gray-500" />
                    <p className="mt-2 text-sm text-gray-300">No students found</p>
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
        title={editingId ? "Edit student" : "Add student"}
        description="Saved to the database."
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassInput
              label="Username"
              value={draft.username}
              onChange={(event) => setDraft({ ...draft, username: event.target.value })}
              placeholder="Enter username"
              autoComplete="off"
              required
            />
            <GlassInput
              label="Full name"
              value={draft.full_name}
              onChange={(event) => setDraft({ ...draft, full_name: event.target.value })}
              placeholder="Enter full name"
              required
            />
            <GlassInput
              label="Student number"
              value={draft.student_number}
              onChange={(event) => setDraft({ ...draft, student_number: event.target.value })}
              placeholder="Enter student number"
              required
            />
            <GlassInput
              label={editingId ? "New password" : "Password"}
              type="password"
              value={draft.password}
              onChange={(event) => setDraft({ ...draft, password: event.target.value })}
              placeholder={editingId ? "Leave blank to keep the current one" : "At least 8 characters"}
              autoComplete="new-password"
              required={!editingId}
            />
            <GlassSelect
              label="Course"
              value={draft.course_id}
              onChange={(event) => changeCourse(event.target.value)}
              hint={data.courses.length === 0 ? "No courses yet — add them on the Courses page." : undefined}
            >
              <option value="">No course yet</option>
              {data.courses.map((course) => (
                <option key={course.course_id} value={course.course_id}>
                  {course.course_code} — {course.course_name}
                </option>
              ))}
            </GlassSelect>
            <GlassSelect
              label="Section"
              value={draft.section}
              onChange={(event) => changeSection(event.target.value)}
              disabled={!draft.course_id}
              hint={!draft.course_id ? "Choose a course first." : undefined}
            >
              <option value="Unassigned">Unassigned</option>
              {sectionOptions.map((section) => (
                <option key={section.section_id} value={section.section_name}>
                  {section.section_name} — {section.year_level}
                </option>
              ))}
            </GlassSelect>
            <GlassSelect
              label="Year level"
              value={draft.year_level}
              onChange={(event) => setDraft({ ...draft, year_level: event.target.value })}
              disabled={Boolean(chosenSection)}
              hint={chosenSection ? "Set by the section." : undefined}
            >
              {YEAR_LEVELS.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </GlassSelect>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="btn-accent">
              {saving ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
