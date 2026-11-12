import { Link } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  Clock,
  GraduationCap,
  Layers,
  MapPin,
  Megaphone,
  RefreshCw,
  Users,
} from "lucide-react";
import clsx from "clsx";
import { toast } from "sonner";
import { useAdminData } from "../../context/AdminDataContext";
import { useAuth } from "../../context/AuthContext";

const audienceClass = {
  Everyone: "border-accent/40 bg-accent/15 text-accent",
  Students: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
  Teachers: "border-sky-400/30 bg-sky-400/10 text-sky-300",
};

const quickActions = [
  {
    to: "/admin/users",
    label: "Manage users",
    description: "Accounts, roles, and access",
    icon: Users,
  },
  {
    to: "/admin/students",
    label: "Manage students",
    description: "Profiles and section assignment",
    icon: GraduationCap,
  },
  {
    to: "/admin/teachers",
    label: "Manage teachers",
    description: "Departments and specializations",
    icon: Briefcase,
  },
  {
    to: "/admin/courses",
    label: "Manage courses",
    description: "Programs such as BSIT or BSHM",
    icon: BookOpen,
  },
  {
    to: "/admin/schedule",
    label: "Weekly schedule",
    description: "Assign days, times, and rooms",
    icon: CalendarDays,
  },
  {
    to: "/admin/announcements",
    label: "Announcements",
    description: "Campus-wide notices",
    icon: Megaphone,
  },
];

export default function AdminDashboard() {
  const { data, refresh } = useAdminData();
  const { user } = useAuth();

  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const todayCourses = [...data.classes]
    .filter((course) => course.day === weekday)
    .sort((a, b) => (a.start_time ?? "").localeCompare(b.start_time ?? ""));

  const today = new Date().toISOString().slice(0, 10);
  const todayAttendance = data.teacherAttendance.filter((record) => record.date === today);
  const presentToday = todayAttendance.filter((record) => record.status === "Present").length;
  const onLeaveToday = todayAttendance.filter((record) => record.status === "On Leave").length;

  const stats = [
    {
      label: "Students",
      value: data.students.length,
      detail: `${data.students.filter((item) => item.status === "Active").length} active`,
      icon: GraduationCap,
    },
    {
      label: "Teachers",
      value: data.teachers.length,
      detail: `${data.teachers.filter((item) => item.status === "Active").length} active`,
      icon: Users,
    },
    {
      label: "Courses",
      value: data.courses.length,
      detail: `${data.sections.length} sections`,
      icon: BookOpen,
    },
    {
      label: "Teachers in today",
      value: presentToday,
      detail: `${onLeaveToday} on leave · ${data.teachers.length} total`,
      icon: ClipboardCheck,
    },
  ];

  const recentAnnouncements = [...data.announcements]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 3);

  const handleRefresh = async () => {
    await refresh();
    toast.success("Data refreshed");
  };

  return (
    <div className="space-y-6">
      <section className="glass relative overflow-hidden bg-white/10 p-6 shadow-glass sm:p-8">
        <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-100 sm:text-3xl">
              Admin Control Panel
            </h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-400">
              Welcome back, {user?.username}. Manage accounts, academic records, and
              campus operations from one place.
            </p>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-3 py-2 text-xs font-semibold text-gray-300 transition hover:border-white/25 hover:bg-white/10 hover:text-white"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="glass glass-hover bg-white/10 p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent/15 text-accent">
                <item.icon size={18} />
              </span>
              <div>
                <p className="text-xs text-gray-400">{item.label}</p>
                <p className="text-2xl font-bold text-gray-100">{item.value}</p>
                <p className="text-[11px] text-gray-500">{item.detail}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-400">
            Quick actions
          </h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {quickActions.map((action) => (
            <Link
              key={action.to}
              to={action.to}
              className="glass glass-hover group flex items-center gap-3 bg-white/10 p-4"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-accent transition group-hover:border-accent/40 group-hover:bg-accent/15">
                <action.icon size={18} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold text-gray-100">
                  {action.label}
                </span>
                <span className="block truncate text-xs text-gray-400">
                  {action.description}
                </span>
              </span>
              <ArrowRight
                size={16}
                className="shrink-0 text-gray-500 transition group-hover:translate-x-0.5 group-hover:text-accent"
              />
            </Link>
          ))}
        </div>
      </section>

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <section className="glass overflow-hidden bg-white/10">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-100">
                Today&apos;s schedule
              </h2>
              <p className="text-xs text-gray-400">{weekday}</p>
            </div>
            <Link
              to="/admin/schedule"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent transition hover:text-accent/80"
            >
              Full timetable
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="divide-y divide-white/10">
            {todayCourses.length > 0 ? (
              todayCourses.map((course) => (
                <div
                  key={course.class_id}
                  className="flex flex-wrap items-center gap-3 px-5 py-3.5 transition hover:bg-white/5"
                >
                  <div className="min-w-[92px]">
                    <p className="text-sm font-semibold text-gray-100">
                      {course.start_time}
                    </p>
                    <p className="text-[11px] text-gray-500">to {course.end_time}</p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-100">
                      <span className="text-accent">{course.subject_code}</span>{" "}
                      {course.subject_name}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-gray-400">
                      <span className="inline-flex items-center gap-1">
                        <Layers size={12} />
                        {course.section_name ?? "No section"}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <MapPin size={12} />
                        {course.room ?? "No room"}
                      </span>
                    </p>
                  </div>
                  <span className="badge border-white/15 bg-white/5 text-gray-300">
                    {course.teacher_name ?? "Unassigned"}
                  </span>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <Clock size={22} className="mx-auto text-gray-500" />
                <p className="mt-2 text-sm font-medium text-gray-300">
                  No classes scheduled for {weekday}
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Assign days and times from the weekly schedule page.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="glass overflow-hidden bg-white/10">
          <div className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
            <div>
              <h2 className="text-sm font-semibold text-gray-100">
                Recent announcements
              </h2>
              <p className="text-xs text-gray-400">Campus-wide notices</p>
            </div>
            <Link
              to="/admin/announcements"
              className="inline-flex items-center gap-1 text-xs font-semibold text-accent transition hover:text-accent/80"
            >
              Manage
              <ArrowRight size={13} />
            </Link>
          </div>

          <div className="divide-y divide-white/10">
            {recentAnnouncements.length > 0 ? (
              recentAnnouncements.map((item) => (
                <div key={item.announcement_id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold text-gray-100">{item.title}</p>
                    <span className={clsx("badge shrink-0", audienceClass[item.audience])}>
                      {item.audience}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-gray-400">
                    {item.body}
                  </p>
                  <p className="mt-2 text-[11px] text-gray-500">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <div className="px-5 py-10 text-center">
                <Megaphone size={22} className="mx-auto text-gray-500" />
                <p className="mt-2 text-sm font-medium text-gray-300">
                  No announcements yet
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Publish your first notice from the announcements page.
                </p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
