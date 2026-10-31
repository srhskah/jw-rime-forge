"use client";

import { useCallback, useRef, useState } from "react";

const DEFAULT_CAPACITY = 80;

/**
 * Present-state undo/redo. `set` records history; `reset` clears stacks
 * (use after load/save). History only covers uncommitted local edits.
 */
export function useUndoRedo<T>(initial: T, capacity = DEFAULT_CAPACITY) {
  const [present, setPresent] = useState(initial);
  const presentRef = useRef(present);
  presentRef.current = present;
  const pastRef = useRef<T[]>([]);
  const futureRef = useRef<T[]>([]);
  const [version, setVersion] = useState(0);

  const bump = useCallback(() => setVersion((v) => v + 1), []);

  const reset = useCallback(
    (value: T) => {
      pastRef.current = [];
      futureRef.current = [];
      presentRef.current = value;
      setPresent(value);
      bump();
    },
    [bump]
  );

  const set = useCallback(
    (value: T, record = true) => {
      if (record) {
        pastRef.current = [...pastRef.current, presentRef.current].slice(-capacity);
        futureRef.current = [];
      }
      presentRef.current = value;
      setPresent(value);
      if (record) bump();
    },
    [bump, capacity]
  );

  const undo = useCallback(() => {
    const past = pastRef.current;
    if (!past.length) return false;
    const previous = past[past.length - 1];
    pastRef.current = past.slice(0, -1);
    futureRef.current = [presentRef.current, ...futureRef.current].slice(0, capacity);
    presentRef.current = previous;
    setPresent(previous);
    bump();
    return true;
  }, [bump, capacity]);

  const redo = useCallback(() => {
    const future = futureRef.current;
    if (!future.length) return false;
    const next = future[0];
    futureRef.current = future.slice(1);
    pastRef.current = [...pastRef.current, presentRef.current].slice(-capacity);
    presentRef.current = next;
    setPresent(next);
    bump();
    return true;
  }, [bump, capacity]);

  return {
    present,
    set,
    reset,
    undo,
    redo,
    canUndo: pastRef.current.length > 0,
    canRedo: futureRef.current.length > 0,
    /** bump token — include in deps if you need to react to canUndo/canRedo */
    version,
  };
}
