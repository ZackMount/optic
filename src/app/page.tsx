"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImageDropzone } from "@/components/image-dropzone";
import { Toolbar } from "@/components/toolbar";
import { WorkspacePreview } from "@/components/workspace-preview";
import { Header } from "@/components/header";
import { useImageProcessor, defaultTransformations, type Transformations } from "@/hooks/use-image-processor";
import { useTheme } from "@/hooks/use-theme";
import { useClipboardPaste } from "@/hooks/use-clipboard-paste";
import type { ImageInput } from "@/lib/image-engine/types";

export default function Home() {
  const [sourceImage, setSourceImage] = useState<ImageInput | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [transformations, setTransformations] = useState<Transformations>(defaultTransformations);

  const { preview, info, isProcessing, isExporting, progress, error, exportImage, prepareImage } = useImageProcessor(sourceImage, transformations);
  const { mode, cycleTheme, mounted } = useTheme();
  
  const selectImage = useCallback((input: ImageInput) => {
    setImportError(null); setSourceImage(input); setTransformations(defaultTransformations);
  }, []);
  useClipboardPaste(selectImage, setImportError);
  useEffect(() => () => { if (sourceImage) URL.revokeObjectURL(sourceImage.url); }, [sourceImage]);
  
  const isGif = info?.animated ?? sourceImage?.format === 'gif';

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
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="relative w-[95%] max-w-[1600px] h-[92vh] glass-panel rounded-2xl flex flex-col overflow-hidden"
        >
          <Header 
            themeMode={mode}
            onCycleTheme={cycleTheme}
            hasImage={!!sourceImage}
            onClose={handleReset}
            progress={progress}
            isProcessing={isProcessing || isExporting}
          />

          {importError && <p role="alert" className="px-4 py-2 text-sm text-destructive">{importError}</p>}
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
                  <ImageDropzone onImageSelect={selectImage} className="w-full h-full" />
                </motion.div>
              ) : (
                <motion.div 
                  key="workspace"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="w-full h-full flex"
                >
                  <div className="h-full border-r border-border bg-background/30">
                    <Toolbar 
                      transformations={transformations} 
                      setTransformations={setTransformations} 
                      isGif={isGif}
                    />
                  </div>

                  <div className="flex-1 min-w-0">
                    <WorkspacePreview 
                      key={sourceImage.id}
                      original={sourceImage}
                      preview={preview}
                      info={info}
                      isProcessing={isProcessing}
                      isExporting={isExporting}
                      error={error}
                      onExport={exportImage}
                      onPrepare={prepareImage}
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
