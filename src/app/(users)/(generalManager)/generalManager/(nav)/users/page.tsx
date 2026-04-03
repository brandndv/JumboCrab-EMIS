import UsersProvider from "@/features/manage-users/users-provider";
import UsersPageContent from "@/features/manage-users/users-page-content";

export default function UsersPage() {
  return (
    <UsersProvider>
      <UsersPageContent />
    </UsersProvider>
  );
}
