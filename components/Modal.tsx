"use client";

export default function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/40 animate-fade-in" onClick={onClose} />
      <div className="relative bg-white w-full sm:max-w-lg sm:rounded-2xl rounded-t-2xl shadow-2xl max-h-[85vh] overflow-y-auto animate-modal-in">
        <div className="sticky top-0 bg-white flex items-center justify-between px-5 py-4 border-b border-line">
          <h3 className="font-display text-lg font-semibold">{title}</h3>
          <button
            onClick={onClose}
            className="text-ink/50 hover:text-ink text-2xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}
