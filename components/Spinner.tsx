export default function Spinner({
  size = 16,
  className = "",
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-2 border-current border-t-transparent align-middle ${className}`}
      style={{ width: size, height: size }}
      aria-label="Loading"
    />
  );
}
