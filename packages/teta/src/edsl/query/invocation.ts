import { userError } from "../errors.ts";
import { isQuery } from "./value.ts";

export function assertCurriedInvocation(
  helper: string,
  usage: string,
  args: unknown[],
  minArgs = 1,
  maxArgs = 1
): void {
  if (args.length < minArgs || args.length > maxArgs) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}

export function assertRowCallback(
  helper: string,
  value: unknown
): asserts value is (...args: any[]) => unknown {
  if (typeof value !== "function") {
    userError("DEFERRED_INPUT_INVALID", `${helper}() expects a row callback`);
  }
}

export function assertCurriedQueryOperand(
  helper: string,
  usage: string,
  args: unknown[]
): void {
  if (args.length !== 1 || !isQuery(args[0])) {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}

export function assertQueryOrCallbackOperand(
  helper: string,
  value: unknown,
  usage: string
): void {
  if (!isQuery(value) && typeof value !== "function") {
    userError("QUERY_HELPER_INVALID_ARGUMENTS", `${helper}() expects ${usage}`);
  }
}
