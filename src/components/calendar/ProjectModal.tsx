import React, { useState, useEffect } from 'react';
import { HabitProject, FriendUser, CheckInRule } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import {
  X,
  Users,
  Check,
  Bell,
  Clock,
  Sparkles,
  Camera,
  Video,
  Mic,
  FileText,
} from 'lucide-react';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (project: HabitProject) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [isProxy, setIsProxy] = useState(false);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [creatorParticipates, setCreatorParticipates] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fetchingFriends, setFetchingFriends] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Rules
  const [requirePhotos, setRequirePhotos] = useState(true);
  const [minPhotos, setMinPhotos] = useState(1);
  const [requireVideo, setRequireVideo] = useState(false);
  const [requireAudio, setRequireAudio] = useState(false);
  const [requireText, setRequireText] = useState(true);
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('21:00');
  
  // 新增：所见即所得的微信催促原文本内容状态
  const [reminderMessage, setReminderMessage] = useState('今天不要忘记打卡哦，快去完成吧！');

  useEffect(() => {
    if (isOpen) {
      loadFriends();
      setTitle('');
      setIsProxy(false);
      setSelectedFriendIds([]);
      setCreatorParticipates(true);
      setReminderMessage('今天不要忘记打卡哦，快去完成吧！');
      setError(null);
    }
  }, [isOpen]);

  const loadFriends = async () => {
    setFetchingFriends(true);
    try {
      const list = await api.getFriends();
      setFriends(list);
    } catch (err) {
      console.error(err);
    } finally {
      setFetchingFriends(false);
    }
  };

  const handleToggleFriend = (friendId: string) => {
    if (selectedFriendIds.includes(friendId)) {
      setSelectedFriendIds(selectedFriendIds.filter((id) => id !== friendId));
    } else {
      setSelectedFriendIds([...selectedFriendIds, friendId]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('请输入打卡项目名称');
      return;
    }

    if (selectedFriendIds.length === 0 && !creatorParticipates) {
      setError('必须至少选择一位打卡成员或本人参与打卡');
      return;
    }

    setLoading(true);
    setError(null);

    const rules: CheckInRule = {
      requirePhotos,
      minPhotos: requirePhotos ? minPhotos : 0,
      requireVideo,
      requireAudio,
      requireText,
      reminderEnabled,
      reminderTime: reminderEnabled ? reminderTime : undefined,
      reminderMessage: reminderEnabled ? reminderMessage.trim() : undefined, // 写入 D1 规则 JSON 中云端同步
    };

    try {
      const project = await api.createProject({
        title: title.trim(),
        isProxy,
        selectedFriendIds,
        creatorParticipates,
        rules,
      });
      onSuccess(project);
      onClose();
    } catch (err: any) {
      setError(err.message || '创建项目失败，请重试');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-stone-200 overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-stone-100 bg-stone-50/50">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-stone-900 text-white rounded-xl">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-stone-900">新建自律打卡项目</h2>
              <p className="text-xs text-stone-500">创建专属打卡规则与火苗契约</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-stone-400 hover:text-stone-700 rounded-full hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
          {error && (
            <div className="p-3 text-xs bg-rose-50 border border-rose-200 text-rose-600 rounded-xl">
              {error}
            </div>
          )}

          {/* Project Title */}
          <div>
            <label className="block text-xs font-semibold text-stone-700 mb-1.5">
              项目名称 *
            </label>
            <input
              type="text"
              required
              placeholder="例如：每日晨跑 5 公里 / 英语单词 50 个"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-3 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
            />
          </div>

          {/* Mode Selector: Self vs Proxy */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setIsProxy(false)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                !isProxy
                  ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                  : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
              }`}
            >
              <div className="text-xs font-bold mb-0.5">普通打卡 / 组队打卡</div>
              <div
                className={`text-[10px] ${
                  !isProxy ? 'text-stone-300' : 'text-stone-400'
                }`}
              >
                自己打卡或与好友共同监督
              </div>
            </button>

            <button
              type="button"
              onClick={() => setIsProxy(true)}
              className={`p-3 rounded-2xl border text-left transition-all ${
                isProxy
                  ? 'border-stone-900 bg-stone-900 text-white shadow-sm'
                  : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-700'
              }`}
            >
              <div className="text-xs font-bold mb-0.5 flex items-center gap-1">
                代理打卡模式
                <span
                  className={`text-[9px] px-1.5 py-0.2 rounded-full ${
                    isProxy
                      ? 'bg-amber-400 text-stone-900 font-bold'
                      : 'bg-stone-200 text-stone-600'
                  }`}
                >
                  专属
                </span>
              </div>
              <div
                className={`text-[10px] ${
                  isProxy ? 'text-stone-300' : 'text-stone-400'
                }`}
              >
                帮他人或多成员代记打卡
              </div>
            </button>
          </div>

          {/* Member Selection if not purely solo */}
          <div className="p-4 bg-stone-50 rounded-2xl border border-stone-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-700 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-stone-500" />
                选择打卡成员 (多选)
              </label>
              <span className="text-[10px] text-stone-400">
                已选择 {selectedFriendIds.length} 位
              </span>
            </div>

            {fetchingFriends ? (
              <div className="py-6 text-center text-xs text-stone-400">加载好友中...</div>
            ) : friends.length === 0 ? (
              <div className="py-6 px-3 text-center text-xs text-stone-500 bg-white rounded-xl border border-stone-200">
                暂无已添加的好友，请先在【好友与私聊】中添加好友
              </div>
            ) : (
              <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                {friends.map((friend) => {
                  const isSelected = selectedFriendIds.includes(friend.id);
                  return (
                    <button
                      key={friend.id}
                      type="button"
                      onClick={() => handleToggleFriend(friend.id)}
                      className={`w-full flex items-center justify-between p-2 rounded-lg text-xs transition-colors ${
                        isSelected
                          ? 'bg-stone-900 text-white font-medium'
                          : 'bg-white hover:bg-stone-100 text-stone-700 border border-stone-200'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <img
                          src={
                            friend.avatar ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
                          }
                          alt=""
                          className="w-6 h-6 rounded-full object-cover"
                        />
                        <span>{friend.nickname}</span>
                        <span
                          className={`text-[10px] ${
                            isSelected ? 'text-stone-300' : 'text-stone-400'
                          }`}
                        >
                          (@{friend.username})
                        </span>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-white" />}
                    </button>
                  );
                })}
              </div>
            )}

            <div className="pt-2 border-t border-stone-200 flex items-center gap-2">
              <input
                type="checkbox"
                id="creatorParticipates"
                checked={creatorParticipates}
                onChange={(e) => setCreatorParticipates(e.target.checked)}
                className="w-4 h-4 text-stone-900 bg-stone-100 border-stone-300 rounded focus:ring-stone-900"
              />
              <label
                htmlFor="creatorParticipates"
                className="text-xs text-stone-600 select-none cursor-pointer"
              >
                是否我也参与打卡 (勾选后全员完全同步可见)
              </label>
            </div>
          </div>

          {/* Qualification Rules */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-stone-700 flex items-center justify-between">
              <span>合格判定规则 (达标点亮红日历)</span>
              <span className="text-[10px] text-stone-400 font-normal">满足即算打卡成功</span>
            </label>

            <div className="grid grid-cols-2 gap-2.5">
              {/* Photos */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-stone-500" />
                    需上传图片
                  </span>
                  <input
                    type="checkbox"
                    checked={requirePhotos}
                    onChange={(e) => setRequirePhotos(e.target.checked)}
                    className="w-4 h-4 text-stone-900 rounded"
                  />
                </div>
                {requirePhotos && (
                  <div className="flex items-center justify-between text-[10px] text-stone-500 pt-1 border-t border-stone-200/60">
                    <span>最少张数:</span>
                    <select
                      value={minPhotos}
                      onChange={(e) => setMinPhotos(Number(e.target.value))}
                      className="bg-white border border-stone-200 rounded px-1.5 py-0.5 text-stone-800"
                    >
                      <option value={1}>1 张</option>
                      <option value={2}>2 张</option>
                      <option value={3}>3 张</option>
                      <option value={4}>4 张</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Text */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-stone-500" />
                  需填写心得文字
                </span>
                <input
                  type="checkbox"
                  checked={requireText}
                  onChange={(e) => setRequireText(e.target.checked)}
                  className="w-4 h-4 text-stone-900 rounded"
                />
              </div>

              {/* Video */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
                  <Video className="w-3.5 h-3.5 text-stone-500" />
                  需上传视频
                </span>
                <input
                  type="checkbox"
                  checked={requireVideo}
                  onChange={(e) => setRequireVideo(e.target.checked)}
                  className="w-4 h-4 text-stone-900 rounded"
                />
              </div>

              {/* Audio */}
              <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                <span className="text-xs font-medium text-stone-700 flex items-center gap-1.5">
                  <Mic className="w-3.5 h-3.5 text-stone-500" />
                  需录制语音
                </span>
                <input
                  type="checkbox"
                  checked={requireAudio}
                  onChange={(e) => setRequireAudio(e.target.checked)}
                  className="w-4 h-4 text-stone-900 rounded"
                />
              </div>
            </div>
          </div>

          {/* Daily Reminder & ServerChan */}
          <div className="p-4 bg-amber-50/60 rounded-2xl border border-amber-200/80 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-600" />
                <span className="text-xs font-bold text-amber-900">
                  微信每日打卡督促 (ServerChan 微信推送)
                </span>
              </div>
              <input
                type="checkbox"
                checked={reminderEnabled}
                onChange={(e) => setReminderEnabled(e.target.checked)}
                className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
              />
            </div>

            {reminderEnabled && (
              <div className="space-y-3 pt-2 border-t border-amber-200/50">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-amber-800 flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    每日催促时间:
                  </span>
                  <input
                    type="time"
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="bg-white border border-amber-200 text-stone-900 rounded-lg px-2.5 py-1 text-xs focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                {/* 微信自定义催促文案输入框 - 实现纯文字所见即所得设计 */}
                <div>
                  <label className="block text-[11px] font-bold text-amber-900 mb-1">
                    微信自定义催促文案
                  </label>
                  <textarea
                    rows={2}
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    placeholder="今天不要忘记打卡哦，快去完成吧！"
                    className="w-full px-3 py-2 bg-white border border-amber-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 resize-none"
                  />
                  <p className="text-[10px] text-amber-700/80 mt-0.5 leading-relaxed">
                    在文本框中输入什么字，系统推送时就会微信一字不差地精准发送给成员。
                  </p>
                </div>
              </div>
            )}
            <p className="text-[10px] text-amber-700/80 leading-relaxed">
              开启后，若当日在此时间前未达标，系统将自动向绑定 SendKey 的成员发送微信打卡督促。
            </p>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-stone-100 bg-stone-50 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 text-xs font-semibold text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-xl transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="px-6 py-2.5 bg-stone-900 hover:bg-stone-800 disabled:opacity-50 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-2"
          >
            {loading ? '正在创建...' : '立即创建项目'}
          </button>
        </div>
      </div>
    </div>
  );
};
