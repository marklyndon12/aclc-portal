import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, ShieldCheck } from "lucide-react";
import Modal from "../../components/Modal";
import { api, ApiError } from "../../lib/api";

const REFRESH_SECONDS = 15;

interface LiveQrModalProps {
  open: boolean;
  onClose: () => void;
  studentName: string;
  studentNumber: string;
  section: string;
}

export default function LiveQrModal({
  open,
  onClose,
  studentName,
  studentNumber,
  section,
}: LiveQrModalProps) {
  const [payload, setPayload] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(REFRESH_SECONDS);

  useEffect(() => {
    if (!open) {
      setPayload(null);
      return;
    }

    let cancelled = false;
    let left = REFRESH_SECONDS;

    // The code is signed by the server and only valid for a few seconds.
    const fetchCode = async () => {
      try {
        const result = await api.get<{ payload: string }>("/api/student/live-qr");
        if (!cancelled) {
          setPayload(result.payload);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof ApiError ? err.message : "Could not get your live ID");
        }
      }
    };

    void fetchCode();
    setSecondsLeft(REFRESH_SECONDS);
    const timer = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        left = REFRESH_SECONDS;
        void fetchCode();
      }
      setSecondsLeft(left);
    }, 1000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [open]);

  const progress = (secondsLeft / REFRESH_SECONDS) * 100;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Live ID"
      description="Show this code to your teacher to record attendance."
      size="sm"
    >
      <div className="flex flex-col items-center">
        <div className="relative grid h-[252px] w-[252px] place-items-center rounded-2xl bg-white p-4 shadow-2xl">
          {payload ? (
            <QRCodeSVG
              value={payload}
              size={220}
              level="M"
              bgColor="#ffffff"
              fgColor="#0f172a"
              title="Student live attendance QR code"
            />
          ) : (
            <Loader2 size={28} className="animate-spin text-slate-400" />
          )}
          <span className="absolute -right-2 -top-2 flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        </div>

        {error ? (
          <p className="mt-4 text-center text-sm text-red-300">{error}</p>
        ) : (
          <>
            <p className="mt-5 text-sm text-gray-300">
              Refreshes in <span className="font-bold text-red-400">{secondsLeft}s</span>
            </p>
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-accent transition-all duration-1000 ease-linear"
                style={{ width: `${progress}%` }}
              />
            </div>
          </>
        )}

        <div className="mt-5 w-full rounded-xl border border-white/15 bg-white/5 p-3 text-center">
          <p className="text-sm font-semibold text-gray-100">{studentName}</p>
          <p className="text-xs text-gray-400">
            {studentNumber} · {section}
          </p>
        </div>

        <p className="mt-4 flex items-center gap-1.5 text-center text-xs text-gray-500">
          <ShieldCheck size={14} className="text-emerald-400" />
          Do not screenshot. The code expires every {REFRESH_SECONDS} seconds.
        </p>
      </div>
    </Modal>
  );
}
