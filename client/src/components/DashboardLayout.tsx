import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Award,
  BookOpen,
  Building2,
  Briefcase,
  CalendarDays,
  ClipboardCheck,
  Clock,
  FileQuestion,
  GraduationCap,
  Layers,
  LayoutDashboard,
  LogOut,
  Megaphone,
  Menu,
  QrCode,
  Users,
  X,
  type LucideIcon,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../context/AuthContext";
import { useSessionBouncer } from "../hooks/useSessionBouncer";
import { roleLabel } from "../lib/roles";
import type { Role } from "../types";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const navByRole: Record<Role, NavItem[]> = {
  admin: [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/users", label: "Users", icon: Users },
    { to: "/admin/students", label: "Students", icon: GraduationCap },
    { to: "/admin/teachers", label: "Teachers", icon: Briefcase },
    { to: "/admin/departments", label: "Departments", icon: Building2 },
    { to: "/admin/sections", label: "Sections", icon: Layers },
    { to: "/admin/subjects", label: "Subjects", icon: BookOpen },
    { to: "/admin/courses", label: "Courses", icon: BookOpen },
    { to: "/admin/schedule", label: "Schedule", icon: CalendarDays },
    { to: "/admin/attendance", label: "Teacher Attendance", icon: ClipboardCheck },
    { to: "/admin/announcements", label: "Announcements", icon: Megaphone },
  ],
  teacher: [
    { to: "/teacher/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/teacher/classes", label: "Classes", icon: BookOpen },
    { to: "/teacher/attendance", label: "Attendance", icon: QrCode },
    { to: "/teacher/grades", label: "Grades", icon: Award },
    { to: "/teacher/quizzes", label: "Quizzes", icon: FileQuestion },
    { to: "/teacher/attendance-log", label: "My Attendance", icon: Clock },
    { to: "/teacher/announcements", label: "Announcements", icon: Megaphone },
  ],
  student: [
    { to: "/student/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/student/schedule", label: "Schedule", icon: CalendarDays },
    { to: "/student/grades", label: "Grades", icon: Award },
    { to: "/student/attendance", label: "Attendance", icon: ClipboardCheck },
    { to: "/student/quizzes", label: "Quizzes", icon: FileQuestion },
    { to: "/student/announcements", label: "Announcements", icon: Megaphone },
  ],
};

const roleBadgeClass: Record<Role, string> = {
  admin: "border-accent/40 bg-accent/15 text-accent",
  teacher: "border-sky-400/40 bg-sky-400/10 text-sky-300",
  student: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
};

export default function DashboardLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  useSessionBouncer();

  if (!user) {
    return null;
  }

  const items = navByRole[user.roles];
  const displayName = user.profile?.full_name ?? user.username;

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 to-black">
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={clsx(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-white/10 bg-slate-900/70 backdrop-blur-xl transition-transform duration-300 lg:translate-x-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex items-center gap-3 border-b border-white/10 px-5 py-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white shadow-lg shadow-accent/40">
            <GraduationCap size={20} />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-gray-100">ACLC Portal</p>
            <p className="truncate text-xs text-gray-400">{roleLabel(user.roles)}</p>
          </div>
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-400 transition hover:bg-white/10 hover:text-white lg:hidden"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                clsx(
                  "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-300",
                  isActive
                    ? "bg-accent text-white shadow-lg shadow-accent/30"
                    : "text-gray-400 hover:translate-x-0.5 hover:bg-white/10 hover:text-gray-100"
                )
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 p-4">
          <p className="text-[11px] uppercase tracking-widest text-gray-500">
            Signed in as
          </p>
          <p className="mt-1 truncate text-sm font-medium text-gray-200">{displayName}</p>
          <p className="truncate text-xs text-gray-500">@{user.username}</p>
        </div>
      </aside>

      <div className="flex min-h-screen flex-col lg:pl-64">
        <header className="sticky top-0 z-30 border-b border-white/10 bg-slate-900/60 backdrop-blur-xl">
          <div className="flex items-center justify-between gap-4 px-4 py-3 sm:px-6">
            <div className="flex min-w-0 items-center gap-3">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation"
                className="grid h-9 w-9 place-items-center rounded-xl border border-white/15 bg-white/5 text-gray-300 transition hover:bg-white/15 hover:text-white lg:hidden"
              >
                <Menu size={18} />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-gray-100">{displayName}</p>
                <p className="truncate text-xs text-gray-400">@{user.username}</p>
              </div>
              <span className={clsx("badge hidden sm:inline-flex", roleBadgeClass[user.roles])}>
                {roleLabel(user.roles)}
              </span>
            </div>

            <button
              type="button"
              onClick={handleLogout}
              className="inline-flex items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-gray-200 backdrop-blur-md transition-all duration-300 hover:scale-105 hover:border-red-400/40 hover:bg-red-500/20 hover:text-red-200"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-7xl flex-1 p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
