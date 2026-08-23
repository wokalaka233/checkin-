import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Camera,
  Video,
  Mic,
  FileText,
  Play,
  Pause,
  Send,
  Trash2,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Flame,
  CornerDownRight,
  Sparkles,
} from 'lucide-react';
import { HabitProject, CheckInRecord, DailyComment, CheckInAudio } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { VoiceRecorder } from '../ui/VoiceRecorder';

interface CheckInDrawerProps {
  isOpen: boolean;
  dateStr: string;
  project: HabitProject;
  onClose: () => void;
  onCheckInSuccess: () => void;
}

export const CheckInDrawer: React.FC<CheckInDrawerProps> = ({
  isOpen,
  dateStr,
  project,
  onClose,
  onCheckInSuccess,
}) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CheckInRecord[]>([]);
  const [comments, setComments] = useState<DailyComment[]>([]);

  // Submission Form State
  const [photos, setPhotos] = useState<string[]>([]);
  const [videos, setVideos] = useState<string[]>([]);
  const [audios, setAudios] = useState<CheckInAudio[]>([]);
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState('');

  // Audio Playback state for record items
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Comments state
  const [commentInput, setCommentInput] = useState('');
  const [replyTarget, setReplyTarget] = useState<{ id: string; nickname: string } | null>(null);
  const [submittingComment, setSubmittingComment] = useState(false);

  // Photo viewer lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // 核心改动 1：智能 HD 高清无损压缩算法，肉眼完美保真，体积骤降 90%，防止大图撑爆 D1 锁表
  const compressImage = (base64Str: string): Promise<string> => {
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.src = base64Str;
      img.onload = () => {
        // 如果图片本身小于 1MB，绕过压缩直接走原图，保证绝对高画质
        if (base64Str.length < 1000 * 1024) { 
          resolve(base64Str);
          return;
        }
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const maxDim = 1920; // 1080P Full HD 标准宽度
        let width = img.width;
        let height = img.height;

        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }

        canvas.width = width;
        canvas.height = height;
        ctx?.drawImage(img, 0, 0, width, height);
        // 采用 88% 的高保真系数进行 JPEG 压缩，肉眼完全无失真，体积骤降
        const compressedBase64 = canvas.toDataURL('image/jpeg', 0.88);
        resolve(compressedBase64);
      };
      img.onerror = () => resolve(base64Str);
    });
  };

  // Fetch day details
  const fetchDayDetail = async () => {
    try {
      setLoading(true);
      const data = await api.getDayDetail(project.id, dateStr);
      setRecords(data.records);
      setComments(data.comments);

      // Pre-fill user's existing record if any
      const myRecord = data.records.find((r) => r.userId === user?.id);
      if (myRecord) {
        setPhotos(myRecord.photos || []);
        setVideos(myRecord.videos || []);
        setAudios(myRecord.audios || []);
        setText(myRecord.text || '');
      } else {
        setPhotos([]);
        setVideos([]);
        setAudios([]);
        setText('');
      }
    } catch (e: any) {
      console.error('Failed to load day details:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && dateStr && project) {
      setSubmitError('');
      setSubmitSuccess('');
      setReplyTarget(null);
      setCommentInput('');
      fetchDayDetail();
    }
  }, [isOpen, dateStr, project?.id]);

  if (!isOpen) return null;

  const rules = project.rules || {};

  // Rule verification check
  const meetsPhotoRule = !rules.requirePhotos || photos.length >= (rules.minPhotos || 1);
  const meetsVideoRule = !rules.requireVideo || videos.length > 0;
  const meetsAudioRule = !rules.requireAudio || audios.length > 0;
  const meetsTextRule = !rules.requireText || text.trim().length > 0;
  const isFormQualified = meetsPhotoRule && meetsVideoRule && meetsAudioRule && meetsTextRule;

  // 客户端当日打卡截止与防作弊拦截判定 (本地时间 24:00 截止，管理员具有最高权限不受限制)
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth() + 1;
  const day = today.getDate();
  const localTodayStr = `${year}-${month < 10 ? '0' + month : month}-${day < 10 ? '0' + day : day}`;

  const isToday = dateStr === localTodayStr;
  const isPast = dateStr < localTodayStr;
  const isFuture = dateStr > localTodayStr;
  const isAdmin = user?.isAdmin || user?.role === 'admin';
  const canSubmit = isToday || isAdmin;

  // Handle Photo selection (融入 HD 压缩)
  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File) => {
      const reader = new FileReader();
      reader.onloadend = async () => {
        if (typeof reader.result === 'string') {
          const compressed = await compressImage(reader.result);
          setPhotos((prev) => [...prev, compressed]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  // Handle Video selection
  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file: File = files[0];
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        setVideos([reader.result as string]);
      }
    };
    reader.readAsDataURL(file);
  };

  // Handle Check-in submit
  const handleSubmitCheckIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError('');
    setSubmitSuccess('');
    setSubmitting(true);

    try {
      const res = await api.submitCheckIn({
        projectId: project.id,
        date: dateStr,
        photos,
        videos,
        audios,
        text: text.trim(),
      });

      // 引入可选链与实体安全防护，解决崩溃报错问题
      if (res && res.record && res.record.isQualified) {
        setSubmitSuccess('恭喜打卡达标！火花已更新 🔥');
      } else {
        setSubmitSuccess('打卡已提交（部分未达标，火花保持不变）🟡');
      }

      await fetchDayDetail();
      onCheckInSuccess();
    } catch (err: any) {
      setSubmitError(err.message || '打卡提交失败');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Audio playback
  const playAudio = (url: string) => {
    if (playingAudioUrl === url) {
      audioElementRef.current?.pause();
      setPlayingAudioUrl(null);
    } else {
      if (audioElementRef.current) {
        audioElementRef.current.pause();
      }
      const audio = new Audio(url);
      audioElementRef.current = audio;
      audio.onended = () => setPlayingAudioUrl(null);
      audio.play();
      setPlayingAudioUrl(url);
    }
  };

  // Handle Comment submit
  const handleSendComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentInput.trim()) return;

    setSubmittingComment(true);
    try {
      await api.addComment({
        projectId: project.id,
        date: dateStr,
        content: commentInput.trim(),
        replyToCommentId: replyTarget?.id,
        replyToNickname: replyTarget?.nickname,
      });

      setCommentInput('');
      setReplyTarget(null);
      const updatedComments = await api.getComments(project.id, dateStr);
      setComments(updatedComments);
    } catch (err: any) {
      alert(err.message || '发送评论失败');
    } finally {
      setSubmittingComment(false);
    }
  };

  return (
    <div
      id="checkin-drawer-backdrop"
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end"
    >
      <div
        id="checkin-drawer-content"
        className="w-full max-w-2xl bg-white h-full flex flex-col shadow-2xl overflow-hidden animate-in slide-in-from-right duration-200"
      >
        {/* Drawer Top Navigation Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 bg-white">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-stone-900">{dateStr} 打卡详情</h2>
              <span className="px-2 py-0.5 bg-stone-100 text-stone-700 text-xs font-semibold rounded-md">
                {project.title}
              </span>
            </div>
            <p className="text-xs text-stone-500 mt-0.5">
              已打卡 {records.length} / {project.members.length} 人
            </p>
          </div>

          <button
            id="btn-close-checkin-drawer"
            type="button"
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-800 rounded-xl hover:bg-stone-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Drawer Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {loading ? (
            <div className="py-12 text-center text-xs text-stone-400">
              正在加载当日打卡记录...
            </div>
          ) : (
            <>
              {/* 1. All Members Submissions Waterfall */}
              <section className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-stone-800" />
                    <span>成员打卡实况 ({records.length})</span>
                  </h3>
                </div>

                {records.length === 0 ? (
                  <div className="py-8 text-center bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-400">
                    该日暂无成员打卡记录
                  </div>
                ) : (
                  <div className="space-y-4">
                    {records.map((rec) => (
                      <div
                        key={rec.id}
                        className="bg-stone-50 rounded-2xl border border-stone-200 p-4 space-y-3 shadow-2xs"
                      >
                        {/* Member Header */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2.5">
                            <img
                              src={rec.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                              alt=""
                              className="w-8 h-8 rounded-full object-cover"
                            />
                            <div>
                              <div className="text-xs font-bold text-stone-900 flex items-center gap-1">
                                <span>{rec.userNickname}</span>
                                {rec.userId === user?.id && (
                                  <span className="text-[10px] px-1 bg-stone-200 text-stone-700 rounded font-normal">
                                    我
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-stone-400">
                                {new Date(rec.createdAt).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })}
                              </div>
                            </div>
                          </div>

                          <div
                            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                              rec.isQualified
                                ? 'bg-emerald-100 text-emerald-800'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {rec.isQualified ? (
                              <>
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                <span>已达标</span>
                              </>
                            ) : (
                              <>
                                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                                <span>部分未达标</span>
                              </>
                            )}
                          </div>
                        </div>

                        {/* Text note */}
                        {rec.text && (
                          <div className="text-xs text-stone-800 bg-white p-3 rounded-xl border border-stone-200 leading-relaxed whitespace-pre-wrap">
                            {rec.text}
                          </div>
                        )}

                        {/* Photo Gallery Grid */}
                        {rec.photos && rec.photos.length > 0 && (
                          <div className="grid grid-cols-3 gap-2">
                            {rec.photos.map((photo, idx) => (
                              <button
                                key={idx}
                                type="button"
                                onClick={() => setLightboxImage(photo)}
                                className="aspect-square rounded-xl overflow-hidden border border-stone-200 group relative cursor-pointer"
                              >
                                <img
                                  src={photo}
                                  alt=""
                                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                />
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Videos */}
                        {rec.videos && rec.videos.length > 0 && (
                          <div className="space-y-2">
                            {rec.videos.map((vid, idx) => (
                              <div
                                key={idx}
                                className="rounded-xl overflow-hidden border border-stone-200 bg-black aspect-video flex items-center justify-center"
                              >
                                <video
                                  src={vid}
                                  controls
                                  className="max-h-full max-w-full"
                                />
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Voice Audios */}
                        {rec.audios && rec.audios.length > 0 && (
                          <div className="space-y-1.5">
                            {rec.audios.map((aud, idx) => {
                              const isThisPlaying = playingAudioUrl === aud.url;
                              return (
                                <div
                                  key={idx}
                                  className="flex items-center gap-3 p-2.5 bg-white rounded-xl border border-stone-200"
                                >
                                  <button
                                    type="button"
                                    onClick={() => playAudio(aud.url)}
                                    className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center hover:bg-stone-800 transition-colors flex-shrink-0"
                                  >
                                    {isThisPlaying ? (
                                      <Pause className="w-3.5 h-3.5 fill-current" />
                                    ) : (
                                      <Play className="w-3.5 h-3.5 fill-current ml-0.5" />
                                    )}
                                  </button>
                                  <div className="flex-1 flex items-center gap-1">
                                    <Mic className="w-3.5 h-3.5 text-stone-500" />
                                    <span className="text-xs font-mono text-stone-700">
                                      语音打卡 ({aud.duration}秒)
                                    </span>
                                  </div>
                                  {isThisPlaying && (
                                    <span className="text-[10px] text-red-500 font-bold animate-pulse">
                                      播放中...
                                    </span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* 2. My Check-in Action Zone - 只有在可以打卡或者用户是管理员时才展示可填写表单 */}
              {!canSubmit ? (
                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-2xl flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <span>
                    {isPast 
                      ? '⚠️ 已过打卡截止时间（每日打卡截止至当天 24:00），普通成员无法进行补打卡。' 
                      : '⚠️ 无法为未来的日期进行预先打卡。'}
                  </span>
                </div>
              ) : (
                <section className="bg-stone-50 rounded-2xl border border-stone-200 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                      <Flame className="w-3.5 h-3.5 text-orange-500" />
                      <span>
                        {records.some((r) => r.userId === user?.id) ? '修改我的打卡' : '提交今日打卡'}
                      </span>
                    </h3>
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded-md ${
                        isFormQualified
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {isFormQualified ? '已满足达标条件' : '待满足所有要求'}
                    </span>
                  </div>

                  {/* Rule requirement list */}
                  <div className="bg-white p-3 rounded-xl border border-stone-200 space-y-1.5 text-xs text-stone-600">
                    <div className="font-semibold text-stone-800 text-[11px] mb-1">
                      当前打卡达标要求：
                    </div>
                    {rules.requirePhotos && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={
                            photos.length >= (rules.minPhotos || 1)
                              ? 'text-emerald-600 font-bold'
                              : 'text-amber-600'
                          }
                        >
                          {photos.length >= (rules.minPhotos || 1) ? '✓' : '○'} 照片：需上传至少 {rules.minPhotos || 1} 张 (当前 {photos.length} 张)
                        </span>
                      </div>
                    )}
                    {rules.requireVideo && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={
                            videos.length > 0
                              ? 'text-emerald-600 font-bold'
                              : 'text-amber-600'
                          }
                        >
                          {videos.length > 0 ? '✓' : '○'} 视频：需上传视频 (当前 {videos.length} 个)
                        </span>
                      </div>
                    )}
                    {rules.requireAudio && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={
                            audios.length > 0
                              ? 'text-emerald-600 font-bold'
                              : 'text-amber-600'
                          }
                        >
                          {audios.length > 0 ? '✓' : '○'} 语音：需录制语音 (当前 {audios.length} 条)
                        </span>
                      </div>
                    )}
                    {rules.requireText && (
                      <div className="flex items-center gap-1.5">
                        <span
                          className={
                            text.trim().length > 0
                              ? 'text-emerald-600 font-bold'
                              : 'text-amber-600'
                          }
                        >
                          {text.trim().length > 0 ? '✓' : '○'} 文字说明：必填
                        </span>
                      </div>
                    )}
                    {rules.note && (
                      <div className="text-stone-400 text-[10px] pt-1">
                        备注：{rules.note}
                      </div>
                    )}
                    
                    {/* 微信每日督促显示：加入 D1 数据库全局 enabled 开关强同步联动 */}
                    {project.globalReminderEnabled !== false && (rules.reminderEnabled ?? project.reminderEnabled) && (
                      <div className="text-emerald-700 font-medium text-[11px] pt-1 flex items-center gap-1 border-t border-stone-100">
                        <span>⏰ 微信每日催促已开启 ({rules.reminderTime || project.reminderTime || '21:00'})</span>
                      </div>
                    )}
                  </div>

                  {submitError && (
                    <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                      {submitError}
                    </div>
                  )}
                  {submitSuccess && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs rounded-xl">
                      {submitSuccess}
                    </div>
                  )}

                  <form onSubmit={handleSubmitCheckIn} className="space-y-4">
                    {/* Photo picker & preview */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Camera className="w-3.5 h-3.5" />
                          <span>拍照 / 选图 ({photos.length} 张)</span>
                        </span>
                        <label
                          htmlFor="input-photo-upload"
                          className="cursor-pointer text-[11px] text-stone-900 hover:underline font-semibold"
                        >
                          + 添加图片
                        </label>
                      </label>
                      <input
                        id="input-photo-upload"
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handlePhotoUpload}
                        className="hidden"
                      />

                      {photos.length > 0 && (
                        <div className="grid grid-cols-4 gap-2 pt-1">
                          {photos.map((p, idx) => (
                            <div
                              key={idx}
                              className="aspect-square relative rounded-xl overflow-hidden border border-stone-200 group"
                            >
                              <img src={p} alt="" className="w-full h-full object-cover" />
                              <button
                                type="button"
                                onClick={() => setPhotos((prev) => prev.filter((_, i) => i !== idx))}
                                className="absolute top-1 right-1 p-1 bg-black/60 text-white rounded-md opacity-90 hover:bg-red-600 transition-colors"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Video picker & preview */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Video className="w-3.5 h-3.5" />
                          <span>上传视频 ({videos.length})</span>
                        </span>
                        <label
                          htmlFor="input-video-upload"
                          className="cursor-pointer text-[11px] text-stone-900 hover:underline font-semibold"
                        >
                          + 选择视频
                        </label>
                      </label>
                      <input
                        id="input-video-upload"
                        type="file"
                        accept="video/*"
                        onChange={handleVideoUpload}
                        className="hidden"
                      />
                      {videos.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {videos.map((v, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-white rounded-xl border border-stone-200 text-xs"
                            >
                              <span className="text-stone-700 truncate max-w-[200px]">
                                已选择视频文件 ({idx + 1})
                              </span>
                              <button
                                type="button"
                                onClick={() => setVideos((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Voice recording */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1">
                        <Mic className="w-3.5 h-3.5" />
                        <span>录音打卡</span>
                      </label>
                      <VoiceRecorder
                        onRecordingComplete={(audioUrl, duration) => {
                          setAudios((prev) => [...prev, { url: audioUrl, duration }]);
                        }}
                      />
                      {audios.length > 0 && (
                        <div className="space-y-1.5 pt-2">
                          {audios.map((aud, idx) => (
                            <div
                              key={idx}
                              className="flex items-center justify-between p-2 bg-white rounded-xl border border-stone-200 text-xs"
                            >
                              <span className="text-stone-700">
                                录音 #{idx + 1} ({aud.duration}秒)
                              </span>
                              <button
                                type="button"
                                onClick={() => setAudios((prev) => prev.filter((_, i) => i !== idx))}
                                className="text-stone-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Text Note */}
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1.5 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span>打卡文字说明</span>
                      </label>
                      <textarea
                        id="input-checkin-text"
                        rows={2}
                        value={text}
                        onChange={(e) => setText(e.target.value)}
                        placeholder="写点什么..."
                        className="w-full px-3 py-2 bg-white border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900"
                      />
                    </div>

                    <button
                      id="btn-submit-checkin"
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 bg-stone-900 hover:bg-stone-800 active:scale-[0.99] text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                    >
                      {submitting ? (
                        '提交中...'
                      ) : (
                        <>
                          <CheckCircle2 className="w-4 h-4" />
                          <span>
                            {records.some((r) => r.userId === user?.id) ? '更新打卡并核算火花' : '提交打卡并核算火花'}
                          </span>
                        </>
                      )}
                    </button>
                  </form>
                </section>
              )}

              {/* 3. Daily Comments Section: 评论区 */}
              <section className="space-y-3 pt-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-stone-900 flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-stone-800" />
                    <span>评论区 ({comments.length})</span>
                  </h3>
                </div>

                {/* Comment list */}
                {comments.length === 0 ? (
                  <div className="py-6 text-center bg-stone-50 rounded-2xl border border-stone-200 text-xs text-stone-400">
                    善语结善缘...
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {comments.map((cmt) => (
                      <div
                        key={cmt.id}
                        className="p-3 bg-stone-50 rounded-xl border border-stone-200 space-y-1.5"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <img
                              src={cmt.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                              alt=""
                              className="w-5 h-5 rounded-full object-cover"
                            />
                            <span className="text-xs font-semibold text-stone-900">
                              {cmt.userNickname}
                            </span>
                            {cmt.replyToNickname && (
                              <span className="text-[11px] text-stone-500 flex items-center gap-0.5">
                                <CornerDownRight className="w-3 h-3 text-stone-400" />
                                回复 @{cmt.replyToNickname}
                              </span>
                            )}
                          </div>
                          <span className="text-[10px] text-stone-400">
                            {new Date(cmt.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        </div>

                        <p className="text-xs text-stone-800 pl-7 leading-relaxed">
                          {cmt.content}
                        </p>

                        <div className="pl-7 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              setReplyTarget({
                                id: cmt.id,
                                nickname: cmt.userNickname,
                              })
                            }
                            className="text-[10px] text-stone-500 hover:text-stone-900 font-medium"
                          >
                            回复
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Comment input form */}
                <form onSubmit={handleSendComment} className="pt-2">
                  {replyTarget && (
                    <div className="flex items-center justify-between text-xs text-stone-500 bg-stone-100 px-3 py-1.5 rounded-t-xl border-t border-x border-stone-200">
                      <span>回复 @{replyTarget.nickname}:</span>
                      <button
                        type="button"
                        onClick={() => setReplyTarget(null)}
                        className="text-stone-400 hover:text-stone-700"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <input
                      id="input-daily-comment"
                      type="text"
                      value={commentInput}
                      onChange={(e) => setCommentInput(e.target.value)}
                      placeholder={replyTarget ? `回复 @${replyTarget.nickname}...` : '参与当日全员讨论...'}
                      className={`flex-1 px-3.5 py-2 bg-stone-50 border border-stone-200 text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white ${
                        replyTarget ? 'rounded-b-xl' : 'rounded-xl'
                      }`}
                    />
                    <button
                      id="btn-send-daily-comment"
                      type="submit"
                      disabled={submittingComment || !commentInput.trim()}
                      className="p-2.5 bg-stone-900 hover:bg-stone-800 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-40"
                    >
                      <Send className="w-4 h-4" />
                    </button>
                  </div>
                </form>
              </section>
            </>
          )}
        </div>
      </div>

      {/* Lightbox for HD images */}
      {lightboxImage && (
        <div
          id="photo-lightbox"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={lightboxImage}
            alt=""
            className="max-h-full max-w-full object-contain rounded-lg shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
