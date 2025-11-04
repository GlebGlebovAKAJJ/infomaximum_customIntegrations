app = {
    schema: 2,
    version: "1.0.2",
    label: "Tool Kit",
    description: "",
    blocks: {
        SendHttpRequest: {
            label: "HTTP-запрос",
            description: "Выполняет произвольный HTTP-запрос к внешнему API",

            inputFields: [
                {
                    key: "url",
                    label: "URL",
                    type: "text",
                    required: true,
                    placeholder: "https://api.example.com/endpoint"
                },
                {
                    key: "method",
                    label: "Метод запроса",
                    type: "select",
                    required: true,
                    options: [
                        { label: "GET", value: "GET" },
                        { label: "POST", value: "POST" },
                        { label: "PUT", value: "PUT" },
                        { label: "PATCH", value: "PATCH" },
                        { label: "DELETE", value: "DELETE" }
                    ]
                },
                (service, bundle) => {
                    const m = (bundle.inputData.method || '').toUpperCase();
                    if (!m) return [];
                    const fields = [
                        {
                            key: "headers",
                            label: "Заголовки запроса",
                            type: "keyValue",
                            hint: "Добавьте ключи и значения (например: Authorization, Content-Type)"
                        }
                    ];
                    if (["POST", "PUT", "PATCH"].includes(m)) {
                        fields.push({
                            key: "json_body",
                            label: "Тело запроса (JSON)",
                            type: "text",
                            placeholder: "{\"field\":\"value\"}"
                        });
                    }
                    return fields;
                }
            ],
            executePagination: (service, bundle) => {
                const method = (bundle.inputData.method || "GET").toUpperCase();
                const url = (bundle.inputData.url || "").trim()
                    .replace(/^["']|["']$/g, ""); // убирает обрамляющие кавычки, если есть


                if (!url) throw new Error("URL не указан.");

                let headersRaw = bundle.inputData.headers;
                let headers = {};

                if (headersRaw) {
                    if (typeof headersRaw === "string") {
                        try {
                            headers = JSON.parse(headersRaw);
                        } catch {
                            headers = headersRaw.split(/\r?\n/).reduce((acc, line) => {
                                const i = line.indexOf(":");
                                if (i > 0) acc[line.slice(0, i).trim()] = line.slice(i + 1).trim();
                                return acc;
                            }, {});
                        }
                    } else if (Array.isArray(headersRaw)) {
                        headersRaw.forEach(h => {
                            if (h && h.key) headers[h.key] = h.value ?? "";
                        });
                    } else if (typeof headersRaw === "object") {
                        headers = { ...headersRaw };
                    }
                }
                let body = null;
                if (["POST", "PUT", "PATCH"].includes(method) && bundle.inputData.json_body) {
                    try {
                        body = JSON.parse(bundle.inputData.json_body);
                    } catch (e) {
                        throw new Error("Некорректный JSON в теле запроса: " + e.message);
                    }
                }
                if (body && !Object.keys(headers).some(h => h.toLowerCase() === "content-type")) {
                    headers["Content-Type"] = "application/json";
                }

                const started = Date.now();
                let resp;

                try {
                    resp = service.request({
                        url,
                        method,
                        headers,
                        ...(body ? { jsonBody: body } : {})
                    });
                } catch (e) {
                    throw new Error("Ошибка выполнения HTTP-запроса: " + e.message);
                }

                const duration = Date.now() - started;

                const raw = new TextDecoder().decode(resp.response || new Uint8Array());
                let parsed;
                try {
                    parsed = JSON.parse(raw);
                } catch {
                    parsed = raw;
                }

                return {
                    output: [[
                        resp.status,
                        typeof parsed === "string" ? parsed : JSON.stringify(parsed, null, 2)
                    ]],
                    output_variables: [
                        { name: "status", type: "Long" },
                        { name: "response", type: "String" }
                    ],
                    state: { done: true },
                    hasNext: false
                };
            }
        },
        ParseJson: {
            label: "Парсинг JSON",
            description: "Разворачивает вложенный JSON и возвращает одну строку, где каждый ключ становится отдельной колонкой.",

            inputFields: [
                {
                    key: "json_input",
                    label: "JSON-вход",
                    type: "text",
                    required: true,
                    placeholder: '{"fields":{"issuetype":{"name":"Epic","subtask":false}}}'
                }
            ],

            executePagination: (service, bundle) => {
                const input = (bundle.inputData.json_input || "").trim();
                if (!input) {
                    throw new Error("Поле JSON-вход не должно быть пустым.");
                }

                let parsed;
                try {
                    parsed = JSON.parse(input);
                } catch (e) {
                    throw new Error("Некорректный JSON: " + e.message);
                }

                // рекурсивное разворачивание в ключи
                const flatten = (obj, prefix = "", result = {}) => {
                    for (const key in obj) {
                        if (!Object.prototype.hasOwnProperty.call(obj, key)) continue;
                        const path = prefix ? `${prefix}.${key}` : key;
                        const value = obj[key];

                        if (value !== null && typeof value === "object" && !Array.isArray(value)) {
                            flatten(value, path, result);
                        } else {
                            result[path] = Array.isArray(value) ? JSON.stringify(value) : value;
                        }
                    }
                    return result;
                };

                const flattened = flatten(parsed);

                // динамически определяем тип
                const detectType = val => {
                    if (val === null) return "String";
                    if (typeof val === "boolean") return "Boolean";
                    if (typeof val === "number") return "Double";
                    return "String";
                };

                const outputVariables = Object.keys(flattened).map(k => ({
                    name: k,
                    type: detectType(flattened[k])
                }));

                // формируем одну строку с плоскими ключами
                const outputRow = [Object.values(flattened)];

                return {
                    output: outputRow,
                    output_variables: outputVariables,
                    state: { parsed: true },
                    hasNext: false
                };
            }
        },
        SynchronizerWithAvailableMapping: {
            label: "🗘 Синхронизатор (с сохранением данных из прошлых блоков)",
            description: "Синхронизирует выполнение блоков скриптов: останавливает или продолжает в зависимости от режима, при этом сохраняя возможность использования данных маппинга из прошлых блоков.",
            inputFields: [{ key: "stop_mode", label: "Остановить выполнение?", type: "boolean", default: false }],
            execute: (service, bundle) => {
                const { stop_mode } = bundle.inputData || {};
                const input = bundle.input || [];
                // Собираем входные данные в массив в meta
                bundle.meta = bundle.meta || {};
                bundle.meta.data = bundle.meta.data || [];
                bundle.meta.data.push(...input);
                if (stop_mode === true || stop_mode === "true") {
                    bundle.meta.data = [];
                    return {
                        output: [],
                        output_variables: []
                    };
                }
                // Для продолжения: даем один пуск, используя meta для отслеживания
                const launched = bundle.meta.launched;
                if (launched) {
                    return {
                        output: [],
                        output_variables: []
                    };
                } else {
                    bundle.meta.launched = true;
                    return {
                        output: [["continue"]],
                        output_variables: [{ name: "status", type: "String" }]
                    };
                }
            }
        }
    },
    connections: {}
};
