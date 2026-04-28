import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Video, Image as ImageIcon, User, LogOut, Eye } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardLayout() {
  const navigate = useNavigate();

  const handleSignOut = () => {
    localStorage.removeItem('auth');
    navigate('/');
  };

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Video Analysis', path: '/dashboard/video', icon: Video },
    { name: 'Photo Analysis', path: '/dashboard/photo', icon: ImageIcon },
    { name: 'Profile', path: '/dashboard/profile', icon: User },
  ];

  return (
    <div className="dashboard-shell flex h-screen overflow-hidden font-sans">
      <motion.aside 
        initial={{ x: -200, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.5 }}
        className="relative z-20 flex w-72 flex-col border-r border-white/10 bg-gradient-to-b from-[#020617] via-[#081120] to-[#0f172a] shadow-2xl shadow-black/40"
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-cyan-500/10 to-transparent" />

        <div className="relative p-6">
          <div className="glass-card flex items-center space-x-3 rounded-2xl border-white/10 bg-white/[0.06] px-4 py-4 shadow-cyan-500/10">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-400 via-sky-500 to-purple-500 shadow-lg shadow-cyan-500/30">
              <Eye className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.3em] text-cyan-300/80">AI Suite</p>
              <h1 className="text-xl font-bold tracking-tight text-white">
                TruthLens AI
              </h1>
            </div>
          </div>
        </div>

        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        
        <nav className="flex-1 px-4 py-6 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              end={item.path === '/dashboard'}
              className={({ isActive }) =>
                `group flex items-center space-x-3 rounded-2xl px-4 py-3.5 font-medium transition-all duration-300 ${
                  isActive
                    ? 'border border-cyan-400/20 bg-cyan-500/10 text-cyan-300 shadow-lg shadow-cyan-500/10'
                    : 'text-slate-400 hover:translate-x-1 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 transition-all duration-300 group-hover:bg-white/10">
                <item.icon className="h-5 w-5" />
              </span>
              <span>{item.name}</span>
            </NavLink>
          ))}
        </nav>

        <div className="mx-6 h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />

        <div className="p-4">
          <button
            onClick={handleSignOut}
            className="group flex w-full items-center space-x-3 rounded-2xl px-4 py-3.5 font-medium text-slate-400 transition-all duration-300 hover:translate-x-1 hover:bg-white/5 hover:text-red-300"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/5 transition-all duration-300 group-hover:bg-red-500/10">
              <LogOut className="h-5 w-5" />
            </span>
            <span>Sign Out</span>
          </button>
        </div>
      </motion.aside>

      <main className="relative flex-1 overflow-y-auto">
        <div className="dashboard-grid-overlay pointer-events-none absolute inset-0 opacity-25" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-cyan-500/10 via-blue-500/5 to-transparent" />
        <div className="relative min-h-full">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
