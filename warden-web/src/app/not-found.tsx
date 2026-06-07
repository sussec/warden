import { ErrorScreen } from "@/components/layout/error-screen";

export default function NotFound() {
  return (
    <ErrorScreen
      code="404"
      title="Page not found"
      description="The page you're looking for doesn't exist or has been moved."
    />
  );
}
