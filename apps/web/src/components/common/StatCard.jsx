import React from 'react';

export const StatCard = ({
  title,
  mobileTitle,
  value,
  subtitle,
  mobileSubtitle,
  icon: Icon,
  color = 'blue',
  trend,
  onClick
}) => {
  const colorMap = {
    blue: 'bg-blue-50 text-blue-600 border-blue-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100',
    purple: 'bg-purple-50 text-purple-600 border-purple-100',
    rose: 'bg-rose-50 text-rose-600 border-rose-100'
  };

  return (
    <div
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
      className={`bg-white rounded-xl border border-slate-200 p-3 sm:p-5 shadow-sm transition-all h-full min-h-[92px] sm:min-h-0 flex flex-col justify-between ${
        onClick
          ? 'cursor-pointer hover:shadow-md hover:border-blue-400 hover:-translate-y-0.5 active:translate-y-0 select-none'
          : 'hover:shadow'
      }`}
    >
      <div className="flex items-center justify-between gap-1.5 sm:gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-slate-500 truncate">
            {mobileTitle ? (
              <>
                <span className="sm:hidden">{mobileTitle}</span>
                <span className="hidden sm:inline">{title}</span>
              </>
            ) : (
              title
            )}
          </p>
          <h3 className="text-lg sm:text-2xl font-bold text-slate-800 mt-0.5 sm:mt-1 truncate">{value}</h3>
          {(subtitle || mobileSubtitle) && (
            <p className="text-[10px] sm:text-xs text-slate-500 mt-0.5 sm:mt-1 line-clamp-1 truncate">
              {mobileSubtitle ? (
                <>
                  <span className="sm:hidden">{mobileSubtitle}</span>
                  <span className="hidden sm:inline">{subtitle}</span>
                </>
              ) : (
                subtitle
              )}
            </p>
          )}
        </div>
        {Icon && (
          <div className={`p-2 sm:p-3 rounded-xl border shrink-0 ${colorMap[color] || colorMap.blue}`}>
            <Icon className="w-4 h-4 sm:w-6 sm:h-6" />
          </div>
        )}
      </div>
      {trend && (
        <div className="mt-2.5 sm:mt-3 pt-2.5 sm:pt-3 border-t border-slate-100 flex items-center text-xs text-slate-500">
          {trend}
        </div>
      )}
    </div>
  );
};
