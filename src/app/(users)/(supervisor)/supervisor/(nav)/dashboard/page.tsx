import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const SupervisorDashboardPage = () => {
  return (
    <div className="px-4 py-8 sm:px-8 lg:px-12">
      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Supervisor Dashboard</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Open the Violation menu to draft and track employee violations.
        </CardContent>
      </Card>
    </div>
  );
};

export default SupervisorDashboardPage;
