import AnnouncementFeed from "../../components/AnnouncementFeed";

export default function StudentAnnouncements() {
  return (
    <AnnouncementFeed
      endpoint="/api/student/announcements"
      subtitle="Notices from the school for everyone and for students."
    />
  );
}
