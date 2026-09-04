"use client";

import Image, { type ImageProps } from "next/image";
import { useCallback, useState } from "react";

type ImageState = "failed" | "loaded" | "pending";

function sourceKey(src: ImageProps["src"]) {
  if (typeof src === "string") return src;
  return "default" in src ? src.default.src : src.src;
}

export function ResilientMarketingImage({
  onError,
  onLoad,
  src,
  style,
  ...props
}: ImageProps) {
  const key = sourceKey(src);
  const [resolved, setResolved] = useState<{
    key: string;
    state: Exclude<ImageState, "pending">;
  }>();
  const state: ImageState = resolved?.key === key ? resolved.state : "pending";

  const reconcilePreHydrationImage = useCallback(
    (image: HTMLImageElement | null) => {
      if (!image?.complete) return;
      const nextState = image.naturalWidth > 0 ? "loaded" : "failed";
      setResolved((current) => {
        if (current?.key === key && current.state === nextState) return current;
        return { key, state: nextState };
      });
    },
    [key]
  );

  return (
    <Image
      {...props}
      data-marketing-image-state={state}
      onError={(event) => {
        setResolved({ key, state: "failed" });
        onError?.(event);
      }}
      onLoad={(event) => {
        setResolved({ key, state: "loaded" });
        onLoad?.(event);
      }}
      ref={reconcilePreHydrationImage}
      src={src}
      style={{
        ...style,
        opacity: state === "loaded" ? style?.opacity : 0
      }}
    />
  );
}
