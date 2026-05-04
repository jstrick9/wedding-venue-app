import React from 'react';

interface LogoProps {
  url?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/**
 * Logo Component for Seven Paths Manor
 * 
 * To use your own logo:
 * 1. Upload your logo image to your hosting (Squarespace Files, etc.)
 * 2. Pass the URL as the 'url' prop
 * 
 * Example:
 * <Logo url="https://your-domain.com/path/to/logo.png" />
 */
export const Logo: React.FC<LogoProps> = ({ 
  url, 
  size = 'md',
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-lg',
    lg: 'text-2xl'
  };

  if (url) {
    return (
      <img 
        src={url} 
        alt="Seven Paths Manor" 
        className={`object-contain ${sizeClasses[size]} ${className}`}
      />
    );
  }

  // Fallback placeholder logo
  return (
    <div 
      className={`rounded-lg bg-white/10 flex items-center justify-center ${sizeClasses[size]} ${className}`}
    >
      <span className={`font-serif font-bold text-white ${textSizes[size]}`}>
        7P
      </span>
    </div>
  );
};

export default Logo;
