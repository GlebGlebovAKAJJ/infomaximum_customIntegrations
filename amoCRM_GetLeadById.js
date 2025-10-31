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

        // 1) Тянем сделку
        var leadResponse = makeRequest(
            service,
            {
                // добавляем page/limit для совместимости с makeRequest
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

        // 2) Подтягиваем список custom fields (как в GetLeads)
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

        // 3) Инжектим custom_fields (как в GetLeads)
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

        // 4) Формируем «плоский» вывод и описание выходных переменных — как в GetLeads
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
