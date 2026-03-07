import { ExprRef } from "../../../core/expr";

export function defineExprMethod(name: string, operation: (...args: any[]) => any) {
  Object.defineProperty(ExprRef.prototype, name, {
    configurable: true,
    writable: true,
    value: function (this: ExprRef<unknown>, ...args: any[]) {
      return this.via(operation as any, ...args);
    },
  });
}

export function defineExprMethods(methods: Array<readonly [string, (...args: any[]) => any]>) {
  for (const [name, operation] of methods) {
    defineExprMethod(name, operation);
  }
}
