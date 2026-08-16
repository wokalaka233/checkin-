import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AuthCard } from './components/auth/AuthCard';
import { CalendarView } from './components/calendar/CalendarView';
import { FriendsView } from './components/friends/FriendsView';
import { ProfileView } from './components/profile/ProfileView';
import { BottomNav } from './components/layout/BottomNav';
import { AdminDashboard } from './components/admin/AdminDashboard';

const MainApp: React.FC = () => {
  const { user, loading } = useAuth();
  const [activeTab, setActiveTab] = useState<'calendar' | 'friends' | 'profile'>('calendar');

  if (loading) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-6 h-6 border-2 border-stone-900 border-t-transparent rounded-full animate-spin" />
          <span className="text-xs text-stone-500 font-medium">加载中...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <AuthCard />;
  }

  // Master Admin Account Root View
  if (user.isAdmin || user.username === 'admin') {
    return <AdminDashboard />;
  }

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 flex flex-col justify-between selection:bg-stone-900 selection:text-white">
      <div className="flex-1">
        {activeTab === 'calendar' && <CalendarView />}
        {activeTab === 'friends' && <FriendsView />}
        {activeTab === 'profile' && <ProfileView />}
      </div>

      <BottomNav
        activeTab={activeTab}
        onChangeTab={(tab) => setActiveTab(tab)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
