import { createContext, useContext, useState, type ReactNode } from 'react';

export type Language = 'ru' | 'uk';

interface LanguageContextType {
    language: Language;
    setLanguage: (lang: Language) => void;
    t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

// Translations
const translations: Record<Language, Record<string, string>> = {
    ru: {
        // Common
        'common.save': 'Сохранить',
        'common.cancel': 'Отмена',
        'common.delete': 'Удалить',
        'common.edit': 'Редактировать',
        'common.add': 'Добавить',
        'common.search': 'Поиск',
        'common.loading': 'Загрузка...',
        'common.all': 'Все',
        'common.yes': 'Да',
        'common.no': 'Нет',
        
        // Navigation
        'nav.orders': 'Заказы',
        'nav.materials': 'Материалы',
        'nav.suppliers': 'Поставщики',
        'nav.production': 'Производство',
        'nav.calculator': 'Калькулятор',
        'nav.contractors': 'Подрядчики',
        'nav.techCards': 'Тех. карты',
        'nav.users': 'Пользователи',
        'nav.settings': 'Настройки',
        'nav.logout': 'Выйти',
        
        // Settings
        'settings.title': 'Настройки',
        'settings.subtitle': 'Конфигурация системы и управление доступом',
        'settings.language': 'Язык интерфейса',
        'settings.language.ru': 'Русский',
        'settings.language.uk': 'Українська',
        'settings.tab.users': 'Пользователи',
        'settings.tab.general': 'Импорт и Общие',
        'settings.tab.dev': 'Dev Tools (Roles)',
        
        // Materials
        'materials.title': 'Материалы',
        'materials.subtitle': 'Управление запасами сырья, упаковки и материалов',
        'materials.createOrder': 'Создать заказ',
        'materials.filter.allGroups': 'Все группы',
        'materials.filter.teaBulk': 'Чайное сырье',
        'materials.filter.flavor': 'Ароматизаторы',
        'materials.filter.packaging': 'Упаковка',
        'materials.filter.softPackaging': 'Мягкая упаковка',
        'materials.filter.crates': 'Гофроящики',
        'materials.filter.labels': 'Ярлыки',
        'materials.filter.stickers': 'Стикеры',
        'materials.filter.other': 'Прочее',
        'materials.group.teaBulk': 'Чайное сырье',
        'materials.group.flavor': 'Ароматизаторы',
        'materials.group.packaging': 'Упаковка и расходники',
        'materials.group.softPackaging': 'Мягкая упаковка',
        'materials.group.crates': 'Гофроящики',
        'materials.group.labels': 'Ярлыки',
        'materials.group.stickers': 'Стикеры и этикетки',
        'materials.group.other': 'Прочее',
        'materials.code': 'Код',
        'materials.name': 'Наименование',
        'materials.location': 'Местонахождение',
        'materials.totalStock': 'Общий остаток',
        'materials.unit': 'Ед. изм.',
        'materials.status': 'Статус',
        'materials.actions': 'Действия',
        'materials.status.low': 'Мало',
        'materials.status.ok': 'В норме',
        'materials.deleteConfirm': 'Вы уверены, что хотите удалить материал',
        'materials.deleteWarning': 'Это действие нельзя отменить. Все связанные данные (остатки, заказы) также будут удалены.',
        
        // Suppliers
        'suppliers.title': 'Поставщики',
        'suppliers.subtitle': 'Управление контрагентами и история заказов',
        'suppliers.add': 'Добавить поставщика',
        'suppliers.search': 'Поиск по названию или email...',
        'suppliers.notFound': 'Поставщики не найдены',
        'suppliers.ordersHistory': 'История заказов',
        'suppliers.deleteConfirm': 'Вы уверены, что хотите удалить поставщика',
        'suppliers.deleteWarning': 'Это действие нельзя отменить. Поставщик с существующими заказами не может быть удален.',
        
        // Orders
        'orders.title': 'Заказы',
        
        // Login
        'login.title': 'Вход в систему',
        'login.email': 'Email',
        'login.password': 'Пароль',
        'login.submit': 'Войти',
        'login.error': 'Ошибка входа',
    },
    uk: {
        // Common
        'common.save': 'Зберегти',
        'common.cancel': 'Скасувати',
        'common.delete': 'Видалити',
        'common.edit': 'Редагувати',
        'common.add': 'Додати',
        'common.search': 'Пошук',
        'common.loading': 'Завантаження...',
        'common.all': 'Всі',
        'common.yes': 'Так',
        'common.no': 'Ні',
        'common.error': 'Помилка',
        
        // Navigation
        'nav.orders': 'Замовлення',
        'nav.materials': 'Матеріали',
        'nav.suppliers': 'Постачальники',
        'nav.production': 'Виробництво',
        'nav.calculator': 'Калькулятор',
        'nav.contractors': 'Підрядники',
        'nav.techCards': 'Тех. карти',
        'nav.users': 'Користувачі',
        'nav.settings': 'Налаштування',
        'nav.logout': 'Вийти',
        
        // Settings
        'settings.title': 'Налаштування',
        'settings.subtitle': 'Конфігурація системи та управління доступом',
        'settings.language': 'Мова інтерфейсу',
        'settings.language.ru': 'Русский',
        'settings.language.uk': 'Українська',
        'settings.tab.users': 'Користувачі',
        'settings.tab.general': 'Імпорт та Загальні',
        'settings.tab.dev': 'Dev Tools (Roles)',
        
        // Materials
        'materials.title': 'Матеріали',
        'materials.subtitle': 'Управління запасами сировини, упаковки та матеріалів',
        'materials.createOrder': 'Створити замовлення',
        'materials.filter.allGroups': 'Всі групи',
        'materials.filter.teaBulk': 'Чайна сировина',
        'materials.filter.flavor': 'Ароматизатори',
        'materials.filter.packaging': 'Упаковка',
        'materials.filter.softPackaging': 'М\'яка упаковка',
        'materials.filter.crates': 'Гофроящики',
        'materials.filter.labels': 'Ярлики',
        'materials.filter.stickers': 'Стікери',
        'materials.filter.other': 'Інше',
        'materials.group.teaBulk': 'Чайна сировина',
        'materials.group.flavor': 'Ароматизатори',
        'materials.group.packaging': 'Упаковка та витратні',
        'materials.group.softPackaging': 'М\'яка упаковка',
        'materials.group.crates': 'Гофроящики',
        'materials.group.labels': 'Ярлики',
        'materials.group.stickers': 'Стікери та етикетки',
        'materials.group.other': 'Інше',
        'materials.code': 'Код',
        'materials.name': 'Найменування',
        'materials.location': 'Місцезнаходження',
        'materials.totalStock': 'Загальний залишок',
        'materials.unit': 'Од. вим.',
        'materials.status': 'Статус',
        'materials.actions': 'Дії',
        'materials.status.low': 'Мало',
        'materials.status.ok': 'В нормі',
        'materials.deleteConfirm': 'Ви впевнені, що хочете видалити матеріал',
        'materials.deleteWarning': 'Цю дію неможливо скасувати. Всі пов\'язані дані (залишки, замовлення) також будуть видалені.',
        
        // Suppliers
        'suppliers.title': 'Постачальники',
        'suppliers.subtitle': 'Управління контрагентами та історія замовлень',
        'suppliers.add': 'Додати постачальника',
        'suppliers.search': 'Пошук за назвою або email...',
        'suppliers.notFound': 'Постачальники не знайдені',
        'suppliers.ordersHistory': 'Історія замовлень',
        'suppliers.deleteConfirm': 'Ви впевнені, що хочете видалити постачальника',
        'suppliers.deleteWarning': 'Цю дію неможливо скасувати. Постачальник з існуючими замовленнями не може бути видалений.',
        
        // Orders
        'orders.title': 'Замовлення',
        
        // Login
        'login.title': 'Вхід в систему',
        'login.email': 'Email',
        'login.password': 'Пароль',
        'login.submit': 'Увійти',
        'login.error': 'Помилка входу',
    },
};

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [language, setLanguageState] = useState<Language>(() => {
        // Load from localStorage or default to 'ru'
        const saved = localStorage.getItem('app_language') as Language;
        return saved && (saved === 'ru' || saved === 'uk') ? saved : 'ru';
    });

    const setLanguage = (lang: Language) => {
        setLanguageState(lang);
        localStorage.setItem('app_language', lang);
    };

    const t = (key: string): string => {
        return translations[language][key] || key;
    };

    return (
        <LanguageContext.Provider value={{ language, setLanguage, t }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const context = useContext(LanguageContext);
    if (context === undefined) {
        throw new Error('useLanguage must be used within a LanguageProvider');
    }
    return context;
}

