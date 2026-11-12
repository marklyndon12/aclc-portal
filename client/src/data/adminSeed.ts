import type {
  AdminStudentRow,
  AdminTeacherRow,
  AdminUserRow,
  AnnouncementRow,
  AttendanceRecord,
  Course,
  GradeRecord,
  SectionRow,
  SubjectRow,
} from "../types";

export const ADMIN_DATA_VERSION = 3;

export interface AdminDataState {
  version: number;
  users: AdminUserRow[];
  students: AdminStudentRow[];
  teachers: AdminTeacherRow[];
  sections: SectionRow[];
  subjects: SubjectRow[];
  courses: Course[];
  attendance: AttendanceRecord[];
  grades: GradeRecord[];
  announcements: AnnouncementRow[];
}

export const adminSeed: AdminDataState = {
  version: ADMIN_DATA_VERSION,
  users: [],
  students: [],
  teachers: [],
  sections: [],
  subjects: [],
  courses: [],
  attendance: [],
  grades: [],
  announcements: [],
};
