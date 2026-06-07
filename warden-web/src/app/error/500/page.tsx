import { ErrorScreen } from "@/components/layout/error-screen";

export default function ServerErrorPage() {
  return (
    <ErrorScreen
      code="500"
      title="Something went wrong"
      description="An unexpected error occurred on our side. Please try again later."
      flickerColor="var(--destructive)"
    />
  );
}
