"use client";

import * as React from "react";
import { ImagePlus, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { FileUpload, FileUploadTrigger } from "@/components/ui/file-upload";

type DebateImageUploadInputProps = {
  value: File | null;
  onChange: (file: File | null) => void;
  accept?: string;
  disabled?: boolean;
  maxSize?: number;
};

export function DebateImageUploadInput({
  value,
  onChange,
  accept = "image/png,image/jpeg,image/webp",
  disabled = false,
  maxSize,
}: DebateImageUploadInputProps) {
  const files = React.useMemo(() => (value ? [value] : []), [value]);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!value) {
      setPreviewUrl(null);
      return;
    }

    const objectUrl = URL.createObjectURL(value);
    setPreviewUrl(objectUrl);

    return () => {
      URL.revokeObjectURL(objectUrl);
    };
  }, [value]);

  return (
    <div className="w-full max-w-xl space-y-3">
      <FileUpload
        value={files}
        onValueChange={(nextFiles) => onChange(nextFiles[0] ?? null)}
        accept={accept}
        maxFiles={1}
        maxSize={maxSize}
        disabled={disabled}
      >
        <FileUploadTrigger asChild>
          <div className="group relative cursor-pointer overflow-hidden rounded-2xl border border-dashed transition-background-color duration-200 hover:bg-secondary/25">
            {previewUrl ? (
              <div className="relative aspect-[2/1]">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Selected debate image preview"
                  className="h-full w-full object-cover"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/45 opacity-0 transition-opacity duration-200 group-hover:opacity-100">
                  <span className="text-sm font-medium text-white">
                    Click to change
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex aspect-[2/1] flex-col items-center justify-center gap-3 px-6 text-center transition-colors duration-200 group-hover:bg-secondary/15">
                <div className="rounded-full bg-secondary p-3 transition-colors duration-200 group-hover:bg-secondary/90">
                  <ImagePlus className="size-6 text-muted-foreground" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-foreground">
                    Add debate image
                  </p>
                  <p className="text-sm text-muted-foreground">
                    PNG, JPEG, or WEBP
                  </p>
                </div>
              </div>
            )}
          </div>
        </FileUploadTrigger>
      </FileUpload>

      {previewUrl ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-destructive"
          onClick={() => onChange(null)}
          disabled={disabled}
        >
          <X className="mr-1 size-4" />
          Remove image
        </Button>
      ) : null}
    </div>
  );
}
