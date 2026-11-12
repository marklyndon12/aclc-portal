import { useMemo, useState, type FormEvent } from "react";
import { Briefcase, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import { api, ApiError } from "../../lib/api";
import type { AdminDataState } from "../../data/adminSeed";
import type { AdminTeacherRow } from "../../types";

type RemoteData = Omit<AdminDataState, "version">;

interface Draft {
  username: string;
  password: string;
  full_name: string;
  department_id: string; // "" = unassigned
  specialization: string;
}

const emptyDraft: Draft = {
  username: "",
  password: "",
  full_name: "",
  department_id: "",
  specialization: "",
};

export default function ManageTeachers() {
  const { data, replaceData } = useAdminData();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [saving, setSaving] = useState(false);

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
      password: "",
      full_name: row.full_name,
      department_id: row.department_id ? String(row.department_id) : "",
      specialization: row.specialization,
    });
    setEditingId(row.teacher_id);
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = draft.username.trim();
    const fullName = draft.full_name.trim();

    if (!username || !fullName) {
      toast.error("Username and full name are required");
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

    setSaving(true);
    try {
      const payload = {
        username,
        full_name: fullName,
        department_id: draft.department_id ? Number(draft.department_id) : null,
        specialization: draft.specialization.trim(),
        ...(draft.password ? { password: draft.password } : {}),
      };
      const remote = editingId
        ? await api.patch<RemoteData>(`/api/admin/teachers/${editingId}`, payload)
        : await api.post<RemoteData>("/api/admin/teachers", payload);
      replaceData(remote);
      toast.success(editingId ? `Updated ${fullName}` : `Added ${fullName}`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save teacher");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: AdminTeacherRow) => {
    if (!window.confirm(`Delete teacher ${row.full_name}?`)) return;
    try {
      replaceData(await api.delete<RemoteData>(`/api/admin/teachers/${row.teacher_id}`));
      toast.success(`Removed ${row.full_name}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete teacher");
    }
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
            Faculty profiles, departments, and specializations. Departments are managed on
            the Departments page.
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
          <table className="w-full min-w-[680px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Name</th>
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Specialization</th>
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
                    <td className="px-4 py-3 text-gray-400">
                      {row.department || (
                        <span className="badge border-amber-400/30 bg-amber-400/10 text-amber-300">
                          Unassigned
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{row.specialization || "—"}</td>
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
                  <td colSpan={4} className="px-4 py-12 text-center">
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
            <GlassSelect
              label="Department"
              value={draft.department_id}
              onChange={(event) => setDraft({ ...draft, department_id: event.target.value })}
              hint={
                data.departments.length === 0
                  ? "No departments yet — add them on the Departments page."
                  : undefined
              }
            >
              <option value="">Unassigned</option>
              {data.departments.map((department) => (
                <option key={department.department_id} value={department.department_id}>
                  {department.department_name}
                </option>
              ))}
            </GlassSelect>
            <GlassInput
              label="Specialization"
              value={draft.specialization}
              onChange={(event) => setDraft({ ...draft, specialization: event.target.value })}
              placeholder="Enter specialization"
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
