export const warehouseNameMap: Record<string, string> = {
    'база': 'wh-kotsyubinske',
    'базы': 'wh-kotsyubinske',
    '1с': 'wh-kotsyubinske',
    '1 с': 'wh-kotsyubinske',
    'коцюбинське': 'wh-kotsyubinske',
    'коцюбинское': 'wh-kotsyubinske',
    'тс': 'wh-ts',
    'ts': 'wh-ts',
    'май': 'wh-ts',
    'кава': 'wh-kava',
    'kava': 'wh-kava',
    'бакалея': 'wh-bakaleya',
    'bakaleya': 'wh-bakaleya',
    'фіто': 'wh-fito',
    'фито': 'wh-fito',
    'fito': 'wh-fito',
    'фото': 'wh-fito',
    'тс трейд': 'wh-ts-treyd',
    'тс трейт': 'wh-ts-treyd',
    'ts treyd': 'wh-ts-treyd',
    'ts treyt': 'wh-ts-treyd'
};

export const parseMonthToDate = (monthName: string, year?: number): string | null => {
    const cleanInput = String(monthName || '').trim();
    const monthLower = cleanInput.toLowerCase();

    let explicitYear: number | undefined = undefined;

    const fullYearMatch = cleanInput.match(/20\d{2}/);
    if (fullYearMatch) {
        explicitYear = parseInt(fullYearMatch[0]);
    } else {
        const shortYearMatch = cleanInput.match(/(?:^|[\s.-])(2[1-9])(?:\b|$)/);
        if (shortYearMatch) {
            const yy = parseInt(shortYearMatch[1]);
            explicitYear = 2000 + yy;
        }
    }

    const monthMap: Record<string, number> = {
        'январь': 1, 'января': 1, 'янв': 1, 'січень': 1, 'січня': 1, 'січ': 1, 'january': 1, 'jan': 1,
        'февраль': 2, 'февраля': 2, 'фев': 2, 'лютий': 2, 'лютого': 2, 'лют': 2, 'february': 2, 'feb': 2,
        'март': 3, 'марта': 3, 'мар': 3, 'березень': 3, 'березня': 3, 'бер': 3, 'march': 3, 'mar': 3,
        'апрель': 4, 'апреля': 4, 'апр': 4, 'квітень': 4, 'квітня': 4, 'кві': 4, 'april': 4, 'apr': 4,
        'май': 5, 'мая': 5, 'травень': 5, 'травня': 5, 'тра': 5, 'may': 5,
        'июнь': 6, 'июня': 6, 'июн': 6, 'червень': 6, 'червня': 6, 'чер': 6, 'june': 6, 'jun': 6,
        'июль': 7, 'июля': 7, 'июл': 7, 'липень': 7, 'липня': 7, 'лип': 7, 'july': 7, 'jul': 7,
        'август': 8, 'августа': 8, 'авг': 8, 'серпень': 8, 'серпня': 8, 'сер': 8, 'august': 8, 'aug': 8,
        'сентябрь': 9, 'сентября': 9, 'сен': 9, 'вересень': 9, 'вересня': 9, 'вер': 9, 'september': 9, 'sep': 9,
        'октябрь': 10, 'октября': 10, 'окт': 10, 'жовтень': 10, 'жовтня': 10, 'жов': 10, 'october': 10, 'oct': 10,
        'ноябрь': 11, 'ноября': 11, 'ноя': 11, 'листопад': 11, 'листопада': 11, 'лис': 11, 'november': 11, 'nov': 11,
        'декабрь': 12, 'декабря': 12, 'дек': 12, 'грудень': 12, 'грудня': 12, 'гру': 12, 'december': 12, 'dec': 12
    };

    let foundMonth: number | undefined = undefined;
    const sortedKeys = Object.keys(monthMap).sort((a, b) => b.length - a.length);

    for (const key of sortedKeys) {
        const regex = new RegExp(`(?:^|[^a-zа-яёіїє0-9])${key}(?:$|[^a-zа-яёіїє0-9])`, 'i');
        if (regex.test(monthLower)) {
            foundMonth = monthMap[key];
            break;
        }
    }

    if (foundMonth) {
        const now = new Date();
        const currentYear = now.getFullYear();
        let finalYear = year || currentYear;

        if (explicitYear) {
            finalYear = explicitYear;
        }

        return `${finalYear}-${String(foundMonth).padStart(2, '0')}-01`;
    }

    return null;
};

export const findColumn = (row: Record<string, unknown>, possibleNames: string[]): string => {
    for (const name of possibleNames) {
        if (row[name] !== undefined && row[name] !== null && row[name] !== '') {
            return String(row[name]).trim();
        }
        for (const key in row) {
            const keyLower = key.trim().toLowerCase();
            const nameLower = name.toLowerCase().trim();
            if (keyLower === nameLower) {
                const value = row[key];
                if (value !== undefined && value !== null && value !== '') {
                    return String(value).trim();
                }
            }
            if (keyLower.includes(nameLower) || nameLower.includes(keyLower)) {
                const value = row[key];
                if (value !== undefined && value !== null && value !== '') {
                    return String(value).trim();
                }
            }
        }
    }
    return '';
};

export const determineCategory = (groupValue: string | undefined, name: string): string => {
    let category = 'other';
    const cleanGroupValue = groupValue ? groupValue.toLowerCase().trim() : '';
    
    if (!cleanGroupValue || cleanGroupValue === '') {
        category = 'other';
    } else if (cleanGroupValue === 'flavor' ||
        cleanGroupValue === 'ароматизатор' || cleanGroupValue === 'ароматизаторы' ||
        cleanGroupValue === 'ароматизатори' || cleanGroupValue === 'ароматизаторів' ||
        cleanGroupValue.startsWith('ароматизатор') ||
        cleanGroupValue.includes('ароматизатор') ||
        cleanGroupValue.includes('flavor')) {
        category = 'flavor';
    } else if (cleanGroupValue === 'label' ||
        cleanGroupValue.includes('ярлик') ||
        cleanGroupValue.includes('ярлики') ||
        cleanGroupValue.includes('ярлык') ||
        cleanGroupValue.includes('ярлыки') ||
        cleanGroupValue.includes('label')) {
        category = 'label';
    } else if (cleanGroupValue === 'sticker' || cleanGroupValue === 'стикер' || cleanGroupValue === 'стикеры' || cleanGroupValue === 'стикери' ||
        cleanGroupValue === 'этикетка' || cleanGroupValue === 'этикетки' || cleanGroupValue === 'етикетка' || cleanGroupValue === 'етикетки' ||
        cleanGroupValue === 'наклейка' || cleanGroupValue === 'наклейки' ||
        cleanGroupValue.startsWith('стикер') || cleanGroupValue.startsWith('этикетк') || cleanGroupValue.startsWith('етикетк') ||
        cleanGroupValue.startsWith('наклейк') ||
        cleanGroupValue.includes(' стикер') || cleanGroupValue.includes(' этикетк') || cleanGroupValue.includes(' етикетк') ||
        cleanGroupValue.includes(' наклейк')) {
        category = 'sticker';
    } else if (cleanGroupValue === 'картон' || cleanGroupValue.includes('картон') || cleanGroupValue.includes('картонн') ||
        cleanGroupValue === 'packaging_cardboard') {
        category = 'packaging_cardboard';
    } else if (cleanGroupValue === 'envelope' || cleanGroupValue === 'конверт' || cleanGroupValue === 'конверты' || cleanGroupValue === 'конверти' ||
        cleanGroupValue.startsWith('конверт') || cleanGroupValue.includes(' конверт')) {
        category = 'envelope';
    } else if (cleanGroupValue === 'packaging_box' || cleanGroupValue === 'коробка' || cleanGroupValue === 'коробки' ||
        (cleanGroupValue.includes('коробк') && !cleanGroupValue.includes('гофро'))) {
        category = 'packaging_cardboard';
    } else if (cleanGroupValue.includes('г/я') || cleanGroupValue.includes('гофро') || cleanGroupValue.includes('гофроящик') ||
        (cleanGroupValue.includes('ящик') && cleanGroupValue.includes('гофро'))) {
        category = 'packaging_crate';
    } else if (cleanGroupValue === 'soft_packaging' || cleanGroupValue === 'м/у' || cleanGroupValue === 'м\'яка упаковка' ||
        cleanGroupValue.includes('мягкая упаковка') || cleanGroupValue.includes('м\'яка упаковка') ||
        (cleanGroupValue.includes('упаковк') && (cleanGroupValue.includes('мягк') || cleanGroupValue.includes('м\'як')))) {
        category = 'soft_packaging';
    } else if (cleanGroupValue === 'пачка' || cleanGroupValue === 'пачки' || cleanGroupValue.startsWith('пачка') ||
        (cleanGroupValue.includes('пачка') && !cleanGroupValue.includes('упаковк'))) {
        category = 'packaging_cardboard';
    } else if ((cleanGroupValue.includes('упаковк') || cleanGroupValue.includes('пленк') || cleanGroupValue.includes('пакет') ||
        cleanGroupValue.includes('папір') || cleanGroupValue.includes('нитки') || cleanGroupValue === 'packaging_consumable') &&
        !cleanGroupValue.includes('картон') && !cleanGroupValue.includes('гофро') &&
        !cleanGroupValue.includes('мягк') && !cleanGroupValue.includes('м\'як')) {
        category = 'packaging_consumable';
    } else if (cleanGroupValue === 'tea_bulk' || cleanGroupValue.includes('сировин') || cleanGroupValue.includes('цедра') ||
        cleanGroupValue.includes('трав') || cleanGroupValue.includes('чай') ||
        (cleanGroupValue.includes('чай') && !cleanGroupValue.includes('упаковк'))) {
        category = 'tea_bulk';
    }

    const nameLower = name.toLowerCase();
    if (category === 'other') {
        if (nameLower.includes('ярлык') || nameLower.includes('ярлик') || nameLower.includes('label')) {
            category = 'label';
        } else if (nameLower.includes('стикер') || nameLower.includes('наклейк') || nameLower.includes('етикетк')) {
            category = 'sticker';
        } else if (nameLower.includes('ароматизатор') || nameLower.includes('flavor')) {
            category = 'flavor';
        } else if (nameLower.includes('конверт') || nameLower.includes('envelope')) {
            category = 'envelope';
        }
    }

    const KNOWN_CATEGORIES = [
        'tea_bulk', 'flavor', 'packaging_consumable', 'packaging_crate',
        'label', 'sticker', 'soft_packaging', 'envelope', 'packaging_cardboard'
    ];

    if (category === 'other' && cleanGroupValue && cleanGroupValue !== '') {
        const validCategories: string[] = [...KNOWN_CATEGORIES, 'other'];
        if (validCategories.includes(cleanGroupValue)) {
            category = cleanGroupValue;
        } else {
            const normalizedGroup = cleanGroupValue
                .replace(/\s+/g, '_')
                .replace(/[^a-z0-9_а-яёіїє]/g, '')
                .substring(0, 50);

            if (normalizedGroup && normalizedGroup.length > 0) {
                category = normalizedGroup;
            } else {
                category = 'other';
            }
        }
    }

    return category;
};
