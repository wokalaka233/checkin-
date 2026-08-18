import React, { useState, useEffect, useCallback } from 'react';
import { HabitProject } from '../../types';
import { api } from '../../services/api';
import { ProjectCapsules } from './ProjectCapsules';
import { CalendarGrid } from './CalendarGrid';
import { CheckInDrawer } from './CheckInDrawer';
import { ProjectModal } from './ProjectModal';
import { ProjectSettingsModal } from './ProjectSettingsModal';
import { useAuth } from '../../context/AuthContext';

export const CalendarView: React.FC = () => {
  const { user } = useAuth();
  const [projects, setProjects] = useState<HabitProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [loadingProjects, setLoadingProjects] = useState(true);

  // Month state
  const [currentMonthDate, setCurrentMonthDate] = useState<Date>(new Date());
  const [daysData, setDaysData] = useState<Record<string, any>>({});
  const [loadingCalendar, setLoadingCalendar] = useState(false);

  // Modals & Drawers
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [selectedDateForDrawer, setSelectedDateForDrawer] = useState<string | null>(null);

  // Fetch projects (同步化决策更新，合并渲染，彻底解决“空白占位闪烁”问题)
  const fetchProjects = useCallback(async (selectId?: string) => {
    try {
      setLoadingProjects(true);
      const list = await api.getProjects();
      
      let nextActiveId: string | null = null;
      if (list.length > 0) {
        if (selectId && list.some((p) => p.id === selectId)) {
          nextActiveId = selectId;
        } else if (activeProjectId && list.some((p) => p.id === activeProjectId)) {
          nextActiveId = activeProjectId;
        } else {
          nextActiveId = list[0].id;
        }
      }

      setProjects(list);
      setActiveProjectId(nextActiveId);
    } catch (e) {
      console.error('Failed to load projects:', e);
    } finally {
      setLoadingProjects(false);
    }
  }, [activeProjectId]);

  useEffect(() => {
    fetchProjects();
  }, []);

  // Fetch calendar records for active project & month (引入 Effect Cleanup 异步竞态锁定锁，彻底解决“日历覆盖消失”Bug)
  useEffect(() => {
    let isCurrent = true;

    const loadCalendarData = async () => {
      if (!activeProjectId) {
        setDaysData({});
        return;
      }

      const year = currentMonthDate.getFullYear();
      const month = currentMonthDate.getMonth() + 1;
      const monthStr = `${year}-${month < 10 ? `0${month}` : month}`;

      try {
        setLoadingCalendar(true);
        const res = await api.getCalendarData(activeProjectId, monthStr);
        if (isCurrent) {
          setDaysData(res.days || {});
        }
      } catch (e) {
        console.error('Failed to fetch calendar:', e);
      } finally {
        if (isCurrent) {
          setLoadingCalendar(false);
        }
      }
    };

    loadCalendarData();

    return () => {
      isCurrent = false; // 组件卸载、项目切换或月份切换时，抛弃前一个正在处理的慢速异步网络请求，严防数据覆盖
    };
  }, [activeProjectId, currentMonthDate]);

  // Month navigation handlers
  const handlePrevMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonthDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const handleToday = () => {
    setCurrentMonthDate(new Date());
  };

  const activeProject = projects.find((p) => p.id === activeProjectId) || null;

  return (
    <div className="w-full min-h-screen bg-stone-50/60 pb-24">
      {/* Top Project Navigation Bar */}
      <ProjectCapsules
        projects={projects}
        activeProjectId={activeProjectId}
        onSelectProject={(id) => setActiveProjectId(id)}
        onOpenCreateModal={() => setIsCreateModalOpen(true)}
        onOpenSettingsModal={() => setIsSettingsModalOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-4xl mx-auto px-4 py-4 space-y-4">
        {/* User bar with current user status */}
        <div className="flex items-center justify-between text-xs text-stone-500 px-1">
          <div className="flex items-center gap-2">
            <img
              src={user?.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
              alt=""
              className="w-6 h-6 rounded-full object-cover border border-stone-200"
            />
            <span className="font-semibold text-stone-800">{user?.nickname}</span>
            <span>(@{user?.username})</span>
          </div>

          <div className="text-[11px] text-stone-400">
            已登录 · 打卡助手
          </div>
        </div>

        {/* Project status banner */}
        {activeProject && (
          <div className="bg-white rounded-2xl border border-stone-200 p-4 shadow-xs flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-bold text-stone-900 flex flex-wrap items-center gap-2">
                <span>{activeProject.title}</span>
                {activeProject.rekindleStatus?.isRekindling ? (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-900 text-[11px] font-bold rounded-md">
                    重燃恢复中 ({activeProject.rekindleStatus.progress}/3) · 历史火苗: {activeProject.rekindleStatus.lockedSparks}天
                  </span>
                ) : (
                  <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[11px] font-bold rounded-md">
                    🔥 个人火花: {activeProject.currentUserSpark || activeProject.sparks?.[user?.id || ''] || 0} 天
                  </span>
                )}
                {(activeProject.reminderEnabled ?? activeProject.rules?.reminderEnabled) && (
                  <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-bold rounded-md">
                    ⏰ 微信每日催促 {activeProject.reminderTime || activeProject.rules?.reminderTime || '21:00'}
                  </span>
                )}
              </div>
              <p className="text-xs text-stone-500 mt-1">
                {activeProject.rules?.note || '点击日历中任意日期即可提交或查看打卡详情'}
              </p>
            </div>

            <button
              id="btn-quick-today-checkin"
              type="button"
              onClick={() => setSelectedDateForDrawer(new Date().toISOString().slice(0, 10))}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 active:scale-95 text-white text-xs font-semibold rounded-xl transition-all shadow-xs"
            >
              今日打卡
            </button>
          </div>
        )}

        {/* Real Calendar Grid */}
        {activeProject ? (
          <CalendarGrid
            currentMonthDate={currentMonthDate}
            onPrevMonth={handlePrevMonth}
            onNextMonth={handleNextMonth}
            onToday={handleToday}
            daysData={daysData}
            onSelectDate={(dateStr) => setSelectedDateForDrawer(dateStr)}
          />
        ) : loadingProjects ? (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-xs">
            <p className="text-sm text-stone-400">正在云端同步项目...</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-stone-200 p-12 text-center shadow-xs space-y-3">
            <p className="text-sm text-stone-600">您当前还没有任何打卡项目</p>
            <button
              type="button"
              onClick={() => setIsCreateModalOpen(true)}
              className="px-4 py-2 bg-stone-900 text-white text-xs font-semibold rounded-xl hover:bg-stone-800 transition-colors"
            >
              立即创建打卡项目
            </button>
          </div>
        )}
      </main>

      {/* Project Creation Modal */}
      <ProjectModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(proj) => {
          fetchProjects(proj.id);
        }}
      />

      {/* Project Settings & Member Management Modal */}
      {activeProject && (
        <ProjectSettingsModal
          isOpen={isSettingsModalOpen}
          project={activeProject}
          onClose={() => setIsSettingsModalOpen(false)}
          onUpdated={() => {
            fetchProjects(activeProject.id);
          }}
        />
      )}

      {/* Check-in Detail Drawer */}
      {selectedDateForDrawer && activeProject && (
        <CheckInDrawer
          isOpen={!!selectedDateForDrawer}
          dateStr={selectedDateForDrawer}
          project={activeProject}
          onClose={() => setSelectedDateForDrawer(null)}
          onCheckInSuccess={() => {
            fetchProjects(activeProject.id);
          }}
        />
      )}
    </div>
  );
};
