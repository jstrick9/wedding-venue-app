import React from 'react';
import { Config } from '../../../config';

interface BrandedSectionHeaderProps {
  icon: string;
  title: string;
  description?: string;
  config: Config;
  variant?: 'primary' | 'secondary' | 'accent';
}

export function BrandedSectionHeader({ icon, title, description, config, variant = 'primary' }: BrandedSectionHeaderProps) {
  const bgColor = variant === 'primary' ? config.primaryColor : 
                  variant === 'secondary' ? config.primaryDark : config.accentColor;
  
  return (
    <div className="p-4 rounded-t-xl" style={{ 
      background: `linear-gradient(135deg, ${bgColor} 0%, ${config.primaryDark} 100%)`,
      fontFamily: config.headingFontFamily 
    }}>
      <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: config.headerTextColor }}>
        <span className="text-xl">{icon}</span>
        {title}
      </h3>
      {description && (
        <p className="text-sm mt-1 opacity-90" style={{ color: config.headerTextColor }}>
          {description}
        </p>
      )}
    </div>
  );
}

interface BrandedStatCardProps {
  icon: string;
  label: string;
  value: string | number;
  config: Config;
  variant?: 'primary' | 'secondary' | 'accent' | 'success' | 'warning';
}

export function BrandedStatCard({ icon, label, value, config, variant = 'primary' }: BrandedStatCardProps) {
  const bgColor = variant === 'primary' ? `${config.primaryColor}15` :
                  variant === 'secondary' ? `${config.primaryDark}15` :
                  variant === 'accent' ? `${config.accentColor}15` :
                  variant === 'success' ? '#10b98115' : '#f59e0b15';
  
  const textColor = variant === 'primary' ? config.primaryColor :
                    variant === 'secondary' ? config.primaryDark :
                    variant === 'accent' ? config.accentColor :
                    variant === 'success' ? '#059669' : '#d97706';

  return (
    <div className="p-3 rounded-xl text-center border" style={{ backgroundColor: bgColor, borderColor: `${textColor}30` }}>
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold" style={{ color: textColor }}>{value}</div>
      <div className="text-xs text-gray-600">{label}</div>
    </div>
  );
}

interface TipItem {
  icon?: string;
  title: string;
  description: string;
}

interface BrandedTipsProps {
  title: string;
  tips: TipItem[];
  config: Config;
  defaultOpen?: boolean;
}

export function BrandedTips({ title, tips, config, defaultOpen = false }: BrandedTipsProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <div className="rounded-xl border overflow-hidden" style={{ backgroundColor: `${config.primaryColor}08`, borderColor: `${config.primaryColor}30` }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-3 flex items-center justify-between cursor-pointer hover:opacity-90"
        style={{ backgroundColor: `${config.primaryColor}15` }}
      >
        <h4 className="font-semibold flex items-center gap-2" style={{ color: config.primaryColor }}>
          <span>💡</span>
          <span>{title}</span>
        </h4>
        <span style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
      </button>
      {isOpen && (
        <div className="p-4 space-y-3">
          {tips.map((tip, index) => (
            <div key={index} className="flex items-start gap-3 p-3 rounded-lg bg-white/50 border" style={{ borderColor: `${config.primaryColor}20` }}>
              <span className="text-lg flex-shrink-0">{tip.icon || '💡'}</span>
              <div>
                <h5 className="font-semibold text-sm" style={{ color: config.primaryColor }}>{tip.title}</h5>
                <p className="text-xs text-gray-600 mt-0.5">{tip.description}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}