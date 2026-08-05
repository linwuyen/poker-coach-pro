import { useCallback, useState, type Dispatch, type SetStateAction } from 'react';

export interface StorageCodec<T> {
  parse(raw: string): T;
  serialize(value: T): string;
}

const safeStorage = (): Storage | null => {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
};

export function usePersistentState<T>(
  key: string,
  fallback: T,
  codec: StorageCodec<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => {
    const storage = safeStorage();
    if (!storage) return fallback;

    const raw = storage.getItem(key);
    if (raw === null) return fallback;

    try {
      return codec.parse(raw);
    } catch {
      return fallback;
    }
  });

  const setPersistentValue = useCallback<Dispatch<SetStateAction<T>>>(
    next => {
      setValue(previous => {
        const resolved =
          typeof next === 'function'
            ? (next as (current: T) => T)(previous)
            : next;

        const storage = safeStorage();
        if (storage) {
          try {
            storage.setItem(key, codec.serialize(resolved));
          } catch (error) {
            console.error(`Unable to persist ${key}`, error);
          }
        }
        return resolved;
      });
    },
    [codec, key],
  );

  return [value, setPersistentValue];
}

export const booleanCodec: StorageCodec<boolean> = {
  parse: raw => raw === 'true',
  serialize: value => String(value),
};

export const numberCodec = (
  fallback: number,
  minimum = Number.NEGATIVE_INFINITY,
  maximum = Number.POSITIVE_INFINITY,
): StorageCodec<number> => ({
  parse(raw) {
    const value = Number(raw);
    return Number.isFinite(value) && value >= minimum && value <= maximum
      ? value
      : fallback;
  },
  serialize: value => String(value),
});

export const enumCodec = <T extends string>(
  values: readonly T[],
  fallback: T,
): StorageCodec<T> => ({
  parse: raw => (values.includes(raw as T) ? (raw as T) : fallback),
  serialize: value => value,
});

export const jsonCodec = <T>(
  isValid: (value: unknown) => value is T,
  fallback: T,
): StorageCodec<T> => ({
  parse(raw) {
    const value: unknown = JSON.parse(raw);
    return isValid(value) ? value : fallback;
  },
  serialize: value => JSON.stringify(value),
});

export type SessionSize = 10 | 20 | 'all';

export const sessionSizeCodec: StorageCodec<SessionSize> = {
  parse(raw) {
    if (raw === '10') return 10;
    if (raw === 'all') return 'all';
    return 20;
  },
  serialize: value => String(value),
};

export const aiModeCodec = enumCodec(
  ['online', 'offline'] as const,
  'offline',
);

export const tableSizeCodec = enumCodec(
  ['6max', '9max'] as const,
  '9max',
);

export const volumeCodec = numberCodec(0.5, 0, 1);

export const stringArrayCodec = jsonCodec<string[]>(
  (value): value is string[] =>
    Array.isArray(value) && value.every(item => typeof item === 'string'),
  [],
);
