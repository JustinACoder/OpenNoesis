"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

export function ImageWithFallback({
  alt,
  onError,
  unoptimized,
  ...props
}: ImageProps & { alt: string }) {
  const [error, setError] = useState(false);

  return (
    <Image
      {...props}
      alt={alt}
      unoptimized={error || unoptimized}
      onError={(event) => {
        if (!error) setError(true);
        onError?.(event);
      }}
    />
  );
}
