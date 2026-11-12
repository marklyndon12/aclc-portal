import { GlassSelect } from "../ui/FormControls";
import type { TeacherClass } from "../../types";

interface ClassSelectProps {
  classes: TeacherClass[];
  value: number | null;
  onChange: (id: string) => void;
}

export default function ClassSelect({ classes, value, onChange }: ClassSelectProps) {
  return (
    <GlassSelect
      label="Class"
      value={value === null ? "" : String(value)}
      onChange={(event) => onChange(event.target.value)}
      disabled={classes.length === 0}
    >
      {classes.length === 0 ? <option value="">No classes assigned</option> : null}
      {classes.map((item) => (
        <option key={item.class_id} value={item.class_id}>
          {item.subject_code} — {item.subject_name} ({item.section_name})
        </option>
      ))}
    </GlassSelect>
  );
}

export function NoClasses() {
  return (
    <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 px-5 py-12 text-center">
      <p className="text-sm font-semibold text-gray-200">No classes assigned yet</p>
      <p className="mt-1 text-xs text-gray-400">
        Once the admin assigns you to a class on the Schedule page, it will show up here.
      </p>
    </div>
  );
}

export { default as LoadState } from "../LoadState";
