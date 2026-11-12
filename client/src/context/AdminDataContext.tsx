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

const STORAGE_KEY = "aclc.admin.data.v3";
const LEGACY_STORAGE_KEYS = ["aclc.admin.demo.v1", "aclc.admin.demo.v2"];

interface AdminDataValue {
  data: AdminDataState;
  setData: Dispatch<SetStateAction<AdminDataState>>;
  resetData: () => void;
}

const AdminDataContext = createContext<AdminDataValue | null>(null);

function cloneSeed(): AdminDataState {
  return JSON.parse(JSON.stringify(adminSeed)) as AdminDataState;
}

function readInitialData(): AdminDataState {
  try {
    LEGACY_STORAGE_KEYS.forEach((key) => localStorage.removeItem(key));
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return cloneSeed();
    const parsed = JSON.parse(raw) as Partial<AdminDataState>;
    if (
      parsed.version === ADMIN_DATA_VERSION &&
      Array.isArray(parsed.users) &&
      Array.isArray(parsed.students) &&
      Array.isArray(parsed.teachers) &&
      Array.isArray(parsed.sections) &&
      Array.isArray(parsed.subjects) &&
      Array.isArray(parsed.courses) &&
      Array.isArray(parsed.attendance) &&
      Array.isArray(parsed.grades) &&
      Array.isArray(parsed.announcements)
    ) {
      return parsed as AdminDataState;
    }
  } catch {
    return cloneSeed();
  }
  return cloneSeed();
}

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AdminDataState>(readInitialData);

  useEffect(() => {
    if (data.version !== ADMIN_DATA_VERSION) {
      setData(cloneSeed());
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch {
      // localStorage can be unavailable in private browsing
    }
  }, [data, setData]);

  const resetData = useCallback(() => {
    setData(cloneSeed());
  }, []);

  const value = useMemo<AdminDataValue>(
    () => ({ data, setData, resetData }),
    [data, resetData]
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
