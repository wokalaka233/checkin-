import React, { useState, useEffect } from 'react';
import { X, User, Users, Check, Camera, Video, Mic, FileText, AlertCircle, Bell } from 'lucide-react';
import { FriendUser, CheckInRule } from '../../types';
import { api } from '../../services/api';

interface ProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newProjectId: string) => void;
}

export const ProjectModal: React.FC<ProjectModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [creationType, setCreationType] = useState<'mine' | 'proxy'>('mine');
  const [title, setTitle] = useState('');
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([]);
  const [creatorParticipates, setCreatorParticipates] = useState(true);
  const [loadingFriends, setLoadingFriends] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Rules state
  const [requirePhotos, setRequirePhotos] = useState(true);
  const [minPhotos, setMinPhotos] = useState(1);
  const [requireVideo, setRequireVideo] = useState(false);
  const [requireAudio, setRequireAudio] = useState(false);
  const [requireText, setRequireText] = useState(true);
  const [ruleNote, setRuleNote] = useState('');

  // Creator Custom Reminder state
  const [reminderEnabled, setReminderEnabled] = useState(true);
  const [reminderTime, setReminderTime] = useState('21:00');
  const [reminderMessage, setReminderMessage] = useState('【{nickname}】，您参与的项目【{projectTitle}】今天还没有打卡哦，快去完成吧！');

  useEffect(() => {
    if (isOpen) {
      setError('');
      setTitle('');
      setSelectedFriendIds([]);
      setCreationType('mine');
      setReminderEnabled(true);
      setReminderTime('21:00');
      setReminderMessage('【{nickname}】，您参与的项目【{projectTitle}】今天还没有打卡哦，快去完成吧！');
      setLoadingFriends(true);
      api
        .getFriends()
        .then((list) => setFriends(list))
        .catch(() => setFriends([]))
        .finally(() => setLoadingFriends(false));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleFriend = (friendId: string) => {
    setSelectedFriendIds((prev) =>
      prev.includes(friendId)
        ? prev.filter((id) => id !== friendId)
        : [...prev, friendId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title.trim()) {
      setError('请输入打卡项目名称');
      return;
    }

    if (creationType === 'proxy' && selectedFriendIds.length === 0) {
      setError('代创建打卡必须勾选至少一位好友');
      return;
    }

    setSubmitting(true);
    try {
      const rules: CheckInRule = {
        requirePhotos,
        minPhotos: requirePhotos ? minPhotos : 0,
        requireVideo,
        requireAudio,
        requireText,
        note: ruleNote.trim(),
        reminderEnabled,
        reminderTime,
        reminderMessage: reminderMessage.trim(),
      };

      const project = await api.createProject({
        title: title.trim(),
        isProxy: creationType === 'proxy',
        selectedFriendIds,
        creatorParticipates: creationType === 'proxy' ? creatorParticipates : true,
        rules,
      });

      onSuccess(project.id);
      onClose();
    } catch (err: any) {
      setError(err.message || '创建打卡项目失败');
    } finally {
      setSubmitting(false);
    }
  };

  const hasNoFriends = friends.length === 0;

  return (
    <div
      id="project-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4"
    >
      <div
        id="project-modal-card"
        className="w-full max-w-lg bg-white rounded-2xl border border-stone-200 shadow-xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100">
          <h2 className="text-base font-bold text-stone-900">创建打卡项目</h2>
          <button
            id="btn-close-project-modal"
            type="button"
            onClick={onClose}
            className="p-1 text-stone-400 hover:text-stone-700 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 flex-1">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Creation type tabs */}
          <div className="grid grid-cols-2 gap-2">
            <button
              id="btn-opt-mine"
              type="button"
              onClick={() => setCreationType('mine')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                creationType === 'mine'
                  ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                  : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800'
              }`}
            >
              <User className="w-4 h-4 mt-0.5" />
              <div>
                <div className="text-xs font-bold">创建我的打卡</div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    creationType === 'mine' ? 'text-stone-300' : 'text-stone-500'
                  }`}
                >
                  个人专属习惯
                </div>
              </div>
            </button>

            <button
              id="btn-opt-proxy"
              type="button"
              disabled={hasNoFriends}
              onClick={() => !hasNoFriends && setCreationType('proxy')}
              className={`p-3 rounded-xl border text-left flex items-start gap-2.5 transition-all ${
                hasNoFriends
                  ? 'opacity-40 bg-stone-100 border-stone-200 cursor-not-allowed text-stone-400'
                  : creationType === 'proxy'
                  ? 'border-stone-900 bg-stone-900 text-white shadow-xs'
                  : 'border-stone-200 bg-stone-50 hover:bg-stone-100 text-stone-800'
              }`}
            >
              <Users className="w-4 h-4 mt-0.5" />
              <div>
                <div className="text-xs font-bold">代创建打卡</div>
                <div
                  className={`text-[11px] mt-0.5 ${
                    hasNoFriends
                      ? 'text-stone-400'
                      : creationType === 'proxy'
                      ? 'text-stone-300'
                      : 'text-stone-500'
                  }`}
                >
                  {hasNoFriends ? '无好友置灰不可用' : '为好友/小队创建'}
                </div>
              </div>
            </button>
          </div>

          {/* Project Title */}
          <div>
            <label className="block text-xs font-medium text-stone-700 mb-1.5">
              打卡项目名称
            </label>
            <input
              id="input-project-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="例如：每日晨读打卡、30天健身挑战"
              required
              className="w-full px-3.5 py-2.5 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-sm focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white transition-all"
            />
          </div>

          {/* Proxy Options: Friends Selection & Creator Participation */}
          {creationType === 'proxy' && (
            <div className="space-y-3 p-4 bg-stone-50 rounded-xl border border-stone-200">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-stone-800">
                  选择打卡成员 (多选)
                </span>
                <span className="text-[11px] text-stone-500">
                  已选择 {selectedFriendIds.length} 位
                </span>
              </div>

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
                          src={friend.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
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

              <div className="pt-2 border-t border-stone-200 flex items-center gap-2">
                <input
                  id="checkbox-creator-participates"
                  type="checkbox"
                  checked={creatorParticipates}
                  onChange={(e) => setCreatorParticipates(e.target.checked)}
                  className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
                />
                <label
                  htmlFor="checkbox-creator-participates"
                  className="text-xs text-stone-700 font-medium cursor-pointer"
                >
                  是否我也参与打卡 (勾选后全员完全同步可见)
                </label>
              </div>
            </div>
          )}

          {/* Flexible Rules Setup */}
          <div className="space-y-3">
            <label className="block text-xs font-bold text-stone-800">
              打卡要求配置
            </label>

            {/* Photos */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                  <Camera className="w-4 h-4 text-stone-600" />
                  <span>必须上传照片</span>
                </div>
                <input
                  type="checkbox"
                  checked={requirePhotos}
                  onChange={(e) => setRequirePhotos(e.target.checked)}
                  className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
                />
              </div>
              {requirePhotos && (
                <div className="flex items-center gap-2 text-xs text-stone-600 pl-6">
                  <span>最少张数要求:</span>
                  {[1, 2, 3, 4].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setMinPhotos(num)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border ${
                        minPhotos === num
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-100'
                      }`}
                    >
                      {num} 张
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Video */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                <Video className="w-4 h-4 text-stone-600" />
                <span>必须上传视频</span>
              </div>
              <input
                type="checkbox"
                checked={requireVideo}
                onChange={(e) => setRequireVideo(e.target.checked)}
                className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
              />
            </div>

            {/* Audio */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                <Mic className="w-4 h-4 text-stone-600" />
                <span>必须录制语音</span>
              </div>
              <input
                type="checkbox"
                checked={requireAudio}
                onChange={(e) => setRequireAudio(e.target.checked)}
                className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
              />
            </div>

            {/* Text note */}
            <div className="p-3 bg-stone-50 border border-stone-200 rounded-xl flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs font-medium text-stone-800">
                <FileText className="w-4 h-4 text-stone-600" />
                <span>必须填写打卡文字说明</span>
              </div>
              <input
                type="checkbox"
                checked={requireText}
                onChange={(e) => setRequireText(e.target.checked)}
                className="w-4 h-4 rounded text-stone-900 focus:ring-stone-900 border-stone-300"
              />
            </div>

            {/* Optional note */}
            <div>
              <input
                type="text"
                value={ruleNote}
                onChange={(e) => setRuleNote(e.target.value)}
                placeholder="补充规则备注（例如：需在22点前完成）"
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white"
              />
            </div>
          </div>

          {/* Creator Custom Reminder Settings */}
          <div className="space-y-3 pt-1 border-t border-stone-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Bell className="w-4 h-4 text-emerald-600" />
                <span className="text-xs font-bold text-stone-800">微信打卡提醒设置</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  id="checkbox-reminder-toggle"
                  type="checkbox"
                  checked={reminderEnabled}
                  onChange={(e) => setReminderEnabled(e.target.checked)}
                  className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 border-stone-300"
                />
                <label
                  htmlFor="checkbox-reminder-toggle"
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
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="px-3 py-1.5 bg-white border border-stone-200 rounded-xl text-xs text-stone-900 font-mono font-medium focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  />
                  <span className="text-[10px] text-stone-500 ml-2">
                    若成员到此时仍未达标，将通过微信通道提醒
                  </span>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-stone-700 mb-1">
                    自定义催促文案
                  </label>
                  <textarea
                    rows={2}
                    value={reminderMessage}
                    onChange={(e) => setReminderMessage(e.target.value)}
                    placeholder="【{nickname}】，您参与的项目【{projectTitle}】今天还没有打卡哦，快去完成吧！"
                    className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-600 resize-none"
                  />
                  <p className="text-[10px] text-stone-500 mt-0.5">
                    支持变量：<code className="text-emerald-700">{"{nickname}"}</code>（成员昵称）、<code className="text-emerald-700">{"{projectTitle}"}</code>（打卡项目名称）
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="pt-2">
            <button
              id="btn-submit-create-project"
              type="submit"
              disabled={submitting}
              className="w-full py-3 bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
            >
              {submitting ? '创建中...' : '确认创建'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
