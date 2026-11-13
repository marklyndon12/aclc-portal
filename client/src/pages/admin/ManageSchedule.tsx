import { useMemo, useState, type FormEvent } from "react";
import {
  AlertTriangle,
  CalendarDays,
  CalendarPlus,
  Clock,
  Layers,
  MapPin,
  Pencil,
  Plus,
  Trash2,
  User,
  X,
} from "lucide-react";
import { toast } from "sonner";
import Modal from "../../components/Modal";
import { GlassInput, GlassSelect } from "../../components/ui/FormControls";
import { useAdminData } from "../../context/AdminDataContext";
import { api, ApiError } from "../../lib/api";
import type { AdminDataState } from "../../data/adminSeed";
import type { ClassRow } from "../../types";

type RemoteData = Omit<AdminDataState, "version">;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

interface Form {
  class_id: number | null; // null = creating a new class
  section_id: string;
  subject_id: string;
  teacher_id: string;
  day: string;
  start_time: string;
  end_time: string;
  room: string;
}

const emptyForm: Form = {
  class_id: null,
  section_id: "",
  subject_id: "",
  teacher_id: "",
  day: "Monday",
  start_time: "",
  end_time: "",
  room: "",
};

const isScheduled = (item: ClassRow) => Boolean(item.day && item.start_time && item.end_time);

interface Meeting {
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  section_id: number;
  teacher_id: number | null;
  room: string | null;
}

// Two meetings clash when they overlap in time on the same day AND share the
// teacher, the section, or the room.
function clashReasons(a: Meeting, b: Meeting): string[] {
  if (!a.day || a.day !== b.day) return [];
  if (!a.start_time || !a.end_time || !b.start_time || !b.end_time) return [];
  if (!(a.start_time < b.end_time && a.end_time > b.start_time)) return [];
  const reasons: string[] = [];
  if (a.teacher_id !== null && a.teacher_id === b.teacher_id) reasons.push("teacher");
  if (a.section_id === b.section_id) reasons.push("section");
  if (a.room && b.room && a.room.trim().toLowerCase() === b.room.trim().toLowerCase()) {
    reasons.push("room");
  }
  return reasons;
}

export default function ManageSchedule() {
  const { data, replaceData } = useAdminData();
  const [sectionFilter, setSectionFilter] = useState("all");
  const [teacherFilter, setTeacherFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<Form>(emptyForm);
  const [saving, setSaving] = useState(false);

  const scheduled = useMemo(() => data.classes.filter(isScheduled), [data.classes]);
  const unscheduled = useMemo(
    () => data.classes.filter((item) => !isScheduled(item)),
    [data.classes]
  );

  const visible = useMemo(
    () =>
      scheduled
        .filter((item) => sectionFilter === "all" || String(item.section_id) === sectionFilter)
        .filter((item) => teacherFilter === "all" || String(item.teacher_id) === teacherFilter)
        .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? "")),
    [scheduled, sectionFilter, teacherFilter]
  );

  const conflicts = useMemo(() => {
    const found: string[] = [];
    for (let i = 0; i < scheduled.length; i += 1) {
      for (let j = i + 1; j < scheduled.length; j += 1) {
        const reasons = clashReasons(scheduled[i], scheduled[j]);
        if (reasons.length > 0) {
          found.push(
            `${scheduled[i].subject_code} (${scheduled[i].section_name}) ↔ ${scheduled[j].subject_code} (${scheduled[j].section_name}) · ${scheduled[i].day} · same ${reasons.join(", ")}`
          );
        }
      }
    }
    return found;
  }, [scheduled]);

  const editing = form.class_id !== null;
  const section = data.sections.find((item) => String(item.section_id) === form.section_id);

  // Only subjects that fit the chosen section: same year, same course or general.
  // Every subject that fits the section; the ones it already has are shown but can't be picked again.
  const { subjectOptions, takenSubjects } = useMemo(() => {
    if (!section) return { subjectOptions: [], takenSubjects: new Set<number>() };
    const taken = new Set(
      data.classes.filter((item) => item.section_id === section.section_id).map((item) => item.subject_id)
    );
    const fitting = data.subjects.filter(
      (subject) =>
        (!section.year_level || subject.year_level === section.year_level) &&
        (subject.course_id === null || subject.course_id === section.course_id)
    );
    return { subjectOptions: fitting, takenSubjects: taken };
  }, [data.subjects, data.classes, section]);
  const availableCount = subjectOptions.filter((subject) => !takenSubjects.has(subject.subject_id)).length;

  const liveClash = useMemo(() => {
    if (!section || !form.start_time || !form.end_time) return null;
    const candidate: Meeting = {
      day: form.day,
      start_time: form.start_time,
      end_time: form.end_time,
      section_id: section.section_id,
      teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
      room: form.room.trim() || null,
    };
    for (const other of scheduled) {
      if (other.class_id === form.class_id) continue;
      const reasons = clashReasons(candidate, other);
      if (reasons.length > 0) {
        return `Clashes with ${other.subject_code} for ${other.section_name} (${other.start_time}-${other.end_time}) — same ${reasons.join(", ")}`;
      }
    }
    return null;
  }, [section, form, scheduled]);

  const openNew = (day = "Monday") => {
    setForm({ ...emptyForm, day });
    setOpen(true);
  };

  const openEdit = (item: ClassRow) => {
    setForm({
      class_id: item.class_id,
      section_id: String(item.section_id),
      subject_id: String(item.subject_id),
      teacher_id: item.teacher_id ? String(item.teacher_id) : "",
      day: item.day ?? "Monday",
      start_time: item.start_time ?? "",
      end_time: item.end_time ?? "",
      room: item.room ?? "",
    });
    setOpen(true);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!form.section_id || !form.subject_id) {
      toast.error("Choose a section and a subject");
      return;
    }
    if (!form.start_time || !form.end_time) {
      toast.error("Start and end times are required");
      return;
    }
    if (form.start_time >= form.end_time) {
      toast.error("End time must be after start time");
      return;
    }

    setSaving(true);
    try {
      const schedule = {
        teacher_id: form.teacher_id ? Number(form.teacher_id) : null,
        day: form.day,
        start_time: form.start_time,
        end_time: form.end_time,
        room: form.room.trim() || null,
      };
      const remote = editing
        ? await api.patch<RemoteData>(`/api/admin/classes/${form.class_id}`, schedule)
        : await api.post<RemoteData>("/api/admin/classes", {
            subject_id: Number(form.subject_id),
            section_id: Number(form.section_id),
            ...schedule,
          });
      replaceData(remote);
      toast.success(editing ? "Class updated" : "Class scheduled");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not save class");
    } finally {
      setSaving(false);
    }
  };

  const handleUnschedule = async (item: ClassRow) => {
    if (!window.confirm(`Take ${item.subject_code} (${item.section_name}) off the timetable? The class is kept.`)) {
      return;
    }
    try {
      replaceData(await api.delete<RemoteData>(`/api/admin/classes/${item.class_id}/schedule`));
      toast.success(`${item.subject_code} is now unscheduled`);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not update schedule");
    }
  };

  const handleDelete = async () => {
    if (form.class_id === null) return;
    if (!window.confirm("Delete this class completely?")) return;
    try {
      replaceData(await api.delete<RemoteData>(`/api/admin/classes/${form.class_id}`));
      toast.success("Class deleted");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not delete class");
    }
  };

  const noSetup = data.sections.length === 0 || data.subjects.length === 0;

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="badge border-accent/40 bg-accent/15 text-accent">Timetable</span>
          <h1 className="mt-3 text-2xl font-bold text-gray-100">Weekly Schedule</h1>
          <p className="mt-1 max-w-2xl text-sm text-gray-400">
            Give a subject to a section, then set its teacher, day, time and room. A class
            can&apos;t overlap another one with the same teacher, section, or room.
          </p>
        </div>
        <button type="button" onClick={() => openNew()} disabled={noSetup} className="btn-accent">
          <Plus size={16} />
          Schedule a class
        </button>
      </section>

      {noSetup ? (
        <p className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Add at least one section and one subject first.
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:max-w-xl">
        <GlassSelect
          label="Section"
          value={sectionFilter}
          onChange={(event) => setSectionFilter(event.target.value)}
        >
          <option value="all">All sections</option>
          {data.sections.map((item) => (
            <option key={item.section_id} value={item.section_id}>
              {item.section_name}
            </option>
          ))}
        </GlassSelect>
        <GlassSelect
          label="Teacher"
          value={teacherFilter}
          onChange={(event) => setTeacherFilter(event.target.value)}
        >
          <option value="all">All teachers</option>
          {data.teachers.map((teacher) => (
            <option key={teacher.teacher_id} value={teacher.teacher_id}>
              {teacher.full_name}
            </option>
          ))}
        </GlassSelect>
      </div>

      {conflicts.length > 0 ? (
        <div className="rounded-xl border border-amber-400/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          <p className="flex items-center gap-2 font-semibold">
            <AlertTriangle size={16} />
            {conflicts.length} schedule conflict{conflicts.length > 1 ? "s" : ""} detected
          </p>
          <ul className="mt-2 space-y-1 text-xs text-amber-100/90">
            {conflicts.map((conflict) => (
              <li key={conflict}>• {conflict}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
          <CalendarDays size={16} />
          No teacher, section, or room conflicts in the current timetable.
        </div>
      )}

      {unscheduled.length > 0 ? (
        <section className="glass bg-white/[0.06] p-4">
          <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-300">
            Not scheduled yet ({unscheduled.length})
          </h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {unscheduled.map((item) => (
              <button
                key={item.class_id}
                type="button"
                onClick={() => openEdit(item)}
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-slate-900/60 px-3 py-2 text-left text-xs transition hover:border-accent/40"
              >
                <CalendarPlus size={14} className="shrink-0 text-accent" />
                <span>
                  <span className="font-bold text-accent">{item.subject_code}</span>{" "}
                  <span className="text-gray-300">{item.subject_name}</span>
                  <span className="block text-[11px] text-gray-500">
                    {item.section_name} · {item.teacher_name ?? "No teacher"}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
        {DAYS.map((day) => {
          const items = visible.filter((item) => item.day === day);
          return (
            <div key={day} className="glass bg-white/[0.06] p-3">
              <div className="mb-3 flex items-center justify-between gap-2 px-1">
                <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-gray-300">
                  {day}
                </h2>
                <div className="flex items-center gap-1.5">
                  <span className="badge border-white/10 bg-white/5 text-[10px] text-gray-400">
                    {items.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => openNew(day)}
                    disabled={noSetup}
                    aria-label={`Schedule a class on ${day}`}
                    title={`Schedule a class on ${day}`}
                    className="grid h-6 w-6 place-items-center rounded-md border border-white/10 text-gray-400 transition hover:border-accent/40 hover:text-accent disabled:opacity-40"
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              <div className="space-y-2.5">
                {items.length > 0 ? (
                  items.map((item) => (
                    <article
                      key={item.class_id}
                      className="rounded-xl border border-white/10 bg-slate-900/60 p-3 transition hover:border-accent/40 hover:bg-slate-900/80"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-accent">{item.subject_code}</p>
                          <p className="mt-0.5 text-sm font-semibold leading-snug text-gray-100">
                            {item.subject_name}
                          </p>
                        </div>
                        <div className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={() => openEdit(item)}
                            aria-label={`Edit ${item.subject_code} for ${item.section_name}`}
                            title="Edit"
                            className="grid h-6 w-6 place-items-center rounded-md text-gray-500 transition hover:bg-white/10 hover:text-accent"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUnschedule(item)}
                            aria-label={`Remove ${item.subject_code} from the timetable`}
                            title="Remove from timetable"
                            className="grid h-6 w-6 place-items-center rounded-md text-gray-500 transition hover:bg-red-500/20 hover:text-red-300"
                          >
                            <X size={13} />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 space-y-1 text-[11px] text-gray-400">
                        <p className="flex items-center gap-1.5">
                          <Layers size={11} className="shrink-0" />
                          {item.section_name} · {item.course_code}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <Clock size={11} className="shrink-0" />
                          {item.start_time}-{item.end_time}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <MapPin size={11} className="shrink-0" />
                          {item.room ?? "No room"}
                        </p>
                        <p className="flex items-center gap-1.5">
                          <User size={11} className="shrink-0" />
                          {item.teacher_name ?? "Unassigned"}
                        </p>
                      </div>
                    </article>
                  ))
                ) : (
                  <p className="rounded-xl border border-dashed border-white/10 px-3 py-6 text-center text-[11px] text-gray-500">
                    No classes
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editing ? "Edit class" : "Schedule a class"}
        description={
          editing
            ? "Change the teacher, day, time or room."
            : "Pick a section, then a subject that fits it."
        }
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <GlassSelect
              label="Section"
              value={form.section_id}
              onChange={(event) =>
                setForm({ ...form, section_id: event.target.value, subject_id: "" })
              }
              disabled={editing}
              required
            >
              <option value="">Select a section</option>
              {data.sections.map((item) => (
                <option key={item.section_id} value={item.section_id}>
                  {item.section_name} — {item.course_code}, {item.year_level}
                </option>
              ))}
            </GlassSelect>

            {editing ? (
              <GlassSelect label="Subject" value={form.subject_id} disabled>
                {data.subjects.map((subject) => (
                  <option key={subject.subject_id} value={subject.subject_id}>
                    {subject.subject_code} — {subject.subject_name}
                  </option>
                ))}
              </GlassSelect>
            ) : (
              <GlassSelect
                label="Subject"
                value={form.subject_id}
                onChange={(event) => setForm({ ...form, subject_id: event.target.value })}
                disabled={!section}
                hint={
                  !section
                    ? "Choose a section first."
                    : subjectOptions.length === 0
                      ? `There are no ${section.year_level} subjects for ${section.course_code} yet. Add one on the Subjects page.`
                      : availableCount === 0
                        ? `Every ${section.year_level} subject for ${section.course_code} is already scheduled for ${section.section_name}. Edit its class on the timetable, or add a new subject on the Subjects page.`
                        : `Showing ${section.year_level} subjects for ${section.course_code} (and general subjects).`
                }
                required
              >
                <option value="">Select a subject</option>
                {subjectOptions.map((subject) => (
                  <option
                    key={subject.subject_id}
                    value={subject.subject_id}
                    disabled={takenSubjects.has(subject.subject_id)}
                  >
                    {subject.subject_code} — {subject.subject_name}
                    {subject.course_id === null ? " (general)" : ""}
                    {takenSubjects.has(subject.subject_id) ? " — already scheduled" : ""}
                  </option>
                ))}
              </GlassSelect>
            )}

            <GlassSelect
              label="Teacher"
              value={form.teacher_id}
              onChange={(event) => setForm({ ...form, teacher_id: event.target.value })}
              hint={data.teachers.length === 0 ? "No teachers yet — add teachers first." : undefined}
            >
              <option value="">Unassigned</option>
              {data.teachers.map((teacher) => (
                <option key={teacher.teacher_id} value={teacher.teacher_id}>
                  {teacher.full_name}
                </option>
              ))}
            </GlassSelect>
            <GlassInput
              label="Room"
              value={form.room}
              onChange={(event) => setForm({ ...form, room: event.target.value })}
              placeholder="Enter room"
            />
            <GlassSelect
              label="Day"
              value={form.day}
              onChange={(event) => setForm({ ...form, day: event.target.value })}
            >
              {DAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </GlassSelect>
            <div className="grid grid-cols-2 gap-4">
              <GlassInput
                label="Start time"
                type="time"
                value={form.start_time}
                onChange={(event) => setForm({ ...form, start_time: event.target.value })}
                required
              />
              <GlassInput
                label="End time"
                type="time"
                value={form.end_time}
                onChange={(event) => setForm({ ...form, end_time: event.target.value })}
                required
              />
            </div>
          </div>

          {liveClash ? (
            <p className="flex items-start gap-2 rounded-lg border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              <AlertTriangle size={14} className="mt-0.5 shrink-0" />
              {liveClash}
            </p>
          ) : null}

          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {editing ? (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-red-400/30 px-3 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500/15"
                >
                  <Trash2 size={14} />
                  Delete class
                </button>
              ) : null}
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setOpen(false)} className="btn-glass">
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || Boolean(liveClash)}
                className="btn-accent"
              >
                {saving ? "Saving..." : editing ? "Save changes" : "Schedule class"}
              </button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
