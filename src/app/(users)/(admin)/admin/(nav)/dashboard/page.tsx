import { getSession } from "@/lib/auth";

const AdminDashboardPage = async () => {
  const session = await getSession();

  return (
    <div className="p-8">
      <h1>Admin Dashboard</h1>
      <h1 className="text-2xl font-bold mb-4">Session Test</h1>
      <div className="bg-gray-100 p-4 rounded">
        <h2 className="text-lg font-semibold mb-2">Session Data:</h2>
        <pre className="bg-white p-4 rounded overflow-auto">
          {JSON.stringify(session, null, 2)}
        </pre>
      </div>
      {session.role && (
        <div className="mt-4 p-4 bg-green-100 rounded">
          <p className="text-green-800">
            User Role: <span className="font-semibold">{session.role}</span>
          </p>
        </div>
      )}
    </div>
  );
};

export default AdminDashboardPage;
