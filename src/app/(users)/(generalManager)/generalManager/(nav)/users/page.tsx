import UsersProvider from "@/components/dasboard/manage-users/users-provider";
import UsersPageContent from "@/components/dasboard/manage-users/users-page-content";

export default function UsersPage() {
  return (
    <UsersProvider>
      <UsersPageContent />
    </UsersProvider>
  );
}
