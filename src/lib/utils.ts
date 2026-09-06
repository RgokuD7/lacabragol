import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Error handling helper required by Firebase guidelines
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {}, // Omitting detailed authInfo for brevity, assuming standard setup
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export function isCabraSuprema(
  profile?: { isAdmin?: boolean; role?: string; email?: string } | null,
  email?: string | null
): boolean {
  if (!profile && !email) return false;
  return Boolean(
    profile?.isAdmin ||
    profile?.role === 'cabra_suprema' ||
    profile?.role === 'admin' ||
    profile?.email === 'richarddiaz0107@gmail.com' ||
    email === 'richarddiaz0107@gmail.com'
  );
}
