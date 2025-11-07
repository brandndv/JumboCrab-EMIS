const AdminDashboardPage = () => {
  return (
    <main className="h-full w-full p-4 md:p-6">
      <div className="mx-auto h-full w-full max-w-[2000px]">
        <div className="h-full w-full rounded-lg border bg-card p-6 shadow-sm">
          <h1 className="text-2xl font-semibold">Admin Dashboard</h1>
          <p className="mt-2 text-muted-foreground">
            Welcome to your admin dashboard
          </p>
          
          {/* Add some sample content to test the layout */}
          <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map((item) => (
              <div key={item} className="rounded-lg border p-4">
                <h3 className="font-medium">Card {item}</h3>
                <p className="mt-2 text-sm text-muted-foreground">
                  This is a sample card to demonstrate the layout
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
};

export default AdminDashboardPage;
