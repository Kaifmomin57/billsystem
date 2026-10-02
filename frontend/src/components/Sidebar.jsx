import { useState, useEffect } from "react";
import {
  HouseSimple, Users, Package, CurrencyCircleDollar,
  Receipt, ChartBar, CloudArrowUp,
  SignOut, Gear, List, X,
} from "@phosphor-icons/react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { authStorage } from "../lib/auth";

const NAV_ITEMS = [
  { label: "Dashboard",  icon: HouseSimple,          to: "/" },
  { label: "Customers",  icon: Users,                to: "/customers" },
  { label: "Products",   icon: Package,              to: "/products" },
  { label: "Rates",      icon: CurrencyCircleDollar, to: "/rates" },
  { label: "Bills",      icon: Receipt,              to: "/bills" },
  { label: "Upload",     icon: CloudArrowUp,         to: "/upload" },
  { label: "Reports",    icon: ChartBar,             to: "/reports" },
  { label: "Settings",   icon: Gear,                 to: "/settings" },
];

function SidebarContent({ onNavigate }) {
  const navigate = useNavigate();
  const handleLogout = () => { authStorage.clearToken(); navigate("/login"); };

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-md bg-emerald-600 flex items-center justify-center">
            <Receipt size={18} weight="bold" className="text-white" />
          </div>
          <div>
            <p className="text-sm font-bold text-zinc-100 leading-none">BillTrack</p>
            <p className="text-[11px] text-zinc-500 mt-0.5">Billing Management</p>
          </div>
        </div>
      </div>
      <nav className="flex flex-col gap-0.5 p-3 flex-1 overflow-y-auto">
        {NAV_ITEMS.map(({ label, icon: Icon, to }) => (
          <NavLink
            key={to} to={to} end={to === "/"} onClick={onNavigate}
            className={({ isActive }) => `sidebar-link ${isActive ? "active" : ""}`}
          >
            <Icon size={18} className="sidebar-link-icon" />
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="p-3 border-t border-zinc-800 shrink-0">
        <button onClick={handleLogout} className="sidebar-link w-full text-rose-400 hover:text-rose-300 hover:bg-rose-950/40">
          <SignOut size={18} className="sidebar-link-icon" />
          Sign Out
        </button>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[220px] shrink-0 flex-col bg-zinc-900 border-r border-zinc-800 min-h-[100dvh]">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex items-center gap-3 px-4 py-3 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
        <button onClick={() => setMobileOpen(true)} className="p-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 rounded-md" aria-label="Open menu">
          <List size={22} />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded bg-emerald-600 flex items-center justify-center">
            <Receipt size={13} weight="bold" className="text-white" />
          </div>
          <span className="text-sm font-bold text-zinc-100">BillTrack</span>
        </div>
      </div>

      {/* Overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
      )}

      {/* Mobile drawer */}
      <aside className={`lg:hidden fixed top-0 left-0 z-50 h-full w-[260px] bg-zinc-900 border-r border-zinc-800 flex flex-col transform transition-transform duration-300 ease-in-out ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded bg-emerald-600 flex items-center justify-center">
              <Receipt size={14} weight="bold" className="text-white" />
            </div>
            <span className="text-sm font-bold text-zinc-100">BillTrack</span>
          </div>
          <button onClick={() => setMobileOpen(false)} className="p-1 text-zinc-400 hover:text-zinc-100 rounded">
            <X size={20} />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </div>
      </aside>
    </>
  );
}

