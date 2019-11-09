import * as React from "react";
import { useEffect, ReactNode, ReactElement, useImperativeHandle } from "react";
import { render, cleanup, act, waitForElement } from "@testing-library/react";
import { PromiseToLoadState, usePromiseToLoad, Handle } from "./PromiseToLoad";
import prettyFormat from "pretty-format";

afterEach(cleanup);

const WhenImDone = React.forwardRef(function WhenImDone(
  {
    promise,
    fallback,
    children,
    renderError,
    cancel,
  }: {
    promise: Promise<number> | null;
    fallback: ReactNode;
    renderError: (err: unknown) => ReactNode;
    children: (result: number) => ReactNode;
    cancel?: () => void;
  },
  ref: React.Ref<{}>,
): ReactElement {
  const [state, handle] = usePromiseToLoad<number>();
  useEffect(() => {
    if (promise) handle.setPromise(promise, cancel);
  }, [promise, cancel, handle]);

  useImperativeHandle(ref, () => ({ handle }));

  // The eslint rule thinks these match callbacks returning elements are react components and warns
  // they should have a name - but they are not components.
  /* eslint-disable react/display-name */
  return PromiseToLoadState.match(state, {
    WAITING: () => <>{fallback}</>,
    ERROR: error => <>{renderError(error)}</>,
    DONE: result => <>{children(result)}</>,
  });
  /* eslint-enable react/display-name */
});
WhenImDone.displayName = "WhenImDone";

it("Renders the fallback when the promise is unfulfilled", () => {
  const promise = new Promise<number>(() => {});
  const rendered = render(
    <WhenImDone
      fallback={<div>Fallback</div>}
      promise={promise}
      renderError={err => <div>{prettyFormat(err)}</div>}
    >
      {() => "Do not show me"}
    </WhenImDone>,
  );
  expect(rendered.getByText("Fallback")).toBeDefined();
  expect(rendered.queryByText("Do not show me")).toBeNull();
});

it("Renders the child when the promise is fulfilled", async () => {
  let presolve: (n: number) => void | undefined;
  const promise = new Promise<number>(resolve => {
    presolve = resolve;
  });
  const rendered = render(
    <WhenImDone
      fallback={<div>Fallback</div>}
      promise={promise}
      renderError={err => <div>{prettyFormat(err)}</div>}
    >
      {n => <div>Got {n}</div>}
    </WhenImDone>,
  );
  expect(rendered.getByText("Fallback")).toBeDefined();
  expect(rendered.queryByText("Got")).toBeNull();
  act(() => {
    presolve(6);
  });
  expect(await waitForElement(() => rendered.getByText("Got 6"))).toBeDefined();
  expect(rendered.queryByText("Fallback")).toBeNull();
});

it("Renders the error render fn if passed and the promise errors", async () => {
  let preject: (err: unknown) => void | undefined;
  const promise = new Promise<number>((_, reject) => {
    preject = reject;
  });
  const rendered = render(
    <WhenImDone
      fallback={<div>Fallback</div>}
      promise={promise}
      renderError={err => <div>Err {err}</div>}
    >
      {n => <div>Got {n}</div>}
    </WhenImDone>,
  );
  act(() => {
    preject("X");
  });
  expect(await waitForElement(() => rendered.getByText("Err X"))).toBeDefined();
  expect(rendered.queryByText("Fallback")).toBeNull();
  expect(rendered.queryByText("Got")).toBeNull();
});

it("Renders the fallback when promise is null", () => {
  const rendered = render(
    <WhenImDone
      fallback={<div>Fallback</div>}
      promise={null}
      renderError={err => <div>{prettyFormat(err)}</div>}
    >
      {() => "Do not show me"}
    </WhenImDone>,
  );
  expect(rendered.getByText("Fallback")).toBeDefined();
  expect(rendered.queryByText("Do not show me")).toBeNull();
});

it("Cancels the promise when a new one is passed in and the old is still waiting", async () => {
  let oldResolve: (n: number) => void | undefined;
  const oldPromise = new Promise<number>(resolve => {
    oldResolve = resolve;
  });
  const cancelHandler = jest.fn();
  const rendered = render(
    <WhenImDone
      fallback={<div>Fallback</div>}
      promise={oldPromise}
      renderError={err => <div>Err {err}</div>}
      cancel={cancelHandler}
    >
      {n => <div>Got {n}</div>}
    </WhenImDone>,
  );
  let newResolve: (n: number) => void | undefined;
  const newPromise = new Promise<number>(resolve => {
    newResolve = resolve;
  });
  act(() => {
    rendered.rerender(
      <WhenImDone
        fallback={<div>Fallback new</div>}
        promise={newPromise}
        renderError={err => <div>Err {err}</div>}
        cancel={cancelHandler}
      >
        {n => <div>Got {n}</div>}
      </WhenImDone>,
    );
  });
  expect(rendered.getByText("Fallback new")).toBeDefined();
  expect(cancelHandler.mock.calls.length).toBe(1);
  expect(cancelHandler.mock.calls[0][0]).toBe(oldPromise);
  cancelHandler.mockReset();
  act(() => {
    newResolve(6);
    oldResolve(4);
  });
  expect(await waitForElement(() => rendered.getByText("Got 6"))).toBeDefined();
  expect(cancelHandler.mock.calls.length).toBe(0);
});

it("Does not cancel the promise when a new one is passed in and the old is resolved", async () => {
  let oldResolve: (n: number) => void | undefined;
  const oldPromise = new Promise<number>(resolve => {
    oldResolve = resolve;
  });
  const cancelHandler = jest.fn();
  const rendered = render(
    <WhenImDone
      fallback={<div>Fallback</div>}
      promise={oldPromise}
      renderError={err => <div>Err {err}</div>}
      cancel={cancelHandler}
    >
      {n => <div>Got {n}</div>}
    </WhenImDone>,
  );
  act(() => oldResolve(4));
  expect(await waitForElement(() => rendered.getByText("Got 4"))).toBeDefined();

  let newResolve: (n: number) => void | undefined;
  const newPromise = new Promise<number>(resolve => {
    newResolve = resolve;
  });
  act(() => {
    rendered.rerender(
      <WhenImDone
        fallback={<div>Fallback new</div>}
        promise={newPromise}
        renderError={err => <div>Err {err}</div>}
        cancel={cancelHandler}
      >
        {n => <div>Got {n}</div>}
      </WhenImDone>,
    );
  });
  expect(rendered.getByText("Fallback new")).toBeDefined();
  expect(cancelHandler.mock.calls.length).toBe(0);
  cancelHandler.mockReset();
  act(() => {
    newResolve(6);
    oldResolve(4);
  });
  expect(await waitForElement(() => rendered.getByText("Got 6"))).toBeDefined();
  expect(cancelHandler.mock.calls.length).toBe(0);
});

it("Never changes the handle", async () => {
  let oldResolve: (n: number) => void | undefined;
  const oldPromise = new Promise<number>(resolve => {
    oldResolve = resolve;
  });
  const ref = React.createRef<{}>();
  const rendered = render(
    <WhenImDone
      fallback={<div>Fallback</div>}
      promise={oldPromise}
      renderError={err => <div>Err {err}</div>}
      ref={ref}
    >
      {n => <div>Got {n}</div>}
    </WhenImDone>,
  );
  const getHandle = (): Handle<number> => {
    return (ref.current as { handle: Handle<number> }).handle;
  };
  const originalHandle = getHandle();
  act(() => {
    oldResolve(4);
  });
  expect(await waitForElement(() => rendered.getByText("Got 4"))).toBeDefined();
  expect(getHandle()).toBe(originalHandle);
  let newResolve: (n: number) => void | undefined;
  const newPromise = new Promise<number>(resolve => {
    newResolve = resolve;
  });
  act(() => {
    rendered.rerender(
      <WhenImDone
        fallback={<div>Fallback new</div>}
        promise={newPromise}
        renderError={err => <div>Err {err}</div>}
        ref={ref}
      >
        {n => <div>Got {n}</div>}
      </WhenImDone>,
    );
  });
  expect(rendered.getByText("Fallback new")).toBeDefined();
  expect(getHandle()).toBe(originalHandle);
  act(() => {
    newResolve(6);
  });
  expect(await waitForElement(() => rendered.getByText("Got 6"))).toBeDefined();
  expect(getHandle()).toBe(originalHandle);
});

it("Ignores promise resolution after cancellation through the handle", async () => {
  let oldResolve: (n: number) => void | undefined;
  const oldPromise = new Promise<number>(resolve => {
    oldResolve = resolve;
  });
  const ref = React.createRef<{}>();
  const cancelHandler = jest.fn();
  const rendered = render(
    <WhenImDone
      fallback={<div>Fallback</div>}
      promise={oldPromise}
      renderError={err => <div>Err {err}</div>}
      ref={ref}
      cancel={cancelHandler}
    >
      {n => <div>Got {n}</div>}
    </WhenImDone>,
  );
  const getHandle = (): Handle<number> => {
    return (ref.current as { handle: Handle<number> }).handle;
  };
  const originalHandle = getHandle();
  act(() => {
    originalHandle.cancel();
    oldResolve(0);
  });
  expect(
    await waitForElement(() => rendered.getByText("Fallback")),
  ).toBeDefined();
  expect(cancelHandler.mock.calls.length).toBe(1);
});
