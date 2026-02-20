function describeJiraFieldType(e) {
    if (!e || "object" != typeof e) return { type: "String" };
    const { type: t, items: a, custom: n } = e;
    if (n) {
        if (n.includes(":float")) return { type: "Long" };
        if (n.includes(":labels")) return { type: "StringArray" };
        if (n.includes(":select"))
            return {
                type: "Object",
                struct: [
                    { name: "id", type: "String" },
                    { name: "value", type: "String" },
                ],
            };
        if (n.includes(":multiselect"))
            return {
                type: "ObjectArray",
                struct: [
                    { name: "id", type: "String" },
                    { name: "value", type: "String" },
                ],
            };
    }
    if ("array" === t)
        switch (a) {
            case "string":
            default:
                return { type: "StringArray" };
            case "number":
                return { type: "LongArray" };
            case "user":
                return {
                    type: "ObjectArray",
                    struct: [
                        { name: "self", type: "String" },
                        { name: "name", type: "String" },
                        { name: "key", type: "String" },
                        { name: "emailAddress", type: "String" },
                        {
                            name: "avatarUrls",
                            type: "Object",
                            struct: [
                                { name: "48x48", type: "String" },
                                { name: "24x24", type: "String" },
                                { name: "16x16", type: "String" },
                                { name: "32x32", type: "String" },
                            ],
                        },
                        { name: "displayName", type: "String" },
                        { name: "active", type: "Boolean" },
                        { name: "timeZone", type: "String" },
                    ],
                };
            case "group":
                return {
                    type: "ObjectArray",
                    struct: [{ name: "name", type: "String" }],
                };
            case "option":
                return {
                    type: "ObjectArray",
                    struct: [
                        { name: "self", type: "String" },
                        { name: "id", type: "String" },
                        { name: "value", type: "String" },
                        { name: "disabled", type: "Boolean" },
                    ],
                };
            case "version":
                return {
                    type: "ObjectArray",
                    struct: [
                        { name: "self", type: "String" },
                        { name: "id", type: "String" },
                        { name: "description", type: "String" },
                        { name: "name", type: "String" },
                        { name: "archived", type: "Boolean" },
                        { name: "released", type: "Boolean" },
                        { name: "releaseDate", type: "String" },
                    ],
                };
            case "component":
                return {
                    type: "ObjectArray",
                    struct: [
                        { name: "self", type: "String" },
                        { name: "id", type: "String" },
                        { name: "name", type: "String" },
                    ],
                };
            case "project":
                return {
                    type: "ObjectArray",
                    struct: [
                        { name: "self", type: "String" },
                        { name: "id", type: "String" },
                        { name: "key", type: "String" },
                        { name: "name", type: "String" },
                    ],
                };
        }
    return "user" === t
        ? {
            type: "Object",
            struct: [
                { name: "self", type: "String" },
                { name: "name", type: "String" },
                { name: "key", type: "String" },
                { name: "emailAddress", type: "String" },
                {
                    name: "avatarUrls",
                    type: "Object",
                    struct: [
                        { name: "48x48", type: "String" },
                        { name: "24x24", type: "String" },
                        { name: "16x16", type: "String" },
                        { name: "32x32", type: "String" },
                    ],
                },
                { name: "displayName", type: "String" },
                { name: "active", type: "Boolean" },
                { name: "timeZone", type: "String" },
            ],
        }
        : "group" === t
            ? { type: "Object", struct: [{ name: "name", type: "String" }] }
            : "option" === t
                ? {
                    type: "Object",
                    struct: [
                        { name: "self", type: "String" },
                        { name: "id", type: "String" },
                        { name: "value", type: "String" },
                        { name: "disabled", type: "Boolean" },
                    ],
                }
                : "version" === t
                    ? {
                        type: "Object",
                        struct: [
                            { name: "id", type: "String" },
                            { name: "description", type: "String" },
                            { name: "name", type: "String" },
                            { name: "archived", type: "Boolean" },
                            { name: "released", type: "Boolean" },
                            { name: "releaseDate", type: "String" },
                        ],
                    }
                    : "component" === t
                        ? {
                            type: "Object",
                            struct: [
                                { name: "id", type: "String" },
                                { name: "name", type: "String" },
                                { name: "description", type: "String" },
                            ],
                        }
                        : "project" === t
                            ? {
                                type: "Object",
                                struct: [
                                    { name: "self", type: "String" },
                                    { name: "id", type: "String" },
                                    { name: "key", type: "String" },
                                    { name: "name", type: "String" },
                                ],
                            }
                            : "status" === t
                                ? {
                                    type: "Object",
                                    struct: [
                                        { name: "name", type: "String" },
                                        {
                                            name: "statusCategory",
                                            type: "Object",
                                            struct: [
                                                { name: "name", type: "String" },
                                                { name: "colorName", type: "String" },
                                            ],
                                        },
                                    ],
                                }
                                : { type: "number" === t ? "Long" : "String" };
}
function buildObject(e, t) {
    const a = {};
    for (const n of t) {
        const t = e[n.name];
        "Object" === n.type
            ? (a[n.name] = buildObject(t && "object" == typeof t ? t : {}, n.struct))
            : "ObjectArray" === n.type
                ? (a[n.name] = Array.isArray(t)
                    ? t.map((e) => buildObject(e, n.struct))
                    : [buildObject({}, n.struct)])
                : (a[n.name] = null == t || "object" == typeof t ? null : t);
    }
    return a;
}
function renameDuplicateNames(e, t = 1) {
    const a = {},
        n = [];
    return (
        e.forEach((e) => {
            a[e.name] = (a[e.name] || 0) + 1;
        }),
        e.forEach((e) => {
            if (a[e.name] > 1) {
                const a = `${e.name}_${t}`;
                (n.push({ ...e, name: a }), t++);
            } else n.push({ ...e });
        }),
        n
    );
}
function processJiraData(e, t) {
    const a = /^customfield_/,
        n = e.map((e) => ({
            id: e.id,
            name: a.test(e.id) ? e.name : e.id,
            ...describeJiraFieldType(e.schema),
        }));
    return {
        type: renameDuplicateNames(n, 1),
        data: t.map((e) => {
            const t = {};
            return (
                n.forEach((a) => {
                    const n = e.fields[a.id];
                    void 0 !== n && (t[a.name] = n);
                }),
                (function (e, t) {
                    return t.map((t) => {
                        const a = e[t.name];
                        return "Object" === t.type
                            ? buildObject(a && "object" == typeof a ? a : {}, t.struct)
                            : "ObjectArray" === t.type
                                ? Array.isArray(a) && a.length > 0
                                    ? a.map((e) => buildObject(e, t.struct))
                                    : []
                                : "String" === t.type
                                    ? null !== a
                                        ? "string" == typeof a
                                            ? a
                                            : JSON.stringify(a)
                                        : null
                                    : "StringArray" === t.type
                                        ? Array.isArray(a)
                                            ? a.map((e) =>
                                                "string" == typeof e ? e : JSON.stringify(e),
                                            )
                                            : []
                                        : t.type.endsWith("Array")
                                            ? Array.isArray(a)
                                                ? a
                                                : []
                                            : (a ?? null);
                    });
                })(t, n)
            );
        }),
    };
}
function request(e, t, a, n = {}) {
    const {
        headers: i,
        body: r,
        isMultipart: s,
        isParse: l = !0,
        getStatus: u = !1,
    } = n,
        o = e.request({
            url: a,
            method: t,
            headers: i,
            ...(r && !s ? { jsonBody: r } : {}),
            ...(s ? { multipartBody: r } : {}),
        }),
        p = l ? JSON.parse(new TextDecoder().decode(o.response)) : o;
    return (
        !u &&
        (o.status < 200 || o.status >= 300) &&
        e.stringError("Невозможно выполнить блок:\n" + JSON.stringify(p)),
        u ? o.status : p
    );
}
const api = {
    get: (e, t, a) => request(e, "GET", t, a),
    post: (e, t, a) => request(e, "POST", t, a),
    put: (e, t, a) => request(e, "PUT", t, a),
    delete: (e, t, a) => request(e, "DELETE", t, a),
    patch: (e, t, a) => request(e, "PATCH", t, a),
};
function parseTagID(e) {
    return e.replace(/^\$\$\$id_/, "") ?? e;
}
function getType(e) {
    if (Array.isArray(e))
        return 0 === e.length ? "StringArray" : `${getType(e[0])}Array`;
    if (null == e) return "String";
    if ("object" == typeof e) return "Object";
    const t = "number" != typeof e ? typeof e : "Long";
    return t.charAt(0).toUpperCase() + t.slice(1);
}
function parseStructure(e) {
    const t = [];
    for (const a in e) {
        const n = e[a],
            i = getType(n),
            r = { name: a, type: i };
        ("Object" === i
            ? (r.struct = parseStructure(n))
            : i.endsWith("Array") &&
            n.length > 0 &&
            "object" == typeof n[0] &&
            (r.struct = parseStructure(n[0])),
            t.push(r));
    }
    return t;
}
function generation_data_buildObject(e, t) {
    const a = {};
    for (const n of t) {
        const t = e[n.name];
        "Object" === n.type
            ? (a[n.name] = generation_data_buildObject(
                t && "object" == typeof t ? t : {},
                n.struct,
            ))
            : "ObjectArray" === n.type
                ? (a[n.name] = Array.isArray(t)
                    ? t.map((e) => generation_data_buildObject(e, n.struct))
                    : [generation_data_buildObject({}, n.struct)])
                : (a[n.name] = null == t || "object" == typeof t ? null : t);
    }
    return a;
}
const typeComposer = function (e, t) {
    const a = { type: [], data: [] },
        n = Array.isArray(e) ? e : [e],
        i = n.map((e) => parseStructure(e));
    return (
        (a.type = (function (e) {
            const t = [],
                a = {};
            return (
                e.forEach((e) => {
                    e.forEach((e) => {
                        const n = t.findIndex((t) => t.name === e.name);
                        -1 === n
                            ? ((a[e.name] = !0), t.push(e))
                            : ("ObjectArray" !== e.type && "Object" !== e.type) ||
                            (t[n] = e);
                    });
                }),
                t
            );
        })(i)),
        (a.data = n.map((e) =>
            (function (e, t) {
                const a = [];
                for (const n of t) {
                    const t = e && e[n.name];
                    "Object" === n.type
                        ? a.push(
                            generation_data_buildObject(
                                t && "object" == typeof t ? t : {},
                                n.struct,
                            ),
                        )
                        : "ObjectArray" === n.type
                            ? a.push(
                                Array.isArray(t)
                                    ? t.map((e) => generation_data_buildObject(e, n.struct))
                                    : [generation_data_buildObject({}, n.struct)],
                            )
                            : "StringArray" === n.type ||
                                "BooleanArray" === n.type ||
                                "LongArray" === n.type
                                ? Array.isArray(t)
                                    ? a.push(t.map((e) => JSON.stringify(e)))
                                    : a.push([])
                                : a.push(null == t || "object" == typeof t ? null : t);
                }
                return a;
            })(e, t || a.type),
        )),
        a
    );
},
    commentOutputVariables = [
        { name: "self", type: "String" },
        { name: "id", type: "String" },
        {
            name: "author",
            type: "Object",
            struct: [
                { name: "self", type: "String" },
                { name: "name", type: "String" },
                { name: "key", type: "String" },
                { name: "emailAddress", type: "String" },
                { name: "displayName", type: "String" },
                { name: "active", type: "Boolean" },
                { name: "timeZone", type: "String" },
            ],
        },
        { name: "body", type: "String" },
        {
            name: "updateAuthor",
            type: "Object",
            struct: [
                { name: "self", type: "String" },
                { name: "name", type: "String" },
                { name: "key", type: "String" },
                { name: "emailAddress", type: "String" },
                { name: "displayName", type: "String" },
                { name: "active", type: "Boolean" },
                { name: "timeZone", type: "String" }
            ],
        },
        { name: "created", type: "String" },
        { name: "updated", type: "String" },
        {
            name: "visibility",
            type: "Object",
            struct: [
                { name: "identifier", type: "String" },
                { name: "type", type: "String" },
                { name: "value", type: "String" },
            ],
        },
    ];
app = {
    schema: 2,
    version: "3.1.2",
    label: "Jira Software Data Center",
    description:
        "Интеграция с Jira для управления задачами, комментариями, вложениями и пользователями",
    blocks: {
        SearchIssues: {
            label: "Найти задачи",
            description: "Находит задачи Jira, используя JQL-запрос",
            inputFields: [
                { key: "jql", label: "JQL-запрос", type: "text", required: !1 },
            ],
            executePagination: (e, t, a) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const n = a?.variables ?? null,
                    i = {
                        baseUrl: `${t.authData.connection_base_url}/rest/api/2`,
                        page: null != a ? a.page + 1 : 0,
                        limit: 50,
                        hasNext: !0,
                        startAt: null != a ? (a.page + 1) * a.limit : 0,
                        variables: n,
                    };
                function r(a) {
                    const n = e.request({
                        url: a,
                        method: "GET",
                        headers: { Authorization: t.authData.api_key },
                    });
                    if (n.status < 200 || n.status >= 300 || !n.response) return null;
                    const i = JSON.parse(new TextDecoder().decode(n.response));
                    return JSON.stringify(i);
                }
                const s = api.get(
                    e,
                    `${i.baseUrl}/search?jql=${encodeURIComponent(t.inputData.jql)}&startAt=${i.startAt}&maxResults=${i.limit}&fields=*all`,
                    { headers: { Authorization: t.authData.api_key } },
                );
                (null == i.variables &&
                    (i.variables = api.get(
                        e,
                        `${t.authData.connection_base_url}/rest/api/2/field`,
                        { headers: { Authorization: t.authData.api_key } },
                    )),
                    s.total - s.maxResults * (i.page + 1) <= 0 && (i.hasNext = !1));
                const l = [
                    "key",
                    "id",
                    "creator",
                    "watches",
                    "assignee",
                    "description",
                    "parent",
                    "priority",
                    "project",
                    "issuetype",
                    "status",
                    "reporter",
                    "created",
                    "updated",
                    "resolutiondate",
                    "workratio",
                    "duedate",
                    "progress",
                    "votes",
                    "aggregateprogress",
                    "subtasks",
                    "components",
                    "fixVersions",
                    "aggregatetimespent",
                    "timespent",
                    "timeestimate",
                    "aggregatetimeoriginalestimate",
                    "timeoriginalestimate",
                    "aggregatetimeestimate",
                    "resolution",
                    "labels",
                    "summary",
                    "issuelinks",
                    "comment",
                ],
                    u = processJiraData(
                        Array.isArray(i.variables)
                            ? i.variables.filter((e) => e.custom || !l.includes(e.id))
                            : [],
                        s.issues,
                    );
                return {
                    output_variables: [
                        { type: "String", name: "key" },
                        { type: "String", name: "id" },
                        { type: "String", name: "remoteLink" },
                        {
                            type: "Object",
                            name: "fields",
                            struct: [
                                {
                                    type: "Object",
                                    name: "creator",
                                    struct: [
                                        { type: "String", name: "name" },
                                        { type: "String", name: "emailAddress" },
                                        { type: "String", name: "displayName" },
                                        { type: "String", name: "key" },
                                        { type: "String", name: "active" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "watches",
                                    struct: [
                                        { type: "String", name: "self" },
                                        { type: "String", name: "watchCount" },
                                        { type: "String", name: "isWatching" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "assignee",
                                    struct: [
                                        { type: "String", name: "name" },
                                        { type: "String", name: "emailAddress" },
                                        { type: "String", name: "displayName" },
                                        { type: "String", name: "key" },
                                        { type: "String", name: "active" },
                                    ],
                                },
                                { type: "String", name: "description" },
                                {
                                    type: "Object",
                                    name: "parent",
                                    struct: [{ type: "String", name: "id" }],
                                },
                                {
                                    type: "Object",
                                    name: "priority",
                                    struct: [
                                        { type: "String", name: "id" },
                                        { type: "String", name: "name" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "project",
                                    struct: [
                                        { type: "String", name: "id" },
                                        { type: "String", name: "key" },
                                        { type: "String", name: "name" },
                                        { type: "String", name: "description" },
                                        { type: "String", name: "projectCategory" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "issuetype",
                                    struct: [{ type: "String", name: "name" }],
                                },
                                {
                                    type: "Object",
                                    name: "status",
                                    struct: [
                                        { type: "String", name: "description" },
                                        { type: "String", name: "iconUrl" },
                                        { type: "String", name: "id" },
                                        { type: "String", name: "name" },
                                        { type: "String", name: "self" },
                                        {
                                            type: "Object",
                                            name: "statusCategory",
                                            struct: [
                                                { type: "String", name: "colorName" },
                                                { type: "Long", name: "id" },
                                                { type: "String", name: "key" },
                                                { type: "String", name: "name" },
                                                { type: "String", name: "self" },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "reporter",
                                    struct: [
                                        { type: "String", name: "name" },
                                        { type: "String", name: "emailAddress" },
                                        { type: "String", name: "displayName" },
                                        { type: "String", name: "key" },
                                        { type: "Boolean", name: "active" },
                                    ],
                                },
                                { type: "String", name: "created" },
                                { type: "String", name: "updated" },
                                { type: "String", name: "resolutiondate" },
                                { type: "Long", name: "workratio" },
                                { type: "String", name: "duedate" },
                                {
                                    type: "Object",
                                    name: "progress",
                                    struct: [
                                        { type: "String", name: "total" },
                                        { type: "String", name: "progress" },
                                        { type: "String", name: "percent" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "votes",
                                    struct: [
                                        { type: "String", name: "self" },
                                        { type: "Long", name: "votes" },
                                        { type: "String", name: "hasVoted" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "aggregateprogress",
                                    struct: [
                                        { type: "String", name: "progress" },
                                        { type: "String", name: "total" },
                                        { type: "String", name: "percent" },
                                    ],
                                },
                                { type: "String", name: "subtasks" },
                                {
                                    type: "Object",
                                    name: "components",
                                    struct: [
                                        { type: "String", name: "id" },
                                        { type: "String", name: "name" },
                                    ],
                                },
                                { type: "String", name: "fixVersions" },
                                { type: "Long", name: "aggregatetimespent" },
                                { type: "Long", name: "timeestimate" },
                                { type: "Long", name: "timespent" },
                                { type: "Long", name: "aggregatetimeoriginalestimate" },
                                { type: "Long", name: "timeoriginalestimate" },
                                { type: "Long", name: "aggregatetimeestimate" },
                                {
                                    type: "Object",
                                    name: "resolution",
                                    struct: [
                                        { type: "String", name: "self" },
                                        { type: "String", name: "id" },
                                        { type: "String", name: "description" },
                                        { type: "String", name: "name" },
                                    ],
                                },
                                { type: "String", name: "labels" },
                                { type: "String", name: "summary" },
                                { type: "String", name: "issuelinks" },
                                { type: "String", name: "comment" },
                                ...u.type,
                            ],
                        },
                    ],
                    output:
                        ((o = s.issues),
                            (p = u),
                            o.map((e, t) => [
                                e.key ?? null,
                                e.id ?? null,
                                r(`${i.baseUrl}/issue/${e.key}/remotelink`),
                                {
                                    creator: {
                                        name: e.fields?.creator?.name ?? null,
                                        emailAddress: e.fields?.creator?.emailAddress ?? null,
                                        displayName: e.fields?.creator?.displayName ?? null,
                                        key: e.fields?.creator?.key ?? null,
                                        active:
                                            null != e.fields?.creator?.active
                                                ? `${e.fields.creator.active}`
                                                : null,
                                    },
                                    watches: {
                                        self: e.fields?.watches?.self
                                            ? JSON.stringify(e.fields.watches.self)
                                            : null,
                                        watchCount:
                                            null != e.fields?.watches?.watchCount
                                                ? JSON.stringify(e.fields.watches.watchCount)
                                                : null,
                                        isWatching:
                                            null != e.fields?.watches?.isWatching
                                                ? JSON.stringify(e.fields.watches.isWatching)
                                                : null,
                                    },
                                    assignee: {
                                        name: e.fields?.assignee?.name ?? null,
                                        emailAddress: e.fields?.assignee?.emailAddress ?? null,
                                        displayName: e.fields?.assignee?.displayName ?? null,
                                        key: e.fields?.assignee?.key ?? null,
                                        active:
                                            null != e.fields?.assignee?.active
                                                ? `${e.fields.assignee.active}`
                                                : null,
                                    },
                                    description: e.fields?.description ?? null,
                                    parent: { id: e.fields?.parent?.id ?? null },
                                    priority: {
                                        id: e.fields?.priority?.id ?? null,
                                        name: e.fields?.priority?.name ?? null,
                                    },
                                    project: e.fields?.project
                                        ? {
                                            id:
                                                null != e.fields.project.id
                                                    ? `${e.fields.project.id}`
                                                    : null,
                                            key: e.fields.project.key ?? null,
                                            name: e.fields.project.name ?? null,
                                            description: e.fields.project.description ?? null,
                                            projectCategory:
                                                e.fields.project.projectCategory?.name ?? null,
                                        }
                                        : null,
                                    issuetype: { name: e.fields?.issuetype?.name ?? null },
                                    status: {
                                        description: e.fields?.status?.description ?? null,
                                        iconUrl: e.fields?.status?.iconUrl ?? null,
                                        id: e.fields?.status?.id ?? null,
                                        name: e.fields?.status?.name ?? null,
                                        self: e.fields?.status?.self ?? null,
                                        statusCategory: {
                                            colorName:
                                                e.fields?.status?.statusCategory?.colorName ?? null,
                                            id: e.fields?.status?.statusCategory?.id ?? null,
                                            key: e.fields?.status?.statusCategory?.key ?? null,
                                            name: e.fields?.status?.statusCategory?.name ?? null,
                                            self: e.fields?.status?.statusCategory?.self ?? null,
                                        },
                                    },
                                    reporter: {
                                        name: e.fields?.reporter?.name ?? null,
                                        emailAddress: e.fields?.reporter?.emailAddress ?? null,
                                        displayName: e.fields?.reporter?.displayName ?? null,
                                        key: e.fields?.reporter?.key ?? null,
                                        active: e.fields?.reporter?.active ?? !1,
                                    },
                                    created: e.fields?.created ?? null,
                                    updated: e.fields?.updated ?? null,
                                    resolutiondate: e.fields?.resolutiondate ?? null,
                                    workratio: e.fields?.workratio ?? null,
                                    duedate: e.fields?.duedate ? `${e.fields.duedate}` : null,
                                    progress: {
                                        total: e.fields?.progress?.total ?? null,
                                        progress: e.fields?.progress?.progress ?? null,
                                        percent: e.fields?.progress?.percent ?? null,
                                    },
                                    votes: {
                                        self: e.fields?.votes?.self
                                            ? JSON.stringify(e.fields.votes.self)
                                            : null,
                                        votes:
                                            null != e.fields?.votes?.votes
                                                ? JSON.stringify(e.fields.votes.votes)
                                                : null,
                                        hasVoted:
                                            null != e.fields?.votes?.hasVoted
                                                ? JSON.stringify(e.fields.votes.hasVoted)
                                                : null,
                                    },
                                    aggregateprogress: {
                                        total: e.fields?.aggregateprogress?.total ?? null,
                                        progress: e.fields?.aggregateprogress?.progress ?? null,
                                        percent: e.fields?.aggregateprogress?.percent ?? null,
                                    },
                                    subtasks: e.fields?.subtasks
                                        ? JSON.stringify(e.fields.subtasks)
                                        : null,
                                    components: {
                                        id: Array.isArray(e.fields?.components)
                                            ? JSON.stringify(e.fields.components.map((e) => e.id))
                                            : null,
                                        name: Array.isArray(e.fields?.components)
                                            ? JSON.stringify(e.fields.components.map((e) => e.name))
                                            : null,
                                    },
                                    fixVersions: Array.isArray(e.fields?.fixVersions)
                                        ? JSON.stringify(e.fields.fixVersions.map((e) => e.name))
                                        : null,
                                    aggregatetimespent: e.fields?.aggregatetimespent ?? null,
                                    timeestimate: e.fields?.timeestimate ?? e.fields.timeestimate,
                                    timespent: e.fields?.timespent ?? null,
                                    aggregatetimeoriginalestimate:
                                        e.fields?.aggregatetimeoriginalestimate ?? null,
                                    timeoriginalestimate:
                                        null != e.fields?.timeoriginalestimate
                                            ? `${e.fields.timeoriginalestimate}`
                                            : null,
                                    aggregatetimeestimate: e.fields?.aggregatetimeestimate ?? null,
                                    resolution: {
                                        self: e.fields?.resolution?.self ?? null,
                                        id: e.fields?.resolution?.id ?? null,
                                        description: e.fields?.resolution?.description ?? null,
                                        name: e.fields?.resolution?.name ?? null,
                                    },
                                    labels: Array.isArray(e.fields?.labels)
                                        ? JSON.stringify(e.fields.labels)
                                        : null,
                                    summary: e.fields?.summary ?? null,
                                    issuelinks: e.fields?.issuelinks
                                        ? JSON.stringify(e.fields.issuelinks)
                                        : null,
                                    comment: e.fields?.comment?.comments?.length
                                        ? JSON.stringify(
                                            e.fields.comment.comments.map((e) =>
                                                JSON.stringify({
                                                    id: null != e.id ? JSON.stringify(e.id) : null,
                                                    author: e.author?.name
                                                        ? JSON.stringify(e.author.name)
                                                        : null,
                                                    displayName: e.author?.displayName
                                                        ? JSON.stringify(e.author.displayName)
                                                        : null,
                                                    body: e.body ? JSON.stringify(e.body) : null,
                                                    created: e.created ? JSON.stringify(e.created) : null,
                                                }),
                                            ),
                                        )
                                        : null,
                                    ...Object.fromEntries(
                                        p.data[t]?.map((e, t) => [
                                            p.type[t]?.name ?? `custom_field_${t}`,
                                            e,
                                        ]) ?? [],
                                    ),
                                },
                            ])),
                    state: i.hasNext ? i : null,
                    hasNext: i.hasNext,
                };
                var o, p;
            },
        },
        GetIssueByKeys: {
            label: "Получить информацию о задаче",
            description:
                "Получает сведения о задаче: стандартные и пользовательские поля, сложные объекты и исторические данные",
            inputFields: [
                { key: "issueKey", label: "Ключ задачи", type: "text", required: !0 },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = { baseUrl: `${t.authData.connection_base_url}/rest/api/2` };
                function n(a) {
                    const n = e.request({
                        url: a,
                        method: "GET",
                        headers: { Authorization: t.authData.api_key },
                    });
                    if (n.status < 200 || n.status >= 300 || !n.response) return null;
                    const i = JSON.parse(new TextDecoder().decode(n.response));
                    return JSON.stringify(i);
                }
                const i = [
                    api.get(e, `${a.baseUrl}/issue/${t.inputData.issueKey}`, {
                        headers: { Authorization: t.authData.api_key },
                    }),
                ],
                    r = [
                        "key",
                        "id",
                        "creator",
                        "watches",
                        "assignee",
                        "description",
                        "parent",
                        "priority",
                        "project",
                        "issuetype",
                        "status",
                        "reporter",
                        "created",
                        "updated",
                        "resolutiondate",
                        "workratio",
                        "duedate",
                        "progress",
                        "votes",
                        "aggregateprogress",
                        "subtasks",
                        "components",
                        "fixVersions",
                        "aggregatetimespent",
                        "timespent",
                        "timeestimate",
                        "aggregatetimeoriginalestimate",
                        "timeoriginalestimate",
                        "aggregatetimeestimate",
                        "resolution",
                        "labels",
                        "summary",
                        "issuelinks",
                        "comment",
                    ],
                    s = processJiraData(
                        api
                            .get(e, `${a.baseUrl}/field`, {
                                headers: { Authorization: t.authData.api_key },
                            })
                            .filter((e) => e.custom || !r.includes(e.id)),
                        i,
                    );
                return {
                    output:
                        ((l = i),
                            (u = s),
                            l.map((e, t) => [
                                e.key ?? null,
                                e.id ?? null,
                                n(`${a.baseUrl}/issue/${e.key}/remotelink`),
                                {
                                    creator: {
                                        name: e.fields?.creator?.name ?? null,
                                        emailAddress: e.fields?.creator?.emailAddress ?? null,
                                        displayName: e.fields?.creator?.displayName ?? null,
                                        key: e.fields?.creator?.key ?? null,
                                        active:
                                            null != e.fields?.creator?.active
                                                ? `${e.fields.creator.active}`
                                                : null,
                                    },
                                    watches: {
                                        self: e.fields?.watches?.self
                                            ? JSON.stringify(e.fields.watches.self)
                                            : null,
                                        watchCount:
                                            null != e.fields?.watches?.watchCount
                                                ? JSON.stringify(e.fields.watches.watchCount)
                                                : null,
                                        isWatching:
                                            null != e.fields?.watches?.isWatching
                                                ? JSON.stringify(e.fields.watches.isWatching)
                                                : null,
                                    },
                                    assignee: {
                                        name: e.fields?.assignee?.name ?? null,
                                        emailAddress: e.fields?.assignee?.emailAddress ?? null,
                                        displayName: e.fields?.assignee?.displayName ?? null,
                                        key: e.fields?.assignee?.key ?? null,
                                        active:
                                            null != e.fields?.assignee?.active
                                                ? `${e.fields.assignee.active}`
                                                : null,
                                    },
                                    description: e.fields?.description ?? null,
                                    parent: { id: e.fields?.parent?.id ?? null },
                                    priority: {
                                        id: e.fields?.priority?.id ?? null,
                                        name: e.fields?.priority?.name ?? null,
                                    },
                                    project: e.fields?.project
                                        ? {
                                            id:
                                                null != e.fields.project.id
                                                    ? `${e.fields.project.id}`
                                                    : null,
                                            key: e.fields.project.key ?? null,
                                            name: e.fields.project.name ?? null,
                                            description: e.fields.project.description ?? null,
                                            projectCategory:
                                                e.fields.project.projectCategory?.name ?? null,
                                        }
                                        : null,
                                    issuetype: { name: e.fields?.issuetype?.name ?? null },
                                    status: {
                                        description: e.fields?.status?.description ?? null,
                                        iconUrl: e.fields?.status?.iconUrl ?? null,
                                        id: e.fields?.status?.id ?? null,
                                        name: e.fields?.status?.name ?? null,
                                        self: e.fields?.status?.self ?? null,
                                        statusCategory: {
                                            colorName:
                                                e.fields?.status?.statusCategory?.colorName ?? null,
                                            id: e.fields?.status?.statusCategory?.id ?? null,
                                            key: e.fields?.status?.statusCategory?.key ?? null,
                                            name: e.fields?.status?.statusCategory?.name ?? null,
                                            self: e.fields?.status?.statusCategory?.self ?? null,
                                        },
                                    },
                                    reporter: {
                                        name: e.fields?.reporter?.name ?? null,
                                        emailAddress: e.fields?.reporter?.emailAddress ?? null,
                                        displayName: e.fields?.reporter?.displayName ?? null,
                                        key: e.fields?.reporter?.key ?? null,
                                        active: e.fields?.reporter?.active ?? !1,
                                    },
                                    created: e.fields?.created ?? null,
                                    updated: e.fields?.updated ?? null,
                                    resolutiondate: e.fields?.resolutiondate ?? null,
                                    workratio: e.fields?.workratio ?? null,
                                    duedate: e.fields?.duedate ? `${e.fields.duedate}` : null,
                                    progress: {
                                        total: e.fields?.progress?.total ?? null,
                                        progress: e.fields?.progress?.progress ?? null,
                                        percent: e.fields?.progress?.percent ?? null,
                                    },
                                    votes: {
                                        self: e.fields?.votes?.self
                                            ? JSON.stringify(e.fields.votes.self)
                                            : null,
                                        votes:
                                            null != e.fields?.votes?.votes
                                                ? JSON.stringify(e.fields.votes.votes)
                                                : null,
                                        hasVoted:
                                            null != e.fields?.votes?.hasVoted
                                                ? JSON.stringify(e.fields.votes.hasVoted)
                                                : null,
                                    },
                                    aggregateprogress: {
                                        total: e.fields?.aggregateprogress?.total ?? null,
                                        progress: e.fields?.aggregateprogress?.progress ?? null,
                                        percent: e.fields?.aggregateprogress?.percent ?? null,
                                    },
                                    subtasks: e.fields?.subtasks
                                        ? JSON.stringify(e.fields.subtasks)
                                        : null,
                                    components: {
                                        id: Array.isArray(e.fields?.components)
                                            ? JSON.stringify(e.fields.components.map((e) => e.id))
                                            : null,
                                        name: Array.isArray(e.fields?.components)
                                            ? JSON.stringify(e.fields.components.map((e) => e.name))
                                            : null,
                                    },
                                    fixVersions: Array.isArray(e.fields?.fixVersions)
                                        ? JSON.stringify(e.fields.fixVersions.map((e) => e.name))
                                        : null,
                                    aggregatetimespent: e.fields?.aggregatetimespent ?? null,
                                    timeestimate: e.fields?.timeestimate ?? e.fields.timeestimate,
                                    timespent: e.fields?.timespent ?? null,
                                    aggregatetimeoriginalestimate:
                                        e.fields?.aggregatetimeoriginalestimate ?? null,
                                    timeoriginalestimate:
                                        null != e.fields?.timeoriginalestimate
                                            ? `${e.fields.timeoriginalestimate}`
                                            : null,
                                    aggregatetimeestimate: e.fields?.aggregatetimeestimate ?? null,
                                    resolution: {
                                        self: e.fields?.resolution?.self ?? null,
                                        id: e.fields?.resolution?.id ?? null,
                                        description: e.fields?.resolution?.description ?? null,
                                        name: e.fields?.resolution?.name ?? null,
                                    },
                                    labels: Array.isArray(e.fields?.labels)
                                        ? JSON.stringify(e.fields.labels)
                                        : null,
                                    summary: e.fields?.summary ?? null,
                                    issuelinks: e.fields?.issuelinks
                                        ? JSON.stringify(e.fields.issuelinks)
                                        : null,
                                    comment: e.fields?.comment?.comments?.length
                                        ? JSON.stringify(
                                            e.fields.comment.comments.map((e) =>
                                                JSON.stringify({
                                                    id: null != e.id ? JSON.stringify(e.id) : null,
                                                    author: e.author?.name
                                                        ? JSON.stringify(e.author.name)
                                                        : null,
                                                    displayName: e.author?.displayName
                                                        ? JSON.stringify(e.author.displayName)
                                                        : null,
                                                    body: e.body ? JSON.stringify(e.body) : null,
                                                    created: e.created ? JSON.stringify(e.created) : null,
                                                }),
                                            ),
                                        )
                                        : null,
                                    ...Object.fromEntries(
                                        u.data[t]?.map((e, t) => [
                                            u.type[t]?.name ?? `custom_field_${t}`,
                                            e,
                                        ]) ?? [],
                                    ),
                                },
                            ])),
                    output_variables: [
                        { type: "String", name: "key" },
                        { type: "String", name: "id" },
                        { type: "String", name: "remoteLink" },
                        {
                            type: "Object",
                            name: "fields",
                            struct: [
                                {
                                    type: "Object",
                                    name: "creator",
                                    struct: [
                                        { type: "String", name: "name" },
                                        { type: "String", name: "emailAddress" },
                                        { type: "String", name: "displayName" },
                                        { type: "String", name: "key" },
                                        { type: "String", name: "active" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "watches",
                                    struct: [
                                        { type: "String", name: "self" },
                                        { type: "String", name: "watchCount" },
                                        { type: "String", name: "isWatching" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "assignee",
                                    struct: [
                                        { type: "String", name: "name" },
                                        { type: "String", name: "emailAddress" },
                                        { type: "String", name: "displayName" },
                                        { type: "String", name: "key" },
                                        { type: "String", name: "active" },
                                    ],
                                },
                                { type: "String", name: "description" },
                                {
                                    type: "Object",
                                    name: "parent",
                                    struct: [{ type: "String", name: "id" }],
                                },
                                {
                                    type: "Object",
                                    name: "priority",
                                    struct: [
                                        { type: "String", name: "id" },
                                        { type: "String", name: "name" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "project",
                                    struct: [
                                        { type: "String", name: "id" },
                                        { type: "String", name: "key" },
                                        { type: "String", name: "name" },
                                        { type: "String", name: "description" },
                                        { type: "String", name: "projectCategory" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "issuetype",
                                    struct: [{ type: "String", name: "name" }],
                                },
                                {
                                    type: "Object",
                                    name: "status",
                                    struct: [
                                        { type: "String", name: "description" },
                                        { type: "String", name: "iconUrl" },
                                        { type: "String", name: "id" },
                                        { type: "String", name: "name" },
                                        { type: "String", name: "self" },
                                        {
                                            type: "Object",
                                            name: "statusCategory",
                                            struct: [
                                                { type: "String", name: "colorName" },
                                                { type: "Long", name: "id" },
                                                { type: "String", name: "key" },
                                                { type: "String", name: "name" },
                                                { type: "String", name: "self" },
                                            ],
                                        },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "reporter",
                                    struct: [
                                        { type: "String", name: "name" },
                                        { type: "String", name: "emailAddress" },
                                        { type: "String", name: "displayName" },
                                        { type: "String", name: "key" },
                                        { type: "Boolean", name: "active" },
                                    ],
                                },
                                { type: "String", name: "created" },
                                { type: "String", name: "updated" },
                                { type: "String", name: "resolutiondate" },
                                { type: "Long", name: "workratio" },
                                { type: "String", name: "duedate" },
                                {
                                    type: "Object",
                                    name: "progress",
                                    struct: [
                                        { type: "String", name: "total" },
                                        { type: "String", name: "progress" },
                                        { type: "String", name: "percent" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "votes",
                                    struct: [
                                        { type: "String", name: "self" },
                                        { type: "Long", name: "votes" },
                                        { type: "String", name: "hasVoted" },
                                    ],
                                },
                                {
                                    type: "Object",
                                    name: "aggregateprogress",
                                    struct: [
                                        { type: "String", name: "progress" },
                                        { type: "String", name: "total" },
                                        { type: "String", name: "percent" },
                                    ],
                                },
                                { type: "String", name: "subtasks" },
                                {
                                    type: "Object",
                                    name: "components",
                                    struct: [
                                        { type: "String", name: "id" },
                                        { type: "String", name: "name" },
                                    ],
                                },
                                { type: "String", name: "fixVersions" },
                                { type: "Long", name: "aggregatetimespent" },
                                { type: "Long", name: "timeestimate" },
                                { type: "Long", name: "timespent" },
                                { type: "Long", name: "aggregatetimeoriginalestimate" },
                                { type: "Long", name: "timeoriginalestimate" },
                                { type: "Long", name: "aggregatetimeestimate" },
                                {
                                    type: "Object",
                                    name: "resolution",
                                    struct: [
                                        { type: "String", name: "self" },
                                        { type: "String", name: "id" },
                                        { type: "String", name: "description" },
                                        { type: "String", name: "name" },
                                    ],
                                },
                                { type: "String", name: "labels" },
                                { type: "String", name: "summary" },
                                { type: "String", name: "issuelinks" },
                                { type: "String", name: "comment" },
                                ...s.type,
                            ],
                        },
                    ],
                    state: a,
                    hasNext: !1,
                };
                var l, u;
            },
        },
        ChangeLog: {
            label: "Получить журнал изменений",
            description:
                "Возвращает журнал изменений задач, соответствующих JQL-фильтру",
            inputFields: [
                { key: "jql", type: "text", label: "JQL-запрос", required: !0 },
            ],
            executePagination: (e, t, a) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const n = {
                    baseUrl: `${t.authData.connection_base_url}/rest/api/2`,
                    page: null != a ? a.page + 1 : 0,
                    limit: 50,
                    startAt: null != a ? (a.page + 1) * a.limit : 0,
                    hasNext: !0,
                },
                    i = api.get(
                        e,
                        `${n.baseUrl}/search?jql=${encodeURIComponent(t.inputData.jql)}&startAt=${n.startAt}&maxResults=${n.limit}&expand=changelog&fields=none`,
                        { headers: { Authorization: t.authData.api_key } },
                    );
                return (
                    i.total - i.maxResults * (n.page + 1) <= 0 && (n.hasNext = !1),
                    {
                        output: (function (e) {
                            const t = [];
                            return (
                                e.forEach((e) => {
                                    e.changelog.histories.forEach((a) => {
                                        const n = {
                                            issue_id: e.id,
                                            key: e.key,
                                            created: a.created,
                                            history_id: a.id,
                                            author: {
                                                emailAddress: a.author ? a.author.emailAddress : "",
                                                name: a.author ? a.author.name : "",
                                                displayName: a.author ? a.author.displayName : "",
                                                active: a.author ? a.author.active : null,
                                                key: a.author ? a.author.key : "",
                                            },
                                        },
                                            i = a.items.map((e) => ({
                                                toString: e.toString ? e.toString : null,
                                                from: e.from ? e.from : null,
                                                fromString: e.fromString ? e.fromString : null,
                                                to: e.to ? e.to : null,
                                                field: e.field ? e.field : null,
                                                fieldtype: e.fieldtype ? e.fieldtype : null,
                                            }));
                                        t.push([
                                            n.issue_id,
                                            n.key,
                                            n.created,
                                            n.history_id,
                                            n.author,
                                            i,
                                        ]);
                                    });
                                }),
                                t
                            );
                        })(i.issues),
                        output_variables: [
                            { type: "String", name: "issue_id" },
                            { type: "String", name: "key" },
                            { type: "String", name: "created" },
                            { type: "String", name: "history_id" },
                            {
                                type: "Object",
                                name: "author",
                                struct: [
                                    { type: "String", name: "emailAddress" },
                                    { type: "String", name: "name" },
                                    { type: "String", name: "displayName" },
                                    { type: "Boolean", name: "active" },
                                    { type: "String", name: "key" },
                                ],
                            },
                            {
                                name: "items",
                                type: "ObjectArray",
                                struct: [
                                    { name: "field", type: "String" },
                                    { name: "fieldtype", type: "String" },
                                    { name: "from", type: "String" },
                                    { name: "fromString", type: "String" },
                                    { name: "to", type: "String" },
                                    { name: "toString", type: "String" },
                                ],
                            },
                        ],
                        state: n,
                        hasNext: n.hasNext,
                    }
                );
            },
        },
        WorkLog: {
            label: "Получить журнал работ",
            description: "Возвращает журнал работ по задаче",
            inputFields: [
                { key: "jql", type: "text", label: "JQL-запрос", required: !0 },
            ],
            executePagination: (e, t, a) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const n = {
                    baseUrl: `${t.authData.connection_base_url}/rest/api/2`,
                    page: null != a ? a.page + 1 : 0,
                    limit: 50,
                    startAt: null != a ? (a.page + 1) * a.limit : 0,
                    hasNext: !0,
                };
                function i(e, t) {
                    return e.map((e) => {
                        const a = {
                            id: e.id,
                            issue_key: t,
                            issueId: e.issueId,
                            timeSpentSeconds: e.timeSpentSeconds,
                            created: e.created,
                            started: e.started,
                            updated: e.updated,
                            author: {
                                name: e.author.name,
                                displayName: e.author.displayName,
                                emailAddress: e.author.emailAddress,
                            },
                            updateAuthor: {
                                name: e.updateAuthor.name,
                                displayName: e.updateAuthor.displayName,
                                emailAddress: e.updateAuthor.emailAddress,
                            },
                            comment: e.comment ? e.comment : "",
                        };
                        return [
                            a.id,
                            a.issue_key,
                            a.issueId,
                            a.timeSpentSeconds,
                            a.created,
                            a.started,
                            a.updated,
                            a.author,
                            a.updateAuthor,
                            a.comment,
                        ];
                    });
                }
                function r() {
                    const a = api.get(
                        e,
                        `${n.baseUrl}/search?jql=${encodeURIComponent(t.inputData.jql)}&startAt=${n.startAt}&maxResults=${n.limit}&fields=none`,
                        { headers: { Authorization: t.authData.api_key } },
                    ),
                        r = (function (a) {
                            const r = [];
                            return (
                                a.issues
                                    .map((e) => e.key)
                                    .map((a) => {
                                        try {
                                            const s = api.get(e, `${n.baseUrl}/issue/${a}/worklog`, {
                                                headers: { Authorization: t.authData.api_key },
                                            });
                                            if (s) {
                                                const e = i(s.worklogs, a);
                                                r.push(...e);
                                            }
                                        } catch {
                                            !(function () {
                                                const e = Date.now();
                                                for (; Date.now() - e < 1e3;);
                                            })();
                                            try {
                                                const s = api.get(
                                                    e,
                                                    `${n.baseUrl}/issue/${a}/worklog`,
                                                    { headers: { Authorization: t.authData.api_key } },
                                                );
                                                if (s) {
                                                    const e = i(s.worklogs, a);
                                                    r.push(...e);
                                                }
                                            } catch (t) {
                                                e.stringError(JSON.stringify(t));
                                            }
                                        }
                                    }),
                                r
                            );
                        })(a);
                    return (
                        a.total - a.maxResults * (n.page + 1) <= 0 && (n.hasNext = !1),
                        r
                    );
                }
                let s = r();
                for (; n.hasNext && s.length < 1;)
                    ((s = r()), s && (n.page++, (n.startAt += 50)));
                return {
                    output: s,
                    output_variables: [
                        { type: "String", name: "id" },
                        { type: "String", name: "issue_key" },
                        { type: "String", name: "issueId" },
                        { type: "Long", name: "timeSpentSeconds" },
                        { type: "String", name: "created" },
                        { type: "String", name: "started" },
                        { type: "String", name: "updated" },
                        {
                            type: "Object",
                            name: "author",
                            struct: [
                                { type: "String", name: "name" },
                                { type: "String", name: "displayName" },
                                { type: "String", name: "emailAddress" },
                            ],
                        },
                        {
                            type: "Object",
                            name: "updateAuthor",
                            struct: [
                                { type: "String", name: "name" },
                                { type: "String", name: "displayName" },
                                { type: "String", name: "emailAddress" },
                            ],
                        },
                        { type: "String", name: "comment" },
                    ],
                    state: n,
                    hasNext: n.hasNext,
                };
            },
        },
        CreateIssue: {
            label: "Создать задачу",
            description: "Создает новую задачу",
            inputFields: [
                (e, t) => {
                    if (
                        !t.authData ||
                        !t.authData.connection_base_url ||
                        !t.authData.api_key
                    )
                        return [];
                    try {
                        const a = api
                            .get(e, `${t.authData.connection_base_url}/rest/api/2/project`, {
                                headers: { Authorization: t.authData.api_key },
                            })
                            .map((e) => e.key);
                        return Array.isArray(a)
                            ? [
                                {
                                    key: "project",
                                    type: "select",
                                    label: "Ключ проекта",
                                    required: !0,
                                    options: a,
                                },
                            ]
                            : [];
                    } catch {
                        return [];
                    }
                },
                (e, t) => {
                    if (
                        !(
                            t.authData &&
                            t.authData.connection_base_url &&
                            t.authData.api_key &&
                            t.inputData.project
                        )
                    )
                        return [];
                    try {
                        const a = api.get(
                            e,
                            `${t.authData.connection_base_url}/rest/api/2/project/${t.inputData.project}`,
                            { headers: { Authorization: t.authData.api_key } },
                        );
                        return Array.isArray(a.issueTypes)
                            ? [
                                {
                                    key: "issuetype_id",
                                    type: "select",
                                    label: "Тип задачи",
                                    required: !0,
                                    options: a.issueTypes.map((e) => ({
                                        value: e.id,
                                        label: e.name,
                                    })),
                                },
                            ]
                            : [];
                    } catch {
                        return [];
                    }
                },
                (e, t) => {
                    if (
                        !(
                            t.authData &&
                            t.authData.connection_base_url &&
                            t.authData.api_key &&
                            t.inputData.project &&
                            t.inputData.issuetype_id
                        )
                    )
                        return [];
                    try {
                        const n = api.get(
                            e,
                            `${t.authData.connection_base_url}/rest/api/2/issue/createmeta/${t.inputData.project}/issuetypes/${t.inputData.issuetype_id}?maxResults=200`,
                            { headers: { Authorization: t.authData.api_key } },
                        );
                        function a(e) {
                            const {
                                schema: t,
                                allowedValues: a = [],
                                operations: n = [],
                            } = e;
                            return ["string", "date", "datetime"].includes(t.type)
                                ? "text"
                                : "number" === t.type
                                    ? "number"
                                    : ("option" === t.type &&
                                        n.includes("add") &&
                                        n.includes("remove")) ||
                                        ("array" === t.type && "option" === t.items)
                                        ? "text"
                                        : a.length > 1
                                            ? n.includes("set") &&
                                                n.includes("add") &&
                                                n.includes("remove")
                                                ? "text"
                                                : "select"
                                            : "text";
                        }
                        return n && Array.isArray(n.values)
                            ? n.values
                                .filter(
                                    (e) => "issuetype" !== e.fieldId && "project" !== e.fieldId,
                                )
                                .map((e) => ({
                                    key: e.fieldId,
                                    type: a(e),
                                    label: e.name,
                                    required: e.required,
                                    ...(e.allowedValues &&
                                        "array" !== e.schema.type && {
                                        options: e.allowedValues.map((e) => ({
                                            value: e.value ?? `$$$id_${e.id}`,
                                            label: e.value ?? e.name,
                                        })),
                                    }),
                                }))
                            : [];
                    } catch {
                        return [];
                    }
                },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = { baseUrl: `${t.authData.connection_base_url}/rest/api/2` };
                let n;
                function i(a) {
                    return api.get(e, a, {
                        headers: { Authorization: t.authData.api_key },
                    });
                }
                function r(e, t) {
                    const { type: a, items: i } = e;
                    switch (a) {
                        case "string":
                        case "text":
                            return String(t);
                        case "number":
                        case "float":
                            return Number(t);
                        case "date":
                        case "datetime":
                            return String(t);
                        case "user":
                        case "priority":
                        case "issuetype":
                        case "project":
                        case "version":
                        case "component":
                            return "object" == typeof t ? t : { name: t };
                        case "option":
                            return { value: t };
                        case "array": {
                            if ("worklog" === i) return void (n = Number(t));
                            let e = [];
                            if ("string" == typeof t)
                                e = t
                                    .split(",")
                                    .map((e) => e.trim())
                                    .filter(Boolean);
                            else {
                                if (!Array.isArray(t)) return [];
                                e = t;
                            }
                            switch (i) {
                                case "option":
                                    return e.map((e) =>
                                        e.startsWith("$$$id_")
                                            ? { id: parseTagID(e) }
                                            : { value: e },
                                    );
                                case "component":
                                case "version":
                                    return e.map((e) => ("object" == typeof e ? e : { name: e }));
                                default:
                                    return e;
                            }
                        }
                        default:
                            return t;
                    }
                }
                const s = i(
                    `${a.baseUrl}/issue/createmeta/${t.inputData.project}/issuetypes`,
                ).values.find((e) => e.id === t.inputData.issuetype_id).id,
                    l = i(
                        `${a.baseUrl}/issue/createmeta/${t.inputData.project}/issuetypes/${s}`,
                    ).values,
                    u = (function (e, a) {
                        const n = {};
                        for (const i in e) {
                            const s = e[i];
                            switch (i) {
                                case "project":
                                    n.project = { key: s };
                                    break;
                                case "issuetype_id":
                                    n.issuetype = { id: t.inputData.issuetype_id };
                                    break;
                                case "assignee":
                                    n.assignee = { name: s };
                                    break;
                                case "reporter":
                                    n.reporter = { name: s };
                                    break;
                                case "priority":
                                    n.priority = Number(parseTagID(s))
                                        ? { id: parseTagID(s) }
                                        : { name: parseTagID(s) };
                                    break;
                                case "fixVersions":
                                    n.fixVersions = Array.isArray(s)
                                        ? s.map((e) => ({ name: e }))
                                        : s.split(/\s*,\s*/).map((e) => ({ name: e }));
                                    break;
                                case "security":
                                    n.security = Number(parseTagID(s))
                                        ? { id: parseTagID(s) }
                                        : { name: parseTagID(s) };
                                    break;
                                default: {
                                    const e = a.find((e) => e.fieldId === i);
                                    e && (n[i] = r(e.schema, s));
                                    break;
                                }
                            }
                        }
                        return { fields: n };
                    })(t.inputData, l),
                    o = api.post(e, `${a.baseUrl}/issue`, {
                        headers: { Authorization: t.authData.api_key },
                        body: JSON.stringify(u),
                    });
                if (n)
                    try {
                        api.post(e, `${a.baseUrl}/issue/${o.key}/worklog`, {
                            headers: { Authorization: t.authData.api_key },
                            body: JSON.stringify({ timeSpentSeconds: n >= 60 ? n : 60 }),
                            isParse: !1,
                            getStatus: !0,
                        });
                    } catch {
                        try {
                            const i = new Date().getTime() + 2e3;
                            for (; new Date().getTime() < i;);
                            api.post(e, `${a.baseUrl}/issue/${o.key}/worklog`, {
                                headers: { Authorization: t.authData.api_key },
                                body: JSON.stringify({ timeSpentSeconds: n >= 60 ? n : 60 }),
                                isParse: !1,
                                getStatus: !0,
                            });
                        } finally {
                        }
                    }
                return {
                    output: [[o.id, o.key, o.self]],
                    output_variables: [
                        { type: "String", name: "id" },
                        { type: "String", name: "key" },
                        { type: "String", name: "self" },
                    ],
                    state: a,
                    hasNext: !1,
                };
            },
        },
        EditIssue: {
            label: "Редактировать задачу",
            description: "Редактирует указанную задачу",
            inputFields: [
                (e, t) => {
                    if (
                        !t.authData ||
                        !t.authData.connection_base_url ||
                        !t.authData.api_key
                    )
                        return [];
                    try {
                        const a = api
                            .get(e, `${t.authData.connection_base_url}/rest/api/2/project`, {
                                headers: { Authorization: t.authData.api_key },
                            })
                            .map((e) => e.key);
                        return Array.isArray(a)
                            ? [
                                {
                                    key: "project",
                                    type: "select",
                                    label: "Ключ проекта",
                                    required: !0,
                                    options: a,
                                },
                            ]
                            : [];
                    } catch {
                        return [];
                    }
                },
                (e, t) => {
                    if (
                        !(
                            t.authData &&
                            t.authData.connection_base_url &&
                            t.authData.api_key &&
                            t.inputData.project
                        )
                    )
                        return [];
                    try {
                        const a = api
                            .get(
                                e,
                                `${t.authData.connection_base_url}/rest/api/2/project/${t.inputData.project}`,
                                { headers: { Authorization: t.authData.api_key } },
                            )
                            .issueTypes.map((e) => ({ name: e.name, id: e.id }));
                        return Array.isArray(a)
                            ? [
                                {
                                    key: "issuetype_id",
                                    type: "select",
                                    label: "Тип задачи",
                                    required: !0,
                                    options: a.map((e) => ({ value: e.id, label: e.name })),
                                },
                            ]
                            : [];
                    } catch {
                        return [];
                    }
                },
                (e, t) =>
                    t.authData &&
                        t.authData.connection_base_url &&
                        t.authData.api_key &&
                        t.inputData.project &&
                        t.inputData.issuetype_id
                        ? {
                            key: "issueKey",
                            type: "text",
                            label: "Ключ редактируемой задачи",
                            required: !0,
                        }
                        : [],
                (e, t) => {
                    if (
                        !(
                            t.authData &&
                            t.authData.connection_base_url &&
                            t.authData.api_key &&
                            t.inputData.project &&
                            t.inputData.issuetype_id
                        )
                    )
                        return [];
                    try {
                        const n = api.get(
                            e,
                            `${t.authData.connection_base_url}/rest/api/2/issue/createmeta/${t.inputData.project}/issuetypes/${t.inputData.issuetype_id}`,
                            { headers: { Authorization: t.authData.api_key } },
                        );
                        function a(e) {
                            const {
                                schema: t,
                                allowedValues: a = [],
                                operations: n = [],
                            } = e;
                            return ["string", "date", "datetime"].includes(t.type)
                                ? "text"
                                : "number" === t.type
                                    ? "number"
                                    : ("option" === t.type &&
                                        n.includes("add") &&
                                        n.includes("remove")) ||
                                        ("array" === t.type && "option" === t.items)
                                        ? "text"
                                        : a.length > 1
                                            ? n.includes("set") &&
                                                n.includes("add") &&
                                                n.includes("remove")
                                                ? "text"
                                                : "select"
                                            : "text";
                        }
                        if (n)
                            return Array.isArray(n.values)
                                ? n.values
                                    .filter(
                                        (e) =>
                                            "issuetype" !== e.fieldId && "project" !== e.fieldId,
                                    )
                                    .map((e) => ({
                                        key: e.fieldId,
                                        type: a(e),
                                        label: e.name,
                                        ...(e.allowedValues &&
                                            "array" !== e.schema.type && {
                                            options: e.allowedValues.map((e) => ({
                                                value: e.value ?? `$$$id_${e.id}`,
                                                label: e.value ?? e.name,
                                            })),
                                        }),
                                    }))
                                : [];
                    } catch {
                        return [];
                    }
                },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = { baseUrl: `${t.authData.connection_base_url}/rest/api/2` };
                let n;
                function i(a) {
                    return api.get(e, a, {
                        headers: { Authorization: t.authData.api_key },
                    });
                }
                function r(e, t) {
                    const { type: a, items: i } = e;
                    switch (a) {
                        case "string":
                        case "text":
                            return String(t);
                        case "number":
                        case "float":
                            return Number(t);
                        case "date":
                        case "datetime":
                            return String(t);
                        case "user":
                        case "priority":
                        case "issuetype":
                        case "project":
                        case "version":
                        case "component":
                            return "object" == typeof t ? t : { name: t };
                        case "option":
                            return { value: t };
                        case "array": {
                            if ("worklog" === i) return void (n = Number(t));
                            let e = [];
                            if ("string" == typeof t)
                                e = t
                                    .split(",")
                                    .map((e) => e.trim())
                                    .filter(Boolean);
                            else {
                                if (!Array.isArray(t)) return [];
                                e = t;
                            }
                            switch (i) {
                                case "option":
                                    return e.map((e) =>
                                        e.startsWith("$$$id_")
                                            ? { id: parseTagID(e) }
                                            : { value: e },
                                    );
                                case "component":
                                case "version":
                                    return e.map((e) => ("object" == typeof e ? e : { name: e }));
                                default:
                                    return e;
                            }
                        }
                        default:
                            return t;
                    }
                }
                const s = i(`${a.baseUrl}/issue/${t.inputData.issueKey}`).fields,
                    l = i(
                        `${a.baseUrl}/issue/createmeta/${s.project.key}/issuetypes/${s.issuetype.id}`,
                    ).values,
                    u = (function (e, t) {
                        const a = {};
                        for (const n in e) {
                            const i = e[n];
                            switch (n) {
                                case "project":
                                    break;
                                case "assignee":
                                    a.assignee = { name: i };
                                    break;
                                case "reporter":
                                    a.reporter = { name: i };
                                    break;
                                case "priority":
                                    a.priority = Number(parseTagID(i))
                                        ? { id: parseTagID(i) }
                                        : { name: parseTagID(i) };
                                    break;
                                case "fixVersions":
                                    a.fixVersions = Array.isArray(i)
                                        ? i.map((e) => ({ name: e }))
                                        : i.split(/\s*,\s*/).map((e) => ({ name: e }));
                                    break;
                                case "security":
                                    a.security = Number(parseTagID(i))
                                        ? { id: parseTagID(i) }
                                        : { name: parseTagID(i) };
                                    break;
                                default: {
                                    const e = t.find((e) => e.fieldId === n);
                                    e && (a[n] = r(e.schema, i));
                                    break;
                                }
                            }
                        }
                        return { fields: a };
                    })(t.inputData, l),
                    o = api.put(e, `${a.baseUrl}/issue/${t.inputData.issueKey}`, {
                        headers: { Authorization: t.authData.api_key },
                        body: JSON.stringify(u),
                        isParse: !1,
                        getStatus: !0,
                    });
                if (n)
                    try {
                        api.post(e, `${a.baseUrl}/issue/${t.inputData.issueKey}/worklog`, {
                            headers: { Authorization: t.authData.api_key },
                            body: JSON.stringify({ timeSpentSeconds: n >= 60 ? n : 60 }),
                            isParse: !1,
                            getStatus: !0,
                        });
                    } catch {
                        try {
                            const i = new Date().getTime() + 2e3;
                            for (; new Date().getTime() < i;);
                            api.post(
                                e,
                                `${a.baseUrl}/issue/${t.inputData.issueKey}/worklog`,
                                {
                                    headers: { Authorization: t.authData.api_key },
                                    body: JSON.stringify({ timeSpentSeconds: n >= 60 ? n : 60 }),
                                    isParse: !1,
                                    getStatus: !0,
                                },
                            );
                        } finally {
                        }
                    }
                return {
                    output: [[o, o >= 200 && o < 300, t.inputData.issueKey]],
                    output_variables: [
                        { type: "Long", name: "status" },
                        { type: "Boolean", name: "editCompelete" },
                        { type: "String", name: "issuekey" },
                    ],
                    state: a,
                    hasNext: !1,
                };
            },
        },
        DeleteIssue: {
            label: "Удалить задачу",
            description: "Удаляет задачу в Jira",
            inputFields: [
                { key: "issue_key", type: "text", label: "Ключ задачи", required: !0 },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = `${t.authData.connection_base_url}/rest/api/2`;
                return {
                    output: (function (n) {
                        const i = api.delete(e, `${a}/issue/${n}`, {
                            headers: { Authorization: t.authData.api_key },
                            isParse: !1,
                            getStatus: !0,
                        });
                        return i >= 200 && i < 300
                            ? [[`Задача ${t.inputData.issue_key} была удалена`]]
                            : [[`Задача ${t.inputData.issue_key} не была удалена`]];
                    })(t.inputData.issue_key),
                    output_variables: [{ type: "String", name: "status" }],
                    state: void 0,
                    hasNext: !1,
                };
            },
        },
        AddWatcher: {
            label: "Добавить наблюдателя",
            description: "Добавляет пользователя в список наблюдателей задачи",
            inputFields: [
                { key: "issue_key", type: "text", label: "Ключ задачи", required: !0 },
                {
                    key: "watcher",
                    type: "text",
                    label: "Сотрудник",
                    hint: "Пример: example@test.com",
                    required: !0,
                },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = `${t.authData.connection_base_url}/rest/api/2`;
                return {
                    output: [
                        [
                            204 ===
                            (function (n, i) {
                                if (!i) throw new Error("Незаполненное поле: Сотрудник");
                                if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i))
                                    throw new Error("Email сотрудника не корректен");
                                return api.post(e, `${a}/issue/${n}/watchers`, {
                                    headers: { Authorization: t.authData.api_key },
                                    body: JSON.stringify(i),
                                    isParse: !1,
                                    getStatus: !0,
                                });
                            })(t.inputData.issue_key, t.inputData.watcher),
                            t.inputData.watcher,
                            t.inputData.issue_key,
                        ],
                    ],
                    output_variables: [
                        { type: "Boolean", name: "status" },
                        { type: "String", name: "email" },
                        { type: "String", name: "issue-key" },
                    ],
                    state: void 0,
                    hasNext: !1,
                };
            },
        },
        AddComment: {
            label: "Добавить комментарий",
            description: "Добавляет комментарий к задаче Jira",
            inputFields: [
                { key: "issue_key", type: "text", label: "Ключ задачи", required: !0 },
                { key: "comment", type: "text", label: "Комментарий", required: !0 },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = `${t.authData.connection_base_url}/rest/api/2`,
                    n = (function (n, i) {
                        if (!i) throw new Error("Отсутствует текст комментария!");
                        return api.post(e, `${a}/issue/${n}/comment`, {
                            headers: { Authorization: t.authData.api_key },
                            body: JSON.stringify({ body: i }),
                        });
                    })(t.inputData.issue_key, t.inputData.comment);
                return {
                    output: [
                        [
                            n.self,
                            n.id,
                            n.body,
                            n.updated,
                            n.created,
                            {
                                self: n.author.self || null,
                                key: n.author.key || null,
                                name: n.author.name || null,
                                displayName: n.author.displayName || null,
                                emailAddress: n.author.emailAddress || null,
                                active: n.author.active ?? null,
                                avatarUrls: {
                                    "48x48": n.author.avatarUrls["48x48"] || null,
                                    "24x24": n.author.avatarUrls["24x24"] || null,
                                    "16x16": n.author.avatarUrls["16x16"] || null,
                                    "32x32": n.author.avatarUrls["32x32"] || null,
                                },
                                timeZone: n.author.timeZone || null,
                            },
                        ],
                    ],
                    output_variables: [
                        { type: "String", name: "self" },
                        { type: "String", name: "id" },
                        { type: "String", name: "body" },
                        { type: "String", name: "updated" },
                        { type: "String", name: "created" },
                        {
                            type: "Object",
                            name: "author",
                            struct: [
                                { type: "String", name: "self" },
                                { type: "String", name: "key" },
                                { type: "String", name: "name" },
                                { type: "String", name: "displayName" },
                                { type: "String", name: "emailAddress" },
                                { type: "Boolean", name: "active" },
                                {
                                    type: "Object",
                                    name: "avatarUrls",
                                    struct: [
                                        { type: "String", name: "48x48" },
                                        { type: "String", name: "24x24" },
                                        { type: "String", name: "16x16" },
                                        { type: "String", name: "32x32" },
                                    ],
                                },
                                { type: "String", name: "timeZone" },
                            ],
                        },
                    ],
                    state: void 0,
                    hasNext: !1,
                };
            },
        },
        AddAttachment: {
            label: "Прикрепить вложение",
            description: "Прикрепляет вложение к задаче",
            inputFields: [
                { key: "issue_key", type: "text", label: "Ключ задачи", required: !0 },
                {
                    key: "attachment",
                    type: "stream",
                    label: "Вложение",
                    hint: "Укажите загружаемый файл",
                    required: !0,
                },
                {
                    key: "attachment_name",
                    type: "text",
                    label: "Название вложения",
                    hint: "Пример: image.png",
                    required: !0,
                },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = `${t.authData.connection_base_url}/rest/api/2/`,
                    n = api.post(e, `${a}issue/${t.inputData.issue_key}/attachments`, {
                        headers: {
                            Authorization: t.authData.api_key,
                            "X-Atlassian-Token": "nocheck",
                        },
                        body: [
                            {
                                key: "file",
                                fileValue: t.inputData.attachment,
                                fileName: t.inputData.attachment_name,
                                contentType: "application/octet-stream",
                            },
                        ],
                        isMultipart: !0,
                    });
                return {
                    output: [
                        [
                            n[0].filename,
                            n[0].size,
                            n[0].created,
                            n[0].self,
                            n[0].id,
                            n[0].mimeType,
                            n[0].content,
                        ],
                    ],
                    output_variables: [
                        { type: "String", name: "filename" },
                        { type: "Long", name: "size" },
                        { type: "String", name: "created" },
                        { type: "String", name: "self" },
                        { type: "String", name: "id" },
                        { type: "String", name: "mimeType" },
                        { type: "String", name: "content" },
                    ],
                    state: void 0,
                    hasNext: !1,
                };
            },
        },
        LinkingIssue: {
            label: "Создать связь",
            description: "Создает связь между задачами",
            inputFields: [
                {
                    key: "inwardIssue",
                    type: "text",
                    label: "Задача, к которой ведет связь",
                    required: !0,
                },
                {
                    key: "outwardIssue",
                    type: "text",
                    label: "Задача, от которой исходит связь",
                    required: !0,
                },
                (e, t) => {
                    if (
                        !t.authData ||
                        !t.authData.connection_base_url ||
                        !t.authData.api_key
                    )
                        return [];
                    const a = api.get(
                        e,
                        `${t.authData.connection_base_url}/rest/api/2/issueLinkType`,
                        { headers: { Authorization: t.authData.api_key } },
                    ),
                        n = a && a.issueLinkTypes ? a.issueLinkTypes : [];
                    return Array.isArray(n)
                        ? [
                            {
                                key: "issue_link_type",
                                type: "select",
                                label: "Тип связи",
                                required: !0,
                                options: n.map((e) => ({ label: e.name, value: e.id })),
                            },
                        ]
                        : [];
                },
                {
                    key: "commentBody",
                    type: "text",
                    label: "Комментарий",
                    required: !1,
                },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = `${t.authData.connection_base_url}/rest/api/2`,
                    n = api.post(e, `${a}/issueLink`, {
                        headers: { Authorization: t.authData.api_key },
                        body: JSON.stringify({
                            inwardIssue: { key: t.inputData.inwardIssue },
                            outwardIssue: { key: t.inputData.outwardIssue },
                            type: { id: t.inputData.issue_link_type },
                            comment: t.inputData.commentBody
                                ? { body: t.inputData.commentBody }
                                : "",
                        }),
                        isParse: !1,
                        getStatus: !0,
                    });
                return {
                    output: [
                        [
                            t.inputData.inwardIssue,
                            t.inputData.outwardIssue,
                            t.inputData.issue_link_type,
                            n,
                        ],
                    ],
                    output_variables: [
                        { type: "String", name: "Задача_цель" },
                        { type: "String", name: "Задача_источник" },
                        { type: "String", name: "Тип_связи" },
                        { type: "Long", name: "Статус" },
                    ],
                    state: void 0,
                    hasNext: !1,
                };
            },
        },
        FindGroups: {
            label: "Получить список доступных групп",
            description: "Возвращает список всех доступных групп Jira",
            inputFields: [],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = `${t.authData.connection_base_url}/rest/api/2`,
                    n = api.get(e, `${a}/groups/picker?maxResults=5000`, {
                        headers: { Authorization: t.authData.api_key },
                    }),
                    i = typeComposer(n.groups);
                return {
                    output: i.data,
                    output_variables: i.type,
                    state: void 0,
                    hasNext: !1,
                };
            },
        },
        GetGroupMember: {
            label: "Получить список пользователей из группы",
            description: "Возвращает список пользователей из выбранной группы Jira",
            inputFields: [
                {
                    key: "group_name",
                    type: "text",
                    label: "Введите имя группы",
                    required: !0,
                },
            ],
            executePagination: (e, t, a) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const n = {
                    baseUrl: `${t.authData.connection_base_url}/rest/api/2`,
                    page: null != a?.page ? a.page + 1 : 0,
                    limit: 50,
                    startAt: null != a?.startAt ? (a.page + 1) * a.limit : 0,
                    hasNext: !0,
                    variables: a?.variables ?? null,
                },
                    i = api.get(
                        e,
                        `${n.baseUrl}/group/member?groupname=${encodeURIComponent(t.inputData.group_name)}&limit=${n.limit}&startAt=${n.startAt}`,
                        { headers: { Authorization: t.authData.api_key } },
                    );
                i.total - i.maxResults * (n.page + 1) <= 0 && (n.hasNext = !1);
                const r = typeComposer(i.values);
                return (
                    n.variables || (n.variables = r.type),
                    n.hasNext || ((n.page = null), (n.startAt = null)),
                    {
                        output: r.data,
                        output_variables: r.type,
                        state: n,
                        hasNext: n.hasNext,
                    }
                );
            },
        },
        AddGroupMember: {
            label: "Добавить пользователя в группу",
            description: "Добавляет пользователя в выбранную группу Jira",
            inputFields: [
                {
                    key: "user_name",
                    type: "text",
                    label: "Введите имя пользователя",
                    required: !0,
                },
                {
                    key: "group_name",
                    type: "text",
                    label: "Введите имя группы",
                    required: !0,
                },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = { baseUrl: `${t.authData.connection_base_url}/rest/api/2` },
                    n = api.post(
                        e,
                        `${a.baseUrl}/group/user?groupname=${encodeURIComponent(t.inputData.group_name)}`,
                        {
                            headers: { Authorization: t.authData.api_key },
                            body: JSON.stringify({ name: t.inputData.user_name }),
                        },
                    );
                return {
                    output: [
                        [
                            t.inputData.group_name,
                            t.inputData.user_name,
                            !!n.users,
                            n.users?.size ?? null,
                        ],
                    ],
                    output_variables: [
                        { name: "group_name", type: "String" },
                        { name: "user_name", type: "String" },
                        { name: "status", type: "Boolean" },
                        { name: "size_group", type: "Long" },
                    ],
                    state: a,
                    hasNext: !1,
                };
            },
        },
        DeleteGropupMember: {
            label: "Удалить пользователя из группы",
            description: "Удаляет пользователя из выбранной группы Jira",
            inputFields: [
                {
                    key: "group_name",
                    type: "text",
                    label: "Введите имя группы",
                    required: !0,
                },
                {
                    key: "user_name",
                    type: "text",
                    label: "Введите имя группы",
                    required: !0,
                },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = `${t.authData.connection_base_url}/rest/api/2`,
                    n = api.delete(
                        e,
                        `${a}/group/user?groupname=${encodeURIComponent(t.inputData.group_name)}&username=${encodeURI(t.inputData.user_name)}`,
                        {
                            headers: { Authorization: t.authData.api_key },
                            isParse: !1,
                            getStatus: !0,
                        },
                    );
                return {
                    output: [
                        [
                            t.inputData.group_name,
                            t.inputData.user_name,
                            n >= 200 && n < 300,
                        ],
                    ],
                    output_variables: [
                        { name: "group_name", type: "String" },
                        { name: "user_name", type: "String" },
                        { name: "status", type: "Boolean" },
                    ],
                    state: void 0,
                    hasNext: !1,
                };
            },
        },
        CreateGroup: {
            label: "Создать группу",
            description: "Создает группу в системе Jira",
            inputFields: [
                {
                    key: "group_name",
                    type: "text",
                    label: "Введите имя группы",
                    required: !0,
                },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = `${t.authData.connection_base_url}/rest/api/2`,
                    n = api.post(e, `${a}/group`, {
                        headers: { Authorization: t.authData.api_key },
                        body: JSON.stringify({ name: t.inputData.group_name }),
                        isParse: !1,
                        getStatus: !0,
                    });
                return {
                    output: [[t.inputData.group_name, n >= 200 && n < 300]],
                    output_variables: [
                        { name: "group_name", type: "String" },
                        { name: "status", type: "Boolean" },
                    ],
                    state: void 0,
                    hasNext: !1,
                };
            },
        },
        DeleteGroup: {
            label: "Удалить группу",
            description: "Удаляет выбранную группу",
            inputFields: [
                {
                    key: "group_name",
                    type: "text",
                    label: "Введите имя группы",
                    required: !0,
                },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = `${t.authData.connection_base_url}/rest/api/2`,
                    n = api.delete(
                        e,
                        `${a}/group?groupname=${encodeURIComponent(t.inputData.group_name)}`,
                        {
                            headers: { Authorization: t.authData.api_key },
                            isParse: !1,
                            getStatus: !0,
                        },
                    );
                return {
                    output: [[t.inputData.group_name, n >= 200 && n < 300]],
                    output_variables: [
                        { name: "group_name", type: "String" },
                        { name: "status", type: "Boolean" },
                    ],
                    state: void 0,
                    hasNext: !1,
                };
            },
        },
        GetWatchers: {
            label: "Показать список наблюдателей",
            description: "Выводит весь список наблюдателей задачи",
            inputFields: [
                { key: "issue_key", type: "text", label: "Ключ задачи", required: !0 },
            ],
            executePagination: (e, t) => {
                return (
                    (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError(
                        "Не удается найти подключение. Проверьте соединение.",
                    ),
                    {
                        output:
                            ((a = api.get(
                                e,
                                `${t.authData.connection_base_url}/rest/api/2/issue/${t.inputData.issue_key}/watchers`,
                                { headers: { Authorization: t.authData.api_key } },
                            )),
                                [
                                    [
                                        a.isWatching ?? null,
                                        a.self ?? null,
                                        a.watchCount ?? null,
                                        a.watchers?.map((e) => ({
                                            self: e.self ?? null,
                                            name: e.name ?? null,
                                            key: e.key ?? null,
                                            emailAddress: e.emailAddress ?? null,
                                            avatarUrls: {
                                                "48x48": e.avatarUrls?.["48x48"] ?? null,
                                                "24x24": e.avatarUrls?.["24x24"] ?? null,
                                                "16x16": e.avatarUrls?.["16x16"] ?? null,
                                                "32x32": e.avatarUrls?.["32x32"] ?? null,
                                            },
                                            displayName: e.displayName ?? null,
                                            active: e.active ?? null,
                                            timeZone: e.timeZone ?? null,
                                        })) || [],
                                    ],
                                ]),
                        output_variables: [
                            { type: "Boolean", name: "isWatching" },
                            { type: "String", name: "self" },
                            { type: "Long", name: "watchCount" },
                            {
                                type: "ObjectArray",
                                name: "watchers",
                                struct: [
                                    { type: "String", name: "self" },
                                    { type: "String", name: "name" },
                                    { type: "String", name: "key" },
                                    { type: "String", name: "emailAddress" },
                                    {
                                        type: "Object",
                                        name: "avatarUrls",
                                        struct: [
                                            { type: "String", name: "48x48" },
                                            { type: "String", name: "24x24" },
                                            { type: "String", name: "16x16" },
                                            { type: "String", name: "32x32" },
                                        ],
                                    },
                                    { type: "String", name: "displayName" },
                                    { type: "Boolean", name: "active" },
                                    { type: "String", name: "timeZone" },
                                ],
                            },
                        ],
                        state: void 0,
                        hasNext: !1,
                    }
                );
                var a;
            },
        },
        AddWorkLog: {
            label: "Добавить журнал работы",
            description: "Добавляет рабочий журнал к задаче",
            inputFields: [
                { key: "issue_key", type: "text", label: "Ключ задачи", required: !0 },
                { key: "comment", type: "text", label: "Комментарий" },
                { key: "started", type: "text", label: "Время начала" },
                { key: "timeSpent", type: "text", label: "Затраченное время" },
                {
                    key: "timeSpentSeconds",
                    type: "number",
                    label: "Время в секундах",
                    required: !0,
                },
                {
                    key: "visibility",
                    type: "group",
                    label: "Видимость",
                    properties: [
                        { key: "identifier", type: "text", label: "Идентификатор" },
                        { key: "type", type: "text", label: "Тип" },
                        { key: "value", type: "text", label: "Значение" },
                    ],
                },
            ],
            executePagination: (e, t) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const a = api.post(
                    e,
                    `${t.authData.connection_base_url}/rest/api/2/issue/${t.inputData.issue_key}/worklog`,
                    {
                        headers: { Authorization: t.authData.api_key },
                        body: JSON.stringify(
                            (function (e) {
                                const t = {};
                                for (const a in e) "issue_key" !== a && (t[a] = e[a]);
                                return t;
                            })(t.inputData),
                        ),
                    },
                ),
                    n = typeComposer(a);
                return {
                    output: n.data,
                    output_variables: n.type,
                    state: void 0,
                    hasNext: !1,
                };
            },
        },
        GetComments: {
            label: "Получить комментарии",
            description: "Выводит список комментариев указанной задачи",
            inputFields: [
                { key: "issue_key", type: "text", label: "Ключ задачи", required: !0 },
            ],
            executePagination: (e, t, a) => {
                (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError("Не удается найти подключение. Проверьте соединение.");
                const n = {
                    page: null != a ? a.page + 1 : 0,
                    limit: 50,
                    hasNext: !0,
                    startAt: null != a ? (a.page + 1) * a.limit : 0,
                },
                    i = api.get(
                        e,
                        `${t.authData.connection_base_url}/rest/api/2/issue/${t.inputData.issue_key}/comment?startAt=${n.startAt}&maxResults=${n.limit}`,
                        { headers: { Authorization: t.authData.api_key } },
                    );
                return (
                    i.total - i.maxResults * (n.page + 1) <= 0 && (n.hasNext = !1),
                    {
                        output: i.comments
                            ? ((r = i.comments),
                                r.map((e) => [
                                    e.self ?? null,
                                    e.id ?? null,
                                    {
                                        self: e.author?.self ?? null,
                                        name: e.author?.name ?? null,
                                        key: e.author?.key ?? null,
                                        emailAddress: e.author?.emailAddress ?? null,
                                        displayName: e.author?.displayName ?? null,
                                        active: e.author?.active ?? null,
                                        timeZone: e.author?.timeZone ?? null,
                                    },
                                    e.body ?? null,
                                    {
                                        self: e.updateAuthor?.self ?? null,
                                        name: e.updateAuthor?.name ?? null,
                                        key: e.updateAuthor.key ?? null,
                                        emailAddress: e.updateAuthor?.emailAddress ?? null,
                                        displayName: e.updateAuthor?.displayName ?? null,
                                        active: e.updateAuthor?.active ?? null,
                                        timeZone: e.updateAuthor?.timeZone ?? null,
                                    },
                                    e.created ?? null,
                                    e.updated ?? null,
                                    {
                                        identifier: e.visibility?.identifier ?? null,
                                        type: e.visibility?.type ?? null,
                                        value: e.visibility?.value ?? null,
                                    },
                                ]))
                            : [],
                        output_variables: commentOutputVariables,
                        state: n.hasNext ? n : void 0,
                        hasNext: n.hasNext,
                    }
                );
                var r;
            },
        },
        EditComment: {
            label: "Редактировать комментарий",
            description: "Редактирование комментария в задаче",
            inputFields: [
                { key: "issue_key", type: "text", label: "Ключ задачи", required: !0 },
                {
                    key: "comment_id",
                    type: "text",
                    label: "Идентификатор комментария",
                    required: !0,
                },
                { key: "body", type: "text", label: "Комментарий", required: !0 },
            ],
            executePagination: (e, t) => {
                return (
                    (t.authData.connection_base_url && t.authData.api_key) ||
                    e.stringError(
                        "Не удается найти подключение. Проверьте соединение.",
                    ),
                    {
                        output:
                            ((a = api.put(
                                e,
                                `${t.authData.connection_base_url}/rest/api/2/issue/${t.inputData.issue_key}/comment/${t.inputData.comment_id}`,
                                {
                                    headers: { Authorization: t.authData.api_key },
                                    body: JSON.stringify({ body: t.inputData.body }),
                                },
                            )),
                                [
                                    [
                                        a.self ?? null,
                                        a.id ?? null,
                                        {
                                            self: a.author?.self ?? null,
                                            name: a.author?.name ?? null,
                                            key: a.author?.key ?? null,
                                            emailAddress: a.author?.emailAddress ?? null,
                                            displayName: a.author?.displayName ?? null,
                                            active: a.author?.active ?? null,
                                            timeZone: a.author?.timeZone ?? null,
                                        },
                                        a.body ?? null,
                                        {
                                            self: a.updateAuthor?.self ?? null,
                                            name: a.updateAuthor?.self ?? null,
                                            key: a.updateAuthor?.self ?? null,
                                            emailAddress: a.updateAuthor?.self ?? null,
                                            displayName: a.updateAuthor?.displayName ?? null,
                                            active: a.updateAuthor?.active ?? null,
                                            timeZone: a.updateAuthor?.timeZone ?? null,
                                        },
                                        a.created ?? null,
                                        a.updated ?? null,
                                        {
                                            identifier: a.visibility?.identifier ?? null,
                                            type: a.visibility?.type ?? null,
                                            value: a.visibility?.value ?? null,
                                        },
                                    ],
                                ]),
                        output_variables: commentOutputVariables,
                        state: void 0,
                        hasNext: !1,
                    }
                );
                var a;
            },
        },
    },
    connections: {
        BasicAuthConnect: {
            label: "Подключение к Atlassian Jira (Basic)",
            description: "Подключение по логину/паролю к Jira",
            inputFields: [
                { key: "connection_base_url", type: "text", label: "URL Jira" },
                { key: "connection_login", type: "text", label: "Логин" },
                { key: "connection_password", type: "password", label: "Пароль" },
                {
                    key: "authorize_button",
                    type: "button",
                    label: "Проверить подключение",
                    typeOptions: {
                        saveFields: (e, t) => {
                            const a = e.base64Encode(
                                t.authData.connection_login +
                                ":" +
                                t.authData.connection_password,
                            ),
                                n = e.request({
                                    url: t.authData.connection_base_url + "/rest/api/2/project",
                                    method: "GET",
                                    headers: { Authorization: "Basic " + a },
                                }),
                                i = JSON.parse(new TextDecoder().decode(n.response));
                            if (200 !== n.status)
                                throw new Error("Ошибка подключения к Jira: " + i);
                            return { connect_status: 200, api_key: "Basic " + a };
                        },
                        message: (e, t) => {
                            if (200 === t.authData.connect_status)
                                return "Успешно авторизован!";
                            throw new Error("Не удалось авторизоваться!");
                        },
                    },
                },
            ],
            execute: () => { },
        },
        PersonalTokenConnect: {
            label: "Подключение к Atlassian Jira (Access Token)",
            description: "Подключение по Access Token",
            inputFields: [
                { key: "connection_base_url", type: "text", label: "URL Jira" },
                { key: "api_token", type: "password", label: "Токен" },
                {
                    key: "authorize_button",
                    type: "button",
                    label: "Проверить подключение",
                    typeOptions: {
                        saveFields: (e, t) => {
                            const a = e.request({
                                url: t.authData.connection_base_url + "/rest/api/2/project",
                                method: "GET",
                                headers: { Authorization: "Bearer " + t.authData.api_token },
                            }),
                                n = JSON.parse(new TextDecoder().decode(a.response));
                            if (200 !== a.status)
                                throw new Error("Ошибка подключения к Jira: " + n);
                            return {
                                connect_status: 200,
                                api_key: "Bearer " + t.authData.api_token,
                            };
                        },
                        message: (e, t) => {
                            if (200 === t.authData.connect_status)
                                return "Успешно авторизован!";
                            throw new Error("Не удалось авторизоваться!");
                        },
                    },
                },
            ],
            execute: () => { },
        },
    },
};
