import type { IdentifierInput, Value } from "../types";
import type { ExprInput, ExprRef } from "./runtime";
import type {
  AliasedSelectValue,
  ProjectionItem,
  SelectValueResult,
} from "./select_types";

type ProjectInput = ExprRef<unknown> | Value;

export function alias<T>(value: ExprInput<T>, as: IdentifierInput): AliasedSelectValue<T> {
  return { kind: "select_alias", value, as };
}

export function project<const Name extends string, TValue extends ProjectInput>(
  name: Name,
  value: TValue,
  options?: { quoted?: boolean }
): ProjectionItem<Name, AliasedSelectValue<SelectValueResult<TValue>>>;
export function project<const Name extends string, TValue extends ProjectInput>(
  identifier: { name: Name; quoted?: boolean },
  value: TValue
): ProjectionItem<Name, AliasedSelectValue<SelectValueResult<TValue>>>;
export function project(
  nameOrIdentifier: string | { name: string; quoted?: boolean },
  value: ProjectInput,
  options?: { quoted?: boolean }
): ProjectionItem<string, AliasedSelectValue<unknown>> {
  const key = typeof nameOrIdentifier === "string" ? nameOrIdentifier : nameOrIdentifier.name;
  const as =
    typeof nameOrIdentifier === "string"
      ? options?.quoted
        ? { name: key, quoted: true }
        : key
      : nameOrIdentifier;
  return {
    kind: "select_projection",
    key,
    value: alias(value as ExprInput<unknown>, as),
  };
}

export function rename<const Name extends string, TValue extends ProjectInput>(
  value: TValue,
  name: Name,
  options?: { quoted?: boolean }
): ProjectionItem<Name, AliasedSelectValue<SelectValueResult<TValue>>>;
export function rename<const Name extends string, TValue extends ProjectInput>(
  value: TValue,
  identifier: { name: Name; quoted?: boolean }
): ProjectionItem<Name, AliasedSelectValue<SelectValueResult<TValue>>>;
export function rename(
  value: ProjectInput,
  nameOrIdentifier: string | { name: string; quoted?: boolean },
  options?: { quoted?: boolean }
): ProjectionItem<string, AliasedSelectValue<unknown>> {
  return typeof nameOrIdentifier === "string"
    ? project(nameOrIdentifier, value, options)
    : project(nameOrIdentifier, value);
}
