import React, { useState, useEffect } from 'react';
import { X, Flame, ShieldAlert, UserMinus, UserPlus, Camera, Video, Mic, FileText, Check, AlertTriangle, Bell } from 'lucide-react';
import { HabitProject, FriendUser, CheckInRule } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

interface ProjectSettingsModalProps {
  isOpen: boolean;
  project: HabitProject | null;
  onClose: () => void;
  onUpdated: () => void;
}

export const ProjectSettingsModal: React.FC<ProjectSettingsModalProps> = ({
  isOpen,
  project,
  onClose,
  onUpdated,
}) => {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'rules' | 'members'>('rules');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Rules local state
  const [requirePhotos, setRequirePhotos] = useState(false);
  const [minPhotos, setMinPhotos] = useState(1);
  const [requireVideo, setRequireVideo] = useState(false);
  const [requireAudio, setRequireAudio] = useState(false);
  const [requireText, setRequireText] = useState(false);
  const [ruleNote, setRuleNote] = useState('');
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('21:00');
  const [reminderMessage, setReminderMessage] = useState('今天不要忘记打卡哦，快去完成吧！');

  const isCreator = project && user && project.creatorId === user.id;

  useEffect(() => {
    if (isOpen && project) {
      setError('');
      setSuccessMsg('');
      const r = project.rules || {};
      setRequirePhotos(!!r.requirePhotos);
      setMinPhotos(r.minPhotos || 1);
      setRequireVideo(!!r.requireVideo);
      setRequireAudio(!!r.requireAudio);
      setRequireText(!!r.requireText);
      setRuleNote(r.note || '');
      setReminderEnabled(r.reminderEnabled ?? project.reminderEnabled ?? true);
      setReminderTime(r.reminderTime || project.reminderTime || '21:00');
      setReminderMessage(
        r.reminderMessage ||
          project.reminderMessage ||
          '今天不要忘记打卡哦，快去完成吧！'
      );

      api
        .getFriends()
        .then((res) => setFriends(res))
        .catch(() => setFriends([]));
    }
  }, [isOpen, project]);

  if (!isOpen || !project) return null;

  const handleSaveRules = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const updatedRules: CheckInRule = {
        requirePhotos,
        minPhotos: requirePhotos ? minPhotos : 0,
        requireVideo,
        requireAudio,
        requireText,
        note: ruleNote.trim(),
        reminderEnabled,
        reminderTime,
        reminderMessage: reminderMessage.trim(), // 云端 D1 数据库规则强同步
      };

      await api.updateProjectRules(project.id, updatedRules);
      setSuccessMsg('打卡规则与提醒设置已更新！');
      onUpdated();
    } catch (err: any) {
      setError(err.message || '更新规则失败');
    } finally {
      setLoading(false);
    }
  };

  const handleKickMember = async (memberId: string) => {
    if (!window.confirm('确定要移出该成员吗？其历史火苗将被锁定保护，重新加入并连续打卡3天即可完全重燃恢复。')) {
      return;
    }
    setError('');
    setLoading(true);
    try {
      await api.removeMember(project.id, memberId);
      setSuccessMsg('已移出成员，该成员历史火花已被安全锁定。');
      onUpdated();
    } catch (err: any) {
      setError(err.message || '移出成员失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMember = async (friendId: string) => {
    setError('');
    setLoading(true);
    try {
      await api.addMember(project.id, friendId);
      setSuccessMsg('成员已添加/恢复入队。');
      onUpdated();
    } catch (err: any) {
      setError(err.message || '添加成员失败');
    } finally {
      setLoading(false);
    }
  };

  // Friends not currently in members
  const availableFriends = friends.filter((f) => !project.members.includes(f.id));

  // 核心改动 1：重构并置顶创建者名单（不论其是否参与打卡一律置顶，普通成员排在其后）
  const activeMembers = project.memberUsers || [];
  const isCreatorInMembers = activeMembers.some(m => m.id === project.creatorId);

  // 如果创建者勾选不参与，则在前端手动组装出一个带有“(创建者)”标识的监督员卡片，确保第一位永远是创建者
  const creatorUser: any = isCreatorInMembers 
    ? activeMembers.find(m => m.id === project.creatorId)
    : {
        id: project.creatorId,
        username: project.creatorId === user?.id ? user?.username : 'creator',
        nickname: project.creatorNickname || '项目创建者',
        avatar: project.creatorId === user?.id ? user?.avatar : `https://api.dicebear.com/7.x/avataaars/svg?seed=${project.creatorId}`,
        isCreatorOnly: true, // 标识仅作为创建者/监督员，不参与打卡
      };

  // 合并排序：创建者排在第一位，其余成员排在后
  const orderedList = [
    creatorUser, 
    ...activeMembers.filter(m => m.id !== project.creatorId)
  ].filter(Boolean);

  return (
    <div
      id="project-settings-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        id="project-settings-modal-card"
        className="w-full max-w-lg bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <div>
            <h2 className="text-base font-bold text-stone-900">{project.title}</h2>
            {/* 核心改动 2：将“共几位成员”文本重构为可点击链接，点击后自动、平滑地在前端切换到“成员与重燃管理”标签页 */}
            <p 
              onClick={() => setActiveTab('members')}
              className="text-[11px] text-stone-500 mt-0.5 cursor-pointer hover:underline hover:text-stone-800 transition-colors"
              title="点击查看成员名单"
            >
              创建者: {project.creatorNickname || '我'} · 共 <span className="font-bold text-stone-700 underline">{project.members.length}</span> 位成员
            </p>
          </div>
          <button
            id="btn-close-project-settings"
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex border-b border-stone-100 bg-stone-50/70 px-6 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('rules')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'rules'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            打卡规则管理
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('members')}
            className={`pb-2.5 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'members'
                ? 'border-stone-900 text-stone-900'
                : 'border-transparent text-stone-400 hover:text-stone-700'
            }`}
          >
            成员与重燃管理
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
              {error}
            </div>
          )}
          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-600" />
              <span>{successMsg}</span>
            </div>
          )}

          {activeTab === 'rules' && (
            <form onSubmit={handleSaveRules} className="space-y-4">
              {!isCreator && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-xl flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>只有项目创建者可以修改打卡规则（当前为只读展示）。</span>
                </div>
              )}

              <div className="space-y-2.5">
                {/* Photos */}
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                      <Camera className="w-4 h-4 text-stone-600" />
                      <span>必须上传照片</span>
                    </div>
                    <input
                      type="checkbox"
                      disabled={!isCreator}
                      checked={requirePhotos}
                      onChange={(e) => setRequirePhotos(e.target.checked)}
                      className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 disabled:opacity-50"
                    />
                  </div>
                  {requirePhotos && (
                    <div className="flex items-center gap-2 text-xs text-stone-600 pl-6">
                      <span>最少张数:</span>
                      {[1, 2, 3, 4].map((num) => (
                        <button
                          key={num}
                          type="button"
                          disabled={!isCreator}
                          onClick={() => setMinPhotos(num)}
                          className={`px-2 py-0.5 rounded-lg text-xs font-medium border ${
                            minPhotos === num
                              ? 'bg-stone-900 text-white border-stone-900'
                              : 'bg-white text-stone-700 border-stone-200'
                          } disabled:opacity-50`}
                        >
                          {num}张
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Video */}
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                    <Video className="w-4 h-4 text-stone-600" />
                    <span>必须上传视频</span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!isCreator}
                    checked={requireVideo}
                    onChange={(e) => setRequireVideo(e.target.checked)}
                    className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 disabled:opacity-50"
                  />
                </div>

                {/* Audio */}
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                    <Mic className="w-4 h-4 text-stone-600" />
                    <span>必须录制语音</span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!isCreator}
                    checked={requireAudio}
                    onChange={(e) => setRequireAudio(e.target.checked)}
                    className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 disabled:opacity-50"
                  />
                </div>

                {/* Text */}
                <div className="p-3.5 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                    <FileText className="w-4 h-4 text-stone-600" />
                    <span>必须填写文字感言</span>
                  </div>
                  <input
                    type="checkbox"
                    disabled={!isCreator}
                    checked={requireText}
                    onChange={(e) => setRequireText(e.target.checked)}
                    className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300 disabled:opacity-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-stone-700 mb-1">
                    规则说明备注
                  </label>
                  <input
                    type="text"
                    disabled={!isCreator}
                    value={ruleNote}
                    onChange={(e) => setRuleNote(e.target.value)}
                    placeholder="例如：每日打卡要求与规则变更说明"
                    className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900 disabled:opacity-50"
                  />
                </div>

                {/* Creator Custom Reminder Settings - 完美联动 D1 全局 enabled 状态，通道关闭时在此弹窗中也实现无痕隐形、不占行 */}
                {project.globalReminderEnabled !== false && (
                  <div className="pt-2 border-t border-stone-200 space-y-3 animate-in fade-in duration-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Bell className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-bold text-stone-800">微信每日提醒设置</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          id="checkbox-settings-reminder-toggle"
                          type="checkbox"
                          disabled={!isCreator}
                          checked={reminderEnabled}
                          onChange={(e) => setReminderEnabled(e.target.checked)}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300 disabled:opacity-50"
                        />
                        <label
                          htmlFor="checkbox-settings-reminder-toggle"
                          className="text-xs text-stone-700 font-semibold cursor-pointer"
                        >
                          开启每日催促
                        </label>
                      </div>
                    </div>

                    {reminderEnabled && (
                      <div className="p-3.5 bg-emerald-50/50 border border-emerald-200/80 rounded-2xl space-y-3">
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">
                            每日提醒推送时间
                          </label>
                          <input
                            type="time"
                            disabled={!isCreator}
                            value={reminderTime}
                            onChange={(e) => setReminderTime(e.target.value)}
                            className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600 disabled:opacity-50"
                          />
                          <span className="text-[10px] text-stone-500 ml-2">
                            若成员到此时仍未达标，将通过微信通知通道提醒
                          </span>
                        </div>

                        {/* 微信自定义催促文案 - 所见即所得，打字输入什么就发送什么，且彻底移除了下方的多余提示标签 */}
                        <div>
                          <label className="block text-[11px] font-bold text-stone-700 mb-1">
                            微信自定义催促文案
                          </label>
                          <textarea
                            rows={2}
                            disabled={!isCreator}
                            value={reminderMessage}
                            onChange={(e) => setReminderMessage(e.target.value)}
                            placeholder="今天不要忘记打卡哦，快去完成吧！"
                            className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none disabled:opacity-50"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {isCreator && (
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-2.5 bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-50"
                  >
                    {loading ? '保存中...' : '保存打卡规则与提醒配置'}
                  </button>
                </div>
              )}
            </form>
          )}

          {activeTab === 'members' && (
            <div className="space-y-4">
              <div>
                <div className="text-xs font-bold text-stone-900 mb-2">
                  当前打卡成员 ({project.members.length} 人)
                </div>
                <div className="space-y-2">
                  {/* 核心改动 3：使用有序的 orderedList 进行渲染，让创建者永远排在第一位置顶 */}
                  {orderedList.map((member: any) => {
                    const sparks = project.sparks[member.id] || 0;
                    const isSelf = member.id === user?.id;
                    const isProjectCreator = member.id === project.creatorId;

                    return (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-2.5 bg-stone-50 border border-stone-200 rounded-xl"
                      >
                        <div className="flex items-center gap-2.5">
                          <img
                            src={member.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                            alt=""
                            className="w-8 h-8 rounded-full object-cover"
                          />
                          <div>
                            <div className="text-xs font-semibold text-stone-900 flex items-center gap-1">
                              <span>{member.nickname}</span>
                              {isProjectCreator && (
                                <span className="px-1.5 py-0.2 bg-stone-900 text-white text-[10px] rounded font-bold">
                                  创建者 {member.isCreatorOnly ? '(监督员)' : ''}
                                </span>
                              )}
                              {isSelf && !member.isCreatorOnly && (
                                <span className="px-1.5 py-0.2 bg-stone-250 text-stone-700 text-[10px] rounded">
                                  我
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-500">
                              {member.username ? `@${member.username}` : '打卡成员'}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {/* 只有在成员实际参与打卡时，才展现火苗天数，监督员不展现火苗 */}
                          {!member.isCreatorOnly && (
                            <div className="flex items-center gap-1 px-2 py-0.5 bg-orange-100 text-orange-800 rounded-lg text-xs font-bold">
                              <Flame className="w-3 h-3 fill-current text-orange-600" />
                              <span>{sparks}天</span>
                            </div>
                          )}

                          {isCreator && !isProjectCreator && (
                            <button
                              type="button"
                              onClick={() => handleKickMember(member.id)}
                              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="移出成员（锁定历史火苗）"
                            >
                              <UserMinus className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Rekindle explanation note */}
              <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl text-[11px] text-stone-600 leading-relaxed flex items-start gap-2">
                <ShieldAlert className="w-4 h-4 text-orange-500 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-stone-900">重燃机制保障：</span>
                  被踢成员退出时的历史火苗被锁定保留；重新入队后连续打卡满 3 天即可完全重燃恢复全部历史火花。
                </div>
              </div>

              {/* Add friends to project */}
              {isCreator && (
                <div>
                  <div className="text-xs font-bold text-stone-900 mb-2">
                    邀请更多好友加入项目
                  </div>
                  {availableFriends.length === 0 ? (
                    <div className="text-xs text-stone-400 py-2">
                      暂无其他可用好友（可在好友标签页添加新好友）
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {availableFriends.map((friend) => (
                        <div
                          key={friend.id}
                          className="flex items-center justify-between p-2 bg-white border border-stone-200 rounded-xl hover:bg-stone-50 transition-colors"
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={friend.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover"
                            />
                            <div className="text-xs font-medium text-stone-800">
                              {friend.nickname}{' '}
                              <span className="text-stone-400 text-[10px]">
                                (@{friend.username})
                              </span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleAddMember(friend.id)}
                            className="px-2.5 py-1 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-lg flex items-center gap-1 transition-colors"
                          >
                            <UserPlus className="w-3.5 h-3.5" />
                            <span>加入项目</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
