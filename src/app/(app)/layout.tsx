import { BottomNav } from "@/components/shared/BottomNav";
import { InstallPrompt } from "@/components/shared/InstallPrompt";
import { AppBootstrap } from "@/components/shared/AppBootstrap";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col min-h-dvh">
      <AppBootstrap />
      <main className="flex-1 pb-20 overflow-y-auto">{children}</main>
      <BottomNav />
      <InstallPrompt />
    </div>
  );
}
