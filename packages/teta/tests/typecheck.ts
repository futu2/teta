import type { ExprRef, SqlBigInt, SqlBytes, SqlDecimal, SqlFloat, SqlInt, SqlJson, SqlTimestamp, SqlUuid, } from "../mod.ts";
import * as publicApi from "../mod.ts";
import { between, filter, filterEq, filterNe, filterGt, filterGte, filterLt, filterLte, fullJoin, fullJoinMerge, identityStep, innerJoin, innerJoinMap, innerJoinMerge, isDistinctFrom, isNotIn, join, leftJoin, leftJoinMap, leftJoinMerge, rightJoin, rightJoinMerge, take, sort, param, map, rename, pipe, flow, table, t, fold, asc, desc, eq, gt, upper, add, mul, coalesce, count, group, loop, sum, and, or, isNotNull, sub, caseWhen, when, mapShape, groupShape, lt, unnest, unionAll, union, unlessStep, values, arrayAgg, prefixOverlapLeft, prefixOverlapRight, prefixAllLeft, prefixAllRight, suffixAllLeft, suffixAllRight, dropOverlapLeft, dropOverlapRight, usingCols, onEq, toString, toTimestamp, pick, drop, extend, select, alias, whenStep } from "../mod.ts";
type Equal<A, B> = ((<T>() => T extends A ? 1 : 2) extends (<T>() => T extends B ? 1 : 2) ? true : false);
type Expect<T extends true> = T;
type ExprType<TExpr> = TExpr extends ExprRef<infer TValue> ? TValue : never;
const users = table("users", {
    id: t.int(),
    name: t.string(),
});
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
const leftViaJoin = pipe(users, join(
    orders,
    (user, order) => eq(user.id, order.user_id),
    { type: "left" }
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
const usingJoin = pipe(users, join(
    profileRows,
    usingCols("id"),
    dropOverlapLeft()
));
const mappedProfileRows = table("profiles_mapped", {
    id: t.int(),
    user_id: t.int(),
    bio: t.string(),
});
const mappedProfileOnEq: (user: typeof users.columns, profile: typeof mappedProfileRows.columns) => ExprRef<boolean> = onEq({ id: "user_id" });
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
const selectedUsers = pipe(users, select((user) => [user.id, user.name]));
const aliasedSelectedUsers = pipe(users, select((user) => [
    pipe(user.id, alias("old_id")),
    pipe(upper(user.name), alias("name_upper")),
]));
const generatedSelectedUsers = pipe(users, select((user) => [
    user.id,
    add(user.id, 1),
    user.name,
    add(user.id, 2),
]));
const generatedExpressionSelectedUsers = pipe(users, select((user) => [
    user.id,
    add(user.id, 1),
]));
const mappedSelectedUsers = pipe(users, map((user) => ({
    id: user.id,
    name: user.name,
})), select((user) => [user.id, user.name]));
const mappedSortedTakenSelectedUsers = pipe(users, map((user) => ({
    id: user.id,
    name: user.name,
})), sort((user) => [desc(user.id)]), take(5), select((user) => [user.id, user.name]));
const extendedUsers = pipe(users, extend((user) => ({
    name_upper: upper(user.name),
})));
const replacedExtendedUsers = pipe(users, extend((user) => ({
    id: toString(user.id),
})));
const pickedUsers = pipe(users, pick("id", "name"));
const callbackFilteredUsers = pipe(users, filter((user) => eq(user.id, 1)));
const filterEqCallbackNameUsers = pipe(users, filterEq((user) => user.name, "Ada"));
const filterGteComputedUsers = pipe(users, filterGte((user) => add(mul(user.id, 2), 1), 3));
const filterEqCallbackUsers = pipe(users, filterEq((user) => user.id, (user) => add(user.id, 0)));
const filterNeUsers = pipe(users, filterNe((user) => user.name, "deleted"));
const filterGtUsers = pipe(users, filterGt((user) => user.id, 0));
const filterLtUsers = pipe(users, filterLt((user) => user.id, 100));
const filterLteUsers = pipe(users, filterLte((user) => user.id, 100));
const literalStringFilter = pipe(users, filterEq("status", "active"));
const variadicAndFilteredUsers = pipe(users, filter((user) => and(eq(user.id, 1), gt(user.id, 0), isNotNull(user.name))));
const variadicOrFilteredUsers = pipe(users, filter((user) => or(eq(user.name, "Ada"), eq(user.name, "Grace"), eq(user.name, "Linus"))));
const conditionalStepUsers = pipe(users, identityStep(), whenStep(true, filterEq((user) => user.name, "Ada")), unlessStep(false, take(10)));
const unionStepUsers = pipe(users, union(users), unionAll(users));
const unnestStepSessions = pipe(sessions, unnest((session) => session.tags, { value: "tag" }));
const predicateConvenienceUsers = pipe(users, filter((user) => and(
    between(user.id, 1, 10),
    isNotIn(user.name, ["Ada", "Grace"]),
    isDistinctFrom(user.name, "anonymous"),
)));
const singleAndExpr = and(eq(users.columns.id, 1));
const singleOrExpr = or(eq(users.columns.id, 1));
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
const curriedJoin = pipe(users, leftJoin(
    orders,
    (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)
));
const directPickedSelection = pipe(users, pick("id"));
const directKeyMappedSelection = pipe(users, rename((key) => `prefix1_${key}`));
const droppedUsers = pipe(users, drop("name"));
const directDroppedProfiles = pipe(profiles, drop("avatar", "metadata"));
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
    age_bucket: caseWhen([
        when(lt(user.id, 10), "small"),
        when(lt(user.id, 100), "medium"),
    ], "large"),
    ...mapShape({
        bumped_id: user.id,
    }, (value) => add(value, 1)),
})));
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
const uuidFilteredProfiles = pipe(profiles, filter((profile) => eq(profile.id, param("00000000-0000-0000-0000-000000000000"))));
const bigintFilteredProfiles = pipe(profiles, filter((profile) => and(gt(profile.external_id, 0), eq(profile.external_id, 42n))));
const nullableFilterGtCallbackUsers = pipe(profiles, filterGt((profile) => profile.credit_limit, 0));
const nullableFilterGtRightCallbackUsers = pipe(profiles, filterGt(0, (profile) => profile.credit_limit));
const stringifiedUserId = toString(users.columns.id);
const stringifiedNullableNickname = toString(profiles.columns.nickname);
const events = table("events", {
    event_date: t.date(),
    event_ts: t.nullable(t.timestamp()),
});
const rawTimestampRows = values([
    { raw_ts: "2024-01-02 03:04:05" as string },
]);
const eventDateTimestamp = toTimestamp(events.columns.event_date);
const nullableEventTimestamp = toTimestamp(events.columns.event_ts);
type _LeftJoinTotal = Expect<Equal<ExprType<typeof leftJoined.columns.total>, SqlFloat | null>>;
type _ExplodedTag = Expect<Equal<ExprType<typeof explodedSessions.columns.tag>, string>>;
type _ExplodedTagIndex = Expect<Equal<ExprType<typeof explodedSessions.columns.tag_index>, SqlInt>>;
type _OuterExplodedTag = Expect<Equal<ExprType<typeof outerExplodedSessions.columns.tag>, string | null>>;
type _RightJoinId = Expect<Equal<ExprType<typeof rightJoined.columns.id>, SqlInt | null>>;
type _FullJoinTotal = Expect<Equal<ExprType<typeof fullJoined.columns.total>, SqlFloat | null>>;
type _LeftViaJoinTotal = Expect<Equal<ExprType<typeof leftViaJoin.columns.total>, SqlFloat | null>>;
type _ProjectedUsersId = Expect<Equal<ExprType<typeof projectedUsers.columns.id>, SqlInt>>;
type _ProjectedUsersName = Expect<Equal<ExprType<typeof projectedUsers.columns.name>, string>>;
type _SelectedUsersKeys = Expect<Equal<keyof typeof selectedUsers.columns, "id" | "name">>;
type _SelectedUsersId = Expect<Equal<ExprType<typeof selectedUsers.columns.id>, SqlInt>>;
type _SelectedUsersName = Expect<Equal<ExprType<typeof selectedUsers.columns.name>, string>>;
type _AliasedSelectedUsersKeys = Expect<Equal<keyof typeof aliasedSelectedUsers.columns, "old_id" | "name_upper">>;
type _AliasedSelectedUsersOldId = Expect<Equal<ExprType<typeof aliasedSelectedUsers.columns.old_id>, SqlInt>>;
type _AliasedSelectedUsersNameUpper = Expect<Equal<ExprType<typeof aliasedSelectedUsers.columns.name_upper>, string>>;
type _GeneratedSelectedUsersKeys = Expect<Equal<keyof typeof generatedSelectedUsers.columns, "id" | "col_1" | "name" | "col_2">>;
type _GeneratedSelectedUsersCol1 = Expect<Equal<ExprType<typeof generatedSelectedUsers.columns.col_1>, SqlInt>>;
type _GeneratedSelectedUsersCol2 = Expect<Equal<ExprType<typeof generatedSelectedUsers.columns.col_2>, SqlInt>>;
type _GeneratedExpressionSelectedUsersKeys = Expect<Equal<keyof typeof generatedExpressionSelectedUsers.columns, "id" | "col_1">>;
type _GeneratedExpressionSelectedUsersCol1 = Expect<Equal<ExprType<typeof generatedExpressionSelectedUsers.columns.col_1>, SqlInt>>;
type _MappedSelectedUsersKeys = Expect<Equal<keyof typeof mappedSelectedUsers.columns, "id" | "name">>;
type _MappedSelectedUsersId = Expect<Equal<ExprType<typeof mappedSelectedUsers.columns.id>, SqlInt>>;
type _MappedSelectedUsersName = Expect<Equal<ExprType<typeof mappedSelectedUsers.columns.name>, string>>;
type _MappedSortedTakenSelectedUsersKeys = Expect<Equal<keyof typeof mappedSortedTakenSelectedUsers.columns, "id" | "name">>;
type _MappedSortedTakenSelectedUsersId = Expect<Equal<ExprType<typeof mappedSortedTakenSelectedUsers.columns.id>, SqlInt>>;
type _MappedSortedTakenSelectedUsersName = Expect<Equal<ExprType<typeof mappedSortedTakenSelectedUsers.columns.name>, string>>;
type _ExtendedUsersKeys = Expect<Equal<keyof typeof extendedUsers.columns, "id" | "name" | "name_upper">>;
type _ExtendedUsersNameUpper = Expect<Equal<ExprType<typeof extendedUsers.columns.name_upper>, string>>;
type _ReplacedExtendedUsersKeys = Expect<Equal<keyof typeof replacedExtendedUsers.columns, "id" | "name">>;
type _ReplacedExtendedUsersId = Expect<Equal<ExprType<typeof replacedExtendedUsers.columns.id>, string>>;
type _ReplacedExtendedUsersName = Expect<Equal<ExprType<typeof replacedExtendedUsers.columns.name>, string>>;
type _CallbackFilteredUsersId = Expect<Equal<ExprType<typeof callbackFilteredUsers.columns.id>, SqlInt>>;
type _FilterEqCallbackNameUsersName = Expect<Equal<ExprType<typeof filterEqCallbackNameUsers.columns.name>, string>>;
type _FilterGteComputedUsersId = Expect<Equal<ExprType<typeof filterGteComputedUsers.columns.id>, SqlInt>>;
type _FilterEqCallbackUsersId = Expect<Equal<ExprType<typeof filterEqCallbackUsers.columns.id>, SqlInt>>;
type _FilterNeUsersName = Expect<Equal<ExprType<typeof filterNeUsers.columns.name>, string>>;
type _FilterGtUsersId = Expect<Equal<ExprType<typeof filterGtUsers.columns.id>, SqlInt>>;
type _FilterLtUsersId = Expect<Equal<ExprType<typeof filterLtUsers.columns.id>, SqlInt>>;
type _FilterLteUsersId = Expect<Equal<ExprType<typeof filterLteUsers.columns.id>, SqlInt>>;
type _LiteralStringFilterName = Expect<Equal<ExprType<typeof literalStringFilter.columns.name>, string>>;
type _CallbackSortedUsersName = Expect<Equal<ExprType<typeof callbackSortedUsers.columns.name>, string>>;
type _CallbackAggregatedOrdersTotalSpend = Expect<Equal<ExprType<typeof callbackAggregatedOrders.columns.total_spend>, SqlFloat>>;
type _CallbackExplodedSessionsTag = Expect<Equal<ExprType<typeof callbackExplodedSessions.columns.tag>, string>>;
type _CallbackMergedJoinUserId = Expect<Equal<ExprType<typeof callbackMergedJoin.columns.user_id>, SqlInt>>;
type _CallbackMergedJoinTotal = Expect<Equal<ExprType<typeof callbackMergedJoin.columns.total>, SqlFloat | null>>;
type _VariadicAndFilteredUsersId = Expect<Equal<ExprType<typeof variadicAndFilteredUsers.columns.id>, SqlInt>>;
type _VariadicOrFilteredUsersName = Expect<Equal<ExprType<typeof variadicOrFilteredUsers.columns.name>, string>>;
type _ConditionalStepUsersName = Expect<Equal<ExprType<typeof conditionalStepUsers.columns.name>, string>>;
type _UnionStepUsersName = Expect<Equal<ExprType<typeof unionStepUsers.columns.name>, string>>;
type _LoopStepUsersId = Expect<Equal<ExprType<typeof loopStepUsers.columns.id>, SqlInt>>;
type _UnnestStepSessionsTag = Expect<Equal<ExprType<typeof unnestStepSessions.columns.tag>, string>>;
type _PredicateConvenienceUsersName = Expect<Equal<ExprType<typeof predicateConvenienceUsers.columns.name>, string>>;
type _SingleAndExpr = Expect<Equal<ExprType<typeof singleAndExpr>, boolean>>;
type _SingleOrExpr = Expect<Equal<ExprType<typeof singleOrExpr>, boolean>>;
type _PickedUsersId = Expect<Equal<ExprType<typeof pickedUsers.columns.id>, SqlInt>>;
type _PickedUsersName = Expect<Equal<ExprType<typeof pickedUsers.columns.name>, string>>;
type _InlineRowsId = Expect<Equal<ExprType<typeof inlineRows.columns.id>, number>>;
type _InlineRowsName = Expect<Equal<ExprType<typeof inlineRows.columns.name>, string>>;
type _ProfileRowsBio = Expect<Equal<ExprType<typeof profileRows.columns.bio>, string>>;
type _CurriedJoinTotal = Expect<Equal<ExprType<typeof curriedJoin.columns.total>, SqlFloat | null>>;
type _DirectPickedKeys = Expect<Equal<keyof typeof directPickedSelection.columns, "id">>;
type _DirectPickedId = Expect<Equal<ExprType<typeof directPickedSelection.columns.id>, SqlInt>>;
type _DroppedUsersKeys = Expect<Equal<keyof typeof droppedUsers.columns, "id">>;
type _DroppedUsersId = Expect<Equal<ExprType<typeof droppedUsers.columns.id>, SqlInt>>;
type _DirectDroppedProfilesKeys = Expect<Equal<keyof typeof directDroppedProfiles.columns, "id" | "external_id" | "credit_limit" | "nickname">>;
type _DirectDroppedProfilesId = Expect<Equal<ExprType<typeof directDroppedProfiles.columns.id>, SqlUuid>>;
type _DirectDroppedProfilesExternalId = Expect<Equal<ExprType<typeof directDroppedProfiles.columns.external_id>, SqlBigInt>>;
type _DirectKeyMappedId = Expect<Equal<ExprType<typeof directKeyMappedSelection.columns.prefix1_id>, SqlInt>>;
type _DirectKeyMappedName = Expect<Equal<ExprType<typeof directKeyMappedSelection.columns.prefix1_name>, string>>;
type _DroppedUsersUsageId = Expect<Equal<ExprType<typeof droppedUsersUsage.columns.id>, SqlInt>>;
type _ManualOmittedAggregateUserId = Expect<Equal<ExprType<typeof manualOmittedAggregate.columns.user_id>, SqlInt>>;
type _ManualOmittedAggregateOrderCount = Expect<Equal<ExprType<typeof manualOmittedAggregate.columns.order_count>, SqlInt>>;
type _ManualOmittedAggregateTotalSpend = Expect<Equal<ExprType<typeof manualOmittedAggregate.columns.total_spend>, SqlFloat>>;
type _LeftJoinCoalescedTotal = Expect<Equal<ExprType<typeof leftJoinTotal>, SqlFloat>>;
type _LeftJoinCoalescedSub = Expect<Equal<ExprType<typeof leftJoinTotalRemaining>, SqlFloat>>;
type _RenamedJoinUserId = Expect<Equal<ExprType<typeof renamedJoin.columns.user_id>, SqlInt>>;
type _RenamedJoinOrderTotal = Expect<Equal<ExprType<typeof renamedJoin.columns.order_total>, SqlFloat>>;
type _OverlapPrefixedLeftUserId = Expect<Equal<ExprType<typeof overlapPrefixedLeft.columns.user_id>, SqlInt>>;
type _OverlapPrefixedLeftRightId = Expect<Equal<ExprType<typeof overlapPrefixedLeft.columns.id>, number>>;
type _OverlapPrefixedRightProfileId = Expect<Equal<ExprType<typeof overlapPrefixedRight.columns.profile_id>, number>>;
type _AllPrefixedLeftId = Expect<Equal<ExprType<typeof allPrefixedLeft.columns.left_id>, SqlInt>>;
type _AllPrefixedRightTotal = Expect<Equal<ExprType<typeof allPrefixedRight.columns.order_total>, SqlFloat | null>>;
type _AllSuffixedLeftId = Expect<Equal<ExprType<typeof allSuffixedLeft.columns.id_user>, SqlInt | null>>;
type _AllSuffixedRightTotal = Expect<Equal<ExprType<typeof allSuffixedRight.columns.total_order>, SqlFloat | null>>;
type _DroppedOverlapLeftId = Expect<Equal<ExprType<typeof droppedOverlapLeft.columns.id>, number>>;
type _DroppedOverlapRightId = Expect<Equal<ExprType<typeof droppedOverlapRight.columns.id>, SqlInt>>;
type _UsingJoinId = Expect<Equal<ExprType<typeof usingJoin.columns.id>, number>>;
type _UsingJoinBio = Expect<Equal<ExprType<typeof usingJoin.columns.bio>, string>>;
type _MappedJoinLeftId = Expect<Equal<ExprType<typeof mappedJoin.columns.left_id>, SqlInt>>;
type _MappedJoinBio = Expect<Equal<ExprType<typeof mappedJoin.columns.bio>, string | null>>;
type _ProjectedWithQuotedKey = Expect<Equal<ExprType<typeof projectedWithQuotedKey.columns["User Id"]>, SqlInt>>;
type _AggregatedWithQuotedKey = Expect<Equal<ExprType<typeof aggregatedWithQuotedKey.columns["Total Spend"]>, SqlFloat>>;
type _AggregatedTotals = Expect<Equal<ExprType<typeof aggregatedTotals.columns.totals>, SqlFloat[]>>;
type _LoopedId = Expect<Equal<ExprType<typeof looped.columns.id>, SqlInt>>;
type _ProjectedWithCaseAgeBucket = Expect<Equal<ExprType<typeof projectedWithCase.columns.age_bucket>, string>>;
type _ProjectedWithCaseBumpedId = Expect<Equal<ExprType<typeof projectedWithCase.columns.bumped_id>, SqlInt>>;
type _AggregatedWithGroupShapeUserId = Expect<Equal<ExprType<typeof aggregatedWithGroupShape.columns.user_id>, SqlInt>>;
type _ProfileId = Expect<Equal<ExprType<typeof profiles.columns.id>, SqlUuid>>;
type _ProfileExternalId = Expect<Equal<ExprType<typeof profiles.columns.external_id>, SqlBigInt>>;
type _ProfileCreditLimit = Expect<Equal<ExprType<typeof profiles.columns.credit_limit>, SqlDecimal | null>>;
type _ProfileMetadata = Expect<Equal<ExprType<typeof profiles.columns.metadata>, SqlJson<ProfileMeta>>>;
type _ProfileAvatar = Expect<Equal<ExprType<typeof profiles.columns.avatar>, SqlBytes | null>>;
type _ProfileNickname = Expect<Equal<ExprType<typeof profiles.columns.nickname>, string | null>>;
type _ProjectedProfileExternalId = Expect<Equal<ExprType<typeof projectedProfiles.columns.external_id>, SqlBigInt>>;
type _ProjectedProfileCreditLimit = Expect<Equal<ExprType<typeof projectedProfiles.columns.credit_limit>, SqlDecimal>>;
type _ProjectedProfileMetadata = Expect<Equal<ExprType<typeof projectedProfiles.columns.metadata>, SqlJson<ProfileMeta>>>;
type _ProjectedProfileAvatar = Expect<Equal<ExprType<typeof projectedProfiles.columns.avatar>, SqlBytes | null>>;
type _ProjectedProfileNickname = Expect<Equal<ExprType<typeof projectedProfiles.columns.nickname>, string>>;
type _NullableFilterGtCallbackUsersCreditLimit = Expect<Equal<ExprType<typeof nullableFilterGtCallbackUsers.columns.credit_limit>, SqlDecimal | null>>;
type _NullableFilterGtRightCallbackUsersCreditLimit = Expect<Equal<ExprType<typeof nullableFilterGtRightCallbackUsers.columns.credit_limit>, SqlDecimal | null>>;
type _FlowNumberToString = Expect<Equal<ReturnType<typeof flowNumberToString>, string>>;
type _FlowPipelineKeys = Expect<Equal<keyof typeof flowPipelineResult.columns, "id">>;
type _FlowPipelineId = Expect<Equal<ExprType<typeof flowPipelineResult.columns.id>, SqlInt>>;
type _StringifiedUserId = Expect<Equal<ExprType<typeof stringifiedUserId>, string>>;
type _StringifiedNullableNickname = Expect<Equal<ExprType<typeof stringifiedNullableNickname>, string | null>>;
type _EventDateTimestamp = Expect<Equal<ExprType<typeof eventDateTimestamp>, SqlTimestamp>>;
type _NullableEventTimestamp = Expect<Equal<ExprType<typeof nullableEventTimestamp>, SqlTimestamp | null>>;
void leftSelected;
void rightSelected;
void fullSelected;
void curriedPipeline;
void flowNumberToString;
void flowPipeline;
void flowPipelineResult;
void curriedJoin;
void inlineRows;
void profileRows;
void directPickedSelection;
void directKeyMappedSelection;
void droppedUsers;
void directDroppedProfiles;
void directKeyMappedUsage;
void droppedUsersUsage;
void manualOmittedAggregate;
void leftViaJoinSelected;
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
void selectedUsers;
void aliasedSelectedUsers;
void generatedSelectedUsers;
void generatedExpressionSelectedUsers;
void extendedUsers;
void replacedExtendedUsers;
void callbackFilteredUsers;
void filterEqCallbackNameUsers;
void filterGteComputedUsers;
void filterEqCallbackUsers;
void filterNeUsers;
void filterGtUsers;
void filterLtUsers;
void filterLteUsers;
void literalStringFilter;
void variadicAndFilteredUsers;
void variadicOrFilteredUsers;
void conditionalStepUsers;
void unionStepUsers;
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
void invalidPickedUsers;
// @ts-expect-error filter predicates must return boolean expressions
pipe(users, filter((user) => user.name));
// @ts-expect-error and requires at least one expression
and();
// @ts-expect-error or requires at least one expression
or();
pipe(users, join(
    orders,
    // @ts-expect-error join predicates must return boolean expressions
    (user, order) => order.total
));
pipe(users, join(
    profileRows,
    // @ts-expect-error default joins with overlapping output names require an explicit merge strategy
    (user, profile) => eq(user.id, profile.id)
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
// @ts-expect-error filterEq rejects mismatched literal operand types
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
// @ts-expect-error extend rejects unknown callback columns when applied to a typed query
pipe(users, extend((user) => ({ broken: user.missing })));
// @ts-expect-error select rejects unknown callback current columns
pipe(users, select((user) => [user.missing]));
// @ts-expect-error select rejects mixed valid and unknown callback current columns
pipe(users, select((user) => [user.id, user.missing]));
// @ts-expect-error select rejects duplicate output names from repeated columns
pipe(users, select((user) => [user.id, user.id]));
// @ts-expect-error select rejects duplicate output names from alias collisions
pipe(users, select((user) => [user.id, pipe(user.name, alias("id"))]));
// @ts-expect-error select rejects unknown callback current columns after map
pipe(users, map((user) => ({ id: user.id, name: user.name })), select((user) => [user.id, user.missing]));
// @ts-expect-error select rejects unknown callback current columns after map, sort, and take
pipe(users, map((user) => ({ id: user.id, name: user.name })), sort((user) => [desc(user.id)]), take(5), select((user) => [user.id, user.missing]));
// @ts-expect-error alias must wrap a select expression item through pipe
pipe(users, select((user) => [alias("bad")]));
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
// @ts-expect-error toTimestamp should reject arbitrary strings
toTimestamp(rawTimestampRows.columns.raw_ts);
const profileRowsWithUserId = values([
    { id: 1 as number, user_id: 1 as number, bio: "A" as string },
    { id: 2 as number, user_id: 2 as number, bio: "B" as string },
]);
pipe(users, innerJoinMerge(
    profileRowsWithUserId,
    (user, profile) => eq(user.id, profile.user_id),
    // @ts-expect-error prefixOverlapLeft can still collide with right-side keys after rename
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
// @ts-expect-error unnest selectors must reject undefined
pipe(sessions, unnest(undefined, { value: "tag" }));
// @ts-expect-error rename should reject unknown direct renamed fields
pipe(directKeyMappedSelection, map((user) => ({ broken: user.prefix1_na })));
// @ts-expect-error drop rejects unknown columns when applied to a typed query
pipe(users, drop("missing"));
// @ts-expect-error pick is a query step, not a map selector
pipe(users, map(pick("id")));
// @ts-expect-error drop is a query step, not a map selector
pipe(users, map(drop("name")));
// @ts-expect-error rename is a query step, not a map selector
pipe(users, map(rename((key) => `prefix2_${key}`)));
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
// @ts-expect-error join is curried-only
join(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error lateral join is curried-only
join(users, (user) => pipe(orders, filter((order) => eq(order.user_id, user.id))), (user, order) => eq(user.id, order.user_id));
// @ts-expect-error innerJoin is curried-only
innerJoin(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error leftJoin is curried-only
leftJoin(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error rightJoin is curried-only
rightJoin(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error fullJoin is curried-only
fullJoin(users, orders, (user, order) => eq(user.id, order.user_id));
// @ts-expect-error col is removed from the public API
publicApi.col;
// @ts-expect-error leftCol is removed from the public API
publicApi.leftCol;
// @ts-expect-error rightCol is removed from the public API
publicApi.rightCol;
