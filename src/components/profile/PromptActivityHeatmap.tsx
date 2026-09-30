import { useState, useMemo } from 'react';
import { cn } from '../../lib/utils';

interface DayActivity {
  dayOfWeek: number;
  date: string;
  fullDate: string;
  isoDate: string;
  runs: number;
  level: 0 | 1 | 2 | 3 | 4;
}

const WEEKS_COUNT = 16;
const DAYS_PER_WEEK = 7;

interface PromptActivityHeatmapProps {
  activityTimestamps?: (number | string)[];
}

export function PromptActivityHeatmap({ activityTimestamps = [] }: PromptActivityHeatmapProps) {
  const [hoveredCell, setHoveredCell] = useState<DayActivity | null>(null);

  // Group real timestamps by YYYY-MM-DD
  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const ts of activityTimestamps) {
      try {
        const d = new Date(ts);
        if (!isNaN(d.getTime())) {
          const key = d.toISOString().slice(0, 10);
          map.set(key, (map.get(key) || 0) + 1);
        }
      } catch {
        // ignore invalid dates
      }
    }
    return map;
  }, [activityTimestamps]);

  const { weeks, months, totalRuns, activeStreak } = useMemo(() => {
    const weeksList: DayActivity[][] = [];
    const monthsList: { name: string; colIndex: number }[] = [];
    
    const today = new Date();
    // Align so the last day shown is today
    const totalDays = WEEKS_COUNT * DAYS_PER_WEEK;
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - totalDays + 1);

    let lastMonth = -1;
    let total = 0;

    for (let w = 0; w < WEEKS_COUNT; w++) {
      const week: DayActivity[] = [];
      
      for (let d = 0; d < DAYS_PER_WEEK; d++) {
        const currentDate = new Date(startDate);
        currentDate.setDate(startDate.getDate() + (w * 7 + d));
        
        const monthIndex = currentDate.getMonth();
        if (d === 0 && monthIndex !== lastMonth) {
          monthsList.push({
            name: currentDate.toLocaleString('default', { month: 'short' }),
            colIndex: w
          });
          lastMonth = monthIndex;
        }

        const isoKey = currentDate.toISOString().slice(0, 10);
        const runs = activityMap.get(isoKey) || 0;
        total += runs;

        let level: 0 | 1 | 2 | 3 | 4 = 0;
        if (runs >= 8) level = 4;
        else if (runs >= 4) level = 3;
        else if (runs >= 2) level = 2;
        else if (runs >= 1) level = 1;

        const formattedMonth = currentDate.toLocaleString('default', { month: 'short' });
        const dayNum = currentDate.getDate();
        const year = currentDate.getFullYear();
        const weekdayName = currentDate.toLocaleString('default', { weekday: 'long' });

        week.push({
          dayOfWeek: d,
          date: `${formattedMonth} ${dayNum}`,
          fullDate: `${weekdayName}, ${formattedMonth} ${dayNum}, ${year}`,
          isoDate: isoKey,
          runs,
          level,
        });
      }
      weeksList.push(week);
    }

    // Compute active streak working backwards from today
    let streak = 0;
    let checkDate = new Date(today);
    while (true) {
      const k = checkDate.toISOString().slice(0, 10);
      const count = activityMap.get(k) || 0;
      if (count > 0) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      } else {
        // Allow today to still be 0 if yesterday had runs
        if (streak === 0 && checkDate.toDateString() === today.toDateString()) {
          checkDate.setDate(checkDate.getDate() - 1);
          const yestCount = activityMap.get(checkDate.toISOString().slice(0, 10)) || 0;
          if (yestCount > 0) {
            streak++;
            checkDate.setDate(checkDate.getDate() - 1);
            continue;
          }
        }
        break;
      }
    }

    return {
      weeks: weeksList,
      months: monthsList,
      totalRuns: total.toLocaleString(),
      activeStreak: streak,
    };
  }, [activityMap]);

  const LEVEL_CLASSES: Record<number, string> = {
    0: 'bg-white/[0.04] border border-white/[0.04]',
    1: 'bg-emerald-950/80 border border-emerald-900/50 hover:border-emerald-600',
    2: 'bg-emerald-800/80 border border-emerald-700/60 hover:border-emerald-500',
    3: 'bg-emerald-600/90 border border-emerald-500/70 hover:border-emerald-400',
    4: 'bg-emerald-400 border border-emerald-300 hover:border-white',
  };

  return (
    <div className="rounded-3xl glass-panel-luxury p-5 sm:p-6 border border-white/10 shadow-2xl relative overflow-hidden">
      <div className="absolute inset-x-0 top-0 h-[1.5px] glass-specular-line pointer-events-none" />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h3 className="text-sm font-display font-semibold text-white tracking-wide flex items-center gap-2">
            <span>Prompt Activity Heatmap</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 border border-white/10 text-emerald-400">
              Live Tracker
            </span>
          </h3>
          <p className="text-xs text-white/40 mt-0.5 font-mono">
            {activityTimestamps.length > 0
              ? 'Real-time telemetry of prompt generations and LLM evaluations'
              : 'Start synthesizing prompts in Bedrock to build your contribution activity'}
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs font-mono">
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 text-[11px] uppercase">Streak:</span>
            <span className="text-emerald-400 font-bold">{activeStreak} {activeStreak === 1 ? 'day' : 'days'}</span>
          </div>
          <div className="w-px h-3.5 bg-white/10" />
          <div className="flex items-center gap-1.5">
            <span className="text-white/40 text-[11px] uppercase">Runs:</span>
            <span className="text-white font-bold">{totalRuns}</span>
          </div>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto custom-scrollbar pb-2">
        <div className="min-w-[620px]">
          {/* Months header */}
          <div className="flex text-[10px] font-mono text-white/35 mb-2 ml-7">
            {months.map((m, idx) => (
              <span 
                key={idx} 
                style={{ width: `${(100 / WEEKS_COUNT) * 2.5}%` }} 
                className="inline-block truncate"
              >
                {m.name}
              </span>
            ))}
          </div>

          <div className="flex gap-1.5">
            {/* Days of week labels */}
            <div className="flex flex-col justify-between text-[9px] font-mono text-white/30 h-[106px] pr-2 select-none">
              <span>Mon</span>
              <span>Wed</span>
              <span>Fri</span>
            </div>

            {/* Weeks columns */}
            <div className="flex flex-1 gap-1.5">
              {weeks.map((week, wIdx) => (
                <div key={wIdx} className="flex flex-col gap-1.5 flex-1">
                  {week.map((day, dIdx) => (
                    <div
                      key={dIdx}
                      onMouseEnter={() => setHoveredCell(day)}
                      onMouseLeave={() => setHoveredCell(null)}
                      className={cn(
                        "w-full h-3 rounded-[3.5px] transition-all duration-150 cursor-pointer",
                        LEVEL_CLASSES[day.level]
                      )}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tooltip & Legend Footer */}
      <div className="mt-4 pt-3.5 border-t border-white/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs font-mono">
        <div className="min-h-[20px] text-white/70 text-[11px]">
          {hoveredCell ? (
            <span>
              <strong className="text-white">{hoveredCell.runs} runs</strong> on {hoveredCell.fullDate}
            </span>
          ) : (
            <span className="text-white/35">Hover over any tile to view daily execution telemetry</span>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[10px] text-white/40">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded-[2.5px] bg-white/[0.04] border border-white/[0.04]" />
          <span className="w-2.5 h-2.5 rounded-[2.5px] bg-emerald-950/80 border border-emerald-900/50" />
          <span className="w-2.5 h-2.5 rounded-[2.5px] bg-emerald-800/80 border border-emerald-700/60" />
          <span className="w-2.5 h-2.5 rounded-[2.5px] bg-emerald-600/90 border border-emerald-500/70" />
          <span className="w-2.5 h-2.5 rounded-[2.5px] bg-emerald-400 border border-emerald-300" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
}
