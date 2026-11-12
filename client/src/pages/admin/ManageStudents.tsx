import { useMemo, useState, type FormEvent } from "react";
import { GraduationCap, Pencil, Plus, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import type { AdminStudentRow } from "../../types";

interface Draft {
  username: string;
  full_name: string;
  student_number: string;
  year_level: string;
  section: string;
  course_year: string;
  status: "Active" | "Disabled";
}

const YEAR_LEVELS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

const emptyDraft: Draft = {
  username: "",
  full_name: "",
  student_number: "",
  year_level: "1st Year",
  section: "Unassigned",
  course_year: "",
  status: "Active",
};

export default function ManageStudents() {
  const { data, setData } = useAdminData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const sectionOptions = useMemo(
    () => ["Unassigned", ...data.sections.map((section) => section.section_name)],
    [data.sections]
  );

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.students.filter(
      (row) =>
        !term ||
        row.full_name.toLowerCase().includes(term) ||
        row.student_number.toLowerCase().includes(term) ||
        row.section.toLowerCase().includes(term)
    );
  }, [data.students, query]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row: AdminStudentRow) => {
    setDraft({
      username: row.username,
      full_name: row.full_name,
      student_number: row.student_number,
      year_level: row.year_level,
      section: row.section,
      course_year: row.course_year,
      status: row.status,
    });
    setEditingId(row.student_id);
    setOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = draft.username.trim().toLowerCase();
    const fullName = draft.full_name.trim();
    const studentNumber = draft.student_number.trim();

    if (!username || !fullName || !studentNumber) {
      toast.error("Username, full name, and student number are required");
      return;
    }

    const editing = data.students.find((row) => row.student_id === editingId);
    const duplicateUser = data.users.some(
      (row) =>
        row.username.toLowerCase() === username && row.user_id !== editing?.user_id
    );
    if (duplicateUser) {
      toast.error("That username is already in use");
      return;
    }

    const duplicateNumber = data.students.some(
      (row) =>
        row.student_number.toLowerCase() === studentNumber.toLowerCase() &&
        row.student_id !== editingId
    );
    if (duplicateNumber) {
      toast.error("That student number is already in use");
      return;
    }

    setData((previous) => {
      if (editing) {
        return {
          ...previous,
          students: previous.students.map((row) =>
            row.student_id === editing.student_id
              ? {
                  ...row,
                  ...draft,
                  username,
                  full_name: fullName,
                  student_number: studentNumber,
                }
              : row
          ),
          users: previous.users.map((row) =>
            row.user_id === editing.user_id
              ? { ...row, username, full_name: fullName, status: draft.status }
              : row
          ),
        };
      }

      const userId = crypto.randomUUID();
      const newStudent: AdminStudentRow = {
        student_id: Date.now(),
        user_id: userId,
        username,
        full_name: fullName,
        student_number: studentNumber,
        year_level: draft.year_level,
        section: draft.section,
        course_year: draft.course_year,
        status: draft.status,
      };

      return {
        ...previous,
        students: [newStudent, ...previous.students],
        users: [
          {
            user_id: userId,
            username,
            full_name: fullName,
            role: "student",
            status: draft.status,
          },
          ...previous.users,
        ],
      };
    });

    toast.success(editing ? `Updated ${fullName}` : `Added ${fullName}`);
    setOpen(false);
  };

  const handleDelete = (row: AdminStudentRow) => {
    if (!window.confirm(`Delete student ${row.full_name}?`)) return;
    setData((previous) => ({
      ...previous,
      students: previous.students.filter((item) => item.student_id !== row.student_id),
      users: previous.users.filter((item) => item.user_id !== row.user_id),
      grades: previous.grades.filter((item) => item.student_id !== row.student_id),
      attendance: previous.attendance.filter(
        (item) => item.student_id !== row.student_id
      ),
    }));
    toast.success(`Removed ${row.full_name}`);
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
            Maintain student profiles and section assignments. Changes sync to the
            temporary user directory.
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
          placeholder="Search name, student number, or section"
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
                <th className="px-4 py-3 font-semibold">Year</th>
                <th className="px-4 py-3 font-semibold">Section</th>
                <th className="px-4 py-3 font-semibold">Status</th>
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
                    <td className="px-4 py-3 text-gray-400">{row.year_level}</td>
                    <td className="px-4 py-3 text-gray-400">{row.section}</td>
                    <td className="px-4 py-3">
                      <span
                        className={clsx(
                          "badge",
                          row.status === "Active"
                            ? "border-green-400/30 bg-green-400/10 text-green-400"
                            : "border-gray-400/30 bg-gray-400/10 text-gray-400"
                        )}
                      >
                        {row.status}
                      </span>
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
        description="Temporary admin data is saved in this browser."
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
              onChange={(event) =>
                setDraft({ ...draft, student_number: event.target.value })
              }
              placeholder="Enter student number"
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
              label="Section"
              value={draft.section}
              onChange={(event) => setDraft({ ...draft, section: event.target.value })}
            >
              {sectionOptions.map((section) => (
                <option key={section} value={section}>
                  {section}
                </option>
              ))}
            </GlassSelect>
            <GlassInput
              label="Course / program"
              value={draft.course_year}
              onChange={(event) =>
                setDraft({ ...draft, course_year: event.target.value })
              }
              placeholder="Enter course year"
            />
            <GlassSelect
              label="Status"
              value={draft.status}
              onChange={(event) =>
                setDraft({ ...draft, status: event.target.value as Draft["status"] })
              }
            >
              <option value="Active">Active</option>
              <option value="Disabled">Disabled</option>
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
