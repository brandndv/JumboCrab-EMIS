"use client";

import { UsersCards } from "@/components/dasboard/manage-users/users-cards";
import UsersProvider, { useUsers } from "@/components/dasboard/manage-users/users-provider";

function UsersPageContent() {
  const { filteredUsers, loading, error, searchTerm, setSearchTerm } = useUsers();

  const handleEdit = (user: any) => {
    console.log("Edit user:", user);
    // Add your edit logic here
  };

  const handleDelete = (user: any) => {
    if (confirm(`Are you sure you want to delete ${user.username}?`)) {
      console.log("Delete user:", user.id);
      // Add your delete logic here
    }
  };

  if (loading) return <div>Loading users...</div>;
  if (error) return <div className="text-red-500">Error: {error}</div>;

  return (
    <div className="p-4">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-4">Users Management</h1>
        <div className="max-w-md">
          <input
            type="text"
            placeholder="Search users..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      <UsersCards
        users={filteredUsers}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
}

export default function UsersPage() {
  return (
    <UsersProvider>
      <UsersPageContent />
    </UsersProvider>
  );
}