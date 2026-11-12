import { useState, type FormEvent } from "react";
import { Building2, Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import { api, ApiError } from "../../lib/api";
import type { AdminDataState } from "../../data/adminSeed";
import type { DepartmentRow } from "../../types";

type RemoteData = Omit<AdminDataState, "version">;

export default function ManageDepartments() {
  const { data, replaceData } = useAdminData();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setName("");
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row: DepartmentRow) => {
    setName(row.department_name);
    setEditingId(row.department_id);
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      toast.error("Enter a department name");
      return;
    }

    setSaving(true);
    try {
      const payload = { department_name: trimmed };
      const remote = editingId
        ? await api.patch<RemoteData>(`/api/admin/departments/${editingId}`, payload)
        : await api.post<RemoteData>("/api/admin/departments", payload);
      replaceData(remote);
      toast.success(editingId ? `Updated ${trimmed}` : `Added ${trimmed}`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save department");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (row: DepartmentRow) => {
    if (!window.confirm(`Delete department ${row.department_name}?`)) return;
    try {
      replaceData(await api.delete<RemoteData>(`/api/admin/departments/${row.department_id}`));
      toast.success(`Removed ${row.department_name}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete department");
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-sky-400/30 bg-sky-400/10 text-sky-300">Faculty</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Manage Departments</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            The departments faculty can choose when they register. Delete is blocked while
            teachers belong to a department.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-accent">
          <Plus size={16} />
          Add department
        </button>
      </section>

      <div className="glass overflow-hidden bg-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[480px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">Department</th>
                <th className="px-4 py-3 font-semibold">Teachers</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.departments.length > 0 ? (
                data.departments.map((row) => (
                  <tr
                    key={row.department_id}
                    className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium text-gray-100">{row.department_name}</td>
                    <td className="px-4 py-3 text-gray-400">{row.teacher_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => openEdit(row)}
                          aria-label={`Edit ${row.department_name}`}
                          title="Edit"
                          className="icon-btn"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          aria-label={`Delete ${row.department_name}`}
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
                  <td colSpan={3} className="px-4 py-12 text-center">
                    <Building2 size={22} className="mx-auto text-gray-500" />
                    <p className="mt-2 text-sm text-gray-300">No departments yet</p>
                    <p className="mt-1 text-xs text-gray-500">
                      Add one so faculty can choose it when they register.
                    </p>
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
        title={editingId ? "Edit department" : "Add department"}
        description="Renaming a department updates it for every teacher in it."
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <GlassInput
            label="Department name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="IT Department"
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
