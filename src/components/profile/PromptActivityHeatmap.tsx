import { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';

interface DayActivity {
  dayOfWeek: number;
  date: string;
  fullDate: string;
  runs: number;
  level: 0 | 1 | 2 | 3 | 4;
}

const WEEKS_COUNT = 16;
const DAYS_PER_WEEK = 7;

function generateActivityCalendar(): { weeks: DayActivity[][]; months: { name: string; colIndex: number }[] } {
  const weeks: DayActivity[][] = [];
  const months: { name: string; colIndex: number }[] = [];
  
  const baseDate = new Date(2026, 1, 20);
  const totalDays = WEEKS_COUNT * DAYS_PER_WEEK;
  
  const startDate = new Date(baseDate);
  startDate.setDate(baseDate.getDate() - totalDays + 1);

  let lastMonth = -1;

  for (let w = 0; w < WEEKS_COUNT; w++) {
    const week: DayActivity[] = [];
    
    for (let d = 0; d < DAYS_PER_WEEK; d++) {
      const currentDate = new Date(startDate);
      currentDate.setDate(startDate.getDate() + (w * 7 + d));
      
      const monthIndex = currentDate.getMonth();
      if (d === 0 && monthIndex !== lastMonth) {
        months.push({
          name: currentDate.toLocaleString('default', { month: 'short' }),
          colIndex: w
        });
        lastMonth = monthIndex;
      }

      const isWeekend = d === 0 || d === 6;
      const recencyBoost = (w / WEEKS_COUNT) * 0.4;
      const inCurrentStreak = w >= 13 || (w >= 10 && d >= 1 && d <= 5);
      
      let level: 0 | 1 | 2 | 3 | 4 = 0;
      let runs = 0;

      const seed = Math.sin(w * 13 + d * 37) * 10000;
      const pseudoRand = seed - Math.floor(seed);

      if (inCurrentStreak) {
        if (pseudoRand > 0.82) level = 4;
        else if (pseudoRand > 0.45) level = 3;
        else if (pseudoRand > 0.15) level = 2;
        else level = 1;
      } else {
        const threshold = isWeekend ? 0.75 : 0.45 - recencyBoost;
        if (pseudoRand > threshold) {
          if (pseudoRand > 0.94) level = 4;
          else if (pseudoRand > 0.82) level = 3;
          else if (pseudoRand > 0.60) level = 2;
          else level = 1;
        }
      }

      switch (level) {
        case 1:
          runs = Math.floor(pseudoRand * 3) + 1;
          break;
        case 2:
          runs = Math.floor(pseudoRand * 4) + 4;
          break;
        case 3:
          runs = Math.floor(pseudoRand * 6) + 8;
          break;
        case 4:
          runs = Math.floor(pseudoRand * 8) + 14;
          break;
        default:
          runs = 0;
      }

      const formattedMonth = currentDate.toLocaleString('default', { month: 'short' });
      const dayNum = currentDate.getDate();
      const year = currentDate.getFullYear();
      const weekdayName = currentDate.toLocaleString('default', { weekday: 'long' });

      week.push({
        dayOfWeek: d,
        date: `${formattedMonth} ${dayNum}`,
        fullDate: `${weekdayName}, ${formattedMonth} ${dayNum}, ${year}`,
        runs,
        level,
      });
    }
    weeks.push(week);
  }

  return { weeks, months };
}

const STATIC_CALENDAR = generateActivityCalendar();

const LEVEL_CLASSES: Record<number, string> = {
  0: 'bg-white/[0.04] border border-white/[0.04]',
  1: 'bg-emerald-950/80 border border-emerald-900/50 hover:border-emerald-600',
  2: 'bg-emerald-800/80 border border-emerald-700/60 hover:border-emerald-500',
  3: 'bg-emerald-600/90 border border-emerald-500/70 hover:border-emerald-400',
  4: 'bg-emerald-400 border border-emerald-300 hover:border-white',
};

export function PromptActivityHeatmap() {
  const [hoveredCell, setHoveredCell] = useState<DayActivity | null>(null);

  const { totalRuns, activeStreak } = useMemo(() => {
    return {
      totalRuns: '1,894',
      activeStreak: 19,
    };
  }, []);

  return (
    <div className="relative rounded-3xl border border-white/10 bg-[#121417]/60 backdrop-blur-xl p-6 sm:p-7 shadow-sm">
      {/* Clean Minimal Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <h2 className="text-base font-bold text-white tracking-tight">
            Prompt Activity
          </h2>
          <p className="text-xs text-neutral-400 mt-1 font-mono">
            {totalRuns} executions across the last 16 weeks
          </p>
        </div>

        {/* Clean Streak Badge */}
        <div className="inline-flex items-center gap-2 self-start sm:self-auto px-3 py-1 rounded-full text-xs font-mono text-neutral-300 bg-white/5 border border-white/10">
          <span className="w-1.5 h-1.5 rounded-full bg-copper-400" />
          <span>{activeStreak}-day streak</span>
        </div>
      </div>

      {/* Heatmap Area */}
      <div className="overflow-x-auto pb-2 custom-scrollbar">
        <div className="min-w-[560px]">
          {/* Months Row */}
          <div className="flex text-[11px] font-mono text-neutral-500 mb-2 pl-7">
            {STATIC_CALENDAR.weeks.map((_, colIdx) => {
              const monthInfo = STATIC_CALENDAR.months.find(m => m.colIndex === colIdx);
              return (
                <div key={colIdx} className="flex-1 text-left">
                  {monthInfo ? (
                    <span className="text-neutral-400 font-medium">{monthInfo.name}</span>
                  ) : null}
                </div>
              );
            })}
          </div>

          {/* Grid with Day Labels on Left */}
          <div className="flex gap-2">
            <div className="flex flex-col justify-between py-0.5 text-[10px] font-mono text-neutral-500 w-5 select-none">
              <span className="h-3.5 leading-none opacity-0">Sun</span>
              <span className="h-3.5 leading-none">Mon</span>
              <span className="h-3.5 leading-none opacity-0">Tue</span>
              <span className="h-3.5 leading-none">Wed</span>
              <span className="h-3.5 leading-none opacity-0">Thu</span>
              <span className="h-3.5 leading-none">Fri</span>
              <span className="h-3.5 leading-none opacity-0">Sat</span>
            </div>

            {/* Weeks columns */}
            <div className="flex gap-1.5 flex-1">
              {STATIC_CALENDAR.weeks.map((week, wIndex) => (
                <div key={wIndex} className="flex flex-col gap-1.5 flex-1">
                  {week.map((item, dIndex) => {
                    const isHovered = hoveredCell?.fullDate === item.fullDate;
                    return (
                      <div
                        key={dIndex}
                        onMouseEnter={() => setHoveredCell(item)}
                        onMouseLeave={() => setHoveredCell(null)}
                        className={cn(
                          "h-3 sm:h-3.5 rounded-[3px] cursor-pointer transition-all duration-150",
                          LEVEL_CLASSES[item.level] || LEVEL_CLASSES[0],
                          isHovered && "scale-125 z-10 ring-1 ring-white"
                        )}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Footer / Hover Inspection Bar & Legend */}
      <div className="mt-4 pt-3 border-t border-white/[0.08] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        {/* Hover details */}
        <div className="font-mono text-xs min-h-[20px] flex items-center">
          {hoveredCell ? (
            <div className="flex items-center gap-1.5 text-neutral-300">
              <span className="font-semibold text-white">
                {hoveredCell.runs === 0 ? 'No activity' : `${hoveredCell.runs} prompts`}
              </span>
              <span className="text-neutral-500">on</span>
              <span className="text-neutral-200">{hoveredCell.fullDate}</span>
            </div>
          ) : (
            <span className="text-neutral-500">Hover over any day to view details</span>
          )}
        </div>

        {/* Minimal Legend */}
        <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500">
          <span>Less</span>
          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-[2px] bg-white/[0.04] border border-white/[0.04]" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-950/80 border border-emerald-900/50" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-800/80 border border-emerald-700/60" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-600/90 border border-emerald-500/70" />
            <div className="w-2.5 h-2.5 rounded-[2px] bg-emerald-400 border border-emerald-300" />
          </div>
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
