import React from 'react';
import { Calendar, MessageSquare, User } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface BottomNavProps {
  activeTab: 'calendar' | 'friends' | 'profile';
  onChangeTab: (tab: 'calendar' | 'friends' | 'profile') => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ activeTab, onChangeTab }) => {
  const { unreadBadge } = useAuth();

  return (
    <nav
      id="bottom-navigation-bar"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-stone-200"
    >
      <div className="max-w-xl mx-auto flex items-center justify-around h-16 px-4">
        {/* Tab 1: 打卡日历 */}
        <button
          id="nav-tab-calendar"
          type="button"
          onClick={() => onChangeTab('calendar')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors relative ${
            activeTab === 'calendar' ? 'text-stone-900 font-semibold' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <Calendar className="w-5 h-5 mb-1 stroke-[2.2]" />
          <span className="text-xs">打卡日历</span>
          {activeTab === 'calendar' && (
            <span className="absolute bottom-1 w-8 h-0.5 bg-stone-900 rounded-full" />
          )}
        </button>

        {/* Tab 2: 好友 */}
        <button
          id="nav-tab-friends"
          type="button"
          onClick={() => onChangeTab('friends')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors relative ${
            activeTab === 'friends' ? 'text-stone-900 font-semibold' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <div className="relative">
            <MessageSquare className="w-5 h-5 mb-1 stroke-[2.2]" />
            {unreadBadge > 0 && (
              <span
                id="friends-unread-badge"
                className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white"
              >
                {unreadBadge > 99 ? '99+' : unreadBadge}
              </span>
            )}
          </div>
          <span className="text-xs">好友</span>
          {activeTab === 'friends' && (
            <span className="absolute bottom-1 w-8 h-0.5 bg-stone-900 rounded-full" />
          )}
        </button>

        {/* Tab 3: 我 */}
        <button
          id="nav-tab-profile"
          type="button"
          onClick={() => onChangeTab('profile')}
          className={`flex flex-col items-center justify-center flex-1 h-full py-1 transition-colors relative ${
            activeTab === 'profile' ? 'text-stone-900 font-semibold' : 'text-stone-400 hover:text-stone-600'
          }`}
        >
          <User className="w-5 h-5 mb-1 stroke-[2.2]" />
          <span className="text-xs">我</span>
          {activeTab === 'profile' && (
            <span className="absolute bottom-1 w-8 h-0.5 bg-stone-900 rounded-full" />
          )}
        </button>
      </div>
    </nav>
  );
};

