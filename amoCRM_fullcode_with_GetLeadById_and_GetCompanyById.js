var LongLivedToken = {
    label: "Подключение по долгосрочному токену amoCRM",
    description: "Подключение по долгосрочному токену amoCRM",
    inputFields: [ {
        key: "subdomain_amo_crm",
        label: "Cубдомен AmoCRM",
        type: "textPlain",
        required: true
    }, {
        key: "client_longlived_token",
        type: "password",
        label: "Долгосрочный токен",
        required: true
    }, {
        key: "show_button",
        type: "button",
        label: "Получить redirect URL",
        required: false,
        executeWithSaveFields: (service, bundle) => ({
            redirect_url: bundle.authData.BASE_URL
        })
    }, {
        key: "redirect_url",
        type: "textPlain",
        label: "Redirect URL",
        required: false
    }, {
        key: "check_connection",
        type: "button",
        label: "Проверить подключение",
        required: false,
        executeWithMessage: (service, bundle) => {
            try {
                var response = service.request({
                    url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/account`,
                    method: "GET",
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    }
                });
                if (200 === response.status) {
                    return "Подключение успешно!";
                }
                throw new Error("Ошибка во время подключения." + JSON.stringify(response));
            } catch (e) {
                throw new Error("Ошибка во время проверки подключения." + JSON.stringify(e));
            }
        }
    }, {
        key: "un_authorize_button",
        type: "button",
        label: "Забыть учётную запись",
        required: false,
        executeWithMessage: () => "Я забыл твой токен.",
        executeWithSaveFields: () => ({
            client_longlived_token: "",
            refreshToken: ""
        })
    } ],
    execute: () => {}
};

function makeRequest(service, config, body = {}, isFile = false) {
    var isGetMethod = "GET" === config.method;
    function getQueryParam(url, param) {
        var regex = new RegExp(`[?&]${param}=([^&]*)`);
        var match = url.match(regex);
        return match ? decodeURIComponent(match[1]) : null;
    }
    function setQueryParam(url, param, value) {
        var re = new RegExp(`([?&])${param}=([^&]*)`);
        return url.match(re) ? url.replace(re, `$1${param}=${encodeURIComponent(value)}`) : url.includes("?") ? `${url}&${param}=${encodeURIComponent(value)}` : `${url}?${param}=${encodeURIComponent(value)}`;
    }
    var basePayload = {
        url: config.url,
        method: config.method,
        headers: config.headers,
        repeatMode: true,
        timeout: 800
    };
    var payload = isGetMethod ? basePayload : {
        ...basePayload,
        ...isFile ? {
            multipartBody: body
        } : {
            jsonBody: body
        }
    };
    function doRequest(url) {
        var reqPayload = isGetMethod ? {
            ...payload,
            url: url
        } : payload;
        return service.request(reqPayload);
    }
    var limitParam = getQueryParam(config.url, "limit");
    var pageParam = getQueryParam(config.url, "page");
    if (!limitParam || !pageParam) {
        throw new Error("В URL запроса должны быть параметры limit и page");
    }
    var limit = Number(limitParam);
    var page = Number(pageParam);
    if (isNaN(limit) || isNaN(page)) {
        throw new Error("Параметры limit и page в URL должны быть числами");
    }
    var response = doRequest(config.url);
    if (408 === response.status) {
        if (limit <= 1) {
            throw new Error("Limit должен быть больше 1 для повторных запросов при статусе 408");
        }
        var halfLimit = Math.floor(limit / 2);
        var resp1 = doRequest(setQueryParam(setQueryParam(config.url, "limit", halfLimit.toString()), "page", page.toString()));
        if (resp1.status < 200 || resp1.status >= 300) {
            throw new Error(`Ошибка при первом повторном запросе: статус ${resp1.status}`);
        }
        var decoded1 = JSON.parse((new TextDecoder).decode(resp1.response));
        var data1;
        try {
            data1 = Object.values(decoded1._embedded)[0];
        } catch {
            throw new Error("Ошибка парсинга первого ответа при повторных запросах");
        }
        var resp2 = doRequest(setQueryParam(setQueryParam(config.url, "limit", halfLimit.toString()), "page", (page + 1).toString()));
        if (resp2.status < 200 || resp2.status >= 300) {
            throw new Error(`Ошибка при втором повторном запросе: статус ${resp2.status}`);
        }
        var decoded2 = JSON.parse((new TextDecoder).decode(resp2.response));
        var data2;
        try {
            data2 = Object.values(decoded2._embedded)[0];
        } catch {
            throw new Error("Ошибка парсинга второго ответа при повторных запросах");
        }
        var combined = [ ...data1, ...data2 ];
        return {
            _links: {
                next: {
                    href: decoded2._links.next.href
                },
                _page: decoded2._page
            },
            _embedded: {
                [Object.keys(decoded2._embedded)[0]]: combined
            }
        };
    }
    if (response.status < 200 || response.status >= 300) {
        throw new Error(`Ошибка: ${JSON.stringify((new TextDecoder).decode(response.response))}`);
    }
    if (204 === response.status) {
        throw new Error(`Нет записей. Проверьте содержимое передаваемое в фильтрацию по времени, либо корректность URL-запрос: ${payload.url}`);
    }
    try {
        var decoded = (new TextDecoder).decode(response.response);
        return JSON.parse(decoded);
    } catch (err) {
        throw new Error(`Ошибка при декодировании ответа: ${err}`);
    }
}

function dateFilterConverter(date) {
    if (!date) {
        return 0;
    }
    var trimmedDate = String(date).trim();
    if (!trimmedDate) {
        return 0;
    }
    var isoString = trimmedDate.replace(/\+0000$/, "");
    if (/^\d+$/.test(isoString)) {
        var timestamp = parseInt(isoString, 10);
        return timestamp > 1e12 ? Math.floor(timestamp / 1000) : timestamp;
    }
    try {
        var dateObj = new Date(isoString);
        if (isNaN(dateObj.getTime())) {
            return 0;
        }
        var unix_time = Math.floor(dateObj.getTime() / 1000);
        return 0 === unix_time ? 1 : unix_time;
    } catch {
        return 0;
    }
}

function QueryFilter(filter) {
    return filter ? Object.entries(filter).filter((([, value]) => null != value && "" !== value)).map((([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)).join("&") : "";
}

function mergeQueryParams(url, newParams) {
    var [base, query] = url.split("?");
    var existingParams = query ? function(query) {
        return query.split("&").map((part => part.split("="))).filter((([key]) => key)).reduce(((acc, [key, value]) => {
            acc[decodeURIComponent(key)] = decodeURIComponent(value || "");
            return acc;
        }), {});
    }(query) : {};
    var merged = {
        ...existingParams,
        ...newParams
    };
    var params;
    return `${base}?${params = merged, Object.entries(params).map((([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)).join("&")}`;
}

class TypeDeterminer {
    determineTypes(obj) {
        var types = [];
        for (var [key, value] of Object.entries(obj)) {
            types.push(this.getTypeDescription(key, value));
        }
        return types;
    }
    getTypeDescription(name, value) {
        return Array.isArray(value) ? this.handleArrayType(name, value) : "object" == typeof value && null !== value ? this.handleObjectType(name, value) : this.getPrimitiveType(name, value);
    }
    handleArrayType(name, array) {
        if (0 === array.length) {
            return {
                type: "StringArray",
                name: name
            };
        }
        var firstElement = array[0];
        if ("object" == typeof firstElement && null !== firstElement) {
            return {
                type: "ObjectArray",
                name: name,
                struct: this.determineTypes(firstElement)
            };
        }
        return {
            type: this.getPrimitiveTypeName(firstElement) + "Array",
            name: name
        };
    }
    handleObjectType(name, obj) {
        return {
            type: "Object",
            name: name,
            struct: this.determineTypes(obj)
        };
    }
    getPrimitiveType(name, value) {
        return {
            type: this.getPrimitiveTypeName(value),
            name: name
        };
    }
    getPrimitiveTypeName(value) {
        return "string" == typeof value ? "String" : "number" == typeof value ? Number.isInteger(value) ? "Long" : "Double" : "boolean" == typeof value ? "Boolean" : "String";
    }
    static use() {
        return typeDeterminerInstance;
    }
}

var typeDeterminerInstance = new TypeDeterminer;

var app = {
    schema: 2,
    version: "0.0.1",
    label: "amoCRM",
    description: "Интеграция с системой amoCRM",
    blocks: {
		GetCompanyById: {
			label: "Получить компанию по ID",
			description: "Возвращает одну компанию по её ID",
			inputFields: [
				{
					key: "company_id",
					type: "text",
					label: "ID компании",
					required: true
				}
			],
			executePagination: (service, bundle, context) => {
				var state = {
					company_id: bundle.inputData.company_id ? String(bundle.inputData.company_id).trim() : "",
					base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/companies`,
					custom_fields_base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/companies/custom_fields?page=1&limit=250`,
					headers: {
						Authorization: `Bearer ${bundle.authData.client_longlived_token}`
					},
					hasNext: false,
					output_vars: context ? context.output_vars : [],
					custom_fields_enums: context ? context.custom_fields_enums : []
				};

				if (!state.company_id) {
					return {
						output: [[ "ID компании не указан" ]],
						output_variables: [{ type: "String", name: "status" }],
						state: state,
						hasNext: false
					};
				}
				var typesDet = new TypeDeterminer;
				function normalizeCompany(company) {
					var toISO = t => t && t > 0 ? new Date(1000 * t).toISOString() : null;
					var {
						id,
						name,
						is_deleted,
						account_id,
						group_id,
						created_at,
						updated_at,
						closest_task_at,
						created_by,
						updated_by,
						responsible_user_id,
						custom_fields_values,
						_embedded: { tags = [] } = { tags: [] }
					} = company;
					return {
						id: id,
						name: name,
						is_deleted: is_deleted,
						account_id: account_id,
						group_id: group_id,
						created_at: toISO(created_at),
						updated_at: toISO(updated_at),
						closest_task_at: toISO(closest_task_at),
						created_by: created_by,
						updated_by: updated_by,
						responsible_user_id: responsible_user_id,
						tags: tags.length ? JSON.stringify(tags) : null,
						custom_fields_values: custom_fields_values
					};
				}
				var companyResponse = makeRequest(
					service,
					{
						url: `${state.base_url}/${encodeURIComponent(state.company_id)}?page=1&limit=1`,
						method: "GET",
						headers: state.headers
					},
					{},
					false
				);

				if (!companyResponse) {
					return {
						output: [[ "Компания не найдена" ]],
						output_variables: [{ type: "String", name: "status" }],
						state: state,
						hasNext: false
					};
				}

				var singleCompany = normalizeCompany(companyResponse);
				if (!state.custom_fields_enums || state.custom_fields_enums.length === 0) {
					var custom_fields = [];
					var nextPageUrl = state.custom_fields_base_url;
					while (nextPageUrl) {
						var resp = makeRequest(
							service,
							{ url: nextPageUrl, method: "GET", headers: state.headers },
							{},
							false
						);
						custom_fields.push(...resp._embedded.custom_fields);
						nextPageUrl = resp._links?.next?.href ?? null;
					}
					state.custom_fields_enums = (function (custom_fields) {
						var custom_fields_values = [];
						var serviceFields = [
							"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
							"utm_referrer", "_ym_uid", "_ym_counter", "roistat", "referrer",
							"openstat_service", "openstat_campaign", "openstat_ad", "openstat_source",
							"from", "gclientid", "gclid", "yclid", "fbclid"
						];
						for (var field of custom_fields) {
							if (field && field.name && serviceFields.indexOf(field.name) === -1) {
								custom_fields_values.push({
									id: field.id,
									name: field.name,
									values: Array.isArray(field.enums) ? field.enums.map(e => e.value) : []
								});
							}
						}
						return custom_fields_values;
					})(custom_fields);
				}
				var injectedCompany = (function (company, custom_fields_enums) {
					var custom_fields = custom_fields_enums.reduce((acc, enum_field) => {
						acc[enum_field.name] = null;
						return acc;
					}, {});
					company.custom_fields = custom_fields;

					if (Object.keys(company).indexOf("custom_fields_values") !== -1 && company.custom_fields_values) {
						company.custom_fields_values.forEach(cf => {
							var field_name = cf.field_name;
							var values = cf.values;
							if (Object.prototype.hasOwnProperty.call(company.custom_fields, field_name)) {
								company.custom_fields[field_name] = (values && values.length > 0) ? values[0].value : null;
							}
						});
					}
					delete company.custom_fields_values;
					return company;
				})(singleCompany, state.custom_fields_enums);
				var ugly_row = (function (company) {
					if (!state.output_vars || !state.output_vars.length) {
						state.output_vars = typesDet.determineTypes(company.custom_fields);
					}
					return [
						company.id,
						company.name,
						company.is_deleted,
						company.account_id,
						company.group_id,
						company.created_at,
						company.updated_at,
						company.closest_task_at,
						company.created_by,
						company.updated_by,
						company.responsible_user_id,
						company.tags,
						company.custom_fields
					];
				})(injectedCompany);
				return {
					output: [ ugly_row ],
					output_variables: [
						{ name: "id", type: "Long" },
						{ name: "name", type: "String" },
						{ name: "is_deleted", type: "Boolean" },
						{ name: "account_id", type: "Long" },
						{ name: "group_id", type: "Long" },
						{ name: "created_at", type: "DateTime" },
						{ name: "updated_at", type: "DateTime" },
						{ name: "closest_task_at", type: "DateTime" },
						{ name: "created_by", type: "Long" },
						{ name: "updated_by", type: "Long" },
						{ name: "responsible_user_id", type: "Long" },
						{ name: "tags", type: "String" },
						{ type: "Object", name: "custom_fields", struct: state.output_vars }
					],
					state: {
						...state,
						hasNext: false
					},
					hasNext: false
				};
			}
		},		
		GetLeadById: {
			label: "Получить сделку по ID",
			description: "Возвращает одну сделку по её ID",
			inputFields: [
				{
					key: "lead_id",
					type: "text",
					label: "ID сделки",
					required: true
				}
			],
			executePagination: (service, bundle, context) => {
				var state = {
					lead_id: bundle.inputData.lead_id ? String(bundle.inputData.lead_id).trim() : "",
					base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/leads`,
					custom_fields_base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/leads/custom_fields?page=1&limit=250`,
					headers: {
						Authorization: `Bearer ${bundle.authData.client_longlived_token}`
					},
					hasNext: false,
					output_vars: context ? context.output_vars : [],
					custom_fields_enums: context ? context.custom_fields_enums : []
				};

				if (!state.lead_id) {
					return {
						output: [[ "ID сделки не указан" ]],
						output_variables: [{ type: "String", name: "status" }],
						state: state,
						hasNext: false
					};
				}

				var typesDet = new TypeDeterminer;
				function normalizeLead(lead) {
					var toISO = t => t && t > 0 ? new Date(1000 * t).toISOString() : null;
					var {
						id,
						name,
						price,
						score = null,
						status_id,
						is_deleted,
						account_id,
						group_id,
						closed_at,
						created_at,
						updated_at,
						closest_task_at,
						created_by,
						updated_by,
						responsible_user_id,
						loss_reason_id,
						labor_cost,
						pipeline_id,
						custom_fields_values,
						_embedded: { tags = [], companies = [] } = { tags: [], companies: [] }
					} = lead;
					return {
						id: id,
						name: name,
						price: price,
						score: score,
						status_id: status_id,
						is_deleted: is_deleted,
						account_id: account_id,
						group_id: group_id,
						closed_at: toISO(closed_at),
						created_at: toISO(created_at),
						updated_at: toISO(updated_at),
						closest_task_at: toISO(closest_task_at),
						created_by: created_by,
						updated_by: updated_by,
						tags: tags.length ? JSON.stringify(tags) : null,
						company_id: companies[0]?.id ?? 0,
						responsible_user_id: responsible_user_id,
						loss_reason_id: loss_reason_id ?? 0,
						labor_cost: labor_cost,
						pipeline_id: pipeline_id,
						custom_fields_values: custom_fields_values
					};
				}
				var leadResponse = makeRequest(
					service,
					{
						url: `${state.base_url}/${encodeURIComponent(state.lead_id)}?page=1&limit=1`,
						method: "GET",
						headers: state.headers
					},
					{},
					false
				);
				if (!leadResponse) {
					return {
						output: [[ "Сделка не найдена" ]],
						output_variables: [{ type: "String", name: "status" }],
						state: state,
						hasNext: false
					};
				}
				var singleLead = normalizeLead(leadResponse);
				if (!state.custom_fields_enums || state.custom_fields_enums.length === 0) {
					var custom_fields = [];
					var nextPageUrl = state.custom_fields_base_url;
					while (nextPageUrl) {
						var resp = makeRequest(
							service,
							{ url: nextPageUrl, method: "GET", headers: state.headers },
							{},
							false
						);
						custom_fields.push(...resp._embedded.custom_fields);
						nextPageUrl = resp._links?.next?.href ?? null;
					}
					state.custom_fields_enums = (function (custom_fields) {
						var custom_fields_values = [];
						var serviceFields = [
							"utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content",
							"utm_referrer", "_ym_uid", "_ym_counter", "roistat", "referrer",
							"openstat_service", "openstat_campaign", "openstat_ad", "openstat_source",
							"from", "gclientid", "gclid", "yclid", "fbclid"
						];
						for (var field of custom_fields) {
							if (field && field.name && serviceFields.indexOf(field.name) === -1) {
								custom_fields_values.push({
									id: field.id,
									name: field.name,
									values: Array.isArray(field.enums) ? field.enums.map(e => e.value) : []
								});
							}
						}
						return custom_fields_values;
					})(custom_fields);
				}
				var injectedLead = (function (lead, custom_fields_enums) {
					var custom_fields = custom_fields_enums.reduce((acc, enum_field) => {
						acc[enum_field.name] = null;
						return acc;
					}, {});
					lead.custom_fields = custom_fields;

					if (Object.keys(lead).indexOf("custom_fields_values") !== -1 && lead.custom_fields_values) {
						lead.custom_fields_values.forEach(cf => {
							var field_name = cf.field_name;
							var values = cf.values;
							if (Object.prototype.hasOwnProperty.call(lead.custom_fields, field_name)) {
								lead.custom_fields[field_name] = (values && values.length > 0) ? values[0].value : null;
							}
						});
					}
					delete lead.custom_fields_values;
					return lead;
				})(singleLead, state.custom_fields_enums);
				var ugly_row = (function (lead) {
					if (!state.output_vars || !state.output_vars.length) {
						state.output_vars = typesDet.determineTypes(lead.custom_fields);
					}
					return [
						lead.id,
						lead.name,
						lead.price,
						lead.score,
						lead.status_id,
						lead.is_deleted,
						lead.account_id,
						lead.group_id,
						lead.closed_at,
						lead.created_at,
						lead.updated_at,
						lead.closest_task_at,
						lead.created_by,
						lead.updated_by,
						lead.tags,
						lead.company_id,
						lead.responsible_user_id,
						lead.loss_reason_id,
						lead.labor_cost,
						lead.pipeline_id,
						lead.custom_fields
					];
				})(injectedLead);
				return {
					output: [ ugly_row ],
					output_variables: [
						{ name: "id", type: "Long" },
						{ name: "name", type: "String" },
						{ name: "price", type: "Long" },
						{ name: "score", type: "String" },
						{ name: "status_id", type: "Long" },
						{ name: "is_deleted", type: "Boolean" },
						{ name: "account_id", type: "Long" },
						{ name: "group_id", type: "Long" },
						{ name: "closed_at", type: "DateTime" },
						{ name: "created_at", type: "DateTime" },
						{ name: "updated_at", type: "DateTime" },
						{ name: "closest_task_at", type: "DateTime" },
						{ name: "created_by", type: "Long" },
						{ name: "updated_by", type: "Long" },
						{ name: "tags", type: "String" },
						{ name: "company_id", type: "Long" },
						{ name: "responsible_user_id", type: "Long" },
						{ name: "loss_reason_id", type: "Long" },
						{ name: "labor_cost", type: "Long" },
						{ name: "pipeline_id", type: "Long" },
						{ type: "Object", name: "custom_fields", struct: state.output_vars }
					],
					state: {
						...state,
						hasNext: false
					},
					hasNext: false
				};
			}
		},
        GetLeads: {
            label: "Получить список сделок",
            description: "Возвращает список сделок",
            inputFields: [ {
                key: "data_range",
                type: "text",
                label: "Фильтровать по дате изменения",
                description: "",
                required: true
            } ],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/leads?page=1&limit=250`,
                    custom_fields_base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/leads/custom_fields?page=1&limit=250`,
                    next_page: context ? context.next_page : "",
                    custom_fields_next_page: context ? context.custom_fields_next_page : "",
                    page_number: context ? context.page_number : 0,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext,
                    output_vars: context ? context.output_vars : [],
                    custom_fields_enums: context ? context.custom_fields_enums : []
                };
                var typesDet = new TypeDeterminer;
                function normalizeLeads(lead) {
                    var toISO = t => t && t > 0 ? new Date(1000 * t).toISOString() : null;
                    var {id: id, name: name, price: price, score: score = null, status_id: status_id, is_deleted: is_deleted, account_id: account_id, group_id: group_id, closed_at: closed_at, created_at: created_at, updated_at: updated_at, closest_task_at: closest_task_at, created_by: created_by, updated_by: updated_by, responsible_user_id: responsible_user_id, loss_reason_id: loss_reason_id, labor_cost: labor_cost, pipeline_id: pipeline_id, custom_fields_values: custom_fields_values, _embedded: {tags: tags = [], companies: companies = []}} = lead;
                    return {
                        id: id,
                        name: name,
                        price: price,
                        score: score,
                        status_id: status_id,
                        is_deleted: is_deleted,
                        account_id: account_id,
                        group_id: group_id,
                        closed_at: toISO(closed_at),
                        created_at: toISO(created_at),
                        updated_at: toISO(updated_at),
                        closest_task_at: toISO(closest_task_at),
                        created_by: created_by,
                        updated_by: updated_by,
                        tags: tags.length ? JSON.stringify(tags) : null,
                        company_id: companies[0]?.id ?? 0,
                        responsible_user_id: responsible_user_id,
                        loss_reason_id: loss_reason_id ?? 0,
                        labor_cost: labor_cost,
                        pipeline_id: pipeline_id,
                        custom_fields_values: custom_fields_values
                    };
                }
                var leads = function() {
                    var rawUrl = state.next_page || state.base_url;
                    bundle.inputData.data_range && "" !== bundle.inputData.data_range && (rawUrl = mergeQueryParams(rawUrl, {
                        "filter[updated_at][from]": dateFilterConverter(bundle.inputData.data_range).toString()
                    }));
                    var response = makeRequest(service, {
                        url: rawUrl,
                        method: "GET",
                        headers: state.headers
                    }, {}, false);
                    if (!response) {
                        state.hasNext = false;
                        return [];
                    }
                    var {_embedded: _embedded, _links: _links, _page: _page} = response;
                    state.page_number = _page ?? null;
                    state.next_page = _links.next?.href ?? null;
                    state.hasNext = Boolean(_links.next);
                    return _embedded.leads.map(normalizeLeads);
                }();
                state.custom_fields_enums && 0 !== state.custom_fields_enums.length || function() {
                    var custom_fields = [];
                    var nextPageUrl = state.custom_fields_base_url;
                    for (;nextPageUrl; ) {
                        var response = makeRequest(service, {
                            url: nextPageUrl,
                            method: "GET",
                            headers: state.headers
                        }, {}, false);
                        custom_fields.push(...response._embedded.custom_fields);
                        nextPageUrl = response._links?.next?.href ?? null;
                    }
                    state.custom_fields_enums = function(custom_fields) {
                        var custom_fields_values = [];
                        var serviceFields = [ "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_referrer", "_ym_uid", "_ym_counter", "roistat", "referrer", "openstat_service", "openstat_campaign", "openstat_ad", "openstat_source", "from", "gclientid", "gclid", "yclid", "fbclid" ];
                        for (var field of custom_fields) {
                            field && field.name && -1 === serviceFields.indexOf(field.name) && custom_fields_values.push({
                                id: field.id,
                                name: field.name,
                                values: Array.isArray(field.enums) ? field.enums.map((field_enum => field_enum.value)) : []
                            });
                        }
                        return custom_fields_values;
                    }(custom_fields);
                }();
                var custom_fields_enums = state.custom_fields_enums;
                var injected_cf = function(leads, custom_fields_enums) {
                    return leads.map((lead => {
                        var custom_fields = custom_fields_enums.reduce(((acc, enum_field) => {
                            acc[enum_field.name] = null;
                            return acc;
                        }), {});
                        lead.custom_fields = custom_fields;
                        -1 !== Object.keys(lead).indexOf("custom_fields_values") && lead.custom_fields_values && lead.custom_fields_values.forEach((custom_field_value => {
                            var field_name = custom_field_value.field_name;
                            var values = custom_field_value.values;
                            Object.prototype.hasOwnProperty.call(lead.custom_fields, field_name) && (lead.custom_fields[field_name] = values && values.length > 0 ? values[0].value : null);
                        }));
                        delete lead.custom_fields_values;
                        return lead;
                    }));
                }(leads, custom_fields_enums);
                var ugly_leads = function(leads) {
                    return leads.map((lead => {
                        state.output_vars?.length || (state.output_vars = typesDet.determineTypes(lead.custom_fields));
                        return [ lead.id, lead.name, lead.price, lead.score, lead.status_id, lead.is_deleted, lead.account_id, lead.group_id, lead.closed_at, lead.created_at, lead.updated_at, lead.closest_task_at, lead.created_by, lead.updated_by, lead.tags, lead.company_id, lead.responsible_user_id, lead.loss_reason_id, lead.labor_cost, lead.pipeline_id, lead.custom_fields ];
                    }));
                }(injected_cf);
                return leads && leads.length && custom_fields_enums ? {
                    output: ugly_leads,
                    output_variables: [ {
                        name: "id",
                        type: "Long"
                    }, {
                        name: "name",
                        type: "String"
                    }, {
                        name: "price",
                        type: "Long"
                    }, {
                        name: "score",
                        type: "String"
                    }, {
                        name: "status_id",
                        type: "Long"
                    }, {
                        name: "is_deleted",
                        type: "Boolean"
                    }, {
                        name: "account_id",
                        type: "Long"
                    }, {
                        name: "group_id",
                        type: "Long"
                    }, {
                        name: "closed_at",
                        type: "DateTime"
                    }, {
                        name: "created_at",
                        type: "DateTime"
                    }, {
                        name: "updated_at",
                        type: "DateTime"
                    }, {
                        name: "closest_task_at",
                        type: "DateTime"
                    }, {
                        name: "created_by",
                        type: "Long"
                    }, {
                        name: "updated_by",
                        type: "Long"
                    }, {
                        name: "tags",
                        type: "String"
                    }, {
                        name: "company_id",
                        type: "Long"
                    }, {
                        name: "responsible_user_id",
                        type: "Long"
                    }, {
                        name: "loss_reason_id",
                        type: "Long"
                    }, {
                        name: "labor_cost",
                        type: "Long"
                    }, {
                        name: "pipeline_id",
                        type: "Long"
                    }, {
                        type: "Object",
                        name: "custom_fields",
                        struct: state.output_vars
                    } ],
                    state: state,
                    hasNext: state.hasNext
                } : {
                    output: [ [] ],
                    output_variables: [],
                    state: {},
                    hasNext: false
                };
            }
        },
        CreateLead: {
            label: "Создать сделку",
            description: "Создает сделку в amoCRM",
            inputFields: [ {
                key: "name_lead",
                type: "text",
                label: "Название сделки",
                required: false
            }, {
                key: "price_lead",
                type: "text",
                label: "Бюджет сделки",
                required: false
            }, {
                key: "company_lead",
                type: "text",
                label: "ID компании для которой добавляется сделка",
                required: false
            }, {
                key: "pipeline_id_lead",
                type: "text",
                label: "ID воронки, в которую добавляется сделка",
                required: false
            }, {
                key: "responsible_user_id_lead",
                type: "text",
                label: "ID пользователя, ответственного за сделку",
                required: false
            }, {
                key: "complete_till",
                type: "text",
                label: "Дата завершения сделки",
                required: false
            } ],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/leads`,
                    next_page: context ? context.next_page : null,
                    page_number: context ? context.page_number : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext
                };
                function createBodyForAmoCrm() {
                    var lead = {};
                    var _embedded = {};
                    bundle.inputData.name_lead && (lead.name = bundle.inputData.name_lead);
                    bundle.inputData.price_lead && (lead.price = ~~bundle.inputData.price_lead);
                    bundle.inputData.pipeline_id_lead && (lead.pipeline_id = bundle.inputData.pipeline_id_lead);
                    bundle.inputData.responsible_user_id_lead && (lead.responsible_user_id = parseInt(bundle.inputData.responsible_user_id_lead, 10));
                    bundle.inputData.complete_till && (lead.complete_till = parseInt(bundle.inputData.complete_till, 10));
                    bundle.inputData.company_lead && (_embedded.companies = [ {
                        id: ~~bundle.inputData.company_lead
                    } ]);
                    lead._embedded = _embedded;
                    return lead;
                }
                return {
                    output: function() {
                        var lead_response = makeRequest(service, {
                            url: state.base_url,
                            method: "POST",
                            headers: state.headers
                        }, [ createBodyForAmoCrm() ], false);
                        if (lead_response) {
                            return lead_response._embedded.leads.map((lead => [ lead.id ]));
                        }
                    }(),
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    } ],
                    state: {},
                    hasNext: false
                };
            }
        },
        GetLeadsPipelines: {
            label: "Получить cписок воронок сделок",
            description: "Возвращает cписок воронок сделок",
            inputFields: [],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/leads/pipelines?page=1&limit=250`,
                    next_page: context ? context.next_page : null,
                    page_number: context ? context.page_number : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext
                };
                function normalizeLeadsPipelines(lead_pipeline) {
                    var pipeline = {
                        id: lead_pipeline.id,
                        name: lead_pipeline.name,
                        sort: lead_pipeline.sort,
                        is_main: lead_pipeline.is_main,
                        is_archived: lead_pipeline.is_archive,
                        account_id: lead_pipeline.account_id,
                        is_unsorted_on: lead_pipeline.is_unsorted_on
                    };
                    return [ pipeline.id, pipeline.name, pipeline.sort, pipeline.is_main, pipeline.is_archived, pipeline.account_id, pipeline.is_unsorted_on ];
                }
                return {
                    output: function() {
                        var url = state.next_page ? state.next_page : state.base_url;
                        var leads_response = makeRequest(service, {
                            url: url,
                            method: "GET",
                            headers: state.headers
                        }, {}, false);
                        if (leads_response) {
                            if (leads_response._links.next) {
                                state.next_page = leads_response._links.next.href;
                                state.hasNext = true;
                            } else {
                                state.hasNext = false;
                            }
                            return leads_response._embedded.pipelines.map(normalizeLeadsPipelines);
                        }
                        state.hasNext = false;
                    }() ?? [ [] ],
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    }, {
                        type: "String",
                        name: "name"
                    }, {
                        type: "Long",
                        name: "sort"
                    }, {
                        type: "Boolean",
                        name: "is_main"
                    }, {
                        type: "Boolean",
                        name: "is_archived"
                    }, {
                        type: "Long",
                        name: "account_id"
                    }, {
                        type: "Boolean",
                        name: "is_unsorted_on"
                    } ],
                    state: state,
                    hasNext: state.hasNext
                };
            }
        },
        GetLeadsPipelineStatuses: {
            label: "Получить cписок статусов воронки сделок",
            description: "Возвращает cписок статусов воронки сделок",
            inputFields: [],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/leads/pipelines`,
                    next_page: context ? context.next_page : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    limit: 250,
                    hasNext: !context || context.hasNext
                };
                function normalizedPipelinesStatuses(pipeline_status) {
                    var pipeline_status_template = {
                        id: pipeline_status.id || null,
                        name: pipeline_status.name || null,
                        sort: pipeline_status.sort || null,
                        is_editable: pipeline_status.is_editable,
                        pipeline_id: pipeline_status.pipeline_id || null,
                        color: pipeline_status.color || null,
                        type: pipeline_status.type,
                        account_id: pipeline_status.account_id || null,
                        _links: {
                            self: {
                                href: pipeline_status._links ? pipeline_status._links.self.href : null
                            }
                        }
                    };
                    return [ pipeline_status_template.id, pipeline_status_template.name, pipeline_status_template.sort, pipeline_status_template.is_editable, pipeline_status_template.pipeline_id, pipeline_status_template.color, pipeline_status_template.type, pipeline_status_template._links, pipeline_status.account_id ];
                }
                var leads_pipelines = function() {
                    var url = state.next_page ? state.next_page : state.base_url + "?page=1&limit=250";
                    var leads_response = makeRequest(service, {
                        url: url,
                        method: "GET",
                        headers: state.headers
                    }, {}, false);
                    if (leads_response) {
                        if (leads_response._links.next) {
                            state.next_page = leads_response._links.next.href;
                            state.hasNext = true;
                        } else {
                            state.hasNext = false;
                        }
                        return leads_response._embedded.pipelines;
                    }
                    state.hasNext = false;
                }();
                if (!leads_pipelines) {
                    return {
                        output: [ [ "Воронки не найдены" ] ],
                        output_variables: [ {
                            type: "String",
                            name: "status"
                        } ],
                        state: state,
                        hasNext: false
                    };
                }
                var out_fields = [];
                leads_pipelines.forEach((leads_pipeline => {
                    var lead_status = (pipeline_id = leads_pipeline.id.toString(), url = `${state.base_url}/${pipeline_id}/statuses?page=1&limit=250`, 
                    makeRequest(service, {
                        url: url,
                        method: "GET",
                        headers: state.headers
                    }, {}, false)._embedded.statuses).map(normalizedPipelinesStatuses);
                    var pipeline_id, url;
                    out_fields.push(...lead_status);
                }));
                return {
                    output: out_fields,
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    }, {
                        type: "String",
                        name: "name"
                    }, {
                        type: "Long",
                        name: "sort"
                    }, {
                        type: "Boolean",
                        name: "is_editable"
                    }, {
                        type: "Long",
                        name: "pipeline_id"
                    }, {
                        type: "String",
                        name: "color"
                    }, {
                        type: "Long",
                        name: "type"
                    }, {
                        type: "Object",
                        name: "_links",
                        struct: [ {
                            type: "Object",
                            name: "self",
                            struct: [ {
                                type: "String",
                                name: "href"
                            } ]
                        } ]
                    }, {
                        type: "Long",
                        name: "account_id"
                    } ],
                    state: state,
                    hasNext: state.hasNext
                };
            }
        },
        GetLossReasons: {
            label: "Получить причины отказа",
            description: "Возвращает информацию о причинах отказа",
            inputFields: [],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4`,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    limit: 250,
                    hasNext: !context || context.hasNext
                };
                function normalizeLossReasons(reasons) {
                    var loss_reasons_template = {
                        id: reasons.id,
                        name: reasons.name,
                        sort: reasons.sort,
                        created_at: reasons.created_at && reasons.created_at > 0 ? new Date(1000 * reasons.created_at).toISOString() : null,
                        updated_at: reasons.updated_at && reasons.updated_at > 0 ? new Date(1000 * reasons.updated_at).toISOString() : null,
                        _links: {
                            self: {
                                href: reasons._links ? reasons._links.self.href : null
                            }
                        }
                    };
                    return [ loss_reasons_template.id, loss_reasons_template.name, loss_reasons_template.sort, loss_reasons_template.created_at, loss_reasons_template.updated_at, loss_reasons_template._links ];
                }
                return {
                    output: makeRequest(service, {
                        url: `${state.base_url}/leads/loss_reasons?page=1&limit=250`,
                        method: "GET",
                        headers: state.headers
                    }, {}, false)._embedded.loss_reasons.map(normalizeLossReasons),
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    }, {
                        type: "String",
                        name: "name"
                    }, {
                        type: "Long",
                        name: "sort"
                    }, {
                        type: "DateTime",
                        name: "created_at"
                    }, {
                        type: "DateTime",
                        name: "updated_at"
                    }, {
                        type: "Object",
                        name: "_links",
                        struct: [ {
                            type: "Object",
                            name: "self",
                            struct: [ {
                                type: "String",
                                name: "href"
                            } ]
                        } ]
                    } ],
                    state: {},
                    hasNext: false
                };
            }
        },
        GetNotes: {
            label: "Получить примечания",
            description: "Возвращает примечания для всех доступных объектов",
            inputFields: [ {
                key: "data_range",
                type: "text",
                label: "Фильтровать по дате изменения",
                required: false
            } ],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_urls: [ `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/leads/notes?page=1&limit=250`, `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/companies/notes?page=1&limit=250`, `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/contacts/notes?page=1&limit=250` ],
                    next_page: context ? context.next_page : null,
                    page_number: context ? context.page_number : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext,
                    type_counter: context ? context.type_counter : 0
                };
                var out_fields = function() {
                    var url = "";
                    url = state.next_page ? state.next_page : bundle.inputData.data_range ? state.base_urls[state.type_counter] + "&" + QueryFilter({
                        "filter[updated_at]": dateFilterConverter(bundle.inputData.data_range)
                    }) : state.base_urls[state.type_counter];
                    var notes_response = makeRequest(service, {
                        url: url,
                        method: "GET",
                        headers: state.headers
                    }, {}, false);
                    if (notes_response) {
                        if (notes_response._links.next) {
                            state.next_page = notes_response._links.next.href;
                            state.hasNext = true;
                        } else {
                            state.type_counter = state.type_counter + 1;
                            if (state.type_counter < state.base_urls.length) {
                                bundle.inputData.data_range ? state.next_page = state.base_urls[state.type_counter] + "&" + QueryFilter({
                                    "filter[updated_at]": dateFilterConverter(bundle.inputData.data_range)
                                }) : state.next_page = state.base_urls[state.type_counter];
                            } else {
                                state.next_page = null;
                                state.hasNext = false;
                            }
                        }
                        return notes_response._embedded.notes.map((note => function(note, parent_note_type) {
                            var note_template = {
                                id: note.id,
                                entity_id: note.entity_id,
                                created_by: note.created_by,
                                updated_by: note.updated_by,
                                created_at: note.created_at && note.created_at > 0 ? new Date(1000 * note.created_at).toISOString() : null,
                                updated_at: note.updated_at && note.updated_at > 0 ? new Date(1000 * note.updated_at).toISOString() : null,
                                responsible_user_id: note.responsible_user_id,
                                group_id: note.group_id,
                                note_type: note.note_type,
                                params: {
                                    text: note.params.text || ""
                                },
                                account_id: note.account_id,
                                parent_type: parent_note_type || ""
                            };
                            return [ note_template.id, note_template.entity_id, note_template.created_by, note_template.updated_by, note_template.created_at, note_template.updated_at, note_template.responsible_user_id, note_template.group_id, note_template.note_type, note_template.params.text, note_template.account_id, note_template.parent_type ];
                        }(note, function(url) {
                            return url.includes("leads") ? "leads" : url.includes("companies") ? "companies" : url.includes("contacts") ? "contacts" : "unknown";
                        }(url))));
                    }
                }();
                return Array.isArray(out_fields) ? {
                    output: out_fields,
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    }, {
                        type: "Long",
                        name: "entity_id"
                    }, {
                        type: "Long",
                        name: "created_by"
                    }, {
                        type: "Long",
                        name: "updated_by"
                    }, {
                        type: "DateTime",
                        name: "created_at"
                    }, {
                        type: "DateTime",
                        name: "updated_at"
                    }, {
                        type: "Long",
                        name: "responsible_user_id"
                    }, {
                        type: "Long",
                        name: "group_id"
                    }, {
                        type: "String",
                        name: "note_type"
                    }, {
                        type: "String",
                        name: "text"
                    }, {
                        type: "Long",
                        name: "account_id"
                    }, {
                        type: "String",
                        name: "parent_type"
                    } ],
                    state: state,
                    hasNext: state.hasNext
                } : {
                    output: [],
                    output_variables: [],
                    state: state,
                    hasNext: state.hasNext
                };
            }
        },
        GetUsers: {
            label: "Получить список пользователей",
            description: "",
            inputFields: [],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/users?page=1&limit=250`,
                    next_page: context ? context.next_page : null,
                    page_number: context ? context.page_number : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext
                };
                function normalizeUsers(user) {
                    var user_template = {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        lang: user.lang,
                        is_active: user.rights.is_active
                    };
                    return [ user_template.id, user_template.name, user_template.email, user_template.lang, user_template.is_active ];
                }
                return {
                    output: (() => {
                        var url = state.next_page || state.base_url;
                        var response = makeRequest(service, {
                            url: url,
                            method: "GET",
                            headers: state.headers
                        }, {}, false);
                        if (!response) {
                            state.hasNext = false;
                            return [];
                        }
                        var {_embedded: _embedded, _links: _links, _page: _page} = response;
                        state.page_number = _page ?? null;
                        state.next_page = _links.next?.href ?? null;
                        state.hasNext = Boolean(_links.next);
                        return _embedded.users.map(normalizeUsers);
                    })(),
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    }, {
                        type: "String",
                        name: "name"
                    }, {
                        type: "String",
                        name: "email"
                    }, {
                        type: "String",
                        name: "lang"
                    }, {
                        type: "Boolean",
                        name: "is_active"
                    } ],
                    state: state,
                    hasNext: state.hasNext
                };
            }
        },
        GetUserRoles: {
            label: "Получить список ролей пользователей",
            description: "Возвращает список ролей пользователей",
            inputFields: [],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/roles?page=1&limit=250`,
                    next_page: context ? context.next_page : null,
                    page_number: context ? context.page_number : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext
                };
                var normalizeUserRoles = user_role => {
                    var user_role_template = {
                        id: user_role.id || null,
                        name: user_role.name || null,
                        lead_rights: user_role.rights.leads || null,
                        company_rights: user_role.rights.companies || null,
                        contact_rights: user_role.rights.contacts || null,
                        task_rights: user_role.rights.tasks || null
                    };
                    return [ user_role_template.id, user_role_template.name, user_role_template.lead_rights, user_role_template.company_rights, user_role_template.contact_rights, user_role_template.task_rights ];
                };
                return {
                    output: (() => {
                        var url = state.next_page || state.base_url;
                        var response = makeRequest(service, {
                            url: url,
                            method: "GET",
                            headers: state.headers
                        }, {}, false);
                        if (!response) {
                            state.hasNext = false;
                            return [];
                        }
                        var {_embedded: _embedded, _links: _links, _page: _page} = response;
                        state.page_number = _page ?? null;
                        state.next_page = _links.next?.href ?? null;
                        state.hasNext = Boolean(_links.next);
                        return _embedded.roles.map(normalizeUserRoles);
                    })(),
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    }, {
                        type: "String",
                        name: "name"
                    }, {
                        type: "Object",
                        name: "lead_rights",
                        struct: [ {
                            type: "String",
                            name: "view"
                        }, {
                            type: "String",
                            name: "edit"
                        }, {
                            type: "String",
                            name: "add"
                        }, {
                            type: "String",
                            name: "delete"
                        }, {
                            type: "String",
                            name: "export"
                        } ]
                    }, {
                        type: "Object",
                        name: "company_rights",
                        struct: [ {
                            type: "String",
                            name: "view"
                        }, {
                            type: "String",
                            name: "edit"
                        }, {
                            type: "String",
                            name: "add"
                        }, {
                            type: "String",
                            name: "delete"
                        }, {
                            type: "String",
                            name: "export"
                        } ]
                    }, {
                        type: "Object",
                        name: "contact_rights",
                        struct: [ {
                            type: "String",
                            name: "view"
                        }, {
                            type: "String",
                            name: "edit"
                        }, {
                            type: "String",
                            name: "add"
                        }, {
                            type: "String",
                            name: "delete"
                        }, {
                            type: "String",
                            name: "export"
                        } ]
                    }, {
                        type: "Object",
                        name: "task_rights",
                        struct: [ {
                            type: "String",
                            name: "edit"
                        }, {
                            type: "String",
                            name: "delete"
                        } ]
                    } ],
                    state: state,
                    hasNext: state.hasNext
                };
            }
        },
        GetCompanies: {
            label: "Получить список компаний",
            description: "Возвращает список компаний",
            inputFields: [ {
                key: "data_range",
                type: "text",
                label: "Фильтровать по дате изменения",
                required: false
            } ],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/companies?page=1&limit=250`,
                    custom_fields_base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/companies/custom_fields?page=1&limit=250`,
                    next_page: context ? context.next_page : "",
                    custom_fields_next_page: context ? context.custom_fields_next_page : "",
                    page_number: context ? context.page_number : 0,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext,
                    output_vars: context ? context.output_vars : [],
                    custom_fields_enums: context ? context.custom_fields_enums : []
                };
                var typesDet = new TypeDeterminer;
                function normalizeCompanies(company) {
                    return {
                        id: company.id,
                        name: company.name,
                        responsible_user_id: company.responsible_user_id,
                        group_id: company.group_id,
                        created_at: company.created_at ? new Date(1000 * company.created_at).toISOString() : null,
                        updated_at: company.updated_at ? new Date(1000 * company.updated_at).toISOString() : null,
                        created_by: company.created_by,
                        updated_by: company.updated_by,
                        closest_task_at: company.closest_task_at ? new Date(1000 * company.closest_task_at).toISOString() : null,
                        is_deleted: company.is_deleted,
                        custom_fields_values: company.custom_fields_values,
                        account_id: company.account_id,
                        tags: company._embedded.tags && company._embedded.tags.length ? company._embedded.tags.map((tag => JSON.stringify(tag))) : null
                    };
                }
                var companies = (() => {
                    var rawUrl = state.next_page || state.base_url;
                    bundle.inputData.data_range && "" !== bundle.inputData.data_range && (rawUrl = mergeQueryParams(rawUrl, {
                        "filter[updated_at][from]": dateFilterConverter(bundle.inputData.data_range).toString()
                    }));
                    var response = makeRequest(service, {
                        url: rawUrl,
                        method: "GET",
                        headers: state.headers
                    }, {}, false);
                    if (!response) {
                        state.hasNext = false;
                        return [];
                    }
                    var {_embedded: _embedded, _links: _links, _page: _page} = response;
                    state.page_number = _page ?? null;
                    state.next_page = _links.next?.href ?? null;
                    state.hasNext = Boolean(_links.next);
                    return _embedded.companies.map(normalizeCompanies);
                })();
                state.custom_fields_enums && 0 !== state.custom_fields_enums.length || function() {
                    var custom_fields = [];
                    var nextPageUrl = state.custom_fields_base_url;
                    for (;nextPageUrl; ) {
                        var response = makeRequest(service, {
                            url: nextPageUrl,
                            method: "GET",
                            headers: state.headers
                        }, {}, false);
                        custom_fields.push(...response._embedded.custom_fields);
                        nextPageUrl = response._links?.next?.href ?? null;
                    }
                    state.custom_fields_enums = function(custom_fields) {
                        var custom_fields_values = [];
                        var serviceFields = [ "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_referrer", "_ym_uid", "_ym_counter", "roistat", "referrer", "openstat_service", "openstat_campaign", "openstat_ad", "openstat_source", "from", "gclientid", "gclid", "yclid", "fbclid" ];
                        for (var field of custom_fields) {
                            field && field.name && -1 === serviceFields.indexOf(field.name) && custom_fields_values.push({
                                id: field.id,
                                name: field.name,
                                values: Array.isArray(field.enums) ? field.enums.map((field_enum => field_enum.value)) : []
                            });
                        }
                        return custom_fields_values;
                    }(custom_fields);
                }();
                var injected_cf = function(companies, custom_fields_enums) {
                    return companies.map((company => {
                        var custom_fields = custom_fields_enums.reduce(((acc, enum_field) => {
                            acc[enum_field.name] = null;
                            return acc;
                        }), {});
                        company.custom_fields = custom_fields;
                        -1 !== Object.keys(company).indexOf("custom_fields_values") && company.custom_fields_values && company.custom_fields_values.forEach((custom_field_value => {
                            var field_name = custom_field_value.field_name;
                            var values = custom_field_value.values;
                            Object.hasOwnProperty.call(company.custom_fields, field_name) && (company.custom_fields[field_name] = values && values.length > 0 ? values[0].value : null);
                        }));
                        delete company.custom_fields_values;
                        return company;
                    }));
                }(companies, state.custom_fields_enums);
                var ugly_companies = function(companies) {
                    return companies.map((company => {
                        state.output_vars?.length || (state.output_vars = typesDet.determineTypes(company.custom_fields));
                        return [ company.id, company.name, company.responsible_user_id, company.group_id, company.created_at, company.updated_at, company.created_by, company.updated_by, company.closest_task_at, company.is_deleted, company.custom_fields, company.account_id, company.tags ];
                    }));
                }(injected_cf);
                return companies && companies.length ? {
                    output: ugly_companies,
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    }, {
                        type: "String",
                        name: "name"
                    }, {
                        type: "Long",
                        name: "responsible_user_id"
                    }, {
                        type: "Long",
                        name: "group_id"
                    }, {
                        type: "DateTime",
                        name: "created_at"
                    }, {
                        type: "DateTime",
                        name: "updated_at"
                    }, {
                        type: "Long",
                        name: "created_by"
                    }, {
                        type: "Long",
                        name: "updated_by"
                    }, {
                        type: "DateTime",
                        name: "closest_task_at"
                    }, {
                        type: "Boolean",
                        name: "is_deleted"
                    }, {
                        type: "Object",
                        name: "custom_fields",
                        struct: state.output_vars
                    }, {
                        type: "Long",
                        name: "account_id"
                    }, {
                        type: "StringArray",
                        name: "tags"
                    } ],
                    state: state,
                    hasNext: state.hasNext
                } : {
                    output: [ [ "Компании не найдены" ] ],
                    output_variables: [ {
                        type: "String",
                        name: "status"
                    } ],
                    state: {
                        base_url: state.base_url,
                        custom_fields_base_url: state.custom_fields_base_url,
                        next_page: null,
                        custom_fields_next_page: null,
                        page_number: state.page_number,
                        headers: state.headers,
                        hasNext: false,
                        output_vars: state.output_vars ?? []
                    },
                    hasNext: false
                };
            }
        },
        CreateCompany: {
            label: "Создать компанию",
            description: "Создает компанию в amoCRM",
            inputFields: [ {
                key: "company_name",
                type: "text",
                label: "Название компании",
                required: false
            }, {
                key: "company_phone",
                type: "text",
                label: "Раб. тел.",
                required: false
            }, {
                key: "company_email",
                type: "text",
                label: "Email раб.",
                required: false
            }, {
                key: "company_web",
                type: "text",
                label: "Web-сайт компании",
                required: false
            }, {
                key: "company_address",
                type: "text",
                label: "Адрес компании",
                required: false
            } ],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/companies`,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext
                };
                var company_name = bundle.inputData?.company_name || "";
                function createBodyForAmoCrm() {
                    var company = {};
                    var custom_fields = [];
                    company_name && (company.name = company_name);
                    var fieldsMapping = {
                        company_phone: {
                            field_code: "PHONE",
                            enum_code: "WORK"
                        },
                        company_email: {
                            field_code: "EMAIL",
                            enum_code: "WORK"
                        },
                        company_web: {
                            field_code: "WEB"
                        },
                        company_address: {
                            field_code: "ADDRESS"
                        },
                        company_name: {
                            field_code: "",
                            enum_code: void 0
                        }
                    };
                    for (var field of Object.keys(fieldsMapping)) {
                        var value = bundle.inputData?.[field];
                        value && custom_fields.push({
                            field_code: fieldsMapping[field].field_code,
                            values: [ {
                                value: value,
                                enum_code: fieldsMapping[field].enum_code
                            } ]
                        });
                    }
                    company.custom_fields_values = custom_fields;
                    return company;
                }
                var company = function() {
                    var created_company = makeRequest(service, {
                        url: state.base_url,
                        method: "POST",
                        headers: state.headers
                    }, [ createBodyForAmoCrm() ], false);
                    if (created_company) {
                        return created_company._embedded.companies.map((company => [ company.id ]));
                    }
                }();
                return company ? {
                    output: company,
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    } ],
                    state: {},
                    hasNext: false
                } : {
                    output: [ [ "Неизвестная ошибка при создании компании. Повторно запустите блок" ] ],
                    output_variables: [ {
                        type: "String",
                        name: "status"
                    } ],
                    state: {},
                    hasNext: false
                };
            }
        },
        GetEvents: {
            label: "Получить список событий",
            description: "Возвращает список событий",
            inputFields: [ {
                key: "data_range",
                type: "text",
                label: "Фильтровать по дате создания",
                required: false
            } ],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/events?page=1&limit=250`,
                    next_page: context ? context.next_page : null,
                    page_number: context ? context.page_number : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext
                };
                function normalizeEvent(event) {
                    var event_template = {
                        id: event.id,
                        type: event.type,
                        entity_id: event.entity_id,
                        entity_type: event.entity_type,
                        created_by: event.created_by,
                        created_at: event.created_at && event.created_at > 0 ? new Date(1000 * event.created_at).toISOString() : null,
                        value_after: event.value_after && event.value_after.length ? event.value_after.map((value => JSON.stringify(value))) : null,
                        value_before: event.value_before && event.value_before.length ? event.value_before.map((value => JSON.stringify(value))) : null,
                        account_id: event.account_id
                    };
                    return [ event_template.id, event_template.type, event_template.entity_id, event_template.entity_type, event_template.created_by, event_template.created_at, event_template.value_after, event_template.value_before, event_template.account_id ];
                }
                return {
                    output: function() {
                        var rawUrl = state.next_page || state.base_url;
                        bundle.inputData.data_range && "" !== bundle.inputData.data_range && (rawUrl = mergeQueryParams(rawUrl, {
                            "filter[created_at][from]": dateFilterConverter(bundle.inputData.data_range).toString()
                        }));
                        var response = makeRequest(service, {
                            url: rawUrl,
                            method: "GET",
                            headers: state.headers
                        }, {}, false);
                        if (!response) {
                            state.hasNext = false;
                            return [];
                        }
                        var {_embedded: _embedded, _links: _links, _page: _page} = response;
                        state.page_number = _page ?? null;
                        state.next_page = _links.next?.href ?? null;
                        state.hasNext = Boolean(_links.next);
                        return _embedded.events.map(normalizeEvent);
                    }(),
                    output_variables: [ {
                        type: "String",
                        name: "id"
                    }, {
                        type: "String",
                        name: "type"
                    }, {
                        type: "Long",
                        name: "entity_id"
                    }, {
                        type: "String",
                        name: "entity_type"
                    }, {
                        type: "Long",
                        name: "created_by"
                    }, {
                        type: "DateTime",
                        name: "created_at"
                    }, {
                        type: "StringArray",
                        name: "value_after"
                    }, {
                        type: "StringArray",
                        name: "value_before"
                    }, {
                        type: "Long",
                        name: "account_id"
                    } ],
                    state: state,
                    hasNext: state.hasNext
                };
            }
        },
        GetEventsType: {
            label: "Получить типы событий",
            description: "Возвращает все доступные для аккаунта типы событий",
            inputFields: [],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/events?page=1&limit=250`,
                    next_page: context ? context.next_page : null,
                    page_number: context ? context.page_number : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext
                };
                function normalizeEventTypes(event) {
                    return [ event.key, event.lang, event.type ];
                }
                return {
                    output: makeRequest(service, {
                        url: `${state.base_url}/types`,
                        method: "GET",
                        headers: state.headers
                    }, {}, false)._embedded.events_types.map(normalizeEventTypes),
                    output_variables: [ {
                        type: "String",
                        name: "key"
                    }, {
                        type: "String",
                        name: "lang"
                    }, {
                        type: "Long",
                        name: "type"
                    } ],
                    state: state,
                    hasNext: state.hasNext
                };
            }
        },
        GetContacts: {
            label: "Получить список контактов",
            description: "Возвращает список контактов",
            inputFields: [ {
                key: "data_range",
                type: "text",
                label: "Фильтровать по дате изменения",
                required: false
            } ],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/contacts?page=1&limit=250`,
                    custom_fields_base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/contacts/custom_fields?page=1&limit=250`,
                    next_page: context ? context.next_page : null,
                    custom_fields_next_page: context ? context.custom_fields_next_page : null,
                    page_number: context ? context.page_number : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: !context || context.hasNext,
                    output_vars: context ? context.output_vars : [],
                    custom_fields_enums: context ? context.custom_fields_enums : []
                };
                var typesDet = new TypeDeterminer;
                function normalizeContacts(contact) {
                    return {
                        id: contact.id,
                        name: contact.name,
                        first_name: contact.first_name,
                        last_name: contact.last_name,
                        responsible_user_id: contact.responsible_user_id,
                        group_id: contact.group_id,
                        created_at: contact.created_at ? new Date(1000 * contact.created_at).toISOString() : null,
                        updated_at: contact.updated_at ? new Date(1000 * contact.updated_at).toISOString() : null,
                        created_by: contact.created_by,
                        updated_by: contact.updated_by,
                        closest_task_at: contact.closest_task_at ? new Date(1000 * contact.closest_task_at).toISOString() : null,
                        is_deleted: contact.is_deleted,
                        is_unsorted: contact.is_unsorted,
                        custom_fields_values: contact.custom_fields_values,
                        account_id: contact.account_id,
                        tags: contact._embedded.tags && contact._embedded.tags.length ? contact._embedded.tags.map((tag => JSON.stringify(tag))) : null,
                        companies: contact._embedded.companies && contact._embedded.companies.length ? contact._embedded.companies[0].id : null
                    };
                }
                var contacts = (() => {
                    var rawUrl = state.next_page || state.base_url;
                    bundle.inputData.data_range && "" !== bundle.inputData.data_range && (rawUrl = mergeQueryParams(rawUrl, {
                        "filter[updated_at][from]": dateFilterConverter(bundle.inputData.data_range).toString()
                    }));
                    var response = makeRequest(service, {
                        url: rawUrl,
                        method: "GET",
                        headers: state.headers
                    }, {}, false);
                    if (!response) {
                        state.hasNext = false;
                        return [];
                    }
                    var {_embedded: _embedded, _links: _links, _page: _page} = response;
                    state.page_number = _page ?? null;
                    state.next_page = _links.next?.href ?? null;
                    state.hasNext = Boolean(_links.next);
                    return _embedded.contacts.map(normalizeContacts);
                })();
                state.custom_fields_enums && 0 !== state.custom_fields_enums.length || function() {
                    var custom_fields = [];
                    var nextPageUrl = state.custom_fields_base_url;
                    for (;nextPageUrl; ) {
                        var response = makeRequest(service, {
                            url: nextPageUrl,
                            method: "GET",
                            headers: state.headers
                        }, {}, false);
                        custom_fields.push(...response._embedded.custom_fields);
                        nextPageUrl = response._links?.next?.href ?? null;
                    }
                    state.custom_fields_enums = function(custom_fields) {
                        var custom_fields_values = [];
                        var serviceFields = [ "utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content", "utm_referrer", "_ym_uid", "_ym_counter", "y_files", "y_folder", "roistat", "referrer", "openstat_service", "openstat_campaign", "openstat_ad", "openstat_source", "from", "gclientid", "gclid", "yclid", "fbclid" ];
                        for (var field of custom_fields) {
                            field && field.name && -1 === serviceFields.indexOf(field.name) && custom_fields_values.push({
                                id: field.id,
                                name: field.name,
                                values: Array.isArray(field.enums) ? field.enums.map((field_enum => field_enum.value)) : []
                            });
                        }
                        return custom_fields_values;
                    }(custom_fields);
                }();
                var injected_cf = function(contacts, custom_fields_enums) {
                    return contacts.map((contact => {
                        var custom_fields = custom_fields_enums.reduce(((acc, enum_field) => {
                            acc[enum_field.name] = null;
                            return acc;
                        }), {});
                        contact.custom_fields = custom_fields;
                        -1 !== Object.keys(contact).indexOf("custom_fields_values") && contact.custom_fields_values && contact.custom_fields_values.forEach((custom_field_value => {
                            var field_name = custom_field_value.field_name;
                            var values = custom_field_value.values;
                            Object.hasOwnProperty.call(contact.custom_fields, field_name) && (contact.custom_fields[field_name] = values && values.length > 0 ? values[0].value : null);
                        }));
                        delete contact.custom_fields_values;
                        return contact;
                    }));
                }(contacts, state.custom_fields_enums);
                var ugly_contacts = function(contacts) {
                    return contacts.map((contact => {
                        state.output_vars?.length || (state.output_vars = typesDet.determineTypes(contact.custom_fields));
                        return [ contact.id, contact.name, contact.first_name, contact.last_name, contact.responsible_user_id, contact.group_id, contact.created_at, contact.updated_at, contact.created_by, contact.updated_by, contact.closest_task_at, contact.is_deleted, contact.is_unsorted, contact.custom_fields, contact.account_id, contact.tags, contact.companies ];
                    }));
                }(injected_cf);
                return {
                    output: ugly_contacts,
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    }, {
                        type: "String",
                        name: "name"
                    }, {
                        type: "String",
                        name: "first_name"
                    }, {
                        type: "String",
                        name: "last_name"
                    }, {
                        type: "Long",
                        name: "responsible_user_id"
                    }, {
                        type: "Long",
                        name: "group_id"
                    }, {
                        type: "DateTime",
                        name: "created_at"
                    }, {
                        type: "DateTime",
                        name: "updated_at"
                    }, {
                        type: "Long",
                        name: "created_by"
                    }, {
                        type: "Long",
                        name: "updated_by"
                    }, {
                        type: "DateTime",
                        name: "closest_task_at"
                    }, {
                        type: "Boolean",
                        name: "is_deleted"
                    }, {
                        type: "Boolean",
                        name: "is_unsorted"
                    }, {
                        type: "Object",
                        name: "custom_fields",
                        struct: state.output_vars
                    }, {
                        type: "Long",
                        name: "account_id"
                    }, {
                        type: "StringArray",
                        name: "tags"
                    }, {
                        type: "Long",
                        name: "company_id"
                    } ],
                    state: state,
                    hasNext: state.hasNext
                };
            }
        },
        CreateContact: {
            label: "Создать контакт",
            description: "Создает контакт в amoCRM",
            inputFields: [ {
                key: "contact_name",
                type: "text",
                label: "ФИО",
                required: false
            }, {
                key: "contact_phone",
                type: "text",
                label: "Раб. тел.",
                required: false
            }, {
                key: "contact_email",
                type: "text",
                label: "Email раб.",
                required: false
            }, {
                key: "contact_position",
                type: "text",
                label: "Должность",
                required: false
            }, {
                key: "contact_company_switcher",
                type: "switcher",
                label: "Связать контакт с компанией?",
                required: true
            }, (service, bundle) => bundle.inputData.contact_company_switcher ? [ {
                key: "contact_company",
                type: "text",
                label: "Идентификатор компании",
                required: true
            } ] : [] ],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/contacts`,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: context?.hasNext ?? false
                };
                function createBodyForAmoCrm() {
                    var contact = {};
                    var custom_fields = [];
                    bundle.inputData.contact_name && (contact.name = bundle.inputData.contact_name);
                    var fieldsMapping = {
                        contact_phone: {
                            field_code: "PHONE",
                            enum_code: "WORK"
                        },
                        contact_email: {
                            field_code: "EMAIL",
                            enum_code: "WORK"
                        },
                        contact_position: {
                            field_code: "POSITION"
                        }
                    };
                    for (var field of Object.keys(fieldsMapping)) {
                        var value = bundle.inputData[field];
                        value && custom_fields.push({
                            field_code: fieldsMapping[field].field_code,
                            values: [ {
                                value: value,
                                enum_code: fieldsMapping[field].enum_code
                            } ]
                        });
                    }
                    contact.custom_fields_values = custom_fields;
                    return contact;
                }
                var created_contact = makeRequest(service, {
                    url: state.base_url,
                    method: "GET",
                    headers: state.headers
                }, [ createBodyForAmoCrm() ], false)._embedded.contacts.map((contact => [ contact.id ]));
                bundle.inputData.contact_company && (id = created_contact[0][0], makeRequest(service, {
                    url: `${state.base_url}/${bundle.inputData.contact_company}/link`,
                    method: "POST",
                    headers: state.headers
                }, [ {
                    to_entity_id: id,
                    to_entity_type: "contacts"
                } ], false));
                var id;
                return {
                    output: created_contact,
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    } ],
                    state: {},
                    hasNext: false
                };
            }
        },
        GetTasks: {
            label: "Получить список задач",
            description: "Возвращает список задач",
            inputFields: [ {
                key: "data_range",
                type: "text",
                label: "Фильтровать по дате изменения",
                required: false
            } ],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/tasks?page=1&limit=250`,
                    next_page: context ? context.next_page : null,
                    page_number: context ? context.page_number : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: context?.hasNext ?? true
                };
                function normalizeTasks(task) {
                    var task_template = {
                        id: task.id,
                        created_by: task.created_by,
                        updated_by: task.updated_by,
                        created_at: task.created_at && task.created_at > 0 ? new Date(1000 * task.created_at).toISOString() : null,
                        updated_at: task.updated_at && task.updated_at > 0 ? new Date(1000 * task.updated_at).toISOString() : null,
                        responsible_user_id: task.responsible_user_id,
                        group_id: task.responsible_user_id,
                        entity_id: task.entity_id,
                        entity_type: task.entity_type,
                        duration: task.duration,
                        is_completed: task.is_completed,
                        task_type_id: task.task_type_id,
                        text: task.text,
                        result: task.result && task.result ? task.result.text : "",
                        complete_till: task.complete_till && task.complete_till > 0 ? new Date(1000 * task.complete_till).toISOString() : null,
                        account_id: task.account_id
                    };
                    return [ task_template.id, task_template.created_by, task_template.updated_by, task_template.created_at, task_template.updated_at, task_template.responsible_user_id, task_template.group_id, task_template.entity_id, task_template.entity_type, task_template.duration, task_template.is_completed, task_template.task_type_id, task_template.text, task_template.result, task_template.complete_till, task_template.account_id ];
                }
                var tasks = (() => {
                    var rawUrl = state.next_page || state.base_url;
                    bundle.inputData.data_range && "" !== bundle.inputData.data_range && (rawUrl = mergeQueryParams(rawUrl, {
                        "filter[updated_at][from]": dateFilterConverter(bundle.inputData.data_range).toString()
                    }));
                    var response = makeRequest(service, {
                        url: rawUrl,
                        method: "GET",
                        headers: state.headers
                    }, {}, false);
                    if (!response) {
                        state.hasNext = false;
                        return [];
                    }
                    var {_embedded: _embedded, _links: _links, _page: _page} = response;
                    state.page_number = _page ?? null;
                    state.next_page = _links.next?.href ?? null;
                    state.hasNext = Boolean(_links.next);
                    return _embedded.tasks.map(normalizeTasks);
                })();
                return tasks && tasks.length ? {
                    output: tasks,
                    output_variables: [ {
                        type: "Long",
                        name: "id"
                    }, {
                        type: "Long",
                        name: "created_by"
                    }, {
                        type: "Long",
                        name: "updated_by"
                    }, {
                        type: "DateTime",
                        name: "created_at"
                    }, {
                        type: "DateTime",
                        name: "updated_at"
                    }, {
                        type: "Long",
                        name: "responsible_user_id"
                    }, {
                        type: "Long",
                        name: "group_id"
                    }, {
                        type: "Long",
                        name: "entity_id"
                    }, {
                        type: "String",
                        name: "entity_type"
                    }, {
                        type: "Long",
                        name: "duration"
                    }, {
                        type: "Boolean",
                        name: "is_completed"
                    }, {
                        type: "Long",
                        name: "task_type_id"
                    }, {
                        type: "String",
                        name: "text"
                    }, {
                        type: "String",
                        name: "result"
                    }, {
                        type: "DateTime",
                        name: "complete_till"
                    }, {
                        type: "Long",
                        name: "account_id"
                    } ],
                    state: state,
                    hasNext: state.hasNext
                } : {
                    output: [ [] ],
                    output_variables: [],
                    state: {},
                    hasNext: false
                };
            }
        },
        CreateTaskLead: {
            label: "Создать задачу для сделки",
            description: "Создает задачу для сделки в amoCRM",
            inputFields: [ {
                key: "created_by",
                type: "text",
                label: "Идентификатор пользователя, создающего задачу",
                required: false
            }, {
                key: "responsible_user_id",
                type: "text",
                label: "ID пользователя, ответственного за задачу",
                required: false
            }, {
                key: "entity_id",
                type: "text",
                label: "Идентификатор объекта системы, к которому привязана задача",
                required: false
            }, {
                key: "task_type_id",
                type: "text",
                label: "Тип задачи",
                required: false
            }, {
                key: "complete_till",
                type: "text",
                label: "Срок исполнения",
                required: true
            }, {
                key: "text",
                type: "text",
                label: "Описание задачи",
                required: true
            } ],
            executePagination: (service, bundle, context) => {
                var state = {
                    base_url: `https://${bundle.authData.subdomain_amo_crm}.amocrm.ru/api/v4/tasks`,
                    next_page: context ? context.next_page : null,
                    page_number: context ? context.page_number : null,
                    headers: {
                        Authorization: `Bearer ${bundle.authData.client_longlived_token}`
                    },
                    hasNext: context?.hasNext ?? true
                };
                function normalizedCreateTasks(task) {
                    return [ task.id, task._links ];
                }
                return {
                    output: makeRequest(service, {
                        url: state.base_url,
                        method: "POST",
                        headers: state.headers
                    }, [ {
                        created_by: bundle.inputData.created_by ? Number(bundle.inputData.created_by) : null,
                        responsible_user_id: bundle.inputData.responsible_user_id ? Number(bundle.inputData.responsible_user_id) : null,
                        entity_id: bundle.inputData.entity_id ? Number(bundle.inputData.entity_id) : 0,
                        entity_type: "leads",
                        task_type_id: bundle.inputData.task_type_id ? Number(bundle.inputData.task_type_id) : 1,
                        text: bundle.inputData.text ? bundle.inputData.text : "Новое название для задачи",
                        complete_till: bundle.inputData.complete_till ? dateFilterConverter(bundle.inputData.complete_till) : 1727262162
                    } ], false)._embedded.tasks.map(normalizedCreateTasks),
                    output_variables: [ {
                        type: "String",
                        name: "id"
                    }, {
                        type: "Object",
                        name: "links",
                        struct: [ {
                            type: "Object",
                            name: "self",
                            struct: [ {
                                type: "String",
                                name: "href"
                            } ]
                        } ]
                    } ],
                    state: {},
                    hasNext: false
                };
            }
        }
    },
    connections: {
        LongLivedToken: LongLivedToken
    }
};
