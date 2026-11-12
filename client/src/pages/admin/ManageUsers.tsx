import { useMemo, useState, type FormEvent } from "react";
import { Pencil, Plus, Search, Trash2, Users } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import { roleLabel } from "../../lib/roles";
import type { AdminUserRow, Role } from "../../types";

interface Draft {
  username: string;
  full_name: string;
  role: Role;
  status: "Active" | "Disabled";
}

const emptyDraft: Draft = {
  username: "",
  full_name: "",
  role: "student",
  status: "Active",
};

const roleBadgeClass: Record<Role, string> = {
  admin: "border-accent/40 bg-accent/15 text-accent",
  teacher: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  student: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
};

export default function ManageUsers() {
  const { data, setData } = useAdminData();
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const rows = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.users.filter((row) => {
      const matchesRole = roleFilter === "all" || row.role === roleFilter;
      const matchesQuery =
        !term ||
        row.full_name.toLowerCase().includes(term) ||
        row.username.toLowerCase().includes(term);
      return matchesRole && matchesQuery;
    });
  }, [data.users, query, roleFilter]);

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row: AdminUserRow) => {
    setDraft({
      username: row.username,
      full_name: row.full_name,
      role: row.role,
      status: row.status,
    });
    setEditingId(row.user_id);
    setOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const username = draft.username.trim();
    const fullName = draft.full_name.trim();

    if (!username || !fullName) {
      toast.error("Username and full name are required");
      return;
    }

    const duplicate = data.users.some(
      (row) => row.username.toLowerCase() === username.toLowerCase() && row.user_id !== editingId
    );
    if (duplicate) {
      toast.error("That username is already in use");
      return;
    }

    if (editingId) {
      setData((previous) => ({
        ...previous,
        users: previous.users.map((row) =>
          row.user_id === editingId ? { ...row, ...draft, username, full_name: fullName } : row
        ),
      }));
      toast.success(`Updated @${username}`);
    } else {
      setData((previous) => ({
        ...previous,
        users: [
          { user_id: crypto.randomUUID(), ...draft, username, full_name: fullName },
          ...previous.users,
        ],
      }));
      toast.success(`Created @${username}`);
    }

    setOpen(false);
  };

  const handleDelete = (row: AdminUserRow) => {
    if (!window.confirm(`Delete account @${row.username}?`)) return;
    setData((previous) => ({
      ...previous,
      users: previous.users.filter((item) => item.user_id !== row.user_id),
    }));
    toast.success(`Removed @${row.username}`);
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">Accounts</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Manage Users</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            All portal accounts, their roles, and access status. Temporary data is stored
            locally in this browser.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-accent">
          <Plus size={16} />
          Add user
        </button>
      </section>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name or username"
            aria-label="Search users"
            className="input-glass pl-9"
          />
        </div>
        <div className="w-full sm:w-44">
          <GlassSelect
            label="Role"
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value as "all" | Role)}
          >
            <option value="all">All roles</option>
            <option value="admin">Administrator</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </GlassSelect>
        </div>
      </div>

      <div className="glass overflow-hidden bg-white/10 shadow-lg">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead>
              <tr className="border-b border-white/10 text-[11px] uppercase tracking-wider text-gray-400">
                <th className="px-4 py-3 font-semibold">User</th>
                <th className="px-4 py-3 font-semibold">Username</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.length > 0 ? (
                rows.map((row) => (
                  <tr
                    key={row.user_id}
                    className="border-b border-white/10 transition hover:bg-white/5 last:border-b-0"
                  >
                    <td className="px-4 py-3 font-medium text-gray-100">{row.full_name}</td>
                    <td className="px-4 py-3 text-gray-400">@{row.username}</td>
                    <td className="px-4 py-3">
                      <span className={clsx("badge", roleBadgeClass[row.role])}>
                        {roleLabel(row.role)}
                      </span>
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
                          aria-label={`Edit ${row.username}`}
                          title="Edit"
                          className="icon-btn"
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(row)}
                          aria-label={`Delete ${row.username}`}
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
                    <Users size={22} className="mx-auto text-gray-500" />
                    <p className="mt-2 text-sm text-gray-300">No users match your filters</p>
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
        title={editingId ? "Edit user" : "Add user"}
        description="Temporary admin data is saved in this browser."
        size="md"
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
              label="Role"
              value={draft.role}
              onChange={(event) => setDraft({ ...draft, role: event.target.value as Role })}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </GlassSelect>
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
