import { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { ShieldCheck } from "lucide-react";
import Modal from "../../components/Modal";

const REFRESH_SECONDS = 15;

interface LiveQrModalProps {
  open: boolean;
  onClose: () => void;
  studentId: number | string;
  studentName: string;
  studentNumber: string;
  section: string;
}

export default function LiveQrModal({
  open,
  onClose,
  studentId,
  studentName,
  studentNumber,
  section,
}: LiveQrModalProps) {
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!open) {
      return;
    }

    const start = Date.now();
    setStartedAt(start);
    setNow(start);

    const timer = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(timer);
  }, [open]);

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const secondsLeft = REFRESH_SECONDS - (elapsed % REFRESH_SECONDS);
  const issuedAt = Math.floor(
    (startedAt + Math.floor(elapsed / REFRESH_SECONDS) * REFRESH_SECONDS * 1000) / 1000
  );
  const payload = `${studentId}|${issuedAt}`;
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
        <div className="relative rounded-2xl bg-white p-4 shadow-2xl">
          <QRCodeSVG
            value={payload}
            size={220}
            level="M"
            bgColor="#ffffff"
            fgColor="#0f172a"
            title="Student live attendance QR code"
          />
          <span className="absolute -right-2 -top-2 flex items-center gap-1 rounded-full bg-accent px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
            Live
          </span>
        </div>

        <p className="mt-5 text-sm text-gray-300">
          Refreshes in{" "}
          <span className="font-bold text-red-400">{secondsLeft}s</span>
        </p>

        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-accent transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

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
