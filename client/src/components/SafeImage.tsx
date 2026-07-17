import { useState } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface SafeImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  fallbackClassName?: string;
}

export function SafeImage({ className, fallbackClassName, alt, onError, ...props }: SafeImageProps) {
  const [broken, setBroken] = useState(false);

  if (broken) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-muted/40 text-muted-foreground/40",
          className,
          fallbackClassName
        )}
        aria-label={alt ?? "Imagem indisponível"}
      >
        <ImageOff className="w-5 h-5" />
      </div>
    );
  }

  return (
    <img
      {...props}
      alt={alt}
      className={className}
      onError={(e) => {
        setBroken(true);
        onError?.(e);
      }}
    />
  );
}
