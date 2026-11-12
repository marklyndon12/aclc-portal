import { Sparkles } from "lucide-react";

export default function ComingSoon({ title }: { title: string }) {
  return (
    <div className="glass grid place-items-center p-12 text-center">
      <div className="mb-4 grid h-12 w-12 place-items-center rounded-2xl bg-accent/15 text-accent">
        <Sparkles size={22} />
      </div>
      <h1 className="text-lg font-semibold text-gray-100">{title}</h1>
      <p className="mt-1 text-sm text-gray-400">
        This page is scheduled for a later phase.
      </p>
    </div>
  );
}
