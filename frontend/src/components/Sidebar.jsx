import { useState, useEffect } from "react";
import {
  HouseSimple, Users, Package, CurrencyCircleDollar,
  Receipt, ChartBar, CloudArrowUp,
  SignOut, Gear, List, X, Storefront, Printer
} from "@phosphor-icons/react";
import { NavLink, useNavigate, useLocation } from "react-router-dom";
import { authStorage } from "../lib/auth";

const NAV_SECTIONS = [
  {
    title: "Billing",
    items: [
      { label: "Dashboard", icon: HouseSimple, to: "/" },
      { label: "Bills & Invoices", icon: Receipt, to: "/bills" },
      { label: "Thermal Printer", icon: Printer, to: "/printer" },
      { label: "Upload Ledger", icon: CloudArrowUp, to: "/upload" },
    ],
  },
  {
    title: "Masters",
    items: [
      { label: "Customers", icon: Users, to: "/customers" },
      { label: "Products", icon: Package, to: "/products" },
      { label: "Rates", icon: CurrencyCircleDollar, to: "/rates" },
    ],
  },
  {
    title: "Insights & Tools",
    items: [
      { label: "Reports", icon: ChartBar, to: "/reports" },
      { label: "Settings", icon: Gear, to: "/settings" },
    ],
  },
];

function SidebarContent({ onNavigate }) {
  const navigate = useNavigate();
  const handleLogout = () => { authStorage.clearToken(); navigate("/login"); };

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800">
      {/* Brand Header */}
      <div className="px-5 py-5 border-b border-zinc-800 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#047857] flex items-center justify-center text-white shadow-sm shrink-0">
            <Storefront size={22} weight="bold" />
          </div>
          <div>
            <p className="text-base font-bold text-zinc-100 tracking-tight leading-tight">BillTrack</p>
            <p className="text-xs text-zinc-400">Billing & Ledger Assistant</p>
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <nav aria-label="Main navigation" className="flex flex-col gap-6 p-3 flex-1 overflow-y-auto">
        {NAV_SECTIONS.map((section) => (
          <div key={section.title} className="flex flex-col gap-1">
            <p className="px-3 pb-1 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
              {section.title}
            </p>
            {section.items.map(({ label, icon: Icon, to }) => (
              <NavLink
                key={to}
                to={to}
                end={to === "/"}
                onClick={onNavigate}
                className={({ isActive }) =>
                  `sidebar-link min-h-[44px] ${isActive ? "active" : ""}`
                }
              >
                <Icon size={20} className="sidebar-link-icon" weight="bold" />
                <span className="text-base">{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>

      {/* Footer / Sign Out */}
      <div className="p-3 border-t border-zinc-800 shrink-0">
        <button
          onClick={handleLogout}
          className="sidebar-link w-full min-h-[44px] text-zinc-300 hover:text-rose-400 hover:bg-rose-500/10"
        >
          <SignOut size={20} className="sidebar-link-icon" weight="bold" />
          <span className="text-base">Sign Out</span>
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
      <aside className="hidden lg:flex w-[240px] shrink-0 flex-col min-h-[100dvh]">
        <SidebarContent onNavigate={() => {}} />
      </aside>

      {/* Mobile top bar */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 flex min-h-[58px] items-center justify-between px-4 py-2 bg-zinc-950/95 backdrop-blur-md border-b border-zinc-800">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileOpen(true)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-300 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
            aria-label="Open menu"
          >
            <List size={22} weight="bold" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#047857] flex items-center justify-center text-white">
              <Storefront size={18} weight="bold" />
            </div>
            <span className="text-base font-bold text-zinc-100">BillTrack</span>
          </div>
        </div>

        <NavLink
          to="/bills"
          className="min-h-[44px] px-3.5 rounded-lg bg-[#047857] text-white flex items-center gap-1.5 font-semibold text-sm shadow-sm active:bg-[#065F46]"
        >
          <Receipt size={18} weight="bold" />
          <span>Bills</span>
        </NavLink>
      </div>

      {/* Mobile bottom navigation bar (min 44px hit targets) */}
      <nav
        aria-label="Mobile bottom navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-zinc-950/95 border-t border-zinc-800 backdrop-blur-md px-2 py-1 flex items-center justify-around min-h-[56px]"
      >
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2 rounded-lg text-xs font-medium transition-colors ${
              isActive ? "text-emerald-400 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`
          }
        >
          <HouseSimple size={20} weight="bold" />
          <span>Home</span>
        </NavLink>

        <NavLink
          to="/bills"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2 rounded-lg text-xs font-medium transition-colors ${
              isActive ? "text-emerald-400 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`
          }
        >
          <Receipt size={20} weight="bold" />
          <span>Bills</span>
        </NavLink>

        <NavLink
          to="/upload"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2 rounded-lg text-xs font-medium transition-colors ${
              isActive ? "text-emerald-400 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`
          }
        >
          <CloudArrowUp size={20} weight="bold" />
          <span>Scan</span>
        </NavLink>

        <NavLink
          to="/rates"
          className={({ isActive }) =>
            `flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2 rounded-lg text-xs font-medium transition-colors ${
              isActive ? "text-emerald-400 font-bold" : "text-zinc-400 hover:text-zinc-200"
            }`
          }
        >
          <CurrencyCircleDollar size={20} weight="bold" />
          <span>Rates</span>
        </NavLink>

        <button
          onClick={() => setMobileOpen(true)}
          className="flex flex-col items-center justify-center min-h-[44px] min-w-[48px] py-1 px-2 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200"
        >
          <List size={20} weight="bold" />
          <span>More</span>
        </button>
      </nav>

      {/* Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-black/75 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={`lg:hidden fixed top-0 left-0 z-50 h-full w-[280px] bg-zinc-950 border-r border-zinc-800 flex flex-col transform transition-transform duration-200 ease-in-out ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex min-h-[58px] items-center justify-between px-4 py-2 border-b border-zinc-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-[#047857] flex items-center justify-center text-white">
              <Storefront size={18} weight="bold" />
            </div>
            <span className="text-base font-bold text-zinc-100">BillTrack</span>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center text-zinc-400 hover:text-white rounded-lg hover:bg-zinc-800"
          >
            <X size={20} weight="bold" />
          </button>
        </div>
        <div className="flex-1 overflow-hidden">
          <SidebarContent onNavigate={() => setMobileOpen(false)} />
        </div>
      </aside>
    </>
  );
}
