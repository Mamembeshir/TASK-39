export function Skeleton({ className = '', height }: { className?: string; height?: number }) {
  return <div className={`animate-pulse rounded-xl bg-muted ${className}`} style={height ? { height } : undefined} />;
}
