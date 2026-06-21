import { LoginForm } from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-8">
        <div className="space-y-2 text-center">
          <h1 className="text-4xl font-bold tracking-tight">Forge</h1>
          <p className="text-muted-foreground text-sm">
            Declare a goal. Forge the machine to reach it.
          </p>
        </div>
        <LoginForm />
      </div>
    </div>
  );
}
