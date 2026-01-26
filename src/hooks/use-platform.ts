"use client";

import { useState, useEffect } from 'react';

export type Platform = 'mac' | 'windows' | 'linux' | 'unknown';
export type DeviceType = 'desktop' | 'mobile' | 'tablet';

export function usePlatform() {
  const [platform, setPlatform] = useState<Platform>('unknown');
  const [deviceType, setDeviceType] = useState<DeviceType>('desktop');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const userAgent = navigator.userAgent.toLowerCase();
    let detectedPlatform: Platform = 'unknown';
    
    if (userAgent.includes('mac')) {
      detectedPlatform = 'mac';
    } else if (userAgent.includes('win')) {
      detectedPlatform = 'windows';
    } else if (userAgent.includes('linux')) {
      detectedPlatform = 'linux';
    }
    
    setPlatform(detectedPlatform);

    const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
    const isTablet = /ipad|android(?!.*mobile)|tablet/i.test(userAgent);
    
    if (isTablet) {
      setDeviceType('tablet');
    } else if (isMobile) {
      setDeviceType('mobile');
    } else {
      setDeviceType('desktop');
    }

    setMounted(true);
  }, []);

  return { platform, deviceType, mounted };
}
