import React from 'react';
import { Plus, Flame, Settings, Users } from 'lucide-react';
import { HabitProject } from '../../types';
import { useAuth } from '../../context/AuthContext';

interface ProjectCapsulesProps {
  projects: HabitProject[];
  activeProjectId: string | null;
  onSelectProject: (id: string) => void;
  onOpenCreateModal: () => void;
  onOpenSettingsModal: () => void;
}

export const ProjectCapsules: React.FC<ProjectCapsulesProps> = ({
  projects,
  activeProjectId,
  onSelectProject,
  onOpenCreateModal,
  onOpenSettingsModal,
}) => {
  const { user } = useAuth();
  const activeProject = projects.find((p) => p.id === activeProjectId);
  const isCreator = activeProject && user && activeProject.creatorId === user.id;

  return (
    <div className="w-full bg-white border-b border-stone-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
            {projects.map((project) => {
              const isActive = project.id === activeProjectId;
              const isRekindling = project.rekindleStatus?.isRekindling;
              const sparks = project.currentUserSpark ?? 0;

              return (
                <button
                  key={project.id}
                  id={`project-capsule-${project.id}`}
                  type="button"
                  onClick={() => onSelectProject(project.id)}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs whitespace-nowrap transition-all border ${
                    isActive
                      ? 'bg-stone-900 border-stone-900 text-white font-medium shadow-xs'
                      : 'bg-stone-100/80 border-stone-200 text-stone-700 hover:bg-stone-200/70 hover:border-stone-300'
                  }`}
                >
                  <span>{project.title}</span>
                  <div
                    className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[11px] font-bold ${
                      isActive
                        ? isRekindling
                          ? 'bg-amber-500 text-stone-950'
                          : 'bg-orange-500 text-white'
                        : isRekindling
                        ? 'bg-amber-100 text-amber-900'
                        : 'bg-orange-100 text-orange-700'
                    }`}
                  >
                    <Flame className="w-3 h-3 fill-current" />
                    {isRekindling ? (
                      <span>重燃 {project.rekindleStatus?.progress}/3</span>
                    ) : (
                      <span>{sparks}天</span>
                    )}
                  </div>
                </button>
              );
            })}

            {projects.length === 0 && (
              <span className="text-xs text-stone-400 py-1">
                暂未加入打卡项目，请先创建
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5 flex-shrink-0">
            {activeProject && (
              <button
                id="btn-project-settings"
                type="button"
                onClick={onOpenSettingsModal}
                className="p-2 rounded-full text-stone-600 hover:text-stone-900 hover:bg-stone-100 border border-stone-200 transition-colors"
                title={isCreator ? '项目设置与成员管理' : '查看项目成员'}
              >
                {isCreator ? (
                  <Settings className="w-4 h-4" />
                ) : (
                  <Users className="w-4 h-4" />
                )}
              </button>
            )}

            <button
              id="btn-open-create-project"
              type="button"
              onClick={onOpenCreateModal}
              className="flex items-center gap-1 px-3 py-1.5 bg-stone-900 hover:bg-stone-800 text-white rounded-full text-xs font-semibold shadow-xs transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>创建打卡</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
