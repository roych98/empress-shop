import type { ReactNode } from 'react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

interface LayoutShellProps {
  children: ReactNode;
}

export function LayoutShell({ children }: LayoutShellProps) {
  const { user, logout } = useAuth();

  return (
    <div className="app-root">
      <aside className="app-sidebar">
        <div className="app-sidebar-header">
          <Link to="/" className="app-logo">
            Empress Tracker
          </Link>
        </div>
        <nav className="app-nav">
          <NavLink to="/" end className="app-nav-link">
            Dashboard
          </NavLink>
          <NavLink to="/runs" className="app-nav-link">
            Runs
          </NavLink>
          <NavLink to="/players" className="app-nav-link">
            Players
          </NavLink>
          <NavLink to="/sales" className="app-nav-link">
            Sales
          </NavLink>
          <NavLink to="/profile" className="app-nav-link">
            Profile
          </NavLink>
          <NavLink to="/settings" className="app-nav-link">
            Settings
          </NavLink>
        </nav>
      </aside>
      <div className="app-main">
        <header className="app-header">
          <div className="app-header-right">
            {user && (
              <>
                <span className="app-user">
                  {user.email} ({user.role})
                </span>
                <button type="button" className="app-button-ghost" onClick={logout}>
                  Logout
                </button>
              </>
            )}
          </div>
        </header>
        <main className="app-content">{children}</main>
      </div>
    </div>
  );
}

