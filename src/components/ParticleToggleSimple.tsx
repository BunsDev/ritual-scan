'use client'
import { useState, useEffect } from 'react';
import { Sparkles, SparklesIcon } from 'lucide-react';

export function ParticleToggleSimple() {
  const [isEnabled, setIsEnabled] = useState(true);
  const [showControls, setShowControls] = useState(false);

  useEffect(() => {
    // Load saved preference from localStorage on mount
    const saved = localStorage.getItem('particleBackgroundEnabled');
    if (saved !== null) {
      const enabled = JSON.parse(saved);
      setIsEnabled(enabled);
    } else {
      // Default to enabled if no preference saved
      setIsEnabled(true);
      localStorage.setItem('particleBackgroundEnabled', 'true');
    }
  }, []);

  // Monitor for canvas changes and apply state
  useEffect(() => {
    const applyCanvasState = () => {
      const canvas = document.getElementById('particle-bg');
      if (canvas) {
        canvas.style.display = isEnabled ? 'block' : 'none';
      }
    };

    // Apply immediately
    applyCanvasState();

    // Set up periodic checks for canvas creation
    const interval = setInterval(applyCanvasState, 100);

    // Set up observer for DOM changes to catch when canvas is added
    const observer = new MutationObserver(() => {
      setTimeout(applyCanvasState, 50); // Small delay to ensure canvas is fully created
    });
    observer.observe(document.body, { childList: true, subtree: true });

    // Clean up after 10 seconds
    const cleanup = setTimeout(() => {
      clearInterval(interval);
      observer.disconnect();
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(cleanup);
      observer.disconnect();
    };
  }, [isEnabled]);

  const toggleParticles = () => {
    const newState = !isEnabled;
    setIsEnabled(newState);
    
    // Save preference to localStorage
    localStorage.setItem('particleBackgroundEnabled', JSON.stringify(newState));
    
    // Toggle the existing particle background canvas
    const canvas = document.getElementById('particle-bg');
    if (canvas) {
      canvas.style.display = newState ? 'block' : 'none';
    }
  };

  return (
    <div className="fixed bottom-4 right-20 z-50">
      <div 
        className="relative"
        onMouseEnter={() => setShowControls(true)}
        onMouseLeave={() => setShowControls(false)}
      >
        {/* Main Toggle Button */}
        <button
          onClick={toggleParticles}
          className={`w-12 h-12 rounded-full backdrop-blur-sm border transition-all duration-300 flex items-center justify-center ${
            isEnabled 
              ? 'bg-lime-500/20 border-lime-500/50 text-lime-400 hover:bg-lime-500/30' 
              : 'bg-gray-500/20 border-gray-500/50 text-gray-400 hover:bg-gray-500/30'
          }`}
          title={isEnabled ? "Disable particle background" : "Enable particle background"}
        >
          {isEnabled ? (
            <Sparkles className="w-5 h-5" />
          ) : (
            <SparklesIcon className="w-5 h-5 opacity-50" />
          )}
          
          {/* Pulsing indicator when enabled */}
          {isEnabled && (
            <div className="absolute inset-0 rounded-full bg-lime-400/20 animate-pulse"></div>
          )}
        </button>

        {/* Extended Controls on Hover */}
        {showControls && (
          <div className="absolute bottom-full right-0 mb-2 bg-black/80 backdrop-blur-sm border border-lime-500/20 rounded-lg p-3 min-w-[200px] transition-all duration-200">
            <div className="text-xs text-lime-400 font-semibold mb-2">
              Ritualization
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Status:</span>
                <span className={`text-xs font-medium ${isEnabled ? 'text-lime-400' : 'text-gray-400'}`}>
                  {isEnabled ? 'Enabled' : 'Disabled'}
                </span>
              </div>
              
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-300">Performance:</span>
                <span className="text-xs text-blue-400">
                  {isEnabled ? 'Active' : 'Optimized'}
                </span>
              </div>
            </div>
            
            <div className="mt-2 pt-2 border-t border-gray-600">
              <div className="text-gray-400 text-[10px]">
                Toggle to improve performance
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
