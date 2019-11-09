import { useReducer, useEffect, useState, useCallback, useRef } from "react";
import { GenericValType, of, Union } from "ts-union";

export const PromiseToLoadState = Union(t => ({
  WAITING: of(null),
  DONE: of(t),
  ERROR: of<unknown>(),
}));

export type PromiseToLoadState<T> = GenericValType<
  T,
  typeof PromiseToLoadState.T
>;

/**
 * Handle returned from {@link usePromiseToLoad} - use it from an effect to set
 * or cancel the promise used for loading.
 */
export interface Handle<T> {
  /**
   * Sets the promise to be used for loading.  If called when another proimise
   * has already been set, the former one is cancelled first.  If called with
   * the same promise again, that will be a no-op.
   * @param promise The promise to use for loading
   * @param cancel An optional function to use to cancel the promise. It will be
   * called if the component unmounts, or a new promise is set to be used,
   * before the promise being passed in this call has resolved.
   */
  setPromise(promise: Promise<T>, cancel?: (promise: Promise<T>) => void): void;

  /**
   * Cancel the existing promise if possible (via the cancel callback passed to
   * `setPromise` on this handle.  If the promise has already resolved or
   * errored this is a no-op.
   */
  cancel(): void;
}

type Action<T> =
  | "RESET"
  | ({ promise: Promise<T> } & (
      | { type: "RESOLVED"; result: T }
      | { type: "ERROR"; error: unknown }
    ));

/**
 * Hook to facilitate rendering a "loading" state until some arbitrary promise
 * resolves.  Because you generally don't want to create the promise in
 * rendering, you don't pass the promise right into this function - intead this
 * function gives you a handle which can then be used inside an effect.
 *
 * An example of use probably illustrates it better than an explanation:
 *
 * @example
 * const [state, handle] = usePromiseToLoad();
 * useEffect(() => {
 *   const abort = new AbortController();
 *   const promise = async () {
 *    const fetchResponse = await fetch(props.url, {signal: abort.signal});
 *    // One could do a bunch of other async stuff here...
 *    return response.json();
 *   }();
 *   handle.setPromise(promise, abort.abort);
 *   // No need to return a cleanup here - usePromiseToLoad will automatically
 *   // cancel if unmounted before the promise resolves.
 * }, [props.url]);
 *
 * const renderThis = PromiseToLoadState.match(state, {
 *   DONE: responseJson => <div>Response JSON: {responseJson}</div>,
 *   ERROR: error => <div>Something went wrong - {prettyFormat(error)}</div>,
 *   default: () => <div>Still loading...
 *       <button onClick={()=>handle.cancel()}>Cancel</button>
 *     </div>
 * });
 *
 */
export function usePromiseToLoad<T>(): [PromiseToLoadState<T>, Handle<T>] {
  const [[waitingPromise, cancelWaitingPromise], setWaitingPromise] = useState<
    [Promise<T> | undefined, ((promise: Promise<T>) => void) | undefined]
  >([undefined, undefined]);
  const reducer = useCallback(
    (
      state: PromiseToLoadState<T>,
      action: Action<T>,
    ): PromiseToLoadState<T> => {
      if (action === "RESET") return PromiseToLoadState.WAITING();
      return PromiseToLoadState.match(state, {
        WAITING: () => {
          // Ignore any results of old promises other than the one we're currently
          // waiting for
          if (action.promise !== waitingPromise) return state;
          if (action.type === "RESOLVED")
            return PromiseToLoadState.DONE(action.result);
          return PromiseToLoadState.ERROR(action.error);
        },
        default: () => state,
      });
    },
    [waitingPromise],
  );

  const [state, dispatch] = useReducer(reducer, PromiseToLoadState.WAITING());

  // The cleanup function has to change with the state.  We don't want to
  // actually invoke that cancel/cleanup unless the _promise_ changes (not the
  // state) - but when that cleanup is invoked, it does need the latest state
  // information.  So we create that cleanup function in the first effect, store
  // it in the ref, and only invoke it in the cleanup for the second effect.
  const cancelIfNeeded = useRef((_p: Promise<T> | undefined) => {});
  useEffect(() => {
    cancelIfNeeded.current = (promise: Promise<T> | undefined) => {
      PromiseToLoadState.if.WAITING(state, () => {
        if (promise && cancelWaitingPromise && waitingPromise === promise)
          cancelWaitingPromise(promise);
      });
    };
  }, [state, cancelWaitingPromise, waitingPromise]);

  useEffect(() => {
    // The promise changed - so reset the state to WAITING even if it had
    // been resolved/errored out before.
    dispatch("RESET");
    if (waitingPromise)
      waitingPromise
        .then(value => {
          dispatch({
            promise: waitingPromise,
            type: "RESOLVED",
            result: value,
          });
        })
        .catch(reason => {
          dispatch({ promise: waitingPromise, type: "ERROR", error: reason });
        });

    return () => {
      cancelIfNeeded.current(waitingPromise);
    };
  }, [waitingPromise]);

  // The useState is just so that we can pass an init function and have it only
  // called once.
  const [handle] = useState(() => ({
    setPromise: (promise: Promise<T>, cancel?: (promise: Promise<T>) => void) =>
      setWaitingPromise([promise, cancel]),
    cancel() {
      cancelIfNeeded.current(waitingPromise);
      setWaitingPromise([undefined, undefined]);
    },
  }));
  return [state, handle];
}
