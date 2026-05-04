import { useState, useEffect } from 'react';
import { getConfig } from '../config';

interface WelcomeModalProps {
  onClose: () => void;
  isAdmin: boolean;
  isGuest?: boolean;
}

export function WelcomeModal({ onClose, isAdmin, isGuest = false }: WelcomeModalProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [dontShowAgain, setDontShowAgain] = useState(false);
  const config = getConfig();
  
  const steps = [
    {
      icon: config.welcomeLogoUrl ? null : '👋',
      logoUrl: config.welcomeLogoUrl || null,
      title: config.welcomeTitle || 'Welcome to the Wedding Layout Planner',
      description: `Create beautiful, customized layouts for your special day at ${config.venueName || 'Seven Paths Manor'}. This tool makes it easy to design the perfect reception, ceremony, or event space.`,
    },
    {
      icon: '🪑',
      title: 'Add Tables & Fixtures',
      description: 'Simply drag items from the sidebar onto your venue canvas. Click an item to select it, then click on the canvas to place it. Move items by dragging them to new positions.',
    },
    {
      icon: '👥',
      title: 'Manage Your Guest List',
      description: 'Add guests and assign them to tables. Import your guest list from a CSV file for quick setup. Track seating capacity and ensure everyone has a spot.',
    },
    {
      icon: '💾',
      title: 'Save & Share Your Layout',
      description: 'Save your layouts to continue later. Print your design or share it with your venue coordinator. Create multiple layouts to compare different arrangements.',
    },
    {
      icon: '✨',
      title: 'Available Features',
      description: 'Quick access to the tools available in your account.',
    },
  ];

  const featureItems = config.welcomeFeatures && config.welcomeFeatures.length > 0
    ? config.welcomeFeatures
    : ['Layout Design', 'Guest Management', 'Templates', 'Print & Share', 'Event Questions', 'Chat'];

  // Close on escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dontShowAgain]);

  const handleClose = () => {
    if (dontShowAgain) {
      // Only permanently hide when user explicitly clicks "Don't show again"
      localStorage.setItem('spm_welcome_hidden', 'true');
    }
    // Note: We no longer set 'spm_welcome_seen' because we want the welcome
    // to show every time until user clicks "Don't show again"
    onClose();
  };

  const handleNext = () => {
    if (currentStep < steps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[10002] flex items-center justify-center p-4" onClick={handleSkip}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      
      {/* Modal */}
      <div 
        className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-6">
          {steps.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrentStep(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index === currentStep 
                  ? 'bg-[#4A1942] w-8' 
                  : index < currentStep 
                    ? 'bg-[#4A1942]/50' 
                    : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          {/* Icon or Logo */}
          {steps[currentStep].logoUrl ? (
            <div className="mb-6 flex justify-center">
              <img 
                src={steps[currentStep].logoUrl} 
                alt="Welcome" 
                className="max-h-24 max-w-48 object-contain"
              />
            </div>
          ) : (
            <div className="text-6xl mb-6">{steps[currentStep].icon}</div>
          )}
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{steps[currentStep].title}</h2>
          <p className="text-gray-600 leading-relaxed">{steps[currentStep].description}</p>
          {currentStep === steps.length - 1 && (
            <div className="mt-5 grid grid-cols-2 gap-2 text-left">
              {featureItems.map((feature) => (
                <div key={feature} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-700">
                  • {feature}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Don't show again checkbox - only for admin and basic users, not guests */}
        {!isGuest && (
          <div className="px-8 pb-4">
            <label className="flex items-center gap-2 cursor-pointer justify-center">
              <input
                type="checkbox"
                checked={dontShowAgain}
                onChange={(e) => setDontShowAgain(e.target.checked)}
                className="w-4 h-4 rounded border-gray-300 text-[#4A1942] focus:ring-[#4A1942]"
              />
              <span className="text-sm text-gray-600">Don't show this again</span>
            </label>
          </div>
        )}
        
        {/* Guest notice */}
        {isGuest && (
          <div className="px-8 pb-4 text-center">
            <p className="text-xs text-gray-500 italic">
              Sign in to save your preferences
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="px-8 pb-8 flex items-center justify-between">
          <button
            onClick={handleSkip}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            Skip tour
          </button>
          <div className="flex gap-3">
            {currentStep > 0 && (
              <button
                onClick={() => setCurrentStep(currentStep - 1)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Back
              </button>
            )}
            <button
              onClick={handleNext}
              className="px-6 py-2 text-sm font-medium text-white rounded-lg transition-colors"
              style={{ backgroundColor: '#4A1942' }}
            >
              {currentStep === steps.length - 1 ? "Let's Start!" : 'Next'}
            </button>
          </div>
        </div>

        {/* Admin tip */}
        {isAdmin && currentStep === steps.length - 1 && (
          <div className="px-8 pb-6">
            <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
              <div className="flex items-start gap-3">
                <span className="text-xl">⚙️</span>
                <div className="text-sm text-amber-800">
                  <strong>Admin Tip:</strong> Access the Admin Panel from the header menu to customize venues, tables, fixtures, and branding settings. You can also customize this welcome screen in Admin Panel → Branding → Welcome Settings.
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
