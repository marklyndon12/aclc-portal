import { useMemo, useState, type FormEvent } from "react";
import { Check, Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import { api, ApiError } from "../../lib/api";
import type { AdminDataState } from "../../data/adminSeed";
import { roleLabel } from "../../lib/roles";
import type { AdminUserRow, Role } from "../../types";

type RemoteData = Omit<AdminDataState, "version">;

interface Draft {
  username: string;
  password: string;
  full_name: string;
  role: Role;
}

const emptyDraft: Draft = {
  username: "",
  password: "",
  full_name: "",
  role: "student",
};

const roleBadgeClass: Record<Role, string> = {
  admin: "border-accent/40 bg-accent/15 text-accent",
  teacher: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  student: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
};

export default function ManageUsers() {
  const { data, replaceData } = useAdminData();
  const [saving, setSaving] = useState(false);
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
      password: "",
      full_name: row.full_name,
      role: row.role,
    });
    setEditingId(row.user_id);
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
      const remote = editingId
        ? await api.patch<RemoteData>(`/api/admin/users/${editingId}`, {
            username,
            full_name: fullName,
            ...(draft.password ? { password: draft.password } : {}),
          })
        : await api.post<RemoteData>("/api/admin/users", {
            username,
            full_name: fullName,
            role: draft.role,
            password: draft.password,
          });
      replaceData(remote);
      toast.success(editingId ? `Updated @${username}` : `Created @${username}`);
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save user");
    } finally {
      setSaving(false);
    }
  };

  const pendingCount = data.users.filter((row) => row.status === "Pending").length;

  const decide = async (row: AdminUserRow, decision: "approve" | "reject") => {
    if (
      decision === "reject" &&
      !window.confirm(`Reject the registration of @${row.username}? They will not be able to sign in.`)
    ) {
      return;
    }
    try {
      replaceData(
        await api.patch<RemoteData>(`/api/admin/users/${row.user_id}/approval`, { decision })
      );
      toast.success(
        decision === "approve" ? `Approved @${row.username}` : `Rejected @${row.username}`
      );
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update approval");
    }
  };

  const handleDelete = async (row: AdminUserRow) => {
    if (!window.confirm(`Delete account @${row.username}?`)) return;
    try {
      replaceData(await api.delete<RemoteData>(`/api/admin/users/${row.user_id}`));
      toast.success(`Removed @${row.username}`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete user");
    }
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">Accounts</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Manage Users</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            All portal accounts, their roles, and sign-up approval. Student course and
            section are set on the Students page.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-accent">
          <Plus size={16} />
          Add user
        </button>
      </section>

      {pendingCount > 0 ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          {pendingCount} registration{pendingCount > 1 ? "s are" : " is"} waiting for your
          approval.
        </div>
      ) : null}

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
                          row.status === "Active" &&
                            "border-green-400/30 bg-green-400/10 text-green-400",
                          row.status === "Pending" &&
                            "border-amber-400/30 bg-amber-400/10 text-amber-300",
                          row.status === "Rejected" &&
                            "border-red-400/30 bg-red-400/10 text-red-300",
                          row.status === "Disabled" &&
                            "border-gray-400/30 bg-gray-400/10 text-gray-400"
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-2">
                        {row.status === "Pending" ? (
                          <>
                            <button
                              type="button"
                              onClick={() => decide(row, "approve")}
                              className="inline-flex items-center gap-1 rounded-lg border border-green-400/30 bg-green-400/10 px-2.5 py-1 text-xs font-semibold text-green-300 transition hover:bg-green-400/20"
                            >
                              <Check size={13} />
                              Approve
                            </button>
                            <button
                              type="button"
                              onClick={() => decide(row, "reject")}
                              className="inline-flex items-center gap-1 rounded-lg border border-red-400/30 bg-red-400/10 px-2.5 py-1 text-xs font-semibold text-red-300 transition hover:bg-red-400/20"
                            >
                              <X size={13} />
                              Reject
                            </button>
                          </>
                        ) : null}
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
        description="Saved to the database."
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
              disabled={Boolean(editingId)}
              hint={editingId ? "An account's role can't be changed." : undefined}
            >
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
              <option value="admin">Administrator</option>
            </GlassSelect>
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
