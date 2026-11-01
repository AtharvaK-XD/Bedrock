import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../lib/utils';

/** On/off switch with a springy thumb. Announces itself as a switch to screen readers. */
export function Switch({
  checked,
  onChange,
  label,
  disabled = false,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        'relative h-6 w-11 shrink-0 rounded-full p-0.5 transition-colors duration-200 cursor-pointer',
        'disabled:cursor-not-allowed disabled:opacity-40',
        checked ? 'bg-copper-500' : 'bg-white/10'
      )}
    >
      <motion.span
        aria-hidden="true"
        className="block h-5 w-5 rounded-full bg-white shadow-md"
        animate={{ x: checked ? 20 : 0 }}
        whileTap={{ scaleX: 1.15 }}
        transition={{ type: 'spring', stiffness: 520, damping: 30 }}
      />
    </button>
  );
}

/** One line in a settings list: title and short explanation on the left, the control on the right. */
export function SettingRow({
  title,
  description,
  children,
  note,
}: {
  title: string;
  description: string;
  children: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/5 bg-white/[0.02] p-4 transition-colors hover:border-white/10">
      <div className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-0.5">
          <p className="text-sm font-semibold text-white">{title}</p>
          <p className="text-xs leading-relaxed text-gray-400">{description}</p>
        </div>
        {children}
      </div>
      {note && <div className="mt-3 text-xs text-gray-500">{note}</div>}
    </div>
  );
}

/** A titled block (card) inside a settings tab. */
export function SettingCard({
  title,
  description,
  children,
  aside,
}: {
  title: string;
  description?: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-white/5 bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-white">{title}</p>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-gray-400">{description}</p>}
        </div>
        {aside}
      </div>
      {children}
    </div>
  );
}

/** A pill-shaped choice button used for presets (token limits, currencies, sizes). */
export function ChoiceButton({
  active,
  onClick,
  children,
  className,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'cursor-pointer rounded-xl border px-3.5 py-2 text-xs transition-all duration-200 active:scale-[0.97]',
        active
          ? 'border-copper-400 bg-copper-500 font-semibold text-white shadow-sm shadow-copper-500/30'
          : 'border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white',
        className
      )}
    >
      {children}
    </button>
  );
}

/** Tab heading with an icon, the same on every Settings tab. */
export function TabHeading({ icon, title, description }: { icon: ReactNode; title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="flex items-center gap-2.5 text-xl font-bold text-white">
        <span className="text-copper-400">{icon}</span>
        <span>{title}</span>
      </h2>
      <p className="mt-1 text-sm text-gray-400">{description}</p>
    </div>
  );
}
