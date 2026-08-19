import React from 'react';
import { ChevronLeft, ChevronRight, Flame, Video, Mic, Camera, FileText } from 'lucide-react';
import { CheckInRecord } from '../../types';

interface CalendarGridProps {
  currentMonthDate: Date;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onToday: () => void;
  daysData: Record<
    string,
    {
      date: string;
      status: 'red' | 'yellow' | 'gray';
      records: CheckInRecord[];
      allQualified: boolean;
      hasAnySubmission: boolean;
      hasMySubmission: boolean;
      isMyQualified: boolean;
    }
  >;
  onSelectDate: (dateStr: string) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  currentMonthDate,
  onPrevMonth,
  onNextMonth,
  onToday,
  daysData,
  onSelectDate,
}) => {
  const year = currentMonthDate.getFullYear();
  const month = currentMonthDate.getMonth(); // 0-indexed

  // Format month string: 'YYYY年MM月'
  const monthDisplay = `${year}年${month + 1}月`;
  
  // 核心修复：采用本地安全时间戳计算，取代 ISOString UTC 零时区切片，彻底根治清晨测试时日历黑圈错标至昨天的时区时差缺陷
  const today = new Date();
  const tYear = today.getFullYear();
  const tMonth = today.getMonth() + 1;
  const tDay = today.getDate();
  const todayStr = `${tYear}-${tMonth < 10 ? '0' + tMonth : tMonth}-${tDay < 10 ? '0' + tDay : tDay}`;

  // Calculate calendar grid days
  const firstDayOfMonth = new Date(year, month, 1);
  const lastDayOfMonth = new Date(year, month + 1, 0);
  const totalDaysInMonth = lastDayOfMonth.getDate();

  // Day of week for 1st of month: 0 is Sun, 1 is Mon... convert to Monday = 0
  let startingDayOfWeek = firstDayOfMonth.getDay() - 1;
  if (startingDayOfWeek === -1) startingDayOfWeek = 6; // Sunday becomes index 6

  const daysArray: (number | null)[] = [];
  for (let i = 0; i < startingDayOfWeek; i++) {
    daysArray.push(null);
  }
  for (let d = 1; d <= totalDaysInMonth; d++) {
    daysArray.push(d);
  }

  // Weekday titles
  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

  return (
    <div className="w-full bg-white rounded-2xl border border-stone-200 shadow-xs p-4 sm:p-6">
      {/* Month Navigation Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-stone-900">{monthDisplay}</h2>
          <button
            type="button"
            onClick={onToday}
            className="px-2 py-0.5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-semibold rounded-md transition-colors"
          >
            今天
          </button>
        </div>

        <div className="flex items-center gap-1">
          <button
            id="btn-prev-month"
            type="button"
            onClick={onPrevMonth}
            className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            id="btn-next-month"
            type="button"
            onClick={onNextMonth}
            className="p-1.5 rounded-lg border border-stone-200 hover:bg-stone-100 text-stone-600 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Weekdays Header */}
      <div className="grid grid-cols-7 gap-1.5 text-center mb-2">
        {weekdays.map((w, idx) => (
          <div
            key={w}
            className={`text-xs font-medium py-1 ${
              idx >= 5 ? 'text-stone-400' : 'text-stone-500'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Calendar Grid Cells */}
      <div className="grid grid-cols-7 gap-1.5">
        {daysArray.map((dayNum, index) => {
          if (dayNum === null) {
            return (
              <div
                key={`empty-${index}`}
                className="min-h-[78px] sm:min-h-[88px] bg-stone-50/40 rounded-xl border border-transparent"
              />
            );
          }

          const dayFormatted = dayNum < 10 ? `0${dayNum}` : `${dayNum}`;
          const monthFormatted = month + 1 < 10 ? `0${month + 1}` : `${month + 1}`;
          const dateStr = `${year}-${monthFormatted}-${dayFormatted}`;

          const isToday = dateStr === todayStr;
          const dayInfo = daysData[dateStr];
          const status = dayInfo?.status || 'gray';
          const records = dayInfo?.records || [];

          // Has photos, videos, audios
          const allPhotos: string[] = [];
          let hasVideo = false;
          let hasAudio = false;

          for (const r of records) {
            if (r.photos && r.photos.length > 0) {
              allPhotos.push(...r.photos);
            }
            if (r.videos && r.videos.length > 0) hasVideo = true;
            if (r.audios && r.audios.length > 0) hasAudio = true;
          }

          // Status colors & styles
          let statusBadgeBg = 'bg-stone-200 text-stone-600';
          let borderColor = 'border-stone-200';
          let cellBg = 'bg-white hover:border-stone-400';

          if (status === 'red') {
            statusBadgeBg = 'bg-red-500 text-white';
            borderColor = 'border-red-200';
            cellBg = 'bg-red-50/30 hover:border-red-400';
          } else if (status === 'yellow') {
            statusBadgeBg = 'bg-amber-400 text-stone-900';
            borderColor = 'border-amber-200';
            cellBg = 'bg-amber-50/30 hover:border-amber-400';
          }

          return (
            <button
              key={dateStr}
              id={`calendar-cell-${dateStr}`}
              type="button"
              onClick={() => onSelectDate(dateStr)}
              className={`min-h-[78px] sm:min-h-[88px] p-1.5 rounded-xl border ${borderColor} ${cellBg} flex flex-col justify-between text-left transition-all relative overflow-hidden group cursor-pointer shadow-2xs`}
            >
              {/* Day header row */}
              <div className="flex items-center justify-between w-full">
                {/* 今天的高亮圆圈样式：精准更正为数字外层套一个空心小圆圈，保持数字深灰色可读，杜绝黑色实心高亮背景 */}
                <span
                  className={`text-xs font-bold leading-none ${
                    isToday
                      ? 'w-5 h-5 rounded-full border border-stone-900 text-stone-900 flex items-center justify-center text-[10px] font-black'
                      : 'text-stone-800'
                  }`}
                >
                  {dayNum}
                </span>

                {/* Status Indicator Dot/Badge */}
                {dayInfo?.hasAnySubmission && (
                  <span
                    className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                      status === 'red'
                        ? 'bg-red-500 ring-2 ring-red-200'
                        : status === 'yellow'
                        ? 'bg-amber-400 ring-2 ring-amber-200'
                        : 'bg-stone-300'
                    }`}
                    title={
                      status === 'red'
                        ? '全员达标 🔥'
                        : status === 'yellow'
                        ? '部分打卡未达标 🟡'
                        : '缺勤 ⚪'
                    }
                  />
                )}
              </div>

              {/* Media Thumbnails & Member Avatars in the cell */}
              <div className="mt-1 flex-1 flex flex-col justify-end space-y-1">
                {/* Photo micro thumbnail preview */}
                {allPhotos.length > 0 ? (
                  <div className="flex items-center gap-1 overflow-hidden">
                    <img
                      src={allPhotos[0]}
                      alt=""
                      className="w-5 h-5 sm:w-6 sm:h-6 rounded-md object-cover flex-shrink-0 border border-stone-200"
                    />
                    {allPhotos.length > 1 && (
                      <span className="text-[9px] font-bold text-stone-500">
                        +{allPhotos.length - 1}
                      </span>
                    )}
                  </div>
                ) : (
                  records.length > 0 && (
                    <div className="flex items-center gap-1 text-[10px] text-stone-500">
                      {hasVideo && <Video className="w-3 h-3 text-stone-600" />}
                      {hasAudio && <Mic className="w-3 h-3 text-stone-600" />}
                      {!hasVideo && !hasAudio && <FileText className="w-3 h-3 text-stone-400" />}
                    </div>
                  )
                )}

                {/* Micro Avatars of checked in members */}
                {records.length > 0 && (
                  <div className="flex items-center -space-x-1 overflow-hidden pt-0.5">
                    {records.slice(0, 3).map((rec) => (
                      <img
                        key={rec.id}
                        src={rec.userAvatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=120&auto=format&fit=crop&q=80'}
                        alt={rec.userNickname}
                        title={`${rec.userNickname}: ${rec.isQualified ? '达标' : '未达标'}`}
                        className={`w-3.5 h-3.5 sm:w-4 sm:h-4 rounded-full object-cover border border-white ${
                          rec.isQualified ? 'ring-1 ring-emerald-500' : 'ring-1 ring-amber-400'
                        }`}
                      />
                    ))}
                    {records.length > 3 && (
                      <span className="text-[8px] text-stone-400 pl-1.5 font-bold">
                        +{records.length - 3}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend guide bar */}
      <div className="mt-5 pt-3 border-t border-stone-100 flex flex-wrap items-center justify-between gap-3 text-xs text-stone-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
            <span>🔥 红色：全员达标</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>🟡 黄色：部分打卡未达标</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-stone-300" />
            <span>⚪ 灰色：缺勤</span>
          </div>
        </div>

        <div className="text-[11px] text-stone-400">
          独立火花计算 · 点击日期查看详情与打卡
        </div>
      </div>
    </div>
  );
};
