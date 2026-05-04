import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { getConfig } from '../config';
import PasswordReset from './PasswordReset';

export interface LoginScreenProps {
  onContinueAsGuest?: () => void;
}

export function LoginScreen({ onContinueAsGuest }: LoginScreenProps) {
  const { login, continueAsGuest } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockoutTime, setLockoutTime] = useState(0);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const usernameInputRef = useRef<HTMLInputElement>(null);
  
  const config = getConfig();
  
  // Trigger animation on mount and focus username input
  useEffect(() => {
    const timer = setTimeout(() => {
      setAnimateIn(true);
      usernameInputRef.current?.focus();
    }, 100);
    
    // Load remembered username
    const savedUsername = localStorage.getItem('spm_remembered_user');
    if (savedUsername) {
      setUsername(savedUsername);
      setRememberMe(true);
    }
    
    return () => clearTimeout(timer);
  }, []);
  
  // Handle lockout timer
  useEffect(() => {
    if (lockoutTime > 0) {
      const timer = setInterval(() => {
        setLockoutTime(prev => {
          if (prev <= 1) {
            setIsLocked(false);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return () => clearInterval(timer);
    }
  }, [lockoutTime]);

  // Detect caps lock
  const handleKeyDown = (e: React.KeyboardEvent) => {
    setCapsLockOn(e.getModifierState('CapsLock'));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isLocked) {
      return;
    }
    
    setError('');
    setIsLoading(true);
    
    // Small delay for UX
    await new Promise(resolve => setTimeout(resolve, 400));
    
    const success = login(username, password);
    if (success) {
      // Save username if remember me is checked
      if (rememberMe) {
        localStorage.setItem('spm_remembered_user', username);
      } else {
        localStorage.removeItem('spm_remembered_user');
      }
      setLoginAttempts(0);
    } else {
      const newAttempts = loginAttempts + 1;
      setLoginAttempts(newAttempts);
      
      if (newAttempts >= 5) {
        setIsLocked(true);
        setLockoutTime(30); // 30 second lockout
        setError('Too many failed attempts. Please wait 30 seconds.');
      } else if (newAttempts >= 3) {
        setError(`Invalid credentials. ${5 - newAttempts} attempts remaining.`);
      } else {
        setError('Invalid username or password');
      }
    }
    setIsLoading(false);
  };

  const handleGuestAccess = () => {
    if (onContinueAsGuest) {
      onContinueAsGuest();
    } else {
      continueAsGuest();
    }
  };

  // Get display tagline (from branding or default)
  const displayTagline = config.tagline || 'Where Your Love Story Unfolds';

  return (
    <div 
      className="fixed inset-0 w-full h-full flex items-center justify-center overflow-auto"
      style={{
        background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.primaryDark} 50%, #1a0a14 100%)`
      }}
    >
      {/* Decorative elements - fixed position, hidden on small screens */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none hidden sm:block">
        <div className="absolute top-10 left-10 w-64 h-64 bg-white/5 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-10 right-10 w-96 h-96 bg-white/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }}></div>
        <div className="absolute top-1/4 left-1/4 text-2xl opacity-10 animate-bounce" style={{ animationDelay: '0.5s' }}>💕</div>
        <div className="absolute top-1/3 right-1/4 text-xl opacity-10 animate-bounce" style={{ animationDelay: '1.5s' }}>✨</div>
      </div>

      {/* Login Card - Compact and Responsive */}
      <div 
        className={`relative bg-white rounded-xl sm:rounded-2xl shadow-2xl w-[94%] max-w-[380px] m-2 transition-all duration-700 ease-out ${animateIn ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'}`}
        style={{
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          maxHeight: 'calc(100vh - 16px)',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Header with Logo - Compact */}
        <div 
          className="p-3 sm:p-4 text-center relative overflow-hidden rounded-t-xl sm:rounded-t-2xl flex-shrink-0" 
          style={{ backgroundColor: config.primaryColor }}
        >
          {/* Header decorative pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.4'%3E%3Cpath d='M20 20v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}></div>
          </div>
          
          {/* Logo - Smaller */}
          <div className="relative mb-2 flex justify-center">
            {config.logoUrl ? (
              <div className="bg-white/10 p-1.5 rounded-lg backdrop-blur-sm">
                <img 
                  src={config.logoUrl} 
                  alt={config.venueName} 
                  className="max-h-12 sm:max-h-14 w-auto object-contain"
                />
              </div>
            ) : (
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white/10 border-2 border-white/30 flex items-center justify-center backdrop-blur-sm">
                <div className="text-center">
                  <div className="text-2xl sm:text-3xl">💒</div>
                </div>
              </div>
            )}
          </div>
          
          {/* Venue Name - Compact */}
          <h1 
            className="text-lg sm:text-xl font-bold text-white tracking-wide relative"
            style={{ fontFamily: config.headingFontFamily || 'inherit' }}
          >
            {config.venueName || 'Seven Paths Manor'}
          </h1>
          
          {/* Tagline from Branding - Single line */}
          <p className="text-white/80 text-[10px] sm:text-xs mt-1 italic truncate px-2">
            "{displayTagline}"
          </p>
          
          {/* App Title & Location - Combined */}
          <div className="mt-1 flex items-center justify-center gap-2 text-white/60 text-[9px] sm:text-[10px]">
            <span>Wedding Layout Planner</span>
            <span>•</span>
            <span className="flex items-center gap-0.5">
              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              </svg>
              {config.location || 'Spring Hope, NC'}
            </span>
          </div>
        </div>

        {/* Login Form - Scrollable if needed */}
        <div className="p-3 sm:p-4 flex-1 overflow-y-auto">
          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Username Field */}
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">
                Username
              </label>
              <div className="relative">
                <input
                  ref={usernameInputRef}
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 pl-8 border-2 border-gray-200 rounded-lg focus:outline-none transition-all text-sm"
                  style={{ 
                    borderColor: error ? '#f87171' : '#e5e7eb',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = config.primaryColor;
                    e.target.style.boxShadow = `0 0 0 3px ${config.primaryColor}20`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = error ? '#f87171' : '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Enter username"
                  required
                  autoComplete="username"
                  disabled={isLocked}
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                </div>
              </div>
            </div>
            
            {/* Password Field */}
            <div>
              <label className="block text-[10px] sm:text-xs font-semibold text-gray-700 mb-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="w-full px-3 py-2 pl-8 pr-8 border-2 border-gray-200 rounded-lg focus:outline-none transition-all text-sm"
                  style={{ 
                    borderColor: error ? '#f87171' : '#e5e7eb',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = config.primaryColor;
                    e.target.style.boxShadow = `0 0 0 3px ${config.primaryColor}20`;
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = error ? '#f87171' : '#e5e7eb';
                    e.target.style.boxShadow = 'none';
                  }}
                  placeholder="Enter password"
                  required
                  autoComplete="current-password"
                  disabled={isLocked}
                />
                <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                </div>
                {/* Show/Hide password toggle */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              
              {/* Caps Lock Warning */}
              {capsLockOn && (
                <div className="mt-1 flex items-center gap-1 text-amber-600 text-[9px]">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  Caps Lock is on
                </div>
              )}
            </div>
            
            {/* Remember Me & Forgot Password - Compact */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-1.5 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-3.5 h-3.5 rounded border-gray-300 focus:ring-2 cursor-pointer"
                  style={{ accentColor: config.primaryColor }}
                />
                <span className="text-[10px] sm:text-xs text-gray-600">Remember me</span>
              </label>
              
              <button 
                type="button"
                onClick={() => setShowPasswordReset(true)}
                className="text-[10px] sm:text-xs hover:underline transition-colors"
                style={{ color: config.primaryColor }}
              >
                Forgot password?
              </button>
            </div>
            
            {/* Error Message */}
            {error && (
              <div className="p-2 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 animate-shake">
                <svg className="w-3.5 h-3.5 text-red-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-red-600">{error}</span>
              </div>
            )}
            
            {/* Lockout Timer */}
            {isLocked && lockoutTime > 0 && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-amber-500 flex-shrink-0 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs text-amber-700">Retry in {lockoutTime}s</span>
              </div>
            )}
            
            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isLoading || isLocked}
              className="w-full py-2.5 text-white font-semibold rounded-lg transition-all transform hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed disabled:transform-none text-sm"
              style={{ 
                background: `linear-gradient(135deg, ${config.primaryColor} 0%, ${config.primaryDark} 100%)`,
                boxShadow: `0 4px 14px ${config.primaryColor}40`
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  Sign In
                </span>
              )}
            </button>
          </form>
          
          {/* Divider */}
          <div className="flex items-center gap-3 my-3">
            <div className="flex-1 h-px bg-gray-200"></div>
            <span className="text-[10px] text-gray-400">or</span>
            <div className="flex-1 h-px bg-gray-200"></div>
          </div>
          
          {/* Continue as Guest */}
          <button
            type="button"
            onClick={handleGuestAccess}
            className="w-full py-2 border-2 border-gray-200 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-all transform hover:scale-[1.02] active:scale-[0.98] text-sm"
          >
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Continue as Guest
            </span>
          </button>
        </div>
        
        {/* Footer - Compact */}
        <div className="px-3 py-2 bg-gray-50 rounded-b-xl sm:rounded-b-2xl border-t border-gray-100 flex-shrink-0">
          <div className="flex items-center justify-between text-[9px] sm:text-[10px] text-gray-500">
            <span>© {new Date().getFullYear()} {config.venueName || 'Seven Paths Manor'}</span>
            <div className="flex items-center gap-2">
              {config.phone && (
                <a href={`tel:${config.phone}`} className="hover:text-gray-700 flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                </a>
              )}
              {config.supportEmail && (
                <a href={`mailto:${config.supportEmail}`} className="hover:text-gray-700 flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                </a>
              )}
              {config.websiteUrl && (
                <a href={config.websiteUrl} target="_blank" rel="noopener noreferrer" className="hover:text-gray-700 flex items-center gap-0.5">
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Password Reset Modal */}
      {showPasswordReset && (
        <PasswordReset
          onClose={() => setShowPasswordReset(false)}
          onSuccess={() => {
            setShowPasswordReset(false);
            setError('');
            // Optionally auto-fill username if it was entered during reset
          }}
        />
      )}
    </div>
  );
}
