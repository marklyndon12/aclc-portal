import { useState, type FormEvent } from "react";
import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import type { SectionRow } from "../../types";

interface Draft {
  section_name: string;
  year_level: string;
  adviser: string;
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const emptyDraft: Draft = {
  section_name: "",
  year_level: "1st Year",
  adviser: "",
};

export default function ManageSections() {
  const { data, setData } = useAdminData();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const adviserOptions = data.teachers.map((teacher) => teacher.full_name);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row: SectionRow) => {
    setDraft({
      section_name: row.section_name,
      year_level: row.year_level,
      adviser: row.adviser,
    });
    setEditingId(row.section_id);
    setOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const sectionName = draft.section_name.trim();
    if (!sectionName) {
      toast.error("Section name is required");
      return;
    }

    const duplicate = data.sections.some(
      (row) =>
        row.section_name.toLowerCase() === sectionName.toLowerCase() &&
        row.section_id !== editingId
    );
    if (duplicate) {
      toast.error("That section already exists");
      return;
    }

    const editing = data.sections.find((row) => row.section_id === editingId);
    const oldName = editing?.section_name;

    setData((previous) => {
      if (editing) {
        return {
          ...previous,
          sections: previous.sections.map((row) =>
            row.section_id === editing.section_id
              ? { ...row, ...draft, section_name: sectionName }
              : row
          ),
          students: previous.students.map((row) =>
            row.section === oldName ? { ...row, section: sectionName } : row
          ),
          courses: previous.courses.map((row) =>
            row.section_name === oldName ? { ...row, section_name: sectionName } : row
          ),
        };
      }

      const newSection: SectionRow = {
        section_id: Date.now(),
        section_name: sectionName,
        year_level: draft.year_level,
        adviser: draft.adviser,
        student_count: 0,
      };

      return { ...previous, sections: [newSection, ...previous.sections] };
    });

    toast.success(editing ? `Updated ${sectionName}` : `Created ${sectionName}`);
    setOpen(false);
  };

  const handleDelete = (row: SectionRow) => {
    const studentCount = data.students.filter(
      (student) => student.section === row.section_name
    ).length;
    const courseCount = data.courses.filter(
      (course) => course.section_name === row.section_name
    ).length;

    if (studentCount > 0 || courseCount > 0) {
      toast.error(
        `Cannot delete ${row.section_name}: ${studentCount} student(s) and ${courseCount} course(s) are linked`
      );
      return;
    }

    if (!window.confirm(`Delete section ${row.section_name}?`)) return;
    setData((previous) => ({
      ...previous,
      sections: previous.sections.filter((item) => item.section_id !== row.section_id),
    }));
    toast.success(`Removed ${row.section_name}`);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">
            Class groups
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Manage Sections</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Sections link students, courses, and faculty advisers. Deletion is blocked
            while dependents exist.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-accent">
          <Plus size={16} />
          Add section
        </button>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {data.sections.map((row) => {
          const studentCount = data.students.filter(
            (student) => student.section === row.section_name
          ).length;
          const courseCount = data.courses.filter(
            (course) => course.section_name === row.section_name
          ).length;

          return (
            <div key={row.section_id} className="glass glass-hover bg-white/10 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
                    <Layers size={18} />
                  </span>
                  <div>
                    <p className="text-base font-semibold text-gray-100">
                      {row.section_name}
                    </p>
                    <p className="text-xs text-gray-400">{row.year_level}</p>
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
                  <dd className="text-base font-semibold text-gray-100">{studentCount}</dd>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 px-3 py-2">
                  <dt className="text-gray-500">Courses</dt>
                  <dd className="text-base font-semibold text-gray-100">{courseCount}</dd>
                </div>
              </dl>

              <p className="mt-3 text-xs text-gray-400">
                Adviser:{" "}
                <span className="text-gray-200">{row.adviser || "Unassigned"}</span>
              </p>
            </div>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit section" : "Add section"}
        description="Renaming a section updates linked student and course records."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <GlassInput
            label="Section name"
            value={draft.section_name}
            onChange={(event) =>
              setDraft({ ...draft, section_name: event.target.value })
            }
            placeholder="Enter section name"
            required
          />
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
          <GlassSelect
            label="Adviser"
            value={draft.adviser}
            onChange={(event) => setDraft({ ...draft, adviser: event.target.value })}
          >
            <option value="">Unassigned</option>
            {adviserOptions.map((teacher) => (
              <option key={teacher} value={teacher}>
                {teacher}
              </option>
            ))}
          </GlassSelect>
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
