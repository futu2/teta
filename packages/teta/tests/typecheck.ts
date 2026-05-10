import { mapKeys, omit, pick, pipe } from "remeda";
import type { ExprRef, SqlBigInt, SqlBytes, SqlDecimal, SqlFloat, SqlInt, SqlJson, SqlTimestamp, SqlUuid, } from "../mod.ts";
import { filter, fullJoin, innerJoin, join, leftJoin, rightJoin, take, sort, param, map, table, t, fold, asc, desc, eq, gt, upper, add, coalesce, count, group, loop, sum, and, sub, caseWhen, when, mapShape, groupShape, lt, unnest, values, arrayAgg, prefixOverlapLeft, prefixOverlapRight, prefixAllLeft, prefixAllRight, suffixAllLeft, suffixAllRight, dropOverlapLeft, dropOverlapRight, usingCols, onEq, toString, toTimestamp, $left, $right } from "../mod.ts";
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
const leftJoined = leftJoin(users, orders, (user, order) => eq(user.id, order.user_id));
const rightJoined = rightJoin(users, orders, (user, order) => eq(user.id, order.user_id));
const fullJoined = fullJoin(users, orders, (user, order) => eq(user.id, order.user_id));
const leftViaJoin = join(users, orders, (user, order) => eq(user.id, order.user_id), { type: "left" });
const renamedJoin = innerJoin(users, orders, (user, order) => eq(user.id, order.user_id), (user, order) => ({
    user_id: user.id,
    order_total: order.total,
}));
const overlapPrefixedLeft = innerJoin(users, profileRows, (user, profile) => eq(user.id, profile.id), prefixOverlapLeft("user_"));
const overlapPrefixedRight = innerJoin(users, profileRows, (user, profile) => eq(user.id, profile.id), prefixOverlapRight("profile_"));
const allPrefixedLeft = innerJoin(users, profileRows, (user, profile) => eq(user.id, profile.id), prefixAllLeft("left_"));
const allPrefixedRight = leftJoin(users, orders, (user, order) => eq(user.id, order.user_id), prefixAllRight("order_"));
const allSuffixedLeft = rightJoin(users, orders, (user, order) => eq(user.id, order.user_id), suffixAllLeft("_user"));
const allSuffixedRight = fullJoin(users, orders, (user, order) => eq(user.id, order.user_id), suffixAllRight("_order"));
const droppedOverlapLeft = innerJoin(users, profileRows, (user, profile) => eq(user.id, profile.id), dropOverlapLeft());
const droppedOverlapRight = innerJoin(users, profileRows, (user, profile) => eq(user.id, profile.id), dropOverlapRight());
const usingJoin = join(users, profileRows, usingCols("id"), dropOverlapLeft());
const mappedJoin = leftJoin(users, table("profiles_mapped", {
    id: t.int(),
    user_id: t.int(),
    bio: t.string(),
}), onEq({ id: "user_id" }), prefixOverlapLeft("left_"));
const filteredUsers = filter(users, (user: typeof users.columns) => gt(user.id, 0));
const projectedUsers = map(filteredUsers, (user: typeof filteredUsers.columns) => ({
    id: user.id,
    name: upper(user.name),
}));
const curriedPipeline = pipe(users, filter((user: typeof users.columns) => gt(user.id, 0)), map((user) => ({
    id: user.id,
    name: upper(user.name),
})), sort((row) => [asc(row.name), desc(row.id)]), take(5));
const curriedJoin = pipe(users, leftJoin(orders, (user: typeof users.columns, order: typeof orders.columns) => eq(user.id, order.user_id)));
const remedaPickedSelection = map(users, pick(["id"]));
const remedaOmittedSelection = map(users, (user) => ({
    ...omit(user, ["name"]),
    upper_name: upper(user.name),
}));
const remedaKeyMappedSelection = map(users, pipe(
    mapKeys((key) => "prefix1_" + key),
));
const remedaTemplateKeyMappedSelection = map(users, pipe(
    mapKeys((key) => `prefix1_${key}`),
));
const remedaTemplateKeyMappedUsage = map(remedaTemplateKeyMappedSelection, (user) => ({
    id: user.prefix1_id,
    name: user.prefix1_name,
}));
const remedaOmittedAggregate = fold(orders, (order) => omit({
    user_id: group(order.user_id),
    order_count: count(order.order_id),
    total_spend: sum(order.total),
}, ["order_count"]));
const leftSelected = map(leftJoined, (row) => ({
    total: coalesce(row.total, 0),
    filtered: gt(row.total, 0),
    name: upper(row.name),
}));
const rightSelected = map(rightJoined, (row) => ({
    user_id: coalesce(row.id, 0),
    total: row.total,
}));
const fullSelected = map(fullJoined, (row) => ({
    id: coalesce(row.id, 0),
    total: coalesce(row.total, 0),
}));
const leftViaJoinSelected = map(leftViaJoin, (row) => ({
    total: coalesce(row.total, 0),
}));
const explodedSessions = unnest(sessions, (session) => session.tags, { value: "tag", ordinality: "tag_index" });
const outerExplodedSessions = unnest(sessions, (session) => session.tags, { value: "tag" }, { outer: true });
const leftJoinTotal = coalesce(leftJoined.columns.total, 0);
const leftJoinTotalRemaining = sub(leftJoinTotal, 1);
const projectedWithQuotedKey = map(users, (user) => ({ ["User Id"]: user.id }));
const aggregatedWithQuotedKey = fold(orders, (order) => ({
    ["User Id"]: group(order.user_id),
    ["Total Spend"]: sum(order.total),
}));
const aggregatedTotals = fold(orders, (order) => ({
    user_id: group(order.user_id),
    totals: arrayAgg(order.total),
}));
const loopBase = map(users, (user) => ({ id: user.id }));
const looped = loop(loopBase, (self) => filter(self, (row) => gt(row.id, 0)));
const projectedWithCase = map(users, (user) => ({
    id: user.id,
    age_bucket: caseWhen([
        when(lt(user.id, 10), "small"),
        when(lt(user.id, 100), "medium"),
    ], "large"),
    ...mapShape({
        bumped_id: user.id,
    }, (value) => add(value, 1)),
}));
const aggregatedWithGroupShape = fold(orders, (order) => ({
    ...groupShape({
        user_id: order.user_id,
    }),
    total_spend: sum(order.total),
}));
const projectedProfiles = map(profiles, (profile) => ({
    id: profile.id,
    external_id: add(profile.external_id, 1),
    credit_limit: coalesce(profile.credit_limit, 0),
    metadata: profile.metadata,
    avatar: profile.avatar,
    nickname: coalesce(profile.nickname, "anonymous"),
}));
const uuidFilteredProfiles = filter(profiles, (profile) => eq(profile.id, param("00000000-0000-0000-0000-000000000000")));
const bigintFilteredProfiles = filter(profiles, (profile) => and(gt(profile.external_id, 0), eq(profile.external_id, 42n)));
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
type _InlineRowsId = Expect<Equal<ExprType<typeof inlineRows.columns.id>, number>>;
type _InlineRowsName = Expect<Equal<ExprType<typeof inlineRows.columns.name>, string>>;
type _ProfileRowsBio = Expect<Equal<ExprType<typeof profileRows.columns.bio>, string>>;
type _CurriedJoinTotal = Expect<Equal<ExprType<typeof curriedJoin.columns.total>, SqlFloat | null>>;
type _RemedaPickedId = Expect<Equal<ExprType<typeof remedaPickedSelection.columns.id>, SqlInt>>;
type _RemedaOmittedId = Expect<Equal<ExprType<typeof remedaOmittedSelection.columns.id>, SqlInt>>;
type _RemedaOmittedUpperName = Expect<Equal<ExprType<typeof remedaOmittedSelection.columns.upper_name>, string>>;
type _RemedaOmittedAggregateUserId = Expect<Equal<ExprType<typeof remedaOmittedAggregate.columns.user_id>, SqlInt>>;
type _RemedaOmittedAggregateTotalSpend = Expect<Equal<ExprType<typeof remedaOmittedAggregate.columns.total_spend>, SqlFloat>>;
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
type _StringifiedUserId = Expect<Equal<ExprType<typeof stringifiedUserId>, string>>;
type _StringifiedNullableNickname = Expect<Equal<ExprType<typeof stringifiedNullableNickname>, string | null>>;
type _EventDateTimestamp = Expect<Equal<ExprType<typeof eventDateTimestamp>, SqlTimestamp>>;
type _NullableEventTimestamp = Expect<Equal<ExprType<typeof nullableEventTimestamp>, SqlTimestamp | null>>;
void leftSelected;
void rightSelected;
void fullSelected;
void curriedPipeline;
void curriedJoin;
void inlineRows;
void profileRows;
void remedaPickedSelection;
void remedaOmittedSelection;
void remedaKeyMappedSelection;
void remedaTemplateKeyMappedSelection;
void remedaTemplateKeyMappedUsage;
void remedaOmittedAggregate;
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
void projectedWithQuotedKey;
void aggregatedWithQuotedKey;
void aggregatedTotals;
void looped;
void projectedWithCase;
void aggregatedWithGroupShape;
void projectedProfiles;
void uuidFilteredProfiles;
void bigintFilteredProfiles;
// @ts-expect-error filter predicates must return boolean expressions
filter(users, (user) => user.name);
// @ts-expect-error join predicates must return boolean expressions
join(users, orders, (user, order) => order.total);
// @ts-expect-error default joins with overlapping output names require an explicit merge strategy
join(users, profileRows, (user, profile) => eq(user.id, profile.id));
// @ts-expect-error innerJoin without merge must reject overlapping output names
innerJoin(users, profileRows, (user, profile) => eq(user.id, profile.id));
// @ts-expect-error leftJoin without merge must reject overlapping output names
leftJoin(users, profileRows, (user, profile) => eq(user.id, profile.id));
// @ts-expect-error rightJoin without merge must reject overlapping output names
rightJoin(users, profileRows, (user, profile) => eq(user.id, profile.id));
// @ts-expect-error fullJoin without merge must reject overlapping output names
fullJoin(users, profileRows, (user, profile) => eq(user.id, profile.id));
// @ts-expect-error deferred no-merge joins with overlapping output names require an explicit merge strategy
leftJoin(users, profileRows, eq($left.id, $right.id));
// @ts-expect-error deferred join merge shapes must only contain expression refs
leftJoin(users, orders, eq($left.id, $right.user_id), { user_id: 1 });
// @ts-expect-error toTimestamp should reject arbitrary strings
toTimestamp(rawTimestampRows.columns.raw_ts);
const profileRowsWithUserId = values([
    { id: 1 as number, user_id: 1 as number, bio: "A" as string },
    { id: 2 as number, user_id: 2 as number, bio: "B" as string },
]);
// @ts-expect-error prefixOverlapLeft can still collide with right-side keys after rename
innerJoin(users, profileRowsWithUserId, (user, profile) => eq(user.id, profile.user_id), prefixOverlapLeft("user_"));
const leftRowsWithUserId = values([
    { id: 1 as number, user_id: 11 as number, name: "Ada" as string },
    { id: 2 as number, user_id: 22 as number, name: "Grace" as string },
]);
const rightRowsOverlappingId = values([
    { id: 1 as number, bio: "A" as string },
    { id: 2 as number, bio: "B" as string },
]);
// @ts-expect-error prefixOverlapLeft must reject self-collision when renamed overlap key hits unchanged left key
innerJoin(leftRowsWithUserId, rightRowsOverlappingId, (left, right) => eq(left.id, right.id), prefixOverlapLeft("user_"));
const rightRowsWithUserId = values([
    { id: 1 as number, user_id: 11 as number, bio: "A" as string },
    { id: 2 as number, user_id: 22 as number, bio: "B" as string },
]);
// @ts-expect-error prefixOverlapRight must reject self-collision when renamed overlap key hits unchanged right key
innerJoin(users, rightRowsWithUserId, (user, right) => eq(user.id, right.id), prefixOverlapRight("user_"));
// @ts-expect-error legacy array selection syntax is removed
map(users, (user) => [user.id]);
// @ts-expect-error legacy array fold syntax is removed
fold(orders, (order) => [group(order.user_id)]);
// @ts-expect-error map projections must reject undefined values
map(users, { id: undefined });
// @ts-expect-error unnest selectors must reject undefined
unnest(sessions, undefined, { value: "tag" });
// @ts-expect-error remeda mapKeys with widened string keys should not expose arbitrary renamed column refs
map(remedaKeyMappedSelection, (user) => ({ broken: user.prefix1_na }));
// @ts-expect-error template-literal mapKeys should still reject unknown renamed fields
map(remedaTemplateKeyMappedSelection, (user) => ({ broken: user.prefix1_na }));
