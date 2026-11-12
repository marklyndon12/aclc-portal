export type Role = "admin" | "teacher" | "student";

export interface StudentProfile {
  student_id: number;
  user_id: string;
  full_name: string;
  student_number: string;
  year_level: string | null;
  section: string | null;
  course_year: string | null;
}

export interface TeacherProfile {
  teacher_id: number;
  user_id: string;
  full_name: string;
  department: string | null;
  specialization: string | null;
}

export type Profile = StudentProfile | TeacherProfile;

export interface SessionUser {
  user_id: string;
  username: string;
  roles: Role;
  profile: Profile | null;
}

export interface LoginResponse {
  token: string;
  user: SessionUser;
}

export interface SignupPayload {
  full_name: string;
  email: string;
  username: string;
  role: Role;
  password: string;
}

export interface SessionResponse {
  user: SessionUser;
}

export interface Course {
  course_id: number;
  course_code: string;
  course_name: string;
  section_name: string | null;
  teacher_name: string | null;
  day: string | null;
  start_time: string | null;
  end_time: string | null;
  room: string | null;
  enrolled: number;
  credits?: number | null;
  subject_code?: string | null;
  year_level?: string | null;
}

export interface ScheduleEntry {
  id: number;
  course_code: string;
  course_name: string;
  time: string;
  room: string;
  teacher: string;
}

export interface GradeEntry {
  id: number;
  course_code: string;
  course_name: string;
  term: string;
  grade: number;
}

export interface AdminUserRow {
  user_id: string;
  username: string;
  full_name: string;
  role: Role;
  status: "Active" | "Disabled";
}

export interface SectionRow {
  section_id: number;
  section_name: string;
  year_level: string;
  student_count: number;
  adviser: string;
}

export interface ScanResult {
  student_name: string;
  status: string;
  time: string;
}

export interface AdminStudentRow {
  student_id: number;
  user_id: string;
  username: string;
  full_name: string;
  student_number: string;
  year_level: string;
  section: string;
  course_year: string;
  status: "Active" | "Disabled";
}

export interface AdminTeacherRow {
  teacher_id: number;
  user_id: string;
  username: string;
  full_name: string;
  department: string;
  specialization: string;
  status: "Active" | "Disabled";
}

export interface SubjectRow {
  subject_id: number;
  subject_code: string;
  subject_name: string;
  units: number;
  year_level: string;
}

export type AttendanceStatus = "Present" | "Absent" | "Late" | "Excused";

export interface AttendanceRecord {
  id: number;
  course_id: number;
  student_id: number;
  date: string;
  status: AttendanceStatus;
}

export interface GradeRecord {
  id: number;
  course_id: number;
  student_id: number;
  prelim: number | null;
  midterm: number | null;
  prefinal: number | null;
  final: number | null;
}

export type AnnouncementAudience = "Everyone" | "Students" | "Teachers";

export interface AnnouncementRow {
  announcement_id: number;
  title: string;
  body: string;
  audience: AnnouncementAudience;
  created_at: string;
}
