import { useCallback, useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { Camera, Loader2, RefreshCw, ScanLine } from "lucide-react";
import { toast } from "sonner";
import Modal from "./Modal";
import { ApiError, api } from "../lib/api";
import type { Course, ScanResult } from "../types";

const SCAN_COOLDOWN_MS = 2500;

interface ScannerModalProps {
  open: boolean;
  course: Course | null;
  onClose: () => void;
  onScanned?: (result: ScanResult) => void;
}

export default function ScannerModal({
  open,
  course,
  onClose,
  onScanned,
}: ScannerModalProps) {
  const [starting, setStarting] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const lastScan = useRef<{ text: string; at: number }>({ text: "", at: 0 });

  const handleResult = useCallback(
    async (decodedText: string) => {
      if (!course) {
        return;
      }

      const now = Date.now();
      if (
        decodedText === lastScan.current.text &&
        now - lastScan.current.at < SCAN_COOLDOWN_MS
      ) {
        return;
      }
      lastScan.current = { text: decodedText, at: now };

      try {
        const result = await api.post<ScanResult>("/api/attendance/scan", {
          course_id: course.course_id,
          payload: decodedText,
        });
        toast.success(`${result.student_name} marked ${result.status}`, {
          description: `${course.course_code} · ${result.time}`,
        });
        onScanned?.(result);
      } catch (error) {
        if (error instanceof ApiError && (error.code === "QR_EXPIRED" || error.status === 400)) {
          toast.error("Expired or invalid QR", {
            description: "Ask the student to refresh their live ID and try again.",
          });
        } else {
          toast.error(error instanceof ApiError ? error.message : "Scan failed", {
            description: "The scan could not be validated. Try again.",
          });
        }
      }
    },
    [course, onScanned]
  );

  useEffect(() => {
    if (!open || !course) {
      return;
    }

    const scanner = new Html5Qrcode("qr-reader");
    let active = true;

    setStarting(true);
    setCameraError(null);

    const startScanner = async () => {
      try {
        await scanner.start(
          { facingMode: "environment" },
          {
            fps: 10,
            qrbox: { width: 240, height: 240 },
            aspectRatio: 1,
          },
          (decodedText) => {
            void handleResult(decodedText);
          },
          () => undefined
        );
        if (!active) {
          await scanner.stop().catch(() => undefined);
        }
      } catch {
        if (!active) {
          return;
        }
        setCameraError(
          "Camera unavailable. Grant camera permission or use a device with a working camera."
        );
        toast.error("Unable to start camera");
      } finally {
        if (active) {
          setStarting(false);
        }
      }
    };

    const timer = window.setTimeout(() => {
      void startScanner();
    }, 150);

    return () => {
      active = false;
      window.clearTimeout(timer);
      if (scanner.isScanning) {
        scanner
          .stop()
          .then(() => scanner.clear())
          .catch(() => undefined);
      } else {
        try {
          scanner.clear();
        } catch {
          void 0;
        }
      }
    };
  }, [open, course, handleResult, attempt]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Attendance Scanner"
      description={
        course
          ? `${course.course_code} · ${course.course_name} · ${course.section_name ?? "No section"}`
          : "Select a course to begin."
      }
      size="lg"
    >
      <div className="space-y-4">
        <div className="relative mx-auto aspect-square w-full max-w-md overflow-hidden rounded-2xl border border-white/20 bg-black shadow-inner">
          <div id="qr-reader" className="h-full w-full" />

          <div className="pointer-events-none absolute inset-0">
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/40" />

            <div className="absolute left-1/2 top-1/2 h-60 w-60 -translate-x-1/2 -translate-y-1/2">
              <span className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-accent" />
              <span className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-accent" />
              <span className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-accent" />
              <span className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-accent" />
              <span className="absolute inset-x-3 top-0 h-0.5 animate-scan rounded-full bg-accent shadow-[0_0_14px_2px_rgba(225,29,72,0.8)]" />
            </div>

            <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-accent/40 bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-accent backdrop-blur">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent" />
                Live scan
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-[10px] font-medium text-gray-200 backdrop-blur">
                <ScanLine size={12} />
                Align inside frame
              </span>
            </div>
          </div>

          {starting ? (
            <div className="absolute inset-0 grid place-items-center bg-black/60">
              <div className="flex flex-col items-center gap-2 text-gray-200">
                <Loader2 size={28} className="animate-spin text-accent" />
                <p className="text-xs">Starting camera...</p>
              </div>
            </div>
          ) : null}

          {cameraError ? (
            <div className="absolute inset-0 grid place-items-center bg-black/80 p-6">
              <div className="text-center">
                <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-red-500/15 text-red-400">
                  <Camera size={22} />
                </div>
                <p className="text-sm font-medium text-gray-100">Camera unavailable</p>
                <p className="mt-1 text-xs text-gray-400">{cameraError}</p>
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                  className="btn-glass mt-4"
                >
                  <RefreshCw size={14} />
                  Retry camera
                </button>
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-center text-xs text-gray-400">
          Point the camera at the student&apos;s live QR. Successful scans appear as
          green toasts; expired codes show a red warning.
        </div>

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="btn-glass">
            Stop scanner
          </button>
        </div>
      </div>
    </Modal>
  );
}
