import { useEffect } from "react";
import { Outlet } from "react-router-dom";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import { AdminHeader } from "./AdminHeader";

const SIDEBAR_KEY = "admin_sidebar_open";

export default function AdminLayout() {
  useEffect(() => {
    document.title = "Painel — 85 TATTOO";
  }, []);

  const defaultOpen = (() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem(SIDEBAR_KEY);
    return v === null ? true : v === "true";
  })();

  return (
    <SidebarProvider
      defaultOpen={defaultOpen}
      onOpenChange={(open) => {
        try {
          localStorage.setItem(SIDEBAR_KEY, String(open));
        } catch {
          /* noop */
        }
      }}
    >
      <div className="admin-shell flex min-h-screen w-full">
        <AdminSidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <AdminHeader />
          <main className="flex-1 overflow-x-hidden">
            <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
