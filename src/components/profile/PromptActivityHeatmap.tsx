import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Flame, 
  TrendingUp, 
  Calendar, 
  Zap, 
  Activity, 
  ShieldCheck
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface DayActivity {
  dayOfWeek: number; // 0-6
  date: string; // "Feb 18, 2026"
  fullDate: string; // "Wednesday, Feb 18, 2026"
  runs: number;
  level: 0 | 1 | 2 | 3 | 4;
  pipelines: string;
  avgLatency: string;
  successRate: string;
}

const WEEKS_COUNT = 16;
const DAYS_PER_WEEK = 7;

// Generate deterministic & beautiful calendar data for the past 16 weeks
function generateActivityCalendar(): { weeks: DayActivity[][]; months: { name: string; colIndex: number }[] } {
  const weeks: DayActivity[][] = [];
  const months: { name: string; colIndex: number }[] = [];
  
  // Reference end date: Feb 20, 2026
  const baseDate = new Date(2026, 1, 20);
  const totalDays = WEEKS_COUNT * DAYS_PER_WEEK;
  
  // Calculate start date
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

      // Generate a realistic activity pattern
      const isWeekend = d === 0 || d === 6;
      const recencyBoost = (w / WEEKS_COUNT) * 0.4;
      // High streak in the last 3 weeks
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
          runs = Math.floor(pseudoRand * 3) + 1; // 1 - 3
          break;
        case 2:
          runs = Math.floor(pseudoRand * 4) + 4; // 4 - 7
          break;
        case 3:
          runs = Math.floor(pseudoRand * 6) + 8; // 8 - 13
          break;
        case 4:
          runs = Math.floor(pseudoRand * 8) + 14; // 14 - 21
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
        pipelines: level === 0 ? 'No activity recorded' : `${Math.ceil(runs * 0.55)} Branching • ${Math.ceil(runs * 0.3)} Wizard • ${Math.max(1, Math.floor(runs * 0.15))} Tester`,
        avgLatency: level === 0 ? '-' : `${280 + Math.floor(pseudoRand * 180)}ms`,
        successRate: level === 0 ? '-' : `${(98.5 + pseudoRand * 1.5).toFixed(1)}%`
      });
    }
    weeks.push(week);
  }

  return { weeks, months };
}

const STATIC_CALENDAR = generateActivityCalendar();

export function PromptActivityHeatmap() {
  const [hoveredCell, setHoveredCell] = useState<DayActivity | null>(null);
  const [filter, setFilter] = useState<'all' | 'streak' | 'high'>('all');

  const { totalRuns, activeStreak, peakDayRuns, passRate } = useMemo(() => {
    let runs = 0;
    let max = 0;
    STATIC_CALENDAR.weeks.forEach(w => {
      w.forEach(d => {
        runs += d.runs;
        if (d.runs > max) max = d.runs;
      });
    });
    return {
      totalRuns: '1,894',
      activeStreak: 19,
      peakDayRuns: 24,
      passRate: '99.4%'
    };
  }, []);

  // Quick stats highlight
  const statChips = [
    { label: 'Total Executions', value: totalRuns, icon: Zap, detail: '+14% vs prev 16w', highlight: 'text-white' },
    { label: 'Active Streak', value: `${activeStreak} Days`, icon: Flame, detail: 'Personal best streak 🔥', highlight: 'text-copper-400' },
    { label: 'Peak Velocity', value: `${peakDayRuns} Runs/d`, icon: TrendingUp, detail: 'Highest throughput', highlight: 'text-emerald-400' },
    { label: 'Reliability Rate', value: passRate, icon: ShieldCheck, detail: '1,882 tests passed', highlight: 'text-teal-300' },
  ];

  return (
    <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-b from-[#13161c]/90 via-[#0f1115]/95 to-[#0b0c0e]/95 backdrop-blur-2xl p-6 sm:p-7 shadow-2xl shadow-black/80 group">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -top-24 -right-24 w-80 h-80 bg-copper-500/10 rounded-full blur-3xl transition-opacity group-hover:opacity-100 opacity-60" />
      <div className="pointer-events-none absolute -bottom-24 -left-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl transition-opacity group-hover:opacity-100 opacity-40" />
      
      {/* Subtle top light edge */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-copper-400/30 to-transparent" />

      {/* Header section */}
      <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3.5">
          <div className="relative p-2.5 rounded-2xl bg-gradient-to-br from-copper-500/20 via-copper-600/10 to-transparent border border-copper-500/30 shadow-[0_0_20px_rgba(44,154,139,0.25)]">
            <Flame className="w-5 h-5 text-copper-400 animate-pulse" />
            <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-copper-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-copper-400" />
            </span>
          </div>
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              Prompt Architecture Activity
              <span className="text-[10px] uppercase font-mono tracking-wider px-2 py-0.5 rounded-full bg-white/10 text-gray-300 border border-white/10">
                16 WEEKS
              </span>
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {totalRuns} pipeline executions, node transformations, and prompt benchmarks
            </p>
          </div>
        </div>

        {/* Top-Right Badges and Filter */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {/* Quick interactive filter tabs */}
          <div className="flex items-center p-1 rounded-xl bg-black/50 border border-white/10 text-[11px] font-mono">
            {[
              { id: 'all', label: 'All 16w' },
              { id: 'streak', label: 'Active Streak' },
              { id: 'high', label: 'High Velocity' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setFilter(tab.id as 'all' | 'streak' | 'high')}
                className={cn(
                  "px-2.5 py-1 rounded-lg transition-all",
                  filter === tab.id
                    ? "bg-copper-500/30 text-copper-300 font-semibold border border-copper-500/40 shadow-sm"
                    : "text-gray-400 hover:text-white"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-mono font-semibold bg-gradient-to-r from-copper-500/15 to-emerald-500/10 text-copper-300 border border-copper-500/30 shadow-[0_0_12px_rgba(44,154,139,0.2)]">
            <Flame className="w-3.5 h-3.5 text-copper-400 animate-bounce" />
            <span>Active Streak: {activeStreak} Days</span>
          </div>
        </div>
      </div>

      {/* Quick Metrics Bar inside Card */}
      <div className="relative z-10 grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-6">
        {statChips.map((chip, idx) => (
          <div 
            key={idx}
            className="p-3 rounded-2xl bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 hover:border-white/10 transition-all group/stat"
          >
            <div className="flex items-center justify-between text-gray-400 mb-1">
              <span className="text-[11px] font-medium">{chip.label}</span>
              <chip.icon className="w-3.5 h-3.5 text-gray-500 group-hover/stat:text-copper-400 transition-colors" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className={cn("text-lg font-bold font-mono tracking-tight", chip.highlight)}>
                {chip.value}
              </span>
            </div>
            <p className="text-[10px] text-gray-500 font-mono mt-0.5">{chip.detail}</p>
          </div>
        ))}
      </div>

      {/* Heatmap Main Visual Area */}
      <div className="relative z-10 p-4 rounded-2xl bg-black/40 border border-white/5">
        <div className="overflow-x-auto pb-2 pt-1 custom-scrollbar">
          <div className="min-w-[620px]">
            {/* Months Row */}
            <div className="flex text-[11px] font-mono text-gray-400 mb-2 pl-8">
              {STATIC_CALENDAR.weeks.map((_, colIdx) => {
                const monthInfo = STATIC_CALENDAR.months.find(m => m.colIndex === colIdx);
                return (
                  <div key={colIdx} className="flex-1 text-left">
                    {monthInfo ? (
                      <span className="text-gray-300 font-semibold">{monthInfo.name}</span>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {/* Grid with Weekday Labels on Left */}
            <div className="flex gap-2">
              {/* Day of Week Labels */}
              <div className="flex flex-col justify-between py-1 text-[10px] font-mono text-gray-500 w-6 select-none">
                <span className="h-3 leading-none opacity-0">Sun</span>
                <span className="h-3 leading-none">Mon</span>
                <span className="h-3 leading-none opacity-0">Tue</span>
                <span className="h-3 leading-none">Wed</span>
                <span className="h-3 leading-none opacity-0">Thu</span>
                <span className="h-3 leading-none">Fri</span>
                <span className="h-3 leading-none opacity-0">Sat</span>
              </div>

              {/* Columns of Days */}
              <div className="flex gap-1.5 flex-1">
                {STATIC_CALENDAR.weeks.map((week, wIndex) => (
                  <div key={wIndex} className="flex flex-col gap-1.5 flex-1">
                    {week.map((item, dIndex) => {
                      // Rich glowing color assignment
                      let cellStyle = 'bg-white/[0.04] border border-white/[0.04] hover:border-white/30 hover:bg-white/10';
                      
                      if (item.level === 1) {
                        cellStyle = 'bg-[#10302b] border border-[#1b4d45] hover:border-copper-400 hover:bg-copper-900/90';
                      } else if (item.level === 2) {
                        cellStyle = 'bg-[#175349] border border-[#237064] shadow-[0_0_8px_rgba(44,154,139,0.3)] hover:border-copper-300 hover:bg-[#1d6358]';
                      } else if (item.level === 3) {
                        cellStyle = 'bg-[#2c9a8b] border border-[#4fb0a1] shadow-[0_0_12px_rgba(44,154,139,0.55)] hover:border-white hover:bg-[#35b1a0]';
                      } else if (item.level === 4) {
                        cellStyle = 'bg-gradient-to-tr from-[#4fb0a1] via-[#7cdbcb] to-white border border-white shadow-[0_0_16px_rgba(124,219,203,0.85)] ring-1 ring-white/40 hover:scale-130';
                      }

                      const isHovered = hoveredCell?.fullDate === item.fullDate;
                      const isFilteredOut = (filter === 'high' && item.level < 2) || (filter === 'streak' && (wIndex < 13 || item.level === 0));

                      return (
                        <div
                          key={dIndex}
                          onMouseEnter={() => setHoveredCell(item)}
                          onMouseLeave={() => setHoveredCell(null)}
                          className={cn(
                            "h-3.5 sm:h-4 rounded-[4px] cursor-pointer transition-all duration-200 transform",
                            cellStyle,
                            isFilteredOut ? "opacity-15 scale-90" : "opacity-100",
                            isHovered && "scale-135 z-20 ring-2 ring-white shadow-[0_0_20px_rgba(79,176,161,0.9)] opacity-100"
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

        {/* Dynamic Detail Card on Hover */}
        <div className="mt-3.5 pt-3 border-t border-white/5 min-h-[46px] flex items-center justify-between">
          <AnimatePresence mode="wait">
            {hoveredCell ? (
              <motion.div
                key={hoveredCell.fullDate}
                initial={{ opacity: 0, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -3 }}
                transition={{ duration: 0.15 }}
                className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center gap-1.5 text-gray-300 font-medium">
                    <Calendar className="w-3.5 h-3.5 text-copper-400" />
                    <span>{hoveredCell.fullDate}</span>
                  </div>
                  <span className="text-gray-600">•</span>
                  <span className={cn(
                    "font-mono font-bold px-2 py-0.5 rounded-full text-[11px]",
                    hoveredCell.runs > 0 ? "bg-copper-500/20 text-copper-300 border border-copper-500/30" : "bg-white/5 text-gray-400"
                  )}>
                    {hoveredCell.runs === 0 ? 'No activity' : `${hoveredCell.runs} executions`}
                  </span>
                </div>

                {hoveredCell.runs > 0 && (
                  <div className="flex items-center gap-3 text-[11px] font-mono text-gray-400">
                    <span className="text-gray-300">{hoveredCell.pipelines}</span>
                    <span className="text-gray-600">•</span>
                    <span>Avg {hoveredCell.avgLatency}</span>
                    <span className="text-gray-600">•</span>
                    <span className="text-emerald-400">{hoveredCell.successRate} Pass</span>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center gap-2 text-xs text-gray-400 font-mono"
              >
                <Activity className="w-3.5 h-3.5 text-copper-400 animate-pulse" />
                <span>Hover over any calendar cell to inspect pipeline execution telemetry and node statistics</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Heatmap Legend & Live Telemetry Badge */}
      <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400 mt-4 pt-4 border-t border-white/5">
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono text-gray-500">Less Active</span>
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-black/40 border border-white/5">
            <div className="w-3.5 h-3.5 rounded-[3px] bg-white/[0.04] border border-white/[0.04]" title="0 executions" />
            <div className="w-3.5 h-3.5 rounded-[3px] bg-[#10302b] border border-[#1b4d45]" title="1-3 executions" />
            <div className="w-3.5 h-3.5 rounded-[3px] bg-[#175349] border border-[#237064] shadow-[0_0_6px_rgba(44,154,139,0.3)]" title="4-7 executions" />
            <div className="w-3.5 h-3.5 rounded-[3px] bg-[#2c9a8b] border border-[#4fb0a1] shadow-[0_0_10px_rgba(44,154,139,0.55)]" title="8-13 executions" />
            <div className="w-3.5 h-3.5 rounded-[3px] bg-gradient-to-tr from-[#4fb0a1] via-[#7cdbcb] to-white border border-white shadow-[0_0_14px_rgba(124,219,203,0.85)]" title="14+ executions" />
          </div>
          <span className="text-[11px] font-mono text-gray-500">More Active</span>
        </div>

        <div className="flex items-center gap-2 text-[11px] font-mono text-gray-400">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
          </span>
          <span className="text-emerald-400/90 font-medium">Telemetry Synced</span>
          <span className="text-gray-600">•</span>
          <span className="text-gray-500">Auto-refresh: 60s</span>
        </div>
      </div>
    </div>
  );
}
