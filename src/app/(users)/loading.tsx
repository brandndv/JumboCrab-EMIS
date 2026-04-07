import { FullScreenLoadingState } from "@/components/loading/loading-states";

export default function UsersRouteLoading() {
  return (
    <FullScreenLoadingState
      title="Opening your dashboard"
      description="Loading your workspace, navigation, and latest role-based data."
    />
  );
}
