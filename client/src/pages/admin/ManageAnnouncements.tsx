import { useMemo, useState, type FormEvent } from "react";
import { Megaphone, Pencil, Plus, Trash2 } from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect, GlassTextarea } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import type { AnnouncementAudience, AnnouncementRow } from "../../types";

interface Draft {
  title: string;
  body: string;
  audience: AnnouncementAudience;
}

const emptyDraft: Draft = {
  title: "",
  body: "",
  audience: "Everyone",
};

const audienceClass: Record<AnnouncementAudience, string> = {
  Everyone: "border-accent/40 bg-accent/15 text-accent",
  Students: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Teachers: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

export default function ManageAnnouncements() {
  const { data, setData } = useAdminData();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [draft, setDraft] = useState<Draft>(emptyDraft);

  const rows = useMemo(
    () => [...data.announcements].sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [data.announcements]
  );

  const openCreate = () => {
    setDraft(emptyDraft);
    setEditingId(null);
    setOpen(true);
  };

  const openEdit = (row: AnnouncementRow) => {
    setDraft({ title: row.title, body: row.body, audience: row.audience });
    setEditingId(row.announcement_id);
    setOpen(true);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const title = draft.title.trim();
    const body = draft.body.trim();

    if (!title || !body) {
      toast.error("Title and message are required");
      return;
    }

    setData((previous) => {
      if (editingId) {
        return {
          ...previous,
          announcements: previous.announcements.map((row) =>
            row.announcement_id === editingId ? { ...row, ...draft, title, body } : row
          ),
        };
      }

      const newRow: AnnouncementRow = {
        announcement_id: Date.now(),
        title,
        body,
        audience: draft.audience,
        created_at: new Date().toISOString(),
      };

      return { ...previous, announcements: [newRow, ...previous.announcements] };
    });

    toast.success(editingId ? "Announcement updated" : "Announcement published");
    setOpen(false);
  };

  const handleDelete = (row: AnnouncementRow) => {
    if (!window.confirm(`Delete announcement "${row.title}"?`)) return;
    setData((previous) => ({
      ...previous,
      announcements: previous.announcements.filter(
        (item) => item.announcement_id !== row.announcement_id
      ),
    }));
    toast.success("Announcement removed");
  };

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">
            Campus notices
          </span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Announcements</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Publish notices for everyone, students, or faculty. Nothing is pre-filled —
            add your own announcement when ready.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-accent">
          <Plus size={16} />
          New announcement
        </button>
      </section>

      {rows.length > 0 ? (
        <div className="space-y-3">
          {rows.map((row) => (
            <article key={row.announcement_id} className="glass bg-white/10 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-base font-semibold text-gray-100">{row.title}</h2>
                    <span className={clsx("badge", audienceClass[row.audience])}>
                      {row.audience}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-gray-500">
                    {new Date(row.created_at).toLocaleString()}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    aria-label={`Edit ${row.title}`}
                    title="Edit"
                    className="icon-btn"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(row)}
                    aria-label={`Delete ${row.title}`}
                    title="Delete"
                    className="icon-btn hover:border-red-400/40 hover:bg-red-500/20 hover:text-red-300"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-300">
                {row.body}
              </p>
            </article>
          ))}
        </div>
      ) : (
        <div className="glass grid place-items-center bg-white/10 px-6 py-16 text-center">
          <Megaphone size={26} className="text-gray-500" />
          <h2 className="mt-3 text-base font-semibold text-gray-200">
            No announcements yet
          </h2>
          <p className="mt-1 max-w-sm text-sm text-gray-400">
            Create the first notice for the campus. It will also appear on the admin
            dashboard.
          </p>
          <button type="button" onClick={openCreate} className="btn-accent mt-4">
            <Plus size={16} />
            New announcement
          </button>
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId ? "Edit announcement" : "New announcement"}
        description="Published notices are stored in this browser for the temporary preview."
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <GlassInput
            label="Title"
            value={draft.title}
            onChange={(event) => setDraft({ ...draft, title: event.target.value })}
            placeholder="Enter announcement title"
            required
          />
          <GlassSelect
            label="Audience"
            value={draft.audience}
            onChange={(event) =>
              setDraft({
                ...draft,
                audience: event.target.value as AnnouncementAudience,
              })
            }
          >
            <option value="Everyone">Everyone</option>
            <option value="Students">Students</option>
            <option value="Teachers">Teachers</option>
          </GlassSelect>
          <GlassTextarea
            label="Message"
            rows={6}
            value={draft.body}
            onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            placeholder="Write the announcement details..."
            required
          />
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setOpen(false)} className="btn-glass">
              Cancel
            </button>
            <button type="submit" className="btn-accent">
              {editingId ? "Save changes" : "Publish"}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
