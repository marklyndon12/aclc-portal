import { Megaphone } from "lucide-react";
import clsx from "clsx";
import LoadState from "./LoadState";
import { useStudentData } from "../hooks/useStudentOverview";
import type { TeacherAnnouncement } from "../types";

const audienceClass: Record<string, string> = {
  Everyone: "border-accent/40 bg-accent/15 text-accent",
  Teachers: "border-sky-400/30 bg-sky-400/10 text-sky-300",
  Students: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
};

export default function AnnouncementFeed({
  endpoint,
  subtitle,
}: {
  endpoint: string;
  subtitle: string;
}) {
  const { data, loading, error, refresh } = useStudentData<{ announcements: TeacherAnnouncement[] }>(endpoint);
  const items = data?.announcements ?? [];

  return (
    <div className="space-y-6">
      <section>
        <span className="badge border-accent/40 bg-accent/15 text-accent">Notices</span>
        <h1 className="mt-3 text-2xl font-bold text-gray-100">Announcements</h1>
        <p className="mt-1 max-w-2xl text-sm text-gray-400">{subtitle}</p>
      </section>

      <LoadState loading={loading} error={error} onRetry={refresh} />

      {!loading && !error ? (
        items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item) => (
              <article key={item.announcement_id} className="glass bg-white/10 p-5">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-base font-semibold text-gray-100">{item.title}</h2>
                  <span className={clsx("badge shrink-0", audienceClass[item.audience])}>
                    {item.audience}
                  </span>
                </div>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-gray-300">
                  {item.body}
                </p>
                <p className="mt-3 text-xs text-gray-500">
                  {new Date(item.created_at).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {item.author_name ? ` · ${item.author_name}` : ""}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <div className="glass bg-white/10 px-5 py-12 text-center">
            <Megaphone size={22} className="mx-auto text-gray-500" />
            <p className="mt-2 text-sm text-gray-300">No announcements yet</p>
          </div>
        )
      ) : null}
    </div>
  );
}
