const DEFAULT_DADATA_BASE_URL = "https://suggestions.dadata.ru";
const DADATA_FIND_PARTY_PATH = "/suggestions/api/4_1/rs/findById/party";

const isPlainObject = value => typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeUrl = value => {
    const raw = typeof value === "string" ? value.trim() : "";
    const sanitized = raw.replace(/^['"]|['"]$/g, "");
    const baseUrl = sanitized || DEFAULT_DADATA_BASE_URL;
    return `${baseUrl.replace(/\/+$/, "")}${DADATA_FIND_PARTY_PATH}`;
};

const parseResponseBody = response => {
    const raw = new TextDecoder().decode(response?.response || new Uint8Array());
    if (!raw) {
        return { raw: "", parsed: null };
    }
    try {
        return { raw, parsed: JSON.parse(raw) };
    } catch (error) {
        return { raw, parsed: null };
    }
};

const FINANCE_TEMPLATE = {
    tax_system: null,
    income: null,
    expense: null,
    revenue: null,
    debt: null,
    penalty: null,
    year: null
};

const PARTY_SHARE_TEMPLATE = {
    value: null,
    type: null
};

const PARTY_FOUNDER_TEMPLATE = {
    ogrn: null,
    inn: null,
    name: null,
    hid: null,
    type: null,
    share: PARTY_SHARE_TEMPLATE,
    invalidity: null,
    start_date: null
};

const PARTY_MANAGER_TEMPLATE = {
    inn: null,
    fio: {
        surname: null,
        name: null,
        patronymic: null,
        gender: null,
        source: null,
        qc: null
    },
    post: null,
    hid: null,
    type: null,
    invalidity: null,
    start_date: null
};

const PARTY_RELATED_TEMPLATE = {
    ogrn: null,
    inn: null,
    name: null,
    hid: null,
    type: null
};

const PARTY_CAPITAL_TEMPLATE = {
    type: null,
    value: null
};

const PARTY_MANAGEMENT_TEMPLATE = {
    name: null,
    post: null,
    start_date: null,
    disqualified: null
};

const PARTY_STATE_TEMPLATE = {
    status: null,
    code: null,
    actuality_date: null,
    registration_date: null,
    liquidation_date: null
};

const PARTY_OPF_TEMPLATE = {
    type: null,
    code: null,
    full: null,
    short: null
};

const PARTY_NAME_TEMPLATE = {
    full_with_opf: null,
    short_with_opf: null,
    latin: null,
    full: null,
    short: null
};

const PARTY_OKVED_TEMPLATE = {
    main: null,
    type: null,
    code: null,
    name: null
};

const PARTY_AUTHORITY_TEMPLATE = {
    type: null,
    code: null,
    name: null,
    address: null
};

const PARTY_DOCUMENT_TEMPLATE = {
    type: null,
    series: null,
    number: null,
    issue_date: null,
    issue_authority: null
};

const PARTY_SMB_DOCUMENT_TEMPLATE = {
    category: null,
    type: null,
    series: null,
    number: null,
    issue_date: null,
    issue_authority: null
};

const PARTY_LICENSE_TEMPLATE = {
    series: null,
    number: null,
    issue_date: null,
    issue_authority: null,
    suspend_date: null,
    suspend_reason: null
};

const PARTY_METRO_TEMPLATE = {
    name: null,
    line: null,
    distance: null
};

const PARTY_DIVISION_TEMPLATE = {
    type: null,
    name: null,
    code: null,
    qc: null
};

const PARTY_UNPARSED_TEMPLATE = {
    type: null,
    value: null,
    qc: null
};

const PARTY_ADDRESS_DATA_TEMPLATE = {
    postal_code: null,
    country: null,
    country_iso_code: null,
    federal_district: null,
    region_fias_id: null,
    region_kladr_id: null,
    region_iso_code: null,
    region_with_type: null,
    region_type: null,
    region_type_full: null,
    region: null,
    area_fias_id: null,
    area_kladr_id: null,
    area_with_type: null,
    area_type: null,
    area_type_full: null,
    area: null,
    city_fias_id: null,
    city_kladr_id: null,
    city_with_type: null,
    city_type: null,
    city_type_full: null,
    city: null,
    city_area: null,
    city_district_fias_id: null,
    city_district_kladr_id: null,
    city_district_with_type: null,
    city_district_type: null,
    city_district_type_full: null,
    city_district: null,
    settlement_fias_id: null,
    settlement_kladr_id: null,
    settlement_with_type: null,
    settlement_type: null,
    settlement_type_full: null,
    settlement: null,
    street_fias_id: null,
    street_kladr_id: null,
    street_with_type: null,
    street_type: null,
    street_type_full: null,
    street: null,
    stead_fias_id: null,
    stead_cadnum: null,
    stead_type: null,
    stead_type_full: null,
    stead: null,
    house_fias_id: null,
    house_kladr_id: null,
    house_cadnum: null,
    house_flat_count: null,
    house_type: null,
    house_type_full: null,
    house: null,
    block_type: null,
    block_type_full: null,
    block: null,
    entrance: null,
    floor: null,
    flat_fias_id: null,
    flat_cadnum: null,
    flat_type: null,
    flat_type_full: null,
    flat: null,
    flat_area: null,
    square_meter_price: null,
    flat_price: null,
    room_fias_id: null,
    room_cadnum: null,
    room_type: null,
    room_type_full: null,
    room: null,
    postal_box: null,
    fias_id: null,
    fias_code: null,
    fias_level: null,
    fias_actuality_state: null,
    kladr_id: null,
    geoname_id: null,
    capital_marker: null,
    okato: null,
    oktmo: null,
    tax_office: null,
    tax_office_legal: null,
    timezone: null,
    geo_lat: null,
    geo_lon: null,
    beltway_hit: null,
    beltway_distance: null,
    metro: [PARTY_METRO_TEMPLATE],
    divisions: [PARTY_DIVISION_TEMPLATE],
    qc_geo: null,
    qc_complete: null,
    qc_house: null,
    history_values: [null],
    unparsed_parts: [PARTY_UNPARSED_TEMPLATE],
    source: null,
    qc: null
};

const PARTY_ADDRESS_TEMPLATE = {
    value: null,
    unrestricted_value: null,
    invalidity: null,
    data: PARTY_ADDRESS_DATA_TEMPLATE
};

const PARTY_PHONE_TEMPLATE = {
    value: null,
    unrestricted_value: null,
    data: {
        contact: null,
        source: null,
        qc: null,
        type: null,
        number: null,
        extension: null,
        provider: null,
        country: null,
        region: null,
        city: null,
        timezone: null,
        country_code: null,
        city_code: null,
        qc_conflict: null
    }
};

const PARTY_EMAIL_TEMPLATE = {
    value: null,
    unrestricted_value: null,
    data: {
        local: null,
        domain: null,
        type: null,
        source: null,
        qc: null
    }
};

const PARTY_DATA_TEMPLATE = {
    kpp: null,
    kpp_largest: null,
    capital: PARTY_CAPITAL_TEMPLATE,
    invalid: null,
    management: PARTY_MANAGEMENT_TEMPLATE,
    founders: [PARTY_FOUNDER_TEMPLATE],
    managers: [PARTY_MANAGER_TEMPLATE],
    predecessors: [PARTY_RELATED_TEMPLATE],
    successors: [PARTY_RELATED_TEMPLATE],
    branch_type: null,
    branch_count: null,
    source: null,
    qc: null,
    hid: null,
    type: null,
    state: PARTY_STATE_TEMPLATE,
    opf: PARTY_OPF_TEMPLATE,
    name: PARTY_NAME_TEMPLATE,
    inn: null,
    ogrn: null,
    okpo: null,
    okato: null,
    oktmo: null,
    okogu: null,
    okfs: null,
    okved: null,
    okveds: [PARTY_OKVED_TEMPLATE],
    authorities: {
        fts_registration: PARTY_AUTHORITY_TEMPLATE,
        fts_report: PARTY_AUTHORITY_TEMPLATE,
        pf: PARTY_AUTHORITY_TEMPLATE,
        sif: PARTY_AUTHORITY_TEMPLATE
    },
    documents: {
        fts_registration: PARTY_DOCUMENT_TEMPLATE,
        fts_report: PARTY_DOCUMENT_TEMPLATE,
        pf_registration: PARTY_DOCUMENT_TEMPLATE,
        sif_registration: PARTY_DOCUMENT_TEMPLATE,
        smb: PARTY_SMB_DOCUMENT_TEMPLATE
    },
    licenses: [PARTY_LICENSE_TEMPLATE],
    finance: FINANCE_TEMPLATE,
    address: PARTY_ADDRESS_TEMPLATE,
    phones: [PARTY_PHONE_TEMPLATE],
    emails: [PARTY_EMAIL_TEMPLATE],
    ogrn_date: null,
    okved_type: null,
    employee_count: null
};

const PARTY_SUGGESTION_TEMPLATE = {
    value: null,
    unrestricted_value: null,
    data: PARTY_DATA_TEMPLATE
};

const PARTY_RESPONSE_TEMPLATE = {
    suggestions: [PARTY_SUGGESTION_TEMPLATE],
    safe_first_suggestion: PARTY_SUGGESTION_TEMPLATE,
    suggestions_count: 0
};

const normalizeLoose = value => {
    if (Array.isArray(value)) {
        return value.map(item => normalizeLoose(item === undefined ? null : item));
    }
    if (isPlainObject(value)) {
        const result = {};
        for (const [key, nestedValue] of Object.entries(value)) {
            result[key] = normalizeLoose(nestedValue === undefined ? null : nestedValue);
        }
        return result;
    }
    return value === undefined ? null : value;
};

const applyTemplate = (value, template) => {
  if (Array.isArray(template)) {
    const elementTemplate = template[0];
    if (Array.isArray(value) && value.length > 0) {
      return value.map(item => applyTemplate(item, elementTemplate));
        }
        return [applyTemplate(undefined, elementTemplate)];
    }

    if (isPlainObject(template)) {
        const source = isPlainObject(value) ? value : {};
        const result = {};

    for (const [key, templateValue] of Object.entries(template)) {
      result[key] = applyTemplate(source[key], templateValue);
    }
    return result;
  }

    if (value === undefined) {
        return template === undefined ? null : template;
    }

    return normalizeLoose(value);
};

const normalizeSuggestion = suggestion => applyTemplate(suggestion, PARTY_SUGGESTION_TEMPLATE);

const buildEmptySuggestion = () => applyTemplate(undefined, PARTY_SUGGESTION_TEMPLATE);

const normalizePartyResponse = payload => {
  const source = isPlainObject(payload) ? payload : {};
  const sourceSuggestions = Array.isArray(source.suggestions) ? source.suggestions : [];
  const normalizedSuggestions = sourceSuggestions.map(normalizeSuggestion);
  const safeFirstSuggestion = normalizedSuggestions.length ? normalizedSuggestions[0] : buildEmptySuggestion();
  return applyTemplate({
    suggestions: normalizedSuggestions.length ? normalizedSuggestions : [safeFirstSuggestion],
    safe_first_suggestion: safeFirstSuggestion,
    suggestions_count: sourceSuggestions.length
  }, PARTY_RESPONSE_TEMPLATE);
};

const wrapPayload = payload => {
    if (isPlainObject(payload)) {
        return payload;
    }
    if (Array.isArray(payload)) {
        return { items: payload };
    }
    return { raw: payload ?? null };
};

const getPrimitiveTypeName = template => {
    if (typeof template === "boolean") {
        return "Boolean";
    }
    if (typeof template === "number") {
        return Number.isInteger(template) ? "Long" : "Double";
    }
    return "String";
};

const buildStructFromTemplate = template => {
    if (Array.isArray(template)) {
        const itemTemplate = template[0];
        if (isPlainObject(itemTemplate)) {
            return {
                type: "ObjectArray",
                struct: buildObjectStruct(itemTemplate)
            };
        }
        return {
            type: `${getPrimitiveTypeName(itemTemplate)}Array`
        };
    }

    if (isPlainObject(template)) {
        return {
            type: "Object",
            struct: buildObjectStruct(template)
        };
    }

    return {
        type: getPrimitiveTypeName(template)
    };
};

const buildOutputVariable = (name, template) => {
    const descriptor = buildStructFromTemplate(template);
    if (descriptor.struct) {
        return {
            name,
            type: descriptor.type,
            struct: descriptor.struct
        };
    }
    return {
        name,
        type: descriptor.type
    };
};

const buildObjectStruct = templateObject => {
    return Object.entries(templateObject).map(([name, template]) => buildOutputVariable(name, template));
};

const RESPONSE_OUTPUT_VARIABLE = buildOutputVariable("response", PARTY_RESPONSE_TEMPLATE);

const buildOutput = (status, payload, query) => {
  const normalizedResponse = normalizePartyResponse(payload);
  const wrappedPayload = wrapPayload(normalizedResponse);
  return {
    output: [[status, wrappedPayload, query ?? null]],
    output_variables: [
      { name: "status", type: "Long" },
      RESPONSE_OUTPUT_VARIABLE,
      { name: "query", type: "String" }
    ],
    state: { done: true },
    hasNext: false
  };
};

app = {
    schema: 2,
  version: "1.0.3",
    label: "DaData",
    description: "Поиск организации, адресов, реквизитов ИП и ЮЛ, ФИО, емейлов, телефонов.",
    blocks: {
        FindParty: {
            label: "Найти организацию (ИНН/ОГРН)",
            description: "Выполняет запрос к DaData findById/party и возвращает ответ.",
            inputFields: [
                { key: "query", label: "ИНН/ОГРН", type: "text", hint: "query", required: true }
            ],
            executePagination: (service, bundle) => {
                const queryRaw = bundle.inputData?.query;
                const query = typeof queryRaw === "string" ? queryRaw.trim() : String(queryRaw || "").trim();
                if (!query) {
                    throw new Error("ИНН/ОГРН не указан.");
                }

                const token = typeof bundle.authData?.dadata_token === "string"
                    ? bundle.authData.dadata_token.trim()
                    : "";
                if (!token) {
                    throw new Error("Токен DaData не указан. Заполните подключение.");
                }

                const url = normalizeUrl(bundle.authData?.base_url);

                const requestPayload = jsonBodyValue => ({
                    url,
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "Accept": "application/json",
                        "Authorization": "Token " + token
                    },
                    jsonBody: jsonBodyValue
                });

                let response;
                let parsedResult;

                try {
                    // По практике этого рантайма строковый jsonBody работает стабильнее для DaData.
                    response = service.request(requestPayload(JSON.stringify({ query })));
                    parsedResult = parseResponseBody(response);
                } catch (error) {
                    throw new Error("Ошибка при выполнении запроса: " + error.message);
                }

                if (!response || response.status < 200 || response.status >= 300) {
                    const shouldRetry = response?.status === 400 && parsedResult?.raw && /JSON parse error/i.test(parsedResult.raw);
                    if (shouldRetry) {
                        try {
                            const retryResponse = service.request(requestPayload({ query }));
                            const retryParsed = parseResponseBody(retryResponse);
                            if (retryResponse.status >= 200 && retryResponse.status < 300) {
                                const payload = retryParsed.parsed && isPlainObject(retryParsed.parsed)
                                    ? retryParsed.parsed
                                    : { raw_response: retryParsed.raw || null, suggestions: [] };
                return buildOutput(retryResponse.status, payload, query);
                            }
                            const details = retryParsed.raw ? ` ${retryParsed.raw}` : "";
                            throw new Error(`Ошибка DaData: ${retryResponse?.status ?? "unknown"}${details}`);
                        } catch (error) {
                            throw new Error("Ошибка при повторном запросе: " + error.message);
                        }
                    }
                    const details = parsedResult?.raw ? ` ${parsedResult.raw}` : "";
                    throw new Error(`Ошибка DaData: ${response?.status ?? "unknown"}${details}`);
                }

                const payload = parsedResult?.parsed && isPlainObject(parsedResult.parsed)
                    ? parsedResult.parsed
                    : { raw_response: parsedResult?.raw || null, suggestions: [] };

        return buildOutput(response.status, payload, query);
      }
    }
  },
    connections: {
        DadataConnection: {
            label: "Подключение к DaData",
            description: "Токен и URL для работы с API DaData.",
            inputFields: [
                {
                    key: "dadata_token",
                    type: "password",
                    label: "Токен DaData",
                    hint: "dadata_token",
                    required: true
                },
                {
                    key: "base_url",
                    type: "text",
                    label: "Base URL DaData",
                    hint: "base_url",
                    placeholder: DEFAULT_DADATA_BASE_URL,
                    required: true
                }
            ],
            execute: (service, bundle) => ({
                dadata_token: bundle.authData.dadata_token,
                base_url: bundle.authData.base_url
            })
        }
    }
};
