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

        // 1) Получаем компанию
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

        // 2) Подтягиваем список custom fields (как в других блоках)
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

        // 3) Инжектим custom_fields
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

        // 4) Формируем вывод и описание выходных переменных
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
