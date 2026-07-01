declare module 'node:test' {
  interface TestContext {
    test(name: string, fn: () => void | Promise<void>): Promise<void>;
  }
  export default function test(name: string, fn: (t: TestContext) => void | Promise<void>): void;
}

declare module 'node:assert/strict' {
  const assert: {
    ok(value: unknown, message?: string): void;
    equal(actual: unknown, expected: unknown, message?: string): void;
    deepEqual(actual: unknown, expected: unknown, message?: string): void;
    throws(fn: () => unknown, expected?: RegExp, message?: string): void;
  };
  export default assert;
}
