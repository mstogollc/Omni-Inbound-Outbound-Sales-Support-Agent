import React, { useState, useEffect } from 'react';
import { LoginScreen } from './components/LoginScreen';
import { DashboardLayout } from './components/DashboardLayout';
import { User } from './types';
import { apiService } from './services/apiService';

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Check for existing session on initial load
  useEffect(() => {
    const checkSession = async () => {
      const sessionUser = await apiService.checkSession();
      if (sessionUser) {
        setUser(sessionUser);
      }
      setLoading(false);
    };
    checkSession();
  }, []);

  const handleLogin = async (email: string, password: string): Promise<User> => {
    const loggedInUser = await apiService.login(email, password);
    setUser(loggedInUser);
    return loggedInUser;
  };

  const handleLogout = async () => {
    await apiService.logout();
    setUser(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
        Loading...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 font-sans">
      {user ? (
        <DashboardLayout user={user} onLogout={handleLogout} />
      ) : (
        <LoginScreen onLogin={handleLogin} />
      )}
    </div>
  );
};

export default App;
