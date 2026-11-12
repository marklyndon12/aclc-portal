import { useMemo, useState, type FormEvent } from "react";
import { GraduationCap, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import { api, ApiError } from "../../lib/api";
import type { AdminDataState } from "../../data/adminSeed";
import type { Course } from "../../types";

type RemoteData = Omit<AdminDataState, "version">;

interface Draft {
  course_code: string;
  course_name: string;
}

const emptyDraft: Draft = { course_code: "", course_name: "" };

export default function ManageCourses() {
  const { data, replaceData } = useAdminData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.courses.filter(
      (course) =>
        !term ||
        course.course_code.toLowerCase().includes(term) ||
        course.course_name.toLowerCase().includes(term)
    );
  }, [data.courses, query]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (course: Course) => {
    setDraft({ course_code: course.course_code, course_name: course.course_name });
    setEditingId(course.course_id);
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = draft.course_code.trim();
    const name = draft.course_name.trim();
    if (!code || !name) {
      toast.error("Course code and name are required");
      return;
    }

    setSaving(true);
    try {
      const payload = { course_code: code, course_name: name };
      const remote = editingId
        ? await api.patch<RemoteData>(`/api/admin/courses/${editingId}`, payload)
        : await api.post<RemoteData>("/api/admin/courses", payload);
      replaceData(remote);
      toast.success(editingId ? `Updated ${code.toUpperCase()}` : `Added ${code.toUpperCase()}`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save course");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (course: Course) => {
    if (!window.confirm(`Delete course ${course.course_code}?`)) return;
    try {
      replaceData(await api.delete<RemoteData>(`/api/admin/courses/${course.course_id}`));
      toast.success(`Removed ${course.course_code}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete course");
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">Programs</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Manage Courses</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            The degree programs you offer, such as BSIT or BSHM. Sections and subjects
            belong to a course. Delete is blocked while any are linked.
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
          placeholder="Search code or course name"
          aria-label="Search courses"
          className="input-glass pl-9"
        />
      </div>

      <div className="glass overflow-hidden bg-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Course</th>
                <th className="px-4 py-3 font-semibold">Sections</th>
                <th className="px-4 py-3 font-semibold">Subjects</th>
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
                    <td className="px-4 py-3 font-semibold text-accent">{course.course_code}</td>
                    <td className="px-4 py-3 font-medium text-gray-100">{course.course_name}</td>
                    <td className="px-4 py-3 text-gray-400">{course.section_count}</td>
                    <td className="px-4 py-3 text-gray-400">{course.subject_count}</td>
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
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <GraduationCap size={22} className="mx-auto text-gray-500" />
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
        description="A degree program, for example BSIT — Bachelor of Science in Information Technology."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <GlassInput
            label="Course code"
            value={draft.course_code}
            onChange={(event) => setDraft({ ...draft, course_code: event.target.value })}
            placeholder="BSIT"
            required
          />
          <GlassInput
            label="Course name"
            value={draft.course_name}
            onChange={(event) => setDraft({ ...draft, course_name: event.target.value })}
            placeholder="Bachelor of Science in Information Technology"
            required
          />
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
