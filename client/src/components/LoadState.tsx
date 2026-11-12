export default function LoadState({
  loading,
  error,
  onRetry,
}: {
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading) return <p className="text-sm text-gray-400">Loading…</p>;
  if (error) {
    return (
      <div className="rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
        {error}{" "}
        <button type="button" onClick={onRetry} className="font-semibold underline">
          Try again
        </button>
      </div>
    );
  }
  return null;
}
