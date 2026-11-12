import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import ComingSoon from "./components/ComingSoon";
import DashboardLayout from "./components/DashboardLayout";
import ProtectedRoute from "./components/ProtectedRoute";
import RoleRoute from "./components/RoleRoute";
import SessionExpiredModal from "./components/SessionExpiredModal";
import { AdminDataProvider } from "./context/AdminDataContext";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { homePath } from "./lib/roles";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminRegister from "./pages/AdminRegister";
import AdminAttendance from "./pages/admin/AdminAttendance";
import AdminDashboard from "./pages/admin/AdminDashboard";
import ManageAnnouncements from "./pages/admin/ManageAnnouncements";
import ManageCourses from "./pages/admin/ManageCourses";
import ManageDepartments from "./pages/admin/ManageDepartments";
import ManageSchedule from "./pages/admin/ManageSchedule";
import ManageSections from "./pages/admin/ManageSections";
import ManageStudents from "./pages/admin/ManageStudents";
import ManageSubjects from "./pages/admin/ManageSubjects";
import ManageTeachers from "./pages/admin/ManageTeachers";
import ManageUsers from "./pages/admin/ManageUsers";
import StudentAnnouncements from "./pages/student/StudentAnnouncements";
import StudentAttendance from "./pages/student/StudentAttendance";
import StudentDashboard from "./pages/student/StudentDashboard";
import StudentGrades from "./pages/student/StudentGrades";
import StudentQuizTake from "./pages/student/StudentQuizTake";
import StudentQuizzes from "./pages/student/StudentQuizzes";
import StudentSchedule from "./pages/student/StudentSchedule";
import TeacherAnnouncements from "./pages/teacher/TeacherAnnouncements";
import TeacherAttendance from "./pages/teacher/TeacherAttendance";
import TeacherClasses from "./pages/teacher/TeacherClasses";
import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import TeacherGrades from "./pages/teacher/TeacherGrades";
import TeacherMyAttendance from "./pages/teacher/TeacherMyAttendance";
import TeacherQuizzes from "./pages/teacher/TeacherQuizzes";

function RootRedirect() {
  const { user } = useAuth();
  return <Navigate to={user ? homePath(user.roles) : "/login"} replace />;
}

function AdminLayout() {
  return (
    <AdminDataProvider>
      <DashboardLayout />
    </AdminDataProvider>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SessionExpiredModal />
        <Toaster position="top-right" richColors closeButton theme="dark" />
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/admin-register" element={<AdminRegister />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute allow={["admin"]} />}>
              <Route path="admin" element={<AdminLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboard />} />
                <Route path="users" element={<ManageUsers />} />
                <Route path="students" element={<ManageStudents />} />
                <Route path="teachers" element={<ManageTeachers />} />
                <Route path="departments" element={<ManageDepartments />} />
                <Route path="sections" element={<ManageSections />} />
                <Route path="subjects" element={<ManageSubjects />} />
                <Route path="courses" element={<ManageCourses />} />
                <Route path="schedule" element={<ManageSchedule />} />
                <Route path="attendance" element={<AdminAttendance />} />
                <Route path="announcements" element={<ManageAnnouncements />} />
                <Route path="*" element={<ComingSoon title="Page not found" />} />
              </Route>
            </Route>

            <Route element={<RoleRoute allow={["teacher"]} />}>
              <Route path="teacher" element={<DashboardLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<TeacherDashboard />} />
                <Route path="classes" element={<TeacherClasses />} />
                <Route path="attendance" element={<TeacherAttendance />} />
                <Route path="grades" element={<TeacherGrades />} />
                <Route path="quizzes" element={<TeacherQuizzes />} />
                <Route path="attendance-log" element={<TeacherMyAttendance />} />
                <Route path="announcements" element={<TeacherAnnouncements />} />
                <Route path="*" element={<ComingSoon title="Page not found" />} />
              </Route>
            </Route>

            <Route element={<RoleRoute allow={["student"]} />}>
              <Route path="student" element={<DashboardLayout />}>
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<StudentDashboard />} />
                <Route path="schedule" element={<StudentSchedule />} />
                <Route path="grades" element={<StudentGrades />} />
                <Route path="attendance" element={<StudentAttendance />} />
                <Route path="quizzes" element={<StudentQuizzes />} />
                <Route path="quizzes/:id" element={<StudentQuizTake />} />
                <Route path="announcements" element={<StudentAnnouncements />} />
                <Route path="*" element={<ComingSoon title="Page not found" />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
