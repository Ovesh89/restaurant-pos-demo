import React from 'react';

export const PageHeader = ({
  title,
  subtitle,
  children
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between pb-4 mb-4 sm:pb-6 sm:mb-6 border-b border-slate-200 gap-3 sm:gap-4">
      <div>
        <h1 className="text-xl sm:text-2xl font-extrabold text-slate-800 tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-normal">{subtitle}</p>}
      </div>
      {children && <div className="flex flex-wrap items-center gap-2 sm:gap-2.5">{children}</div>}
    </div>
  );
};
