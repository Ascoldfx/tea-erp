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
        
        // Contractors
        'contractors.subtitle': 'Управление подрядчиками по фасовке чая',
        'contractors.search': 'Поиск по названию или коду...',
        'contractors.notFound': 'Нет подрядчиков',
        'contractors.contact': 'Контакт',
        'contractors.phone': 'Телефон',
        'contractors.currentTasks': 'Текущие задачи',
        'contractors.materialsTransferred': 'Материалы переданы',
        'contractors.completedOrders': 'Выполнено заказов',
        'contractors.inDevelopment': 'Функционал истории заказов и передачи материалов в разработке',
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
        'materials.filter.group': 'Группа',
        'materials.filter.allGroups': 'Все группы',
        'materials.filter.teaBulk': 'Чайное сырье',
        'materials.filter.flavor': 'Ароматизаторы',
        'materials.filter.packaging': 'Пленки',
        'materials.filter.softPackaging': 'Мягкая упаковка',
        'materials.filter.crates': 'Гофроящики',
        'materials.filter.labels': 'Ярлыки',
        'materials.filter.stickers': 'Стикеры',
        'materials.filter.envelopes': 'Конверты',
        'materials.filter.other': 'Прочее',
        'materials.group.teaBulk': 'Чайное сырье',
        'materials.group.flavor': 'Ароматизаторы',
        'materials.group.packaging': 'Пленки и расходники',
        'materials.group.softPackaging': 'Мягкая упаковка',
        'materials.group.crates': 'Гофроящики',
        'materials.group.labels': 'Ярлыки',
        'materials.group.stickers': 'Стикеры и этикетки',
        'materials.group.envelopes': 'Конверты',
        'materials.group.other': 'Прочее',
        'materials.code': 'Код',
        'materials.name': 'Наименование',
        'materials.location': 'Местонахождение',
        'materials.location.main': 'СКЛАД',
        'materials.location.prod': 'В ЦЕХУ',
        'materials.location.contractor': 'У ПОДРЯДЧИКА',
        'materials.location.supplier': 'У ПОСТАВЩИКА',
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
        'orders.subtitle': 'История и статус текущих заказов',
        'orders.loading': 'Загрузка заказов...',
        'orders.suppliers': 'Заказы поставщикам',
        
        // Users
        'users.title': 'Пользователи',
        'users.subtitle': 'Управление пользователями и ролями',
        'users.create': 'Создать пользователя',
        'users.search': 'Поиск по email, имени или роли...',
        'users.loading': 'Загрузка...',
        'users.notFound': 'Нет пользователей',
        'users.edit': 'Редактировать пользователя',
        'users.list': 'Список пользователей',
        'users.invite': 'Пригласить пользователя',
        'users.emailLabel': 'Email Google аккаунта',
        'users.role': 'Роль',
        'users.role.admin': 'Администратор (Полный доступ)',
        'users.role.warehouse': 'Склад (Только приемка)',
        'users.role.procurement': 'Закупки (Материалы)',
        'users.role.production_planner': 'Планировщик (Производство)',
        'users.role.director': 'Директор (Просмотр)',
        'users.send': 'Отправить',
        'users.user': 'Пользователь',
        'users.status': 'Статус',
        'users.status.active': 'Активен',
        'users.saveChanges': 'Сохранить изменения',
        
        // Settings - additional
        'settings.inviteUser': 'Пригласить пользователя',
        'settings.usersList': 'Список пользователей',
        'settings.dataManagement': 'Управление данными (Демо)',
        'settings.generateTestData': 'Генерация тестовых данных',
        'settings.generateTestDataDesc': 'Создать начальные материалы, склады и остатки для тестирования.',
        'settings.generateButton': 'Сгенерировать данные',
        'settings.devTools': 'Инструменты разработчика',
        'settings.currentRole': 'Текущая роль:',
        'settings.roleSwitcherDisabled': '⚠️ Role switcher отключен. Используйте реальную аутентификацию через страницу входа.',
        'settings.requiresRealUser': 'требует реального пользователя',
        
        // Excel Import
        'excel.title': 'Импорт из Excel',
        'excel.uploadFile': 'Загрузите файл Excel',
        'excel.uploadDescription': 'Файл может быть большим и содержать несколько вкладок. Поддерживаются формулы - будут использованы вычисленные значения.',
        'excel.expectedColumns': 'Ожидаемые колонки: Код/Code, Наименование/Name, Категория/Category, Ед. изм./Unit, Склад/Stock',
        'excel.selectFile': 'Выбрать файл',
        'excel.processing': 'Обработка...',
        'excel.selectSheet': 'Выберите вкладку для импорта',
        'excel.sheetsFound': 'найдено',
        'excel.preview': 'Предпросмотр (первые 5)',
        'excel.itemsFound': 'Найдено позиций:',
        'excel.back': 'Назад',
        'excel.import': 'Импортировать в базу',
        'excel.importing': 'Импорт данных...',
        'excel.importingDesc': 'Сохраняем позиции и обновляем остатки...',
        'excel.importingTime': 'Это может занять несколько секунд',
        'excel.success': 'Готово!',
        'excel.successDesc': 'Успешно импортировано',
        'excel.successItems': 'позиций.',
        'excel.close': 'Закрыть',
        'excel.previewCode': 'Код',
        'excel.previewName': 'Наименование',
        'excel.previewCategory': 'Категория',
        'excel.previewWarehouse': 'Склад',
        'excel.previewProduction': 'Цех',
        
        // Suppliers - additional
        'suppliers.loading': 'Загрузка поставщиков...',
        'suppliers.edit': 'Редактировать',
        'suppliers.editTitle': 'Редактировать поставщика',
        'suppliers.createTitle': 'Добавить поставщика',
        'suppliers.create': 'Создать',
        'suppliers.companyName': 'Название компании',
        'suppliers.contactPerson': 'Контактное лицо',
        'suppliers.phone': 'Телефон',
        'suppliers.email': 'Email',
        
        // Materials - additional
        'materials.deleteTitle': 'Подтверждение удаления',
        'materials.deleteMaterial': 'Удалить материал',
        
        // Common - additional
        'common.back': 'Назад',
        'common.close': 'Закрыть',
        'common.send': 'Отправить',
        'common.create': 'Создать',
        'common.saveChanges': 'Сохранить изменения',
        'common.loadingItems': 'Загрузка...',
        
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
        
        // Contractors
        'contractors.subtitle': 'Управління підрядниками по фасівці чаю',
        'contractors.search': 'Пошук за назвою або кодом...',
        'contractors.notFound': 'Немає підрядників',
        'contractors.contact': 'Контакт',
        'contractors.phone': 'Телефон',
        'contractors.currentTasks': 'Поточні завдання',
        'contractors.materialsTransferred': 'Матеріали передані',
        'contractors.completedOrders': 'Виконано замовлень',
        'contractors.inDevelopment': 'Функціонал історії замовлень та передачі матеріалів в розробці',
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
        'materials.filter.group': 'Група',
        'materials.filter.allGroups': 'Всі групи',
        'materials.filter.teaBulk': 'Чайна сировина',
        'materials.filter.flavor': 'Ароматизатори',
        'materials.filter.packaging': 'Пленки',
        'materials.filter.softPackaging': 'М\'яка упаковка',
        'materials.filter.crates': 'Гофроящики',
        'materials.filter.labels': 'Ярлики',
        'materials.filter.stickers': 'Стікери',
        'materials.filter.envelopes': 'Конверти',
        'materials.filter.other': 'Інше',
        'materials.group.teaBulk': 'Чайна сировина',
        'materials.group.flavor': 'Ароматизатори',
        'materials.group.packaging': 'Плівка та витратні',
        'materials.group.softPackaging': 'М\'яка упаковка',
        'materials.group.crates': 'Гофроящики',
        'materials.group.labels': 'Ярлики',
        'materials.group.stickers': 'Стікери та етикетки',
        'materials.group.envelopes': 'Конверти',
        'materials.group.other': 'Інше',
        'materials.code': 'Код',
        'materials.name': 'Найменування',
        'materials.location': 'Місцезнаходження',
        'materials.location.main': 'СКЛАД',
        'materials.location.prod': 'В ЦЕХУ',
        'materials.location.contractor': 'У ПІДРЯДНИКА',
        'materials.location.supplier': 'У ПОСТАЧАЛЬНИКА',
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
        'orders.subtitle': 'Історія та статус поточних замовлень',
        'orders.loading': 'Завантаження замовлень...',
        'orders.suppliers': 'Замовлення постачальникам',
        
        // Users
        'users.title': 'Користувачі',
        'users.subtitle': 'Управління користувачами та ролями',
        'users.create': 'Створити користувача',
        'users.search': 'Пошук за email, ім\'ям або роллю...',
        'users.loading': 'Завантаження...',
        'users.notFound': 'Немає користувачів',
        'users.edit': 'Редагувати користувача',
        'users.list': 'Список користувачів',
        'users.invite': 'Запросити користувача',
        'users.emailLabel': 'Email Google аккаунта',
        'users.role': 'Роль',
        'users.role.admin': 'Адміністратор (Повний доступ)',
        'users.role.warehouse': 'Склад (Тільки прийомка)',
        'users.role.procurement': 'Закупівлі (Матеріали)',
        'users.role.production_planner': 'Планувальник (Виробництво)',
        'users.role.director': 'Директор (Перегляд)',
        'users.send': 'Відправити',
        'users.user': 'Користувач',
        'users.status': 'Статус',
        'users.status.active': 'Активний',
        'users.saveChanges': 'Зберегти зміни',
        
        // Settings - additional
        'settings.inviteUser': 'Запросити користувача',
        'settings.usersList': 'Список користувачів',
        'settings.dataManagement': 'Управління даними (Демо)',
        'settings.generateTestData': 'Генерація тестових даних',
        'settings.generateTestDataDesc': 'Створити початкові матеріали, склади та залишки для тестування.',
        'settings.generateButton': 'Згенерувати дані',
        'settings.devTools': 'Інструменти розробника',
        'settings.currentRole': 'Поточна роль:',
        'settings.roleSwitcherDisabled': '⚠️ Перемикач ролей вимкнено. Використовуйте реальну аутентифікацію через сторінку входу.',
        'settings.requiresRealUser': 'потребує реального користувача',
        
        // Excel Import
        'excel.title': 'Імпорт з Excel',
        'excel.uploadFile': 'Завантажте файл Excel',
        'excel.uploadDescription': 'Файл може бути великим і містити кілька вкладок. Підтримуються формули - будуть використані обчислені значення.',
        'excel.expectedColumns': 'Очікувані колонки: Код/Code, Найменування/Name, Категорія/Category, Од. вим./Unit, Склад/Stock',
        'excel.selectFile': 'Вибрати файл',
        'excel.processing': 'Обробка...',
        'excel.selectSheet': 'Виберіть вкладку для імпорту',
        'excel.sheetsFound': 'знайдено',
        'excel.preview': 'Попередній перегляд (перші 5)',
        'excel.itemsFound': 'Знайдено позицій:',
        'excel.back': 'Назад',
        'excel.import': 'Імпортувати в базу',
        'excel.importing': 'Імпорт даних...',
        'excel.importingDesc': 'Зберігаємо позиції та оновлюємо залишки...',
        'excel.importingTime': 'Це може зайняти кілька секунд',
        'excel.success': 'Готово!',
        'excel.successDesc': 'Успішно імпортовано',
        'excel.successItems': 'позицій.',
        'excel.close': 'Закрити',
        'excel.previewCode': 'Код',
        'excel.previewName': 'Найменування',
        'excel.previewCategory': 'Категорія',
        'excel.previewWarehouse': 'Склад',
        'excel.previewProduction': 'Цех',
        
        // Suppliers - additional
        'suppliers.loading': 'Завантаження постачальників...',
        'suppliers.edit': 'Редагувати',
        'suppliers.editTitle': 'Редагувати постачальника',
        'suppliers.createTitle': 'Додати постачальника',
        'suppliers.create': 'Створити',
        'suppliers.companyName': 'Назва компанії',
        'suppliers.contactPerson': 'Контактна особа',
        'suppliers.phone': 'Телефон',
        'suppliers.email': 'Email',
        
        // Materials - additional
        'materials.deleteTitle': 'Підтвердження видалення',
        'materials.deleteMaterial': 'Видалити матеріал',
        
        // Common - additional
        'common.back': 'Назад',
        'common.close': 'Закрити',
        'common.send': 'Відправити',
        'common.create': 'Створити',
        'common.saveChanges': 'Зберегти зміни',
        'common.loadingItems': 'Завантаження...',
        
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

