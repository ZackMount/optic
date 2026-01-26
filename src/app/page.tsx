"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageDropzone } from "@/components/image-dropzone";
import { Toolbar } from "@/components/toolbar";
import { WorkspacePreview } from "@/components/workspace-preview";
import { Header } from "@/components/header";
import { useImageProcessor, defaultTransformations, type Transformations } from "@/hooks/use-image-processor";
import { useTheme } from "@/hooks/use-theme";
import { useClipboardPaste } from "@/hooks/use-clipboard-paste";

export default function Home() {
  const [sourceImage, setSourceImage] = useState<string | null>(null);
  const [transformations, setTransformations] = useState<Transformations>(defaultTransformations);

  const { resultImage, isProcessing, progress } = useImageProcessor(sourceImage, transformations);
  const { mode, cycleTheme, mounted } = useTheme();
  
  useClipboardPaste(setSourceImage);
  
  const isGif = useMemo(() => sourceImage?.startsWith('data:image/gif') || false, [sourceImage]);

  const handleReset = () => {
    setSourceImage(null);
    setTransformations(defaultTransformations);
  };

  if (!mounted) {
    return <div className="w-screen h-screen bg-background" />;
  }

  return (
    <main className="w-screen h-screen overflow-hidden bg-gradient-to-br from-gradient-start via-gradient-mid to-gradient-end">
      <div className="w-full h-full flex items-center justify-center p-3">
        {/* App Container - 85% of screen */}
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative w-[95%] max-w-[1600px] h-[92vh] glass-panel rounded-2xl flex flex-col overflow-hidden"
        >
          {/* Header */}
          <Header 
            themeMode={mode}
            onCycleTheme={cycleTheme}
            hasImage={!!sourceImage}
            onClose={handleReset}
            progress={progress}
            isProcessing={isProcessing}
          />

          {/* Content */}
          <div className="flex-1 flex overflow-hidden">
            <AnimatePresence mode="wait">
              {!sourceImage ? (
                <motion.div 
                  key="dropzone"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full p-4"
                >
                  <ImageDropzone onImageSelect={setSourceImage} className="w-full h-full" />
                </motion.div>
              ) : (
                <motion.div 
                  key="workspace"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full flex"
                >
                  {/* Toolbar */}
                  <div className="h-full border-r border-border bg-background/30">
                    <Toolbar 
                      transformations={transformations} 
                      setTransformations={setTransformations} 
                      isGif={isGif}
                    />
                  </div>

                  {/* Preview */}
                  <div className="flex-1 min-w-0">
                    <WorkspacePreview 
                      original={sourceImage} 
                      processed={resultImage} 
                      isProcessing={isProcessing}
                    />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
