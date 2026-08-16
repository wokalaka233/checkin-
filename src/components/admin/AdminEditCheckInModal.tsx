import React, { useState } from 'react';
import { X, Check, Image as ImageIcon, Video, Trash2, Calendar, FileText, CheckCircle2, XCircle } from 'lucide-react';
import { CheckInRecord, HabitProject } from '../../types';
import { api } from '../../services/api';

interface AdminEditCheckInModalProps {
  isOpen: boolean;
  userId: string;
  userNickname: string;
  checkIn: (CheckInRecord & { projectTitle?: string }) | null;
  projects: HabitProject[];
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminEditCheckInModal: React.FC<AdminEditCheckInModalProps> = ({
  isOpen,
  userId,
  userNickname,
  checkIn,
  projects,
  onClose,
  onSuccess,
}) => {
  const isEditing = !!checkIn;

  const [projectId, setProjectId] = useState<string>(
    checkIn?.projectId || (projects[0]?.id || '')
  );
  const [date, setDate] = useState<string>(
    checkIn?.date || new Date().toISOString().slice(0, 10)
  );
  const [isQualified, setIsQualified] = useState<boolean>(
    checkIn ? checkIn.isQualified : true
  );
  const [text, setText] = useState<string>(checkIn?.text || '');
  const [photos, setPhotos] = useState<string[]>(checkIn?.photos || []);
  const [videos, setVideos] = useState<string[]>(checkIn?.videos || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        if (typeof reader.result === 'string') {
          setPhotos((prev) => [...prev, reader.result as string]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleAddVideo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file: File = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setVideos((prev) => [...prev, reader.result as string]);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectId) {
      setError('请选择所属打卡项目');
      return;
    }
    if (!date) {
      setError('请选择打卡日期');
      return;
    }

    try {
      setLoading(true);
      setError('');

      if (isEditing && checkIn) {
        await api.adminUpdateCheckIn(checkIn.id, {
          date,
          text,
          photos,
          videos,
          isQualified,
        });
      } else {
        await api.adminCreateCheckIn({
          projectId,
          userId,
          date,
          text,
          photos,
          videos,
          isQualified,
        });
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || '保存打卡记录失败');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      id="admin-checkin-modal-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
    >
      <div
        id="admin-checkin-modal-content"
        className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-stone-200 p-6 space-y-4 my-8 animate-in fade-in zoom-in-95 duration-150"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-stone-900">
              {isEditing ? '编辑打卡记录 (最高权限)' : '补录/新增打卡记录 (最高权限)'}
            </h3>
            <p className="text-xs text-stone-500 mt-0.5">目标用户：{userNickname}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-700 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Project & Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-stone-700 mb-1">
                所属打卡项目
              </label>
              <select
                id="select-admin-checkin-project"
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                disabled={isEditing}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900 disabled:opacity-60"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-stone-500" />
                <span>打卡日期 (YYYY-MM-DD)</span>
              </label>
              <input
                id="input-admin-checkin-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
              />
            </div>
          </div>

          {/* Qualification status toggle */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1">
              达标状态认定
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsQualified(true)}
                className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-semibold transition-all ${
                  isQualified
                    ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                    : 'bg-stone-50 border-stone-200 text-stone-500'
                }`}
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>判定为：达标 (合格)</span>
              </button>

              <button
                type="button"
                onClick={() => setIsQualified(false)}
                className={`flex-1 py-2 px-3 rounded-xl border flex items-center justify-center gap-1.5 font-semibold transition-all ${
                  !isQualified
                    ? 'bg-red-50 border-red-300 text-red-800'
                    : 'bg-stone-50 border-stone-200 text-stone-500'
                }`}
              >
                <XCircle className="w-4 h-4 text-red-600" />
                <span>判定为：未达标 (需补卡)</span>
              </button>
            </div>
          </div>

          {/* Text Content */}
          <div>
            <label className="block font-semibold text-stone-700 mb-1 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-stone-500" />
              <span>打卡心得 / 文字说明</span>
            </label>
            <textarea
              id="input-admin-checkin-text"
              rows={3}
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="输入打卡文字心得或备注..."
              className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 focus:outline-none focus:ring-2 focus:ring-stone-900"
            />
          </div>

          {/* Photos Management */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-stone-700 flex items-center gap-1">
                <ImageIcon className="w-3.5 h-3.5 text-stone-500" />
                <span>照片图片 ({photos.length} 张)</span>
              </span>
              <label
                htmlFor="admin-photo-upload"
                className="text-[11px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
              >
                + 添加图片
              </label>
              <input
                id="admin-photo-upload"
                type="file"
                multiple
                accept="image/*"
                onChange={handleAddPhoto}
                className="hidden"
              />
            </div>

            {photos.length > 0 && (
              <div className="grid grid-cols-4 gap-2 p-2 bg-stone-50 rounded-xl border border-stone-200">
                {photos.map((src, idx) => (
                  <div key={idx} className="relative group aspect-square rounded-lg overflow-hidden border border-stone-200">
                    <img src={src} alt="" className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                      className="absolute top-1 right-1 bg-red-600 text-white p-1 rounded-md opacity-90 hover:opacity-100 shadow-xs"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Videos Management */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="font-semibold text-stone-700 flex items-center gap-1">
                <Video className="w-3.5 h-3.5 text-stone-500" />
                <span>视频文件 ({videos.length} 个)</span>
              </span>
              <label
                htmlFor="admin-video-upload"
                className="text-[11px] font-semibold text-stone-700 bg-stone-100 hover:bg-stone-200 px-2 py-1 rounded-lg cursor-pointer transition-colors"
              >
                + 添加视频
              </label>
              <input
                id="admin-video-upload"
                type="file"
                accept="video/*"
                onChange={handleAddVideo}
                className="hidden"
              />
            </div>

            {videos.length > 0 && (
              <div className="space-y-2">
                {videos.map((vidSrc, idx) => (
                  <div key={idx} className="relative p-2 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between">
                    <video src={vidSrc} controls className="max-h-24 rounded-lg" />
                    <button
                      type="button"
                      onClick={() => setVideos((prev) => prev.filter((_, i) => i !== idx))}
                      className="px-2.5 py-1 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-xs font-semibold"
                    >
                      删除视频
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 font-semibold rounded-xl transition-colors"
            >
              取消
            </button>
            <button
              id="btn-admin-save-checkin"
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-stone-900 hover:bg-stone-800 text-white font-semibold rounded-xl flex items-center gap-1.5 transition-all disabled:opacity-40"
            >
              {loading ? (
                '保存中...'
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>保存记录</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
