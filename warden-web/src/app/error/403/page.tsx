import { ErrorScreen } from "@/components/layout/error-screen";

export default function ForbiddenPage() {
  return (
    <ErrorScreen
      code="403"
      title="Access denied"
      description="You don't have permission to view this page. Contact your administrator if you believe this is a mistake."
    />
  );
}
