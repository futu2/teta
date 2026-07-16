import type { Column, Expr, Query, JoinKind, JoinOptions, SqlBigInt, SqlBoolean, SqlBytes, SqlDate, SqlDecimal, SqlFloat, SqlInt, SqlJson, SqlNumber, SqlString, SqlTimestamp, SqlUuid, UnnestOptions, UnnestSelection, } from "../mod.ts";
import * as publicApi from "../mod.ts";
import { between, composeSteps, currentDate, currentTimestamp, dateAdd, filter, filterEq, filterNe, filterGt, filterGte, filterLt, filterLte, fullJoin, fullJoinMerge, identityStep, innerJoin, innerJoinMap, innerJoinMerge, isDistinctFrom, isIn, isNotIn, join, leftJoin, leftJoinMap, leftJoinMerge, rightJoin, rightJoinMerge, take, takeWithin, sort, param, lit, map, pick, rename, pipe, flow, table, t, fold, asc, desc, eq, gt, upper, add, mul, coalesce, count, group, loop, sum, and, or, isNotNull, sub, when, mapShape, groupShape, lt, unnest, unionAll, union, unlessStep, values, arrayAgg, prefixOverlapLeft, prefixOverlapRight, prefixAllLeft, prefixAllRight, suffixAllLeft, suffixAllRight, dropOverlapLeft, dropOverlapRight, usingCols, onEq, asBigInt, asBoolean, asBytes, asDate, asDecimal, asFloat, asInt, asJson, asString, asTimestamp, asUuid, whenStep } from "../mod.ts";
type Equal<A, B> = ((<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false);
type Expect<T extends true> = T;
type ExprType<TExpr> = TExpr extends Expr<infer TValue> ? TValue : TExpr extends Column<infer TValue, string> ? TValue : never;
type NamedAggregateExpr = Expr<SqlInt, "aggregate">;
declare const namedAggregateExpr: NamedAggregateExpr;
void namedAggregateExpr;
// @ts-expect-error public Query rows must contain only SQL value types
type InvalidPublicQueryRow = Query<{ payload: Date }>;
const users = table("users", {
    id: t.int(),
    name: t.string(),
});
const readonlyUsersIr = publicApi.toIR(users);
// @ts-expect-error frontend query IR roots are readonly
readonlyUsersIr.scopeId = "__teta_scope_mutated";
// @ts-expect-error frontend query IR stage collections are readonly
readonlyUsersIr.stages.push({ kind: "take", count: 1, projectAll: [] });
const joinKind: JoinKind = "left";
const joinOptions: JoinOptions<typeof joinKind> = { type: joinKind, lateral: true };
const unnestSelection: UnnestSelection<"tag", "tag_index"> = { value: "tag", ordinality: "tag_index" };
const unnestOptions: UnnestOptions<true> = { outer: true };
const stringLiteralExpr = lit("some_string");
const numberLiteralExpr = lit(1);
const bigintLiteralExpr = lit(1n);
const bigintIrLiteralExpr = lit({ kind: "bigint_literal", value: "9007199254740993" } as const);
const booleanLiteralExpr = lit(true);
const nullLiteralExpr = lit(null);
const dateLiteralExpr = lit({ kind: "date_literal", value: "2026-06-03" });
const timestampLiteralExpr = lit({ kind: "timestamp_literal", value: "2026-06-03 12:00:00" });
const currentDateExpr = currentDate();
const currentTimestampExpr = currentTimestamp();
const currentDatePlusDayExpr = dateAdd(currentDateExpr, "day", 1);
const currentTimestampPlusDayExpr = dateAdd(currentTimestampExpr, "day", 1);
const stringParamExpr = param<SqlString>("some_string");
const numberParamExpr = param<SqlNumber>("some_number");
const bigintParamExpr = param<SqlBigInt>("some_bigint");
const booleanParamExpr = param<SqlBoolean>("some_boolean");
const nullParamExpr = param<null>("some_null");
const dateParamExpr = param<SqlDate>("some_date");
const timestampParamExpr = param<SqlTimestamp>("some_timestamp");
const orders = table("orders", {
    order_id: t.int(),
    user_id: t.int(),
    total: t.float(),
});
const sessions = table("sessions", {
    id: t.int(),
    tags: t.array(t.string()),
});
const inlineRows = values([
    { id: 1 as number, name: "Ada" as string },
    { id: 2 as number, name: "Grace" as string },
]);
const profileRows = values([
    { id: 1 as number, bio: "A" as string },
    { id: 2 as number, bio: "B" as string },
]);
type ProfileMeta = {
    theme: string;
    flags: string[];
};
const profiles = table("profiles", {
    id: t.uuid(),
    external_id: t.bigint(),
    credit_limit: t.nullable(t.decimal()),
    metadata: t.json<ProfileMeta>(),
    avatar: t.nullable(t.bytes()),
    nickname: t.nullable(t.string()),
});
const leftJoined = pipe(users, leftJoin(
    orders,
    (user, order) => eq(user.id, order.user_id)
));
const rightJoined = pipe(users, rightJoin(
    orders,
    (user, order) => eq(user.id, order.user_id)
));
const fullJoined = pipe(users, fullJoin(
    orders,
    (user, order) => eq(user.id, order.user_id)
));
const leftViaJoin = pipe(users, leftJoin(
    orders,
    (user, order) => eq(user.id, order.user_id)
));
const leftViaPrimitiveJoin = pipe(users, join(
    orders,
    {
        type: "left",
        on: (user, order) => eq(user.id, order.user_id),
    }
));
const renamedJoin = pipe(users, innerJoinMap(
    orders,
    (user, order) => eq(user.id, order.user_id),
    (user, order) => ({
        user_id: user.id,
        order_total: order.total,
    })
));
const overlapPrefixedLeft = pipe(users, innerJoinMerge(
    profileRows,
    (user, profile) => eq(user.id, profile.id),
    prefixOverlapLeft("user_")
));
const overlapPrefixedRight = pipe(users, innerJoinMerge(
    profileRows,
    (user, profile) => eq(user.id, profile.id),
    prefixOverlapRight("profile_")
));
const allPrefixedLeft = pipe(users, innerJoinMerge(
    profileRows,
    (user, profile) => eq(user.id, profile.id),
    prefixAllLeft("left_")
));
const allPrefixedRight = pipe(users, leftJoinMerge(
    orders,
    (user, order) => eq(user.id, order.user_id),
    prefixAllRight("order_")
));
const allSuffixedLeft = pipe(users, rightJoinMerge(
    orders,
    (user, order) => eq(user.id, order.user_id),
    suffixAllLeft("_user")
));
const allSuffixedRight = pipe(users, fullJoinMerge(
    orders,
    (user, order) => eq(user.id, order.user_id),
    suffixAllRight("_order")
));
const droppedOverlapLeft = pipe(users, innerJoinMerge(
    profileRows,
    (user, profile) => eq(user.id, profile.id),
    dropOverlapLeft()
));
const droppedOverlapRight = pipe(users, innerJoinMerge(
    profileRows,
    (user, profile) => eq(user.id, profile.id),
    dropOverlapRight()
));
const usingJoin = pipe(users, innerJoinMerge(
    profileRows,
    usingCols("id"),
    dropOverlapLeft()
));
const mappedProfileRows = table("profiles_mapped", {
    id: t.int(),
    user_id: t.int(),
    bio: t.string(),
});
const mappedProfileOnEq: (user: typeof users.columns, profile: typeof mappedProfileRows.columns) => Expr<SqlBoolean | null> = onEq({ id: "user_id" });
const mappedJoin = pipe(users, leftJoinMerge(
    mappedProfileRows,
    mappedProfileOnEq,
    prefixOverlapLeft("left_")
));
const callbackMergedJoin = pipe(users, leftJoinMap(
    orders,
    (user, order) => eq(user.id, order.user_id),
    (user, order) => ({
        user_id: user.id,
        total: order.total,
    })
));
const filteredUsers = pipe(users, filter((user: typeof users.columns) => gt(user.id, 0)));
const projectedUsers = pipe(filteredUsers, map((user: typeof filteredUsers.columns) => ({
    id: user.id,
    name: upper(user.name),
})));
const mappedSelectedUsers = pipe(users, map((user) => ({
    id: user.id,
    name: user.name,
})));
const mappedSortedTakenSelectedUsers = pipe(users, map((user) => ({
    id: user.id,
    name: user.name,
})), sort((user) => [desc(user.id)]), take(5));
const takenWithinUsers = pipe(users, takeWithin({
    partitionBy: (user) => user.name,
    orderBy: (user) => asc(user.id),
    count: 1,
}));
pipe(users, takeWithin({
    // @ts-expect-error takeWithin partitionBy must return expression(s)
    partitionBy: () => "name",
    orderBy: (user) => asc(user.id),
    count: 1,
}));
pipe(users, takeWithin({
    partitionBy: (user) => user.name,
    // @ts-expect-error takeWithin orderBy must return order item(s)
    orderBy: (user) => user.id,
    count: 1,
}));
const extendedUsers = pipe(users, map((user) => ({ id: user.id, name: user.name, name_upper: upper(user.name) })));
const singleReplacedExtendedUsers = pipe(users, map((user) => ({ id: add(user.id, 100), name: user.name })));
const replacedExtendedUsers = pipe(users, map((user) => ({ id: asString(user.id), name: user.name })));
const pickedUsers = pipe(users, pick("id", "name"));
const callbackFilteredUsers = pipe(users, filter((user) => eq(user.id, 1)));
const filterEqCallbackNameUsers = pipe(users, filterEq((user) => user.name, "Ada"));
const filterEqCallbackIdUsers = pipe(users, filterEq((user) => user.id, 1));
const filterGteComputedUsers = pipe(users, filterGte((user) => add(mul(user.id, 2), 1), 3));
const filterEqCallbackUsers = pipe(users, filterEq((user) => user.id, (user) => add(user.id, 0)));
const filterNeUsers = pipe(users, filterNe((user) => user.name, "deleted"));
const filterGtUsers = pipe(users, filterGt((user) => user.id, 0));
const filterLtUsers = pipe(users, filterLt((user) => user.id, 100));
const filterLteUsers = pipe(users, filterLte((user) => user.id, 100));
const variadicAndFilteredUsers = pipe(users, filter((user) => and(eq(user.id, 1), gt(user.id, 0), isNotNull(user.name))));
const variadicOrFilteredUsers = pipe(users, filter((user) => or(eq(user.name, "Ada"), eq(user.name, "Grace"), eq(user.name, "Linus"))));
const conditionalStepUsers = pipe(users, identityStep(), whenStep(true, filterEq((user) => user.name, "Ada")), unlessStep(false, take(10)));
const unionStepUsers = pipe(users, union(users), unionAll(users));
const usersReplica = table("users_replica", {
    id: t.int(),
    name: t.string(),
});
const exactUnionStepUsers = pipe(users, union(usersReplica), unionAll(usersReplica));
const unnestStepSessions = pipe(sessions, unnest((session) => session.tags, { value: "tag" }));
const predicateConvenienceUsers = pipe(users, filter((user) => and(
    between(user.id, 1, 10),
    isNotIn(user.name, ["Ada", "Grace"]),
    isDistinctFrom(user.name, "anonymous"),
)));
const singleAndExpr = and(eq(users.columns.id, 1));
const singleOrExpr = or(eq(users.columns.id, 1));
const idAsExpr: Expr<SqlInt> = users.columns.id;
const keepIntExpr = (value: Expr<SqlInt>): Expr<SqlInt> => value;
const keptUserIdExpr = keepIntExpr(users.columns.id);
const callbackSortedUsers = pipe(users, sort((user) => [asc(user.name), desc(user.id)]));
const callbackAggregatedOrders = pipe(orders, fold((order) => ({
    user_id: group(order.user_id),
    total_spend: sum(order.total),
})));
const callbackExplodedSessions = pipe(sessions, unnest((session) => session.tags, { value: "tag" }));
// @ts-expect-error pick rejects unknown columns when applied to a typed query
const invalidPickedUsers = pipe(users, pick("missing"));
const curriedPipeline = pipe(users, filter((user: typeof users.columns) => gt(user.id, 0)), map((user) => ({
    id: user.id,
    name: upper(user.name),
})), sort((row) => [asc(row.name), desc(row.id)]), take(5));
const flowNumberToString = flow(
    (value: number) => value + 1,
    (value) => `n=${value}`,
);
const flowPipeline = flow(
    filter((user: typeof users.columns) => gt(user.id, 0)),
    pick("id"),
);
const flowPipelineResult = flowPipeline(users);
const storedIdentityPipeline = composeSteps();
const storedIdentityKind: "query_step" = storedIdentityPipeline.kind;
const storedIdentityResult = storedIdentityPipeline(users);
const storedIdentityName: Expr<SqlString> = storedIdentityResult.columns.name;
const pipedStoredIdentityResult = pipe(users, storedIdentityPipeline);
const pipedStoredIdentityName: Expr<SqlString> = pipedStoredIdentityResult.columns.name;
const schemaBoundPickPipeline = composeSteps(
    (query: typeof users) => pipe(query, pick("id")),
    take(1),
);
const schemaBoundPickResult = pipe(users, schemaBoundPickPipeline);
const schemaBoundPickId: Expr<SqlInt> = schemaBoundPickResult.columns.id;
const schemaBoundPickKind: "query_step" = schemaBoundPickPipeline.kind;
const composedPipeline = composeSteps(
    filter((user: typeof users.columns) => gt(user.id, 0)),
    map((user) => ({ id: user.id, name: upper(user.name) })),
    filter((user) => eq(user.name, "ADA")),
);
const composedPipelineResult = composedPipeline(users);
const conditionalComposedUsers = pipe(users, whenStep(true, composeSteps(
    filterEq((user) => user.name, "Ada"),
    take(10),
)));
const longComposedPipeline = composeSteps(
    filter((user: typeof users.columns) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user) => gt(user.id, 0)),
    filter((user: typeof users.columns) => gt(user.id, 0)),
    map((user: typeof users.columns) => ({ identifier: user.id })),
);
const longComposedPipelineResult = longComposedPipeline(users);
const longComposedIdentifier: Expr<SqlInt> = longComposedPipelineResult.columns.identifier;
const addOneForLongPipe = (value: number): number => value + 1;
const labelLongPipeResult = (value: number): string => `n=${value}`;
const longPipeResult: string = pipe(
    0,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    labelLongPipeResult,
);
const invalidLongPipe = pipe(
    0,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    addOneForLongPipe,
    // @ts-expect-error long pipelines reject a step whose input does not match the previous output
    labelLongPipeResult,
    addOneForLongPipe,
);
const elevenStepFlowResult: number = flow(
    (value: number) => value + 1,
    (value) => value + 1,
    (value) => value + 1,
    (value) => value + 1,
    (value) => value + 1,
    (value) => value + 1,
    (value) => value + 1,
    (value) => value + 1,
    (value) => value + 1,
    (value) => value + 1,
    (value) => value + 1,
)(0);
const curriedJoin = pipe(users, leftJoin(
    orders,
    (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)
));
const directPickedSelection = pipe(users, pick("id"));
const directKeyMappedSelection = pipe(users, rename((key) => `prefix1_${key}`));
const multiPrefixRenamedSelection = pipe(users, rename((key) => `pre_fix_${key}`));
const multiPrefixRenamedId: Expr<SqlInt> = multiPrefixRenamedSelection.columns.pre_fix_id;
// @ts-expect-error a multi-segment prefix must retain the finite source keys
multiPrefixRenamedSelection.columns.pre_fix_missing;
const fixedRenamedSelection = pipe(
    table("rename_source", { id: t.int() }),
    rename(() => "fixed_name" as const),
);
const fixedRenamedName: Expr<SqlInt> = fixedRenamedSelection.columns.fixed_name;
// @ts-expect-error a fixed rename result must not invent a key-derived column name
fixedRenamedSelection.columns.fixed_id;
const droppedUsers = pipe(users, map((user) => ({ id: user.id })));
const directDroppedProfiles = pipe(profiles, map((profile) => ({
    id: profile.id,
    external_id: profile.external_id,
    credit_limit: profile.credit_limit,
    nickname: profile.nickname,
})));
const directKeyMappedUsage = pipe(directKeyMappedSelection, map((user) => ({
    id: user.prefix1_id,
    name: user.prefix1_name,
})));
const droppedUsersUsage = pipe(droppedUsers, map((user) => ({
    id: user.id,
})));
const manualOmittedAggregate = pipe(orders, fold((order) => ({
    user_id: group(order.user_id),
    order_count: count(order.order_id),
    total_spend: sum(order.total),
})));
const leftSelected = pipe(leftJoined, map((row) => ({
    total: coalesce(row.total, 0),
    filtered: gt(row.total, 0),
    name: upper(row.name),
})));
const rightSelected = pipe(rightJoined, map((row) => ({
    user_id: coalesce(row.id, 0),
    total: row.total,
})));
const fullSelected = pipe(fullJoined, map((row) => ({
    id: coalesce(row.id, 0),
    total: coalesce(row.total, 0),
})));
const leftViaJoinSelected = pipe(leftViaJoin, map((row) => ({
    total: coalesce(row.total, 0),
})));
const explodedSessions = pipe(sessions, unnest((session) => session.tags, { value: "tag", ordinality: "tag_index" }));
const outerExplodedSessions = pipe(sessions, unnest((session) => session.tags, { value: "tag" }, { outer: true }));
const leftJoinTotal = coalesce(leftJoined.columns.total, 0);
const leftJoinTotalRemaining = sub(leftJoinTotal, 1);
const projectedWithQuotedKey = pipe(users, map((user) => ({ ["User Id"]: user.id })));
const aggregatedWithQuotedKey = pipe(orders, fold((order) => ({
    ["User Id"]: group(order.user_id),
    ["Total Spend"]: sum(order.total),
})));
const aggregatedTotals = pipe(orders, fold((order) => ({
    user_id: group(order.user_id),
    totals: arrayAgg(order.total),
})));
const loopBase = pipe(users, map((user) => ({ id: user.id })));
const looped = pipe(loopBase, loop((self) => pipe(self, filter((row) => gt(row.id, 0)))));
const loopStepUsers = pipe(loopBase, loop((self) => pipe(self, filter((row) => gt(row.id, 0)))));
const projectedWithCase = pipe(users, map((user) => ({
    id: user.id,
    age_bucket: when(
        lt(user.id, 10), "small",
        lt(user.id, 100), "medium",
        true, "large"
    ),
    age_bucket_nullable: when(
        lt(user.id, 10), "small",
        lt(user.id, 100), "medium"
    ),
    ...mapShape({
        bumped_id: user.id,
    }, (value) => add(value, 1)),
})));
type CaseDefaultType = Expect<Equal<ExprType<typeof projectedWithCase.columns.age_bucket>, SqlString>>;
type CaseNullableType = Expect<Equal<ExprType<typeof projectedWithCase.columns.age_bucket_nullable>, SqlString | null>>;
const aggregatedWithGroupShape = pipe(orders, fold((order) => ({
    ...groupShape({
        user_id: order.user_id,
    }),
    total_spend: sum(order.total),
})));
const projectedProfiles = pipe(profiles, map((profile) => ({
    id: profile.id,
    external_id: add(profile.external_id, 1),
    credit_limit: coalesce(profile.credit_limit, 0),
    metadata: profile.metadata,
    avatar: profile.avatar,
    nickname: coalesce(profile.nickname, "anonymous"),
})));
const uuidFilteredProfiles = pipe(profiles, filter((profile) => eq(profile.id, param<SqlUuid>("profile_id"))));
const bigintFilteredProfiles = pipe(profiles, filter((profile) => and(gt(profile.external_id, 0), eq(profile.external_id, 42n))));
const nullableFilterGtCallbackUsers = pipe(profiles, filterGt((profile) => profile.credit_limit, 0));
const nullableFilterGtRightCallbackUsers = pipe(profiles, filterGt(0, (profile) => profile.credit_limit));
const stringifiedUserId = asString(users.columns.id);
const stringifiedNullableNickname = asString(profiles.columns.nickname);
const asStringifiedUserId = asString(users.columns.id);
const asStringifiedNullableNickname = asString(profiles.columns.nickname);
const asUserIdInt = asInt(users.columns.id);
const asNullableNicknameInt = asInt(profiles.columns.nickname);
const asUserIdBigInt = asBigInt(users.columns.id);
const asUserIdFloat = asFloat(users.columns.id);
const asUserIdDecimal = asDecimal(users.columns.id);
const asNameBoolean = asBoolean(users.columns.name);
const asProfileIdUuid = asUuid(profiles.columns.nickname);
const asProfileAvatarBytes = asBytes(profiles.columns.nickname);
const asProfileMetadataJson = asJson(profiles.columns.nickname);
const events = table("events", {
    event_date: t.date(),
    event_ts: t.nullable(t.timestamp()),
});
const rawTimestampRows = values([
    { raw_ts: "2024-01-02 03:04:05" as string },
]);
const eventDateTimestamp = asTimestamp(events.columns.event_date);
const nullableEventTimestamp = asTimestamp(events.columns.event_ts);
const rawTimestampDate = asDate(rawTimestampRows.columns.raw_ts);
const rawTimestampTimestamp = asTimestamp(rawTimestampRows.columns.raw_ts);
const nullableEventDate = asDate(events.columns.event_ts);
const eventDatePlusDay = dateAdd(events.columns.event_date, "day", 1);
const nullableEventTimestampPlusDay = dateAdd(events.columns.event_ts, "day", 1);
type _LeftJoinTotal = Expect<Equal<ExprType<typeof leftJoined.columns.total>, SqlFloat | null>>;
type _ExplodedTag = Expect<Equal<ExprType<typeof explodedSessions.columns.tag>, SqlString>>;
type _ExplodedTagIndex = Expect<Equal<ExprType<typeof explodedSessions.columns.tag_index>, SqlInt>>;
type _OuterExplodedTag = Expect<Equal<ExprType<typeof outerExplodedSessions.columns.tag>, SqlString | null>>;
type _RightJoinId = Expect<Equal<ExprType<typeof rightJoined.columns.id>, SqlInt | null>>;
type _FullJoinTotal = Expect<Equal<ExprType<typeof fullJoined.columns.total>, SqlFloat | null>>;
type _LeftViaJoinTotal = Expect<Equal<ExprType<typeof leftViaJoin.columns.total>, SqlFloat | null>>;
type _LeftViaPrimitiveJoinTotal = Expect<Equal<ExprType<typeof leftViaPrimitiveJoin.columns.total>, SqlFloat | null>>;
type _ProjectedUsersId = Expect<Equal<ExprType<typeof projectedUsers.columns.id>, SqlInt>>;
type _ProjectedUsersName = Expect<Equal<ExprType<typeof projectedUsers.columns.name>, SqlString>>;
type _MappedSelectedUsersKeys = Expect<Equal<keyof typeof mappedSelectedUsers.columns, "id" | "name">>;
type _MappedSelectedUsersId = Expect<Equal<ExprType<typeof mappedSelectedUsers.columns.id>, SqlInt>>;
type _MappedSelectedUsersName = Expect<Equal<ExprType<typeof mappedSelectedUsers.columns.name>, SqlString>>;
type _MappedSortedTakenSelectedUsersKeys = Expect<Equal<keyof typeof mappedSortedTakenSelectedUsers.columns, "id" | "name">>;
type _MappedSortedTakenSelectedUsersId = Expect<Equal<ExprType<typeof mappedSortedTakenSelectedUsers.columns.id>, SqlInt>>;
type _MappedSortedTakenSelectedUsersName = Expect<Equal<ExprType<typeof mappedSortedTakenSelectedUsers.columns.name>, SqlString>>;
type _ExtendedUsersKeys = Expect<Equal<keyof typeof extendedUsers.columns, "id" | "name" | "name_upper">>;
type _ExtendedUsersNameUpper = Expect<Equal<ExprType<typeof extendedUsers.columns.name_upper>, SqlString>>;
type _ReplacedExtendedUsersKeys = Expect<Equal<keyof typeof replacedExtendedUsers.columns, "id" | "name">>;
type _ReplacedExtendedUsersId = Expect<Equal<ExprType<typeof replacedExtendedUsers.columns.id>, SqlString>>;
type _ReplacedExtendedUsersName = Expect<Equal<ExprType<typeof replacedExtendedUsers.columns.name>, SqlString>>;
type _CallbackFilteredUsersId = Expect<Equal<ExprType<typeof callbackFilteredUsers.columns.id>, SqlInt>>;
type _FilterEqCallbackNameUsersName = Expect<Equal<ExprType<typeof filterEqCallbackNameUsers.columns.name>, SqlString>>;
type _FilterEqCallbackIdUsersId = Expect<Equal<ExprType<typeof filterEqCallbackIdUsers.columns.id>, SqlInt>>;
type _FilterGteComputedUsersId = Expect<Equal<ExprType<typeof filterGteComputedUsers.columns.id>, SqlInt>>;
type _FilterEqCallbackUsersId = Expect<Equal<ExprType<typeof filterEqCallbackUsers.columns.id>, SqlInt>>;
type _FilterNeUsersName = Expect<Equal<ExprType<typeof filterNeUsers.columns.name>, SqlString>>;
type _FilterGtUsersId = Expect<Equal<ExprType<typeof filterGtUsers.columns.id>, SqlInt>>;
type _FilterLtUsersId = Expect<Equal<ExprType<typeof filterLtUsers.columns.id>, SqlInt>>;
type _FilterLteUsersId = Expect<Equal<ExprType<typeof filterLteUsers.columns.id>, SqlInt>>;
type _CallbackSortedUsersName = Expect<Equal<ExprType<typeof callbackSortedUsers.columns.name>, SqlString>>;
type _CallbackAggregatedOrdersTotalSpend = Expect<Equal<ExprType<typeof callbackAggregatedOrders.columns.total_spend>, SqlFloat>>;
type _CallbackExplodedSessionsTag = Expect<Equal<ExprType<typeof callbackExplodedSessions.columns.tag>, SqlString>>;
type _CallbackMergedJoinUserId = Expect<Equal<ExprType<typeof callbackMergedJoin.columns.user_id>, SqlInt>>;
type _CallbackMergedJoinTotal = Expect<Equal<ExprType<typeof callbackMergedJoin.columns.total>, SqlFloat | null>>;
type _VariadicAndFilteredUsersId = Expect<Equal<ExprType<typeof variadicAndFilteredUsers.columns.id>, SqlInt>>;
type _VariadicOrFilteredUsersName = Expect<Equal<ExprType<typeof variadicOrFilteredUsers.columns.name>, SqlString>>;
type _ConditionalStepUsersName = Expect<Equal<ExprType<typeof conditionalStepUsers.columns.name>, SqlString>>;
type _UnionStepUsersName = Expect<Equal<ExprType<typeof unionStepUsers.columns.name>, SqlString>>;
type _LoopStepUsersId = Expect<Equal<ExprType<typeof loopStepUsers.columns.id>, SqlInt>>;
type _UnnestStepSessionsTag = Expect<Equal<ExprType<typeof unnestStepSessions.columns.tag>, SqlString>>;
type _PredicateConvenienceUsersName = Expect<Equal<ExprType<typeof predicateConvenienceUsers.columns.name>, SqlString>>;
type _SingleAndExpr = Expect<Equal<ExprType<typeof singleAndExpr>, SqlBoolean>>;
type _SingleOrExpr = Expect<Equal<ExprType<typeof singleOrExpr>, SqlBoolean>>;
type _StringLiteralExpr = Expect<Equal<ExprType<typeof stringLiteralExpr>, SqlString>>;
type _NumberLiteralExpr = Expect<Equal<ExprType<typeof numberLiteralExpr>, SqlNumber>>;
type _BigintLiteralExpr = Expect<Equal<ExprType<typeof bigintLiteralExpr>, SqlBigInt>>;
type _BigintIrLiteralExpr = Expect<Equal<ExprType<typeof bigintIrLiteralExpr>, SqlBigInt>>;
type _BooleanLiteralExpr = Expect<Equal<ExprType<typeof booleanLiteralExpr>, SqlBoolean>>;
type _NullLiteralExpr = Expect<Equal<ExprType<typeof nullLiteralExpr>, null>>;
type _DateLiteralExpr = Expect<Equal<ExprType<typeof dateLiteralExpr>, SqlDate>>;
type _TimestampLiteralExpr = Expect<Equal<ExprType<typeof timestampLiteralExpr>, SqlTimestamp>>;
type _CurrentDateExpr = Expect<Equal<ExprType<typeof currentDateExpr>, SqlDate>>;
type _CurrentTimestampExpr = Expect<Equal<ExprType<typeof currentTimestampExpr>, SqlTimestamp>>;
type _CurrentDatePlusDayExpr = Expect<Equal<ExprType<typeof currentDatePlusDayExpr>, SqlDate>>;
type _CurrentTimestampPlusDayExpr = Expect<Equal<ExprType<typeof currentTimestampPlusDayExpr>, SqlTimestamp>>;
type _StringParamExpr = Expect<Equal<ExprType<typeof stringParamExpr>, SqlString>>;
type _NumberParamExpr = Expect<Equal<ExprType<typeof numberParamExpr>, SqlNumber>>;
type _BigintParamExpr = Expect<Equal<ExprType<typeof bigintParamExpr>, SqlBigInt>>;
type _BooleanParamExpr = Expect<Equal<ExprType<typeof booleanParamExpr>, SqlBoolean>>;
type _NullParamExpr = Expect<Equal<ExprType<typeof nullParamExpr>, null>>;
type _DateParamExpr = Expect<Equal<ExprType<typeof dateParamExpr>, SqlDate>>;
type _TimestampParamExpr = Expect<Equal<ExprType<typeof timestampParamExpr>, SqlTimestamp>>;
type _PickedUsersId = Expect<Equal<ExprType<typeof pickedUsers.columns.id>, SqlInt>>;
type _PickedUsersName = Expect<Equal<ExprType<typeof pickedUsers.columns.name>, SqlString>>;
type _InlineRowsId = Expect<Equal<ExprType<typeof inlineRows.columns.id>, SqlNumber>>;
type _InlineRowsName = Expect<Equal<ExprType<typeof inlineRows.columns.name>, SqlString>>;
type _ProfileRowsBio = Expect<Equal<ExprType<typeof profileRows.columns.bio>, SqlString>>;
type _CurriedJoinTotal = Expect<Equal<ExprType<typeof curriedJoin.columns.total>, SqlFloat | null>>;
type _DirectPickedKeys = Expect<Equal<keyof typeof directPickedSelection.columns, "id">>;
type _DirectPickedId = Expect<Equal<ExprType<typeof directPickedSelection.columns.id>, SqlInt>>;
type _DroppedUsersKeys = Expect<Equal<keyof typeof droppedUsers.columns, "id">>;
type _DroppedUsersId = Expect<Equal<ExprType<typeof droppedUsers.columns.id>, SqlInt>>;
type _DirectDroppedProfilesKeys = Expect<Equal<keyof typeof directDroppedProfiles.columns, "id" | "external_id" | "credit_limit" | "nickname">>;
type _DirectDroppedProfilesId = Expect<Equal<ExprType<typeof directDroppedProfiles.columns.id>, SqlUuid>>;
type _DirectDroppedProfilesExternalId = Expect<Equal<ExprType<typeof directDroppedProfiles.columns.external_id>, SqlBigInt>>;
type _DirectKeyMappedId = Expect<Equal<ExprType<typeof directKeyMappedSelection.columns.prefix1_id>, SqlInt>>;
type _DirectKeyMappedName = Expect<Equal<ExprType<typeof directKeyMappedSelection.columns.prefix1_name>, SqlString>>;
type _DroppedUsersUsageId = Expect<Equal<ExprType<typeof droppedUsersUsage.columns.id>, SqlInt>>;
type _ManualOmittedAggregateUserId = Expect<Equal<ExprType<typeof manualOmittedAggregate.columns.user_id>, SqlInt>>;
type _ManualOmittedAggregateOrderCount = Expect<Equal<ExprType<typeof manualOmittedAggregate.columns.order_count>, SqlInt>>;
type _ManualOmittedAggregateTotalSpend = Expect<Equal<ExprType<typeof manualOmittedAggregate.columns.total_spend>, SqlFloat>>;
type _LeftJoinCoalescedTotal = Expect<Equal<ExprType<typeof leftJoinTotal>, SqlFloat>>;
type _LeftJoinCoalescedSub = Expect<Equal<ExprType<typeof leftJoinTotalRemaining>, SqlFloat>>;
type _RenamedJoinUserId = Expect<Equal<ExprType<typeof renamedJoin.columns.user_id>, SqlInt>>;
type _RenamedJoinOrderTotal = Expect<Equal<ExprType<typeof renamedJoin.columns.order_total>, SqlFloat>>;
type _OverlapPrefixedLeftUserId = Expect<Equal<ExprType<typeof overlapPrefixedLeft.columns.user_id>, SqlInt>>;
type _OverlapPrefixedLeftRightId = Expect<Equal<ExprType<typeof overlapPrefixedLeft.columns.id>, SqlNumber>>;
type _OverlapPrefixedRightProfileId = Expect<Equal<ExprType<typeof overlapPrefixedRight.columns.profile_id>, SqlNumber>>;
type _AllPrefixedLeftId = Expect<Equal<ExprType<typeof allPrefixedLeft.columns.left_id>, SqlInt>>;
type _AllPrefixedRightTotal = Expect<Equal<ExprType<typeof allPrefixedRight.columns.order_total>, SqlFloat | null>>;
type _AllSuffixedLeftId = Expect<Equal<ExprType<typeof allSuffixedLeft.columns.id_user>, SqlInt | null>>;
type _AllSuffixedRightTotal = Expect<Equal<ExprType<typeof allSuffixedRight.columns.total_order>, SqlFloat | null>>;
type _DroppedOverlapLeftId = Expect<Equal<ExprType<typeof droppedOverlapLeft.columns.id>, SqlNumber>>;
type _DroppedOverlapRightId = Expect<Equal<ExprType<typeof droppedOverlapRight.columns.id>, SqlInt>>;
type _UsingJoinId = Expect<Equal<ExprType<typeof usingJoin.columns.id>, SqlNumber>>;
type _UsingJoinBio = Expect<Equal<ExprType<typeof usingJoin.columns.bio>, SqlString>>;
type _MappedJoinLeftId = Expect<Equal<ExprType<typeof mappedJoin.columns.left_id>, SqlInt>>;
type _MappedJoinBio = Expect<Equal<ExprType<typeof mappedJoin.columns.bio>, SqlString | null>>;
type _ProjectedWithQuotedKey = Expect<Equal<ExprType<typeof projectedWithQuotedKey.columns["User Id"]>, SqlInt>>;
type _AggregatedWithQuotedKey = Expect<Equal<ExprType<typeof aggregatedWithQuotedKey.columns["Total Spend"]>, SqlFloat>>;
type _AggregatedTotals = Expect<Equal<ExprType<typeof aggregatedTotals.columns.totals>, SqlFloat[]>>;
type _LoopedId = Expect<Equal<ExprType<typeof looped.columns.id>, SqlInt>>;
type _ProjectedWithCaseAgeBucket = Expect<Equal<ExprType<typeof projectedWithCase.columns.age_bucket>, SqlString>>;
type _ProjectedWithCaseBumpedId = Expect<Equal<ExprType<typeof projectedWithCase.columns.bumped_id>, SqlInt>>;
type _AggregatedWithGroupShapeUserId = Expect<Equal<ExprType<typeof aggregatedWithGroupShape.columns.user_id>, SqlInt>>;
type _ProfileId = Expect<Equal<ExprType<typeof profiles.columns.id>, SqlUuid>>;
type _ProfileExternalId = Expect<Equal<ExprType<typeof profiles.columns.external_id>, SqlBigInt>>;
type _ProfileCreditLimit = Expect<Equal<ExprType<typeof profiles.columns.credit_limit>, SqlDecimal | null>>;
type _ProfileMetadata = Expect<Equal<ExprType<typeof profiles.columns.metadata>, SqlJson<ProfileMeta>>>;
type _ProfileAvatar = Expect<Equal<ExprType<typeof profiles.columns.avatar>, SqlBytes | null>>;
type _ProfileNickname = Expect<Equal<ExprType<typeof profiles.columns.nickname>, SqlString | null>>;
type _ProjectedProfileExternalId = Expect<Equal<ExprType<typeof projectedProfiles.columns.external_id>, SqlBigInt>>;
type _ProjectedProfileCreditLimit = Expect<Equal<ExprType<typeof projectedProfiles.columns.credit_limit>, SqlDecimal>>;
type _ProjectedProfileMetadata = Expect<Equal<ExprType<typeof projectedProfiles.columns.metadata>, SqlJson<ProfileMeta>>>;
type _ProjectedProfileAvatar = Expect<Equal<ExprType<typeof projectedProfiles.columns.avatar>, SqlBytes | null>>;
type _ProjectedProfileNickname = Expect<Equal<ExprType<typeof projectedProfiles.columns.nickname>, SqlString>>;
type _NullableFilterGtCallbackUsersCreditLimit = Expect<Equal<ExprType<typeof nullableFilterGtCallbackUsers.columns.credit_limit>, SqlDecimal | null>>;
type _NullableFilterGtRightCallbackUsersCreditLimit = Expect<Equal<ExprType<typeof nullableFilterGtRightCallbackUsers.columns.credit_limit>, SqlDecimal | null>>;
const nullableEqPredicate = eq(profiles.columns.credit_limit, null);
type _NullableEqPredicate = Expect<Equal<ExprType<typeof nullableEqPredicate>, SqlBoolean | null>>;
const nullableGtPredicate = gt(profiles.columns.credit_limit, 0);
type _NullableGtPredicate = Expect<Equal<ExprType<typeof nullableGtPredicate>, SqlBoolean | null>>;
const nonNullableEqPredicate = eq(users.columns.id, 1);
type _NonNullableEqPredicate = Expect<Equal<ExprType<typeof nonNullableEqPredicate>, SqlBoolean>>;
type _FlowNumberToString = Expect<Equal<ReturnType<typeof flowNumberToString>, string>>;
type _FlowPipelineKeys = Expect<Equal<keyof typeof flowPipelineResult.columns, "id">>;
type _FlowPipelineId = Expect<Equal<ExprType<typeof flowPipelineResult.columns.id>, SqlInt>>;
type _StringifiedUserId = Expect<Equal<ExprType<typeof stringifiedUserId>, SqlString>>;
type _StringifiedNullableNickname = Expect<Equal<ExprType<typeof stringifiedNullableNickname>, SqlString | null>>;
type _AsStringifiedUserId = Expect<Equal<ExprType<typeof asStringifiedUserId>, SqlString>>;
type _AsStringifiedNullableNickname = Expect<Equal<ExprType<typeof asStringifiedNullableNickname>, SqlString | null>>;
type _AsUserIdInt = Expect<Equal<ExprType<typeof asUserIdInt>, SqlInt>>;
type _AsNullableNicknameInt = Expect<Equal<ExprType<typeof asNullableNicknameInt>, SqlInt | null>>;
type _AsUserIdBigInt = Expect<Equal<ExprType<typeof asUserIdBigInt>, SqlBigInt>>;
type _AsUserIdFloat = Expect<Equal<ExprType<typeof asUserIdFloat>, SqlFloat>>;
type _AsUserIdDecimal = Expect<Equal<ExprType<typeof asUserIdDecimal>, SqlDecimal>>;
type _AsNameBoolean = Expect<Equal<ExprType<typeof asNameBoolean>, SqlBoolean>>;
type _AsProfileIdUuid = Expect<Equal<ExprType<typeof asProfileIdUuid>, SqlUuid | null>>;
type _AsProfileAvatarBytes = Expect<Equal<ExprType<typeof asProfileAvatarBytes>, SqlBytes | null>>;
type _AsProfileMetadataJson = Expect<Equal<ExprType<typeof asProfileMetadataJson>, SqlJson | null>>;
type _EventDateTimestamp = Expect<Equal<ExprType<typeof eventDateTimestamp>, SqlTimestamp>>;
type _NullableEventTimestamp = Expect<Equal<ExprType<typeof nullableEventTimestamp>, SqlTimestamp | null>>;
type _RawTimestampDate = Expect<Equal<ExprType<typeof rawTimestampDate>, SqlDate>>;
type _RawTimestampTimestamp = Expect<Equal<ExprType<typeof rawTimestampTimestamp>, SqlTimestamp>>;
type _NullableEventDate = Expect<Equal<ExprType<typeof nullableEventDate>, SqlDate | null>>;
type _EventDatePlusDay = Expect<Equal<ExprType<typeof eventDatePlusDay>, SqlDate>>;
type _NullableEventTimestampPlusDay = Expect<Equal<ExprType<typeof nullableEventTimestampPlusDay>, SqlTimestamp | null>>;
void leftSelected;
void rightSelected;
void fullSelected;
void curriedPipeline;
void flowNumberToString;
void flowPipeline;
void flowPipelineResult;
void storedIdentityKind;
void storedIdentityName;
void pipedStoredIdentityName;
void schemaBoundPickId;
void schemaBoundPickKind;
void fixedRenamedName;
void multiPrefixRenamedId;
void composedPipelineResult;
void conditionalComposedUsers;
void longComposedIdentifier;
void curriedJoin;
void inlineRows;
void profileRows;
void directPickedSelection;
void invalidPickedUsers;
void directKeyMappedSelection;
void droppedUsers;
void directDroppedProfiles;
void directKeyMappedUsage;
void droppedUsersUsage;
void manualOmittedAggregate;
void leftViaJoinSelected;
void leftViaPrimitiveJoin;
void joinOptions;
void overlapPrefixedLeft;
void overlapPrefixedRight;
void allPrefixedLeft;
void allPrefixedRight;
void allSuffixedLeft;
void allSuffixedRight;
void droppedOverlapLeft;
void droppedOverlapRight;
void usingJoin;
void mappedJoin;
void callbackMergedJoin;
void extendedUsers;
void replacedExtendedUsers;
void callbackFilteredUsers;
void filterEqCallbackNameUsers;
void filterEqCallbackIdUsers;
void filterGteComputedUsers;
void filterEqCallbackUsers;
void filterNeUsers;
void filterGtUsers;
void filterLtUsers;
void filterLteUsers;
void variadicAndFilteredUsers;
void variadicOrFilteredUsers;
void conditionalStepUsers;
void unionStepUsers;
void exactUnionStepUsers;
void loopStepUsers;
void unnestStepSessions;
void predicateConvenienceUsers;
void singleAndExpr;
void singleOrExpr;
void callbackSortedUsers;
void callbackAggregatedOrders;
void callbackExplodedSessions;
void projectedWithQuotedKey;
void aggregatedWithQuotedKey;
void aggregatedTotals;
void looped;
void projectedWithCase;
void aggregatedWithGroupShape;
void projectedProfiles;
void uuidFilteredProfiles;
void bigintFilteredProfiles;
void nullableFilterGtCallbackUsers;
void nullableFilterGtRightCallbackUsers;
// @ts-expect-error filter predicates must return boolean expressions
pipe(users, filter((user) => user.name));
composeSteps(
    // @ts-expect-error composeSteps rejects a step that requires columns removed by the previous step
    map((user: typeof users.columns) => ({ id: user.id })),
    filter((user: typeof users.columns) => eq(user.name, "Ada")),
);
// @ts-expect-error and requires at least one expression
and();
// @ts-expect-error or requires at least one expression
or();
pipe(users, innerJoin(
    orders,
    // @ts-expect-error innerJoin predicates must return boolean expressions
    (user, order) => order.total
));
pipe(users, innerJoin(
    profileRows,
    // @ts-expect-error innerJoin without merge must reject overlapping output names
    (user, profile) => eq(user.id, profile.id)
));
pipe(users, leftJoin(
    profileRows,
    // @ts-expect-error leftJoin without merge must reject overlapping output names
    (user, profile) => eq(user.id, profile.id)
));
pipe(users, rightJoin(
    profileRows,
    // @ts-expect-error rightJoin without merge must reject overlapping output names
    (user, profile) => eq(user.id, profile.id)
));
pipe(users, fullJoin(
    profileRows,
    // @ts-expect-error fullJoin without merge must reject overlapping output names
    (user, profile) => eq(user.id, profile.id)
));
pipe(users, join(
    orders,
    {
        // @ts-expect-error frontend join type options are lowercase only
        type: "LEFT",
        on: (user, order) => eq(user.id, order.user_id),
    }
));
pipe(sessions, unnest(
    (session) => session.tags,
    // @ts-expect-error unnest selection.value must be a string
    { value: 1 }
));
pipe(sessions, unnest(
    (session) => session.tags,
    { value: "tag" },
    // @ts-expect-error unnest options.outer must be boolean
    { outer: "yes" }
));
pipe(users, leftJoin(
    profileRows,
    // @ts-expect-error no-merge joins with overlapping output names require an explicit merge strategy
    (user, profile) => eq(user.id, profile.id)
));
pipe(users, filter(
    (user) => eq(
        // @ts-expect-error callbacks reject unknown current-row columns in filter context
        user.missing,
        1
    )
));
// @ts-expect-error filterEq rejects unknown callback columns when applied to a typed query
pipe(users, filterEq((user) => user.missing, 1));
// @ts-expect-error filterEq rejects mismatched callback operand types
pipe(users, filterEq((user) => user.name, 1));
// @ts-expect-error filterEq requires at least one callback operand
pipe(users, filterEq("name", "Ada"));
// @ts-expect-error filterEq requires at least one callback operand
pipe(users, filterEq("name", 1));
// @ts-expect-error filterGt rejects non-comparable string callback operands
pipe(users, filterGt((user) => user.name, "Ada"));
// @ts-expect-error filterGt rejects mismatched callback operand types
pipe(users, filterGt((user) => user.name, 1));
// @ts-expect-error filterGte rejects mismatched mixed callback/direct operands
pipe(users, filterGte((user) => user.id, "1"));
// @ts-expect-error filterEq callback operands must be valid expressions
pipe(users, filterEq((user) => user.name, (user) => user.id));
pipe(users, map((user) => ({
    // @ts-expect-error callbacks reject unknown current-row columns in map context
    missing: user.missing,
})));
pipe(orders, fold((order) => ({
    // @ts-expect-error callbacks reject unknown current-row columns in fold context
    total: sum(order.missing),
})));
pipe(users, sort(
    // @ts-expect-error callbacks reject unknown current-row columns in sort context
    (user) => asc(user.missing)
));
// @ts-expect-error callbacks reject unknown current-row columns in unnest context
pipe(sessions, unnest((session) => session.missing, { value: "tag" }));
pipe(users, leftJoin(
    orders,
    // @ts-expect-error callbacks reject unknown join-left columns
    (user, order) => eq(user.missing, order.user_id)
));
pipe(users, leftJoin(
    orders,
    // @ts-expect-error callbacks reject unknown join-right columns
    (user, order) => eq(user.id, order.missing)
));
pipe(users,
    leftJoinMap(
        orders,
        (user, order) => eq(user.id, order.user_id),
        (user, _order) => ({
            // @ts-expect-error callbacks reject unknown join-left columns in merge shapes
            user_id: user.missing,
        })
    )
);
pipe(users,
    leftJoinMap(
        orders,
        (user, order) => eq(user.id, order.user_id),
        (_user, order) => ({
            // @ts-expect-error callbacks reject unknown join-right columns in merge shapes
            total: order.missing,
        })
    )
);
// @ts-expect-error callbacks reject unknown current-row columns when applying filter step directly
filter((user) => eq(user.missing, 1))(users);
// @ts-expect-error callbacks reject unknown current-row columns when applying sort step directly
sort((user) => asc(user.missing))(users);
const profileRowsWithUserId = values([
    { id: 1 as number, user_id: 1 as number, bio: "A" as string },
    { id: 2 as number, user_id: 2 as number, bio: "B" as string },
]);
pipe(users, innerJoinMerge(
    profileRowsWithUserId,
    (user, profile) => eq(user.id, profile.user_id),
    // @ts-expect-error prefixOverlapLeft can still collide with right-side keys after prefixing
    prefixOverlapLeft("user_")
));
const leftRowsWithUserId = values([
    { id: 1 as number, user_id: 11 as number, name: "Ada" as string },
    { id: 2 as number, user_id: 22 as number, name: "Grace" as string },
]);
const rightRowsOverlappingId = values([
    { id: 1 as number, bio: "A" as string },
    { id: 2 as number, bio: "B" as string },
]);
pipe(leftRowsWithUserId, innerJoinMerge(
    rightRowsOverlappingId,
    (left, right) => eq(left.id, right.id),
    // @ts-expect-error prefixOverlapLeft must reject self-collision when renamed overlap key hits unchanged left key
    prefixOverlapLeft("user_")
));
const rightRowsWithUserId = values([
    { id: 1 as number, user_id: 11 as number, bio: "A" as string },
    { id: 2 as number, user_id: 22 as number, bio: "B" as string },
]);
pipe(users, innerJoinMerge(
    rightRowsWithUserId,
    (user, right) => eq(user.id, right.id),
    // @ts-expect-error prefixOverlapRight must reject self-collision when renamed overlap key hits unchanged right key
    prefixOverlapRight("user_")
));
// @ts-expect-error legacy array selection syntax is removed
pipe(users, map((user) => [user.id]));
// @ts-expect-error legacy array fold syntax is removed
pipe(orders, fold((order) => [group(order.user_id)]));
// @ts-expect-error map projections must reject undefined values
pipe(users, map({ id: undefined }));
// @ts-expect-error query internals are opaque on the public Query type
users[Symbol("teta.query.state")];
// @ts-expect-error table schemas must define at least one column
table("empty_rows", {});
// @ts-expect-error table schemas reject arbitrary non-SQL row values
table("bad_rows", { payload: {} });
values([
    { id: 1, name: "Ada" },
    // @ts-expect-error values rows must have exactly the same columns
    { id: 2, email: "grace@example.com" },
]);
// @ts-expect-error t.array expects a column type
t.array({});
// @ts-expect-error map projections reject arbitrary objects
pipe(users, map(() => ({ payload: {} })));
// @ts-expect-error fold requires grouped or aggregate expressions
pipe(orders, fold((order) => ({ user_id: order.user_id, total_spend: sum(order.total) })));
// @ts-expect-error comparisons reject incompatible SQL domains
pipe(users, filter((user) => eq(user.id, user.name)));
// @ts-expect-error IS DISTINCT FROM rejects incompatible SQL domains
isDistinctFrom(users.columns.id, users.columns.name);
// @ts-expect-error IN values must be compatible with the left expression
isIn(users.columns.id, [users.columns.name]);
// @ts-expect-error relational comparisons reject date and numeric operands
gt(events.columns.event_date, 1);
// @ts-expect-error BETWEEN bounds must match the value domain
between(events.columns.event_date, 1, 2);
// @ts-expect-error union rejects same column names with incompatible SQL value types
pipe(users, union(table("users_v2", { id: t.string(), name: t.string() })));
const unionIdOnly = table("union_id_only", { id: t.int() });
// @ts-expect-error union rejects extra left-side columns
pipe(users, union(unionIdOnly));
// @ts-expect-error union rejects missing left-side columns
pipe(unionIdOnly, union(users));
// @ts-expect-error unionAll rejects incompatible SQL value types
pipe(users, unionAll(table("users_v3", { id: t.int(), name: t.int() })));
// @ts-expect-error loop recursive steps cannot drop columns
pipe(users, loop((self) => pipe(self, map((row) => ({ id: row.id })))));
// @ts-expect-error loop recursive steps cannot add columns
pipe(loopBase, loop((self) => pipe(self, map((row) => ({ id: row.id, extra: row.id })))));
// @ts-expect-error loop recursive steps cannot change column value types
pipe(loopBase, loop((self) => pipe(self, map((row) => ({ id: asString(row.id) })))));
// @ts-expect-error unnest selectors must reject undefined
pipe(sessions, unnest(undefined, { value: "tag" }));
// @ts-expect-error map should reject unknown source fields
pipe(directKeyMappedSelection, map((user) => ({ broken: user.prefix1_na })));
// @ts-expect-error map is curried-only
map(users, (user) => ({ id: user.id }));
// @ts-expect-error filter is curried-only
filter(users, (user) => eq(user.id, 1));
// @ts-expect-error fold is curried-only
fold(orders, (order) => ({ user_id: group(order.user_id) }));
// @ts-expect-error sort is curried-only
sort(users, (user) => asc(user.id));
// @ts-expect-error take is curried-only
take(users, 10);
// @ts-expect-error union is curried-only
union(users, users);
// @ts-expect-error unionAll is curried-only
unionAll(users, users);
// @ts-expect-error loop is curried-only
loop(loopBase, (self) => pipe(self, filter((row) => gt(row.id, 0))));
// @ts-expect-error unnest is curried-only
unnest(sessions, (session: typeof sessions.columns) => session.tags, { value: "tag" });
publicApi.join;
// @ts-expect-error innerJoin is curried-only
innerJoin(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error leftJoin is curried-only
leftJoin(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error rightJoin is curried-only
rightJoin(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error fullJoin is curried-only
fullJoin(users, orders, (user, order) => eq(user.id, order.user_id));
const removedColumnRef = "co" + "l";
const removedLeftColumnRef = "left" + "Col";
const removedRightColumnRef = "right" + "Col";
// @ts-expect-error removed from the public API
publicApi[removedColumnRef];
// @ts-expect-error removed from the public API
publicApi[removedLeftColumnRef];
// @ts-expect-error removed from the public API
publicApi[removedRightColumnRef];
