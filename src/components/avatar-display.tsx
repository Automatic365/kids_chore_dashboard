"use client";

interface AvatarDisplayProps {
  avatarUrl: string;
  alt: string;
  className?: string;
  textClassName?: string;
}

function isImageSource(value: string): boolean {
  return (
    value.startsWith("data:image/") ||
    value.startsWith("/") ||
    value.startsWith("http://") ||
    value.startsWith("https://")
  );
}

export function AvatarDisplay({
  avatarUrl,
  alt,
  className,
  textClassName,
}: AvatarDisplayProps) {
  if (isImageSource(avatarUrl)) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={avatarUrl} alt={alt} className={className} />;
  }

  return (
    <div className={className}>
      <span className={textClassName ?? ""} aria-label={alt}>
        {avatarUrl}
      </span>
    </div>
  );
}
