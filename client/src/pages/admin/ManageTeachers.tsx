import { useMemo, useState, type FormEvent } from "react";
import { Briefcase, Pencil, Plus, Search, Trash2 } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import type { AdminTeacherRow } from "../../types";

interface Draft {
  username: string;
  full_name: string;
  department: string;
  specialization: string;
  status: "Active" | "Disabled";
}

const emptyDraft: Draft = {
  username: "",
  full_name: "",
  department: "",
  specialization: "",
  status: "Active",
};

export default function ManageTeachers() {
  const { data, setData } = useAdminData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.teachers.filter(
      (row) =>
        !term ||
        row.full_name.toLowerCase().includes(term) ||
        row.department.toLowerCase().includes(term) ||
        row.specialization.toLowerCase().includes(term)
    );
  }, [data.teachers, query]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row: AdminTeacherRow) => {
    setDraft({
      username: row.username,
      full_name: row.full_name,
      department: row.department,
      specialization: row.specialization,
      status: row.status,
    });
    setEditingId(row.teacher_id);
    setOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = draft.username.trim().toLowerCase();
    const fullName = draft.full_name.trim();

    if (!username || !fullName) {
      toast.error("Username and full name are required");
      return;
    }

    const editing = data.teachers.find((row) => row.teacher_id === editingId);
    const duplicateUser = data.users.some(
      (row) =>
        row.username.toLowerCase() === username && row.user_id !== editing?.user_id
    );
    if (duplicateUser) {
      toast.error("That username is already in use");
      return;
    }

    setData((previous) => {
      if (editing) {
        return {
          ...previous,
          teachers: previous.teachers.map((row) =>
            row.teacher_id === editing.teacher_id
              ? { ...row, ...draft, username, full_name: fullName }
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
      const newTeacher: AdminTeacherRow = {
        teacher_id: Date.now(),
        user_id: userId,
        username,
        full_name: fullName,
        department: draft.department,
        specialization: draft.specialization,
        status: draft.status,
      };

      return {
        ...previous,
        teachers: [newTeacher, ...previous.teachers],
        users: [
          {
            user_id: userId,
            username,
            full_name: fullName,
            role: "teacher",
            status: draft.status,
          },
          ...previous.users,
        ],
      };
    });

    toast.success(editing ? `Updated ${fullName}` : `Added ${fullName}`);
    setOpen(false);
  };

  const handleDelete = (row: AdminTeacherRow) => {
    if (!window.confirm(`Delete teacher ${row.full_name}?`)) return;
    setData((previous) => ({
      ...previous,
      teachers: previous.teachers.filter((item) => item.teacher_id !== row.teacher_id),
      users: previous.users.filter((item) => item.user_id !== row.user_id),
    }));
    toast.success(`Removed ${row.full_name}`);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-sky-400/30 bg-sky-400/10 text-sky-300">
            Faculty records
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Manage Teachers</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Faculty profiles, departments, and specializations. Changes sync to the
            temporary user directory.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-accent">
          <Plus size={16} />
          Add teacher
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
          placeholder="Search name, department, or specialization"
          aria-label="Search teachers"
          className="input-glass pl-9"
        />
      </div>

      <div className="glass overflow-hidden bg-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Specialization</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row.teacher_id}
                    className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-100">{row.full_name}</p>
                      <p className="text-xs text-gray-500">@{row.username}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-400">{row.department || "—"}</td>
                    <td className="px-4 py-3 text-gray-400">
                      {row.specialization || "—"}
                    </td>
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
                  <td colSpan={5} className="px-4 py-12 text-center">
                    <Briefcase size={22} className="mx-auto text-gray-500" />
                    <p className="mt-2 text-sm text-gray-300">No teachers found</p>
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
        title={editingId ? "Edit teacher" : "Add teacher"}
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
              label="Department"
              value={draft.department}
              onChange={(event) =>
                setDraft({ ...draft, department: event.target.value })
              }
              placeholder="Computer Studies"
            />
            <GlassInput
              label="Specialization"
              value={draft.specialization}
              onChange={(event) =>
                setDraft({ ...draft, specialization: event.target.value })
              }
              placeholder="Enter specialization"
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
