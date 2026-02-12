import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { UserNav } from "@/components/UserNav";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-mist/30">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14 sm:h-16">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 sm:w-8 sm:h-8 bg-lagoon rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs sm:text-sm">R</span>
              </div>
              <span className="font-semibold text-ink text-base sm:text-lg">Riciti</span>
            </div>
            <UserNav 
              email={user.email!}
              name={user.user_metadata?.full_name}
              avatarUrl={user.user_metadata?.avatar_url}
            />
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
    </div>
  );
}
