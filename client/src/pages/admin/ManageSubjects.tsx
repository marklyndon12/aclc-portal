import { useState, type FormEvent } from "react";
import { BookOpen, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import type { SubjectRow } from "../../types";

interface Draft {
  subject_code: string;
  subject_name: string;
  units: string;
  year_level: string;
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const emptyDraft: Draft = {
  subject_code: "",
  subject_name: "",
  units: "3",
  year_level: "1st Year",
};

export default function ManageSubjects() {
  const { data, setData } = useAdminData();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row: SubjectRow) => {
    setDraft({
      subject_code: row.subject_code,
      subject_name: row.subject_name,
      units: String(row.units),
      year_level: row.year_level,
    });
    setEditingId(row.subject_id);
    setOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const code = draft.subject_code.trim();
    const name = draft.subject_name.trim();
    const units = Number(draft.units);

    if (!code || !name) {
      toast.error("Subject code and name are required");
      return;
    }
    if (!Number.isFinite(units) || units <= 0) {
      toast.error("Units must be a positive number");
      return;
    }

    const duplicate = data.subjects.some(
      (row) =>
        row.subject_code.toLowerCase() === code.toLowerCase() &&
        row.subject_id !== editingId
    );
    if (duplicate) {
      toast.error("That subject code already exists");
      return;
    }

    setData((previous) => {
      if (editingId) {
        return {
          ...previous,
          subjects: previous.subjects.map((row) =>
            row.subject_id === editingId
              ? {
                  ...row,
                  subject_code: code,
                  subject_name: name,
                  units,
                  year_level: draft.year_level,
                }
              : row
          ),
        };
      }

      const newSubject: SubjectRow = {
        subject_id: Date.now(),
        subject_code: code,
        subject_name: name,
        units,
        year_level: draft.year_level,
      };

      return { ...previous, subjects: [newSubject, ...previous.subjects] };
    });

    toast.success(editingId ? `Updated ${code}` : `Created ${code}`);
    setOpen(false);
  };

  const handleDelete = (row: SubjectRow) => {
    const linked = data.courses.filter(
      (course) => course.subject_code === row.subject_code
    ).length;
    if (linked > 0) {
      toast.error(`Cannot delete ${row.subject_code}: ${linked} course(s) use it`);
      return;
    }
    if (!window.confirm(`Delete subject ${row.subject_code}?`)) return;
    setData((previous) => ({
      ...previous,
      subjects: previous.subjects.filter((item) => item.subject_id !== row.subject_id),
    }));
    toast.success(`Removed ${row.subject_code}`);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">
            Catalog
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Manage Subjects</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Subject catalog used by course offerings. Delete is blocked while courses
            reference a subject.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-accent">
          <Plus size={16} />
          Add subject
        </button>
      </section>

      <div className="glass overflow-hidden bg-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Code</th>
                <th className="px-4 py-3 font-semibold">Subject</th>
                <th className="px-4 py-3 font-semibold">Units</th>
                <th className="px-4 py-3 font-semibold">Year level</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.subjects.length > 0 ? (
                data.subjects.map((row) => (
                  <tr
                    key={row.subject_id}
                    className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-semibold text-accent">
                      {row.subject_code}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-100">
                      {row.subject_name}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{row.units}</td>
                    <td className="px-4 py-3 text-gray-400">{row.year_level}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          aria-label={`Edit ${row.subject_code}`}
                          title="Edit"
                          className="icon-btn"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          aria-label={`Delete ${row.subject_code}`}
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
                    <BookOpen size={22} className="mx-auto text-gray-500" />
                    <p className="mt-2 text-sm text-gray-300">No subjects yet</p>
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
        title={editingId ? "Edit subject" : "Add subject"}
        description="Temporary admin data is saved in this browser."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassInput
              label="Subject code"
              value={draft.subject_code}
              onChange={(event) =>
                setDraft({ ...draft, subject_code: event.target.value })
              }
              placeholder="Enter subject code"
              required
            />
            <GlassInput
              label="Units"
              type="number"
              min={1}
              max={12}
              value={draft.units}
              onChange={(event) => setDraft({ ...draft, units: event.target.value })}
              required
            />
            <div className="sm:col-span-2">
              <GlassInput
                label="Subject name"
                value={draft.subject_name}
                onChange={(event) =>
                  setDraft({ ...draft, subject_name: event.target.value })
                }
                placeholder="Enter subject name"
                required
              />
            </div>
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
