import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { localDate } from "../lib/dates";
import type { TeacherClass, TeacherOverview } from "../types";

export function useTeacherOverview() {
  const [data, setData] = useState<TeacherOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setData(await api.get<TeacherOverview>(`/api/teacher/classes?date=${localDate()}`));
      setError(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Could not load your classes");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}

// The chosen class lives in the URL (?class=ID) so dashboard buttons can deep-link to it.
export function useClassSelection(classes: TeacherClass[]) {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("class");
  const selected = classes.find((item) => String(item.class_id) === fromUrl) ?? classes[0] ?? null;
  const select = (id: string) => setParams({ class: id }, { replace: true });
  return { selected, select };
}
