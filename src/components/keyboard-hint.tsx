"use client";

import { usePlatform } from "@/hooks/use-platform";

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[10px] font-medium bg-card border border-border-strong rounded shadow-[0_1px_2px_rgba(0,0,0,0.05)] dark:shadow-[0_1px_2px_rgba(0,0,0,0.3)]">
      {children}
    </kbd>
  );
}

export function KeyboardHint() {
  const { platform, deviceType, mounted } = usePlatform();

  if (!mounted) {
    return <span className="text-xs text-muted mt-1">or click to browse</span>;
  }

  if (deviceType === 'mobile' || deviceType === 'tablet') {
    return (
      <p className="text-xs text-muted mt-1">
        or tap to browse
      </p>
    );
  }

  if (platform === 'mac') {
    return (
      <p className="text-xs text-muted mt-1 flex items-center justify-center gap-1 flex-wrap">
        <span>or click to browse</span>
        <span>•</span>
        <span className="flex items-center gap-1">
          <Key>⌘</Key>
          <span>+</span>
          <Key>V</Key>
          <span>to paste</span>
        </span>
      </p>
    );
  }

  return (
    <p className="text-xs text-muted mt-1 flex items-center justify-center gap-1 flex-wrap">
      <span>or click to browse</span>
      <span>•</span>
      <span className="flex items-center gap-1">
        <Key>Ctrl</Key>
        <span>+</span>
        <Key>V</Key>
        <span>to paste</span>
      </span>
    </p>
  );
}
