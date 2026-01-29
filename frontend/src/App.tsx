import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LayoutShell } from './components/LayoutShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { RunsPage } from './pages/RunsPage';
import { PlayersPage } from './pages/PlayersPage';
import { SalesPage } from './pages/SalesPage';
import { SettingsPage } from './pages/SettingsPage';
import { RunDetailPage } from './pages/RunDetailPage';
import { ProfilePage } from './pages/ProfilePage';

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <LayoutShell>
                  <DashboardPage />
                </LayoutShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/runs"
            element={
              <ProtectedRoute>
                <LayoutShell>
                  <RunsPage />
                </LayoutShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/runs/:id"
            element={
              <ProtectedRoute>
                <LayoutShell>
                  <RunDetailPage />
                </LayoutShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/players"
            element={
              <ProtectedRoute>
                <LayoutShell>
                  <PlayersPage />
                </LayoutShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sales"
            element={
              <ProtectedRoute>
                <LayoutShell>
                  <SalesPage />
                </LayoutShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element=
            {
              <ProtectedRoute>
                <LayoutShell>
                  <SettingsPage />
                </LayoutShell>
              </ProtectedRoute>
            }
          />
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <LayoutShell>
                  <ProfilePage />
                </LayoutShell>
              </ProtectedRoute>
            }
          />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
