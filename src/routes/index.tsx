import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { Brand } from "@/components/Brand";

export const Route = createFileRoute("/")({
  component: Index,
});

function Index() {
  const { session, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Brand />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" />;
  if (role === "master_admin" || role === "owner") return <Navigate to="/admin/dashboard" />;
  return <Navigate to="/resident/home" />;
}
