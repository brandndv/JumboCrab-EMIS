import { getUsers } from "@/actions/users/users-action";
import UsersProvider from "@/features/manage-users/users-provider";
import UsersPageContent from "@/features/manage-users/users-page-content";

export default async function UsersPage() {
  const result = await getUsers();
  const initialUsers = result.success && result.data ? result.data : [];

  return (
    <UsersProvider initialUsers={initialUsers}>
      <UsersPageContent />
    </UsersProvider>
  );
}
