import AnnouncementFeed from "../../components/AnnouncementFeed";

export default function TeacherAnnouncements() {
  return (
    <AnnouncementFeed
      endpoint="/api/teacher/announcements"
      subtitle="Notices from the admin office for everyone and for faculty."
    />
  );
}
