import { Capacitor } from '@capacitor/core';

export type HapticStyle = 'LIGHT' | 'MEDIUM' | 'HEAVY';

/**
 * Triggers haptic feedback on native platforms
 */
export const triggerHaptic = async (style: HapticStyle = 'LIGHT') => {
  if (!Capacitor.isNativePlatform()) return;
  
  try {
    const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    await Haptics.impact({ 
      style: style === 'LIGHT' ? ImpactStyle.Light : style === 'MEDIUM' ? ImpactStyle.Medium : ImpactStyle.Heavy 
    });
  } catch (e) {
    // Haptics not available or failed
    console.warn('Haptics failed:', e);
  }
};
