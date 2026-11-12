import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type ReactNode,
  type SetStateAction,
} from "react";
import {
  ADMIN_DATA_VERSION,
  adminSeed,
  type AdminDataState,
} from "../data/adminSeed";
import { api } from "../lib/api";

type RemoteAdminData = Omit<AdminDataState, "version">;

interface AdminDataValue {
  data: AdminDataState;
  setData: Dispatch<SetStateAction<AdminDataState>>;
  /** Replace local state with a payload returned by the admin API. */
  replaceData: (remote: RemoteAdminData) => void;
  /** Re-fetch everything from the database. */
  refresh: () => Promise<void>;
  loading: boolean;
}

const AdminDataContext = createContext<AdminDataValue | null>(null);

function cloneSeed(): AdminDataState {
  return JSON.parse(JSON.stringify(adminSeed)) as AdminDataState;
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminDataState>(cloneSeed);
  const [loading, setLoading] = useState(true);

  const replaceData = useCallback((remote: RemoteAdminData) => {
    setData({ ...cloneSeed(), ...remote, version: ADMIN_DATA_VERSION });
  }, []);

  const refresh = useCallback(async () => {
    try {
      replaceData(await api.get<RemoteAdminData>("/api/admin/data"));
    } catch (error) {
      console.error("Could not load admin data", error);
    } finally {
      setLoading(false);
    }
  }, [replaceData]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const value = useMemo<AdminDataValue>(
    () => ({ data, setData, replaceData, refresh, loading }),
    [data, replaceData, refresh, loading]
  );

  return (
    <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>
  );
}

export function useAdminData(): AdminDataValue {
  const context = useContext(AdminDataContext);
  if (!context) {
    throw new Error("useAdminData must be used within an AdminDataProvider");
  }
  return context;
}
