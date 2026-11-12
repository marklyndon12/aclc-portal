import { useState, type FormEvent } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import { api, ApiError } from "../../lib/api";
import type { AdminDataState } from "../../data/adminSeed";
import type { SectionRow } from "../../types";

type RemoteData = Omit<AdminDataState, "version">;

interface Draft {
  section_name: string;
  year_level: string;
  course_id: string;
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const emptyDraft: Draft = { section_name: "", year_level: "1st Year", course_id: "" };

export default function ManageSections() {
  const { data, replaceData } = useAdminData();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setDraft({ ...emptyDraft, course_id: String(data.courses[0]?.course_id ?? "") });
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row: SectionRow) => {
    setDraft({
      section_name: row.section_name,
      year_level: row.year_level || "1st Year",
      course_id: String(row.course_id),
    });
    setEditingId(row.section_id);
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sectionName = draft.section_name.trim();
    if (!sectionName) {
      toast.error("Section name is required");
      return;
    }
    if (!draft.course_id) {
      toast.error("Choose the course this section belongs to");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        section_name: sectionName,
        year_level: draft.year_level,
        course_id: Number(draft.course_id),
      };
      const remote = editingId
        ? await api.patch<RemoteData>(`/api/admin/sections/${editingId}`, payload)
        : await api.post<RemoteData>("/api/admin/sections", payload);
      replaceData(remote);
      toast.success(editingId ? `Updated ${sectionName}` : `Created ${sectionName}`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save section");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: SectionRow) => {
    if (!window.confirm(`Delete section ${row.section_name}?`)) return;
    try {
      replaceData(await api.delete<RemoteData>(`/api/admin/sections/${row.section_id}`));
      toast.success(`Removed ${row.section_name}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete section");
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">Class groups</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Manage Sections</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            A section belongs to one course and one year level. Deletion is blocked while
            students or classes are linked.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreate}
          disabled={data.courses.length === 0}
          title={data.courses.length === 0 ? "Add a course first" : undefined}
          className="btn-accent"
        >
          <Plus size={16} />
          Add section
        </button>
      </section>

      {data.courses.length === 0 ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Add a course (for example BSIT) before creating sections.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.sections.map((row) => (
          <div key={row.section_id} className="glass glass-hover bg-white/10 p-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
                  <Layers size={18} />
                </span>
                <div>
                  <p className="text-base font-semibold text-gray-100">{row.section_name}</p>
                  <p className="text-xs text-gray-400">
                    {row.course_code} · {row.year_level || "No year"}
                  </p>
                </div>
              </div>
              <div className="flex gap-1.5">
                <button
                  type="button"
                  onClick={() => openEdit(row)}
                  aria-label={`Edit ${row.section_name}`}
                  title="Edit"
                  className="icon-btn"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(row)}
                  aria-label={`Delete ${row.section_name}`}
                  title="Delete"
                  className="icon-btn hover:border-red-400/40 hover:bg-red-500/20 hover:text-red-300"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-xs">
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <dt className="text-gray-500">Students</dt>
                <dd className="text-base font-semibold text-gray-100">{row.student_count}</dd>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                <dt className="text-gray-500">Classes</dt>
                <dd className="text-base font-semibold text-gray-100">{row.class_count}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit section" : "Add section"}
        description="Renaming a section updates its students too."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <GlassInput
            label="Section name"
            value={draft.section_name}
            onChange={(event) => setDraft({ ...draft, section_name: event.target.value })}
            placeholder="BSIT-1A"
            required
          />
          <GlassSelect
            label="Course"
            value={draft.course_id}
            onChange={(event) => setDraft({ ...draft, course_id: event.target.value })}
            required
          >
            <option value="">Select a course</option>
            {data.courses.map((course) => (
              <option key={course.course_id} value={course.course_id}>
                {course.course_code} — {course.course_name}
              </option>
            ))}
          </GlassSelect>
          <GlassSelect
            label="Year level"
            value={draft.year_level}
            onChange={(event) => setDraft({ ...draft, year_level: event.target.value })}
          >
            {YEAR_LEVELS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </GlassSelect>
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
