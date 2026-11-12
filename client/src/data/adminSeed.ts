import type {
  AdminStudentRow,
  AdminTeacherRow,
  AdminUserRow,
  AnnouncementRow,
  DepartmentRow,
  ClassRow,
  Course,
  SectionRow,
  SubjectRow,
  TeacherAttendanceRecord,
} from "../types";

export const ADMIN_DATA_VERSION = 6;

export interface AdminDataState {
  version: number;
  users: AdminUserRow[];
  students: AdminStudentRow[];
  teachers: AdminTeacherRow[];
  departments: DepartmentRow[];
  sections: SectionRow[];
  subjects: SubjectRow[];
  courses: Course[];
  classes: ClassRow[];
  teacherAttendance: TeacherAttendanceRecord[];
  announcements: AnnouncementRow[];
}

export const adminSeed: AdminDataState = {
  version: ADMIN_DATA_VERSION,
  users: [],
  students: [],
  teachers: [],
  departments: [],
  sections: [],
  subjects: [],
  courses: [],
  classes: [],
  teacherAttendance: [],
  announcements: [],
};
