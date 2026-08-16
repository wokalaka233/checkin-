import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  Key,
  Calendar,
  Image as ImageIcon,
  Video,
  Mic,
  Play,
  Pause,
  Trash2,
  Edit,
  Plus,
  ArrowLeft,
  CheckCircle2,
  XCircle,
  LogOut,
  RefreshCw,
  Eye,
  EyeOff,
  Flame,
  Shield,
  Layers,
  FileText,
} from 'lucide-react';
import { AdminUserSummary, AdminUserDetail, CheckInRecord, HabitProject } from '../../types';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { AdminPasswordModal } from './AdminPasswordModal';
import { AdminEditCheckInModal } from './AdminEditCheckInModal';
import { AdminNotificationManager } from './AdminNotificationManager';
import { Bell } from 'lucide-react';

export const AdminDashboard: React.FC = () => {
  const { logout } = useAuth();

  // Top Section Switcher
  const [mainSection, setMainSection] = useState<'users' | 'notifications'>('users');

  // State: All users list
  const [users, setUsers] = useState<AdminUserSummary[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showPasswords, setShowPasswords] = useState(true);

  // State: Selected user for deep inspection
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [activeTab, setActiveTab] = useState<'checkins' | 'projects'>('checkins');

  // Modals state
  const [passwordModalUser, setPasswordModalUser] = useState<{
    id: string;
    username: string;
    nickname: string;
    password?: string;
  } | null>(null);

  const [checkInModalData, setCheckInModalData] = useState<{
    isOpen: boolean;
    checkIn: (CheckInRecord & { projectTitle?: string }) | null;
  }>({
    isOpen: false,
    checkIn: null,
  });

  // Audio player & Lightbox
  const [playingAudioUrl, setPlayingAudioUrl] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Fetch all users
  const fetchUsers = useCallback(async () => {
    try {
      setLoadingUsers(true);
      const data = await api.getAdminUsers();
      setUsers(data);
    } catch (e) {
      console.error('Failed to load admin users:', e);
    } finally {
      setLoadingUsers(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // Fetch selected user's details
  const fetchUserDetail = useCallback(async (userId: string) => {
    try {
      setLoadingDetail(true);
      const data = await api.getAdminUserDetail(userId);
      setUserDetail(data);
    } catch (e) {
      console.error('Failed to load user detail:', e);
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  useEffect(() => {
    if (selectedUserId) {
      fetchUserDetail(selectedUserId);
    } else {
      setUserDetail(null);
    }
  }, [selectedUserId, fetchUserDetail]);

  // Delete check-in record
  const handleDeleteCheckIn = async (checkInId: string) => {
    if (!confirm('确定要删除该条打卡记录吗？此操作无法撤销。')) return;

    try {
      await api.adminDeleteCheckIn(checkInId);
      if (selectedUserId) {
        await fetchUserDetail(selectedUserId);
        await fetchUsers();
      }
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  // Delete project
  const handleDeleteProject = async (projectId: string) => {
    if (!confirm('确定要删除该打卡项目吗？项目下的所有打卡数据将被清空。')) return;

    try {
      await api.adminDeleteProject(projectId);
      if (selectedUserId) {
        await fetchUserDetail(selectedUserId);
        await fetchUsers();
      }
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  // Filtered users
  const filteredUsers = users.filter(
    (u) =>
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.nickname.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-stone-100/70 text-stone-900 pb-20">
      {/* Top Header */}
      <header className="bg-white border-b border-stone-200 sticky top-0 z-30 shadow-2xs">
        <div className="max-w-6xl mx-auto px-4 py-2.5 flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-stone-900 flex items-center justify-center text-white shadow-xs">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-stone-900 flex items-center gap-2">
                <span>系统管理工作台</span>
                <span className="text-[10px] bg-stone-900 text-white font-mono px-2 py-0.5 rounded-full font-bold">
                  MASTER ROOT
                </span>
              </div>
            </div>
          </div>

          {/* Top Admin Section Tabs */}
          <div className="flex items-center gap-1 bg-stone-100 p-1 rounded-xl border border-stone-200 text-xs font-semibold">
            <button
              id="tab-admin-users"
              type="button"
              onClick={() => {
                setMainSection('users');
                setSelectedUserId(null);
              }}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                mainSection === 'users'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Users className="w-3.5 h-3.5" />
              <span>用户与打卡管理</span>
            </button>

            <button
              id="tab-admin-notifications"
              type="button"
              onClick={() => {
                setMainSection('notifications');
                setSelectedUserId(null);
              }}
              className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 transition-all ${
                mainSection === 'notifications'
                  ? 'bg-white text-stone-900 shadow-2xs font-bold'
                  : 'text-stone-600 hover:text-stone-900'
              }`}
            >
              <Bell className="w-3.5 h-3.5 text-amber-500" />
              <span>管理提醒消息</span>
            </button>
          </div>

          <button
            id="btn-admin-logout"
            type="button"
            onClick={logout}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-stone-100 hover:bg-stone-200 active:scale-95 text-stone-700 text-xs font-semibold rounded-xl transition-all"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>退出登录</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-6xl mx-auto px-4 py-6">
        {mainSection === 'notifications' ? (
          <AdminNotificationManager users={users} />
        ) : !selectedUserId ? (
          /* ================= SCREEN 1: ALL USERS LIST ================= */
          <div className="space-y-6">
            {/* Stats Cards & Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-stone-500">注册总用户</div>
                  <div className="text-xl font-bold text-stone-900">{users.length} 位</div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center">
                  <Calendar className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-stone-500">全平台打卡总计</div>
                  <div className="text-xl font-bold text-stone-900">
                    {users.reduce((acc, u) => acc + (u.checkInCount || 0), 0)} 次
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-xs text-stone-500">打卡项目关联</div>
                  <div className="text-xl font-bold text-stone-900">
                    {users.reduce((acc, u) => acc + (u.projectCount || 0), 0)} 个
                  </div>
                </div>
              </div>
            </div>

            {/* Search and Action Bar */}
            <div className="bg-white p-4 rounded-2xl border border-stone-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="relative w-full sm:w-80">
                <Search className="w-4 h-4 text-stone-400 absolute left-3 top-3" />
                <input
                  id="input-admin-search-users"
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索用户账号或昵称..."
                  className="w-full pl-9 pr-3 py-2 bg-stone-50 border border-stone-200 rounded-xl text-stone-900 text-xs focus:outline-none focus:ring-2 focus:ring-stone-900 focus:bg-white"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                <button
                  type="button"
                  onClick={() => setShowPasswords(!showPasswords)}
                  className="px-3 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-colors"
                >
                  {showPasswords ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  <span>{showPasswords ? '隐藏密码列' : '显示存储密码'}</span>
                </button>

                <button
                  type="button"
                  onClick={fetchUsers}
                  className="p-2 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-xl transition-colors"
                  title="刷新用户列表"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* User Cards Grid */}
            {loadingUsers ? (
              <div className="py-20 text-center text-xs text-stone-400">加载用户数据中...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-16 text-center text-xs text-stone-400 bg-white rounded-2xl border border-stone-200">
                未找到匹配的用户
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredUsers.map((u) => (
                  <div
                    key={u.id}
                    id={`admin-user-card-${u.id}`}
                    className="bg-white rounded-2xl border border-stone-200 shadow-xs hover:shadow-md transition-all p-5 flex flex-col justify-between space-y-4"
                  >
                    {/* User Header */}
                    <div className="flex items-start justify-between">
                      <div
                        onClick={() => setSelectedUserId(u.id)}
                        className="flex items-center gap-3 cursor-pointer group"
                      >
                        <img
                          src={
                            u.avatar ||
                            'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
                          }
                          alt={u.nickname}
                          className="w-12 h-12 rounded-full object-cover border border-stone-200 group-hover:ring-2 group-hover:ring-stone-900 transition-all"
                        />
                        <div>
                          <div className="text-sm font-bold text-stone-900 group-hover:underline">
                            {u.nickname}
                          </div>
                          <div className="text-xs text-stone-400 font-mono">@{u.username}</div>
                        </div>
                      </div>

                      <button
                        id={`btn-modify-pwd-${u.id}`}
                        type="button"
                        onClick={() => setPasswordModalUser(u)}
                        className="p-2 bg-stone-50 hover:bg-stone-900 hover:text-white text-stone-600 rounded-xl text-xs font-semibold transition-all flex items-center gap-1 shadow-2xs"
                        title="修改此用户密码"
                      >
                        <Key className="w-3.5 h-3.5" />
                        <span>改密</span>
                      </button>
                    </div>

                    {/* Stored Password Display for Admin */}
                    {showPasswords && (
                      <div className="px-3 py-2 bg-stone-50 rounded-xl border border-stone-200 text-xs flex items-center justify-between">
                        <span className="text-stone-500 font-medium">当前密码：</span>
                        <span className="font-mono font-bold text-stone-900 bg-white px-2 py-0.5 rounded border border-stone-200">
                          {u.password || '无'}
                        </span>
                      </div>
                    )}

                    {/* Stats pills */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2 bg-stone-50 rounded-xl border border-stone-100 text-center">
                        <div className="text-[10px] text-stone-400">参与项目</div>
                        <div className="font-bold text-stone-800">{u.projectCount} 个</div>
                      </div>
                      <div className="p-2 bg-stone-50 rounded-xl border border-stone-100 text-center">
                        <div className="text-[10px] text-stone-400">总打卡次数</div>
                        <div className="font-bold text-stone-800">{u.checkInCount} 次</div>
                      </div>
                    </div>

                    {/* Footer button */}
                    <button
                      id={`btn-enter-user-${u.id}`}
                      type="button"
                      onClick={() => setSelectedUserId(u.id)}
                      className="w-full py-2 bg-stone-900 hover:bg-stone-800 text-white rounded-xl text-xs font-semibold flex items-center justify-center transition-all"
                    >
                      进入
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          /* ================= SCREEN 2: SELECTED USER DEEP INSPECT ================= */
          <div className="space-y-6">
            {/* Back Navigation Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                id="btn-back-to-all-users"
                type="button"
                onClick={() => setSelectedUserId(null)}
                className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 text-xs font-semibold rounded-xl transition-all shadow-2xs"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>返回全部用户列表</span>
              </button>

              {userDetail && (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setPasswordModalUser(userDetail.user)}
                    className="px-3.5 py-2 bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
                  >
                    <Key className="w-3.5 h-3.5 text-stone-600" />
                    <span>修改该用户密码</span>
                  </button>

                  <button
                    id="btn-admin-add-checkin"
                    type="button"
                    onClick={() =>
                      setCheckInModalData({
                        isOpen: true,
                        checkIn: null,
                      })
                    }
                    className="px-3.5 py-2 bg-stone-900 hover:bg-stone-800 text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all shadow-2xs"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>为该用户新增/补录打卡</span>
                  </button>
                </div>
              )}
            </div>

            {loadingDetail || !userDetail ? (
              <div className="py-20 text-center text-xs text-stone-400">
                加载用户多媒体打卡数据中...
              </div>
            ) : (
              <>
                {/* User Profile Header Card */}
                <div className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <img
                      src={
                        userDetail.user.avatar ||
                        'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'
                      }
                      alt=""
                      className="w-16 h-16 rounded-full object-cover border border-stone-200 shadow-2xs"
                    />
                    <div>
                      <div className="text-base font-bold text-stone-900">
                        {userDetail.user.nickname}
                      </div>
                      <div className="text-xs text-stone-500 font-mono">
                        账号：@{userDetail.user.username}
                      </div>
                      <div className="text-[11px] text-stone-400 mt-1">
                        注册时间：{new Date(userDetail.user.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                      <span className="text-stone-500">当前存储密码：</span>
                      <span className="font-mono font-bold text-stone-900 ml-1">
                        {userDetail.user.password || '123456'}
                      </span>
                    </div>

                    <div className="p-3 bg-stone-50 rounded-xl border border-stone-200 text-xs">
                      <span className="text-stone-500">总打卡记录：</span>
                      <span className="font-bold text-stone-900 ml-1">
                        {userDetail.checkIns.length} 条
                      </span>
                    </div>
                  </div>
                </div>

                {/* Sub Tab Navigation */}
                <div className="flex bg-stone-200/80 p-1 rounded-xl w-fit">
                  <button
                    type="button"
                    onClick={() => setActiveTab('checkins')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                      activeTab === 'checkins'
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    打卡多媒体记录 ({userDetail.checkIns.length})
                  </button>

                  <button
                    type="button"
                    onClick={() => setActiveTab('projects')}
                    className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                      activeTab === 'projects'
                        ? 'bg-white text-stone-900 shadow-xs'
                        : 'text-stone-600 hover:text-stone-900'
                    }`}
                  >
                    参与的打卡项目 ({userDetail.projects.length})
                  </button>
                </div>

                {/* Tab Content 1: Check-in records stream */}
                {activeTab === 'checkins' && (
                  <div className="space-y-4">
                    {userDetail.checkIns.length === 0 ? (
                      <div className="py-16 text-center text-xs text-stone-400 bg-white rounded-2xl border border-stone-200">
                        该用户暂无任何打卡记录，可点击上方「新增/补录打卡」为其添加。
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {userDetail.checkIns.map((chk) => (
                          <div
                            key={chk.id}
                            id={`admin-checkin-row-${chk.id}`}
                            className="bg-white rounded-2xl border border-stone-200 shadow-xs p-5 space-y-4"
                          >
                            {/* Record Header */}
                            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-stone-100">
                              <div className="flex items-center gap-2">
                                <span className="px-2.5 py-1 bg-stone-900 text-white text-xs font-mono font-bold rounded-lg">
                                  📅 {chk.date}
                                </span>
                                <span className="text-xs font-bold text-stone-800">
                                  {chk.projectTitle || '打卡项目'}
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-[10px] font-bold rounded-md flex items-center gap-1 ${
                                    chk.isQualified
                                      ? 'bg-emerald-100 text-emerald-800'
                                      : 'bg-red-100 text-red-800'
                                  }`}
                                >
                                  {chk.isQualified ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>已达标</span>
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="w-3 h-3" />
                                      <span>未达标</span>
                                    </>
                                  )}
                                </span>
                              </div>

                              {/* CRUD Action Buttons */}
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    setCheckInModalData({
                                      isOpen: true,
                                      checkIn: chk,
                                    })
                                  }
                                  className="px-3 py-1.5 bg-stone-100 hover:bg-stone-900 hover:text-white text-stone-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1"
                                >
                                  <Edit className="w-3.5 h-3.5" />
                                  <span>编辑</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDeleteCheckIn(chk.id)}
                                  className="px-3 py-1.5 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 text-xs font-semibold rounded-xl transition-all flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  <span>删除</span>
                                </button>
                              </div>
                            </div>

                            {/* Text remark */}
                            {chk.text && (
                              <div className="p-3 bg-stone-50 rounded-xl text-xs text-stone-800 leading-relaxed">
                                {chk.text}
                              </div>
                            )}

                            {/* Photos Gallery */}
                            {chk.photos && chk.photos.length > 0 && (
                              <div>
                                <div className="text-[11px] font-semibold text-stone-500 mb-2 flex items-center gap-1">
                                  <ImageIcon className="w-3.5 h-3.5 text-stone-400" />
                                  <span>打卡照片 ({chk.photos.length} 张，点击放大)</span>
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {chk.photos.map((imgSrc, pIdx) => (
                                    <div
                                      key={pIdx}
                                      onClick={() => setLightboxImage(imgSrc)}
                                      className="aspect-square rounded-xl overflow-hidden border border-stone-200 cursor-pointer group relative"
                                    >
                                      <img
                                        src={imgSrc}
                                        alt=""
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Videos Player */}
                            {chk.videos && chk.videos.length > 0 && (
                              <div>
                                <div className="text-[11px] font-semibold text-stone-500 mb-2 flex items-center gap-1">
                                  <Video className="w-3.5 h-3.5 text-stone-400" />
                                  <span>打卡视频 ({chk.videos.length} 个)</span>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                  {chk.videos.map((vidSrc, vIdx) => (
                                    <div
                                      key={vIdx}
                                      className="rounded-xl overflow-hidden border border-stone-200 bg-black"
                                    >
                                      <video src={vidSrc} controls className="w-full max-h-60" />
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Audio Recordings */}
                            {chk.audios && chk.audios.length > 0 && (
                              <div>
                                <div className="text-[11px] font-semibold text-stone-500 mb-2 flex items-center gap-1">
                                  <Mic className="w-3.5 h-3.5 text-stone-400" />
                                  <span>语音录音 ({chk.audios.length} 段)</span>
                                </div>
                                <div className="space-y-2">
                                  {chk.audios.map((aud, aIdx) => (
                                    <div
                                      key={aIdx}
                                      className="p-3 bg-stone-50 rounded-xl border border-stone-200 flex items-center justify-between"
                                    >
                                      <div className="flex items-center gap-2">
                                        <audio src={aud.url} controls className="h-8" />
                                        <span className="text-xs text-stone-600 font-mono">
                                          {aud.duration}&quot;
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Tab Content 2: Projects List */}
                {activeTab === 'projects' && (
                  <div className="space-y-4">
                    {userDetail.projects.length === 0 ? (
                      <div className="py-16 text-center text-xs text-stone-400 bg-white rounded-2xl border border-stone-200">
                        该用户当前没有加入任何打卡项目。
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {userDetail.projects.map((p) => (
                          <div
                            key={p.id}
                            className="bg-white rounded-2xl border border-stone-200 p-5 shadow-xs space-y-3 flex flex-col justify-between"
                          >
                            <div>
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-bold text-stone-900">{p.title}</h4>
                                <span className="px-2 py-0.5 bg-orange-100 text-orange-800 text-[11px] font-bold rounded-md">
                                  🔥 {p.sparks?.[userDetail.user.id] || 0} 天火苗
                                </span>
                              </div>

                              <p className="text-xs text-stone-500 mt-1">
                                {p.rules?.note || '无规则说明'}
                              </p>

                              <div className="text-[11px] text-stone-400 mt-2">
                                成员人数：{p.members.length} 人
                              </div>
                            </div>

                            <div className="pt-2 border-t border-stone-100 flex items-center justify-between">
                              <span className="text-[10px] text-stone-400 font-mono">
                                ID: {p.id}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteProject(p.id)}
                                className="px-2.5 py-1 bg-red-50 hover:bg-red-600 hover:text-white text-red-700 text-xs font-semibold rounded-lg transition-all"
                              >
                                删除项目
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </main>

      {/* Modal: Change Password */}
      {passwordModalUser && (
        <AdminPasswordModal
          isOpen={!!passwordModalUser}
          user={passwordModalUser}
          onClose={() => setPasswordModalUser(null)}
          onSuccess={() => {
            fetchUsers();
            if (selectedUserId) fetchUserDetail(selectedUserId);
          }}
        />
      )}

      {/* Modal: Edit or Add Check-in */}
      {checkInModalData.isOpen && userDetail && (
        <AdminEditCheckInModal
          isOpen={checkInModalData.isOpen}
          userId={userDetail.user.id}
          userNickname={userDetail.user.nickname}
          checkIn={checkInModalData.checkIn}
          projects={userDetail.allProjects || userDetail.projects}
          onClose={() => setCheckInModalData({ isOpen: false, checkIn: null })}
          onSuccess={() => {
            if (selectedUserId) fetchUserDetail(selectedUserId);
            fetchUsers();
          }}
        />
      )}

      {/* Full screen Lightbox */}
      {lightboxImage && (
        <div
          id="admin-lightbox"
          onClick={() => setLightboxImage(null)}
          className="fixed inset-0 z-60 bg-black/90 flex items-center justify-center p-4 cursor-pointer"
        >
          <img
            src={lightboxImage}
            alt=""
            className="max-h-full max-w-full object-contain rounded-xl shadow-2xl"
          />
        </div>
      )}
    </div>
  );
};
