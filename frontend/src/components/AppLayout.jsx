import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";

export default function AppLayout() {
  return (
    <div className="flex min-h-[100dvh]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 pt-[72px] lg:pt-6 animate-fade-in">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
