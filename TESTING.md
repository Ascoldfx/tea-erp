# Проверка работы приложения

## ✅ Текущий статус

**Dev сервер запущен и работает!**

Приложение доступно по адресу: **http://localhost:5173**

## Шаги для проверки

### 1. Откройте приложение в браузере

Перейдите на: http://localhost:5173

### 2. Проверьте страницу входа

Вы должны увидеть:
- ✅ Форму входа с полями Email и Пароль (не Google OAuth)
- ✅ Красивый дизайн с логотипом Tea ERP

### 3. Войдите в систему

**Важно:** Сначала нужно исправить ваш профиль админа в Supabase!

#### Шаг 3.1: Исправьте профиль админа

Выполните в Supabase SQL Editor (https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp/sql/new):

```sql
INSERT INTO profiles (id, email, full_name, role)
SELECT id, email, 'Антон', 'admin'
FROM auth.users
WHERE email = 'ascoldfx@gmail.com'
ON CONFLICT (id) 
DO UPDATE SET 
    role = 'admin',
    full_name = COALESCE(profiles.full_name, 'Антон'),
    is_active = true;
```

#### Шаг 3.2: Войдите в систему

1. Введите ваш email: `ascoldfx@gmail.com`
2. Введите ваш пароль (тот, который вы установили в Supabase)
3. Нажмите "Войти"

### 4. Проверьте функционал

После входа проверьте:

- ✅ **Сессия сохраняется** - обновите страницу (F5), вы должны остаться залогинены
- ✅ **Страница пользователей** - перейдите в `/users`, вы должны видеть список пользователей
- ✅ **Редактирование ролей** - попробуйте изменить роль существующего пользователя
- ✅ **Навигация** - проверьте, что все страницы доступны

### 5. Что НЕ будет работать (без Edge Functions)

❌ Создание новых пользователей через UI  
❌ Сброс паролей через UI  

**Решение:** Создавайте пользователей через Supabase Dashboard, затем обновляйте роли через UI.

## Проверка изменений в коде

### Измененные файлы:

1. ✅ `src/context/AuthContext.tsx` - реальная Supabase аутентификация
2. ✅ `src/pages/auth/LoginPage.tsx` - форма email/password
3. ✅ `src/services/usersService.ts` - использует Edge Functions (требуют развертывания)
4. ✅ `src/components/auth/ProtectedRoute.tsx` - учитывает загрузку

### Новые файлы:

1. ✅ `migrations/fix_admin_profile.sql` - SQL для исправления профиля
2. ✅ `supabase/functions/create-user/index.ts` - Edge Function для создания пользователей
3. ✅ `supabase/functions/reset-password/index.ts` - Edge Function для сброса паролей
4. ✅ `EDGE_FUNCTIONS_SETUP.md` - инструкция по развертыванию
5. ✅ `QUICK_START.md` - быстрый старт без Edge Functions

## Проверка в консоли браузера

Откройте DevTools (F12) и проверьте:

1. **Console** - не должно быть ошибок
2. **Network** - запросы к Supabase должны проходить успешно
3. **Application → Local Storage** - должна быть сохранена сессия Supabase

## Если что-то не работает

### Проблема: "Supabase not initialized"

**Решение:** Проверьте, что файл `.env` существует и содержит правильные ключи:
```bash
cat .env
```

### Проблема: "Failed to fetch" при входе

**Решение:** 
1. Проверьте, что ваш email и пароль правильные
2. Проверьте, что профиль создан в таблице `profiles` с ролью `admin`
3. Проверьте, что `is_active = true` в профиле

### Проблема: Сессия не сохраняется

**Решение:** 
1. Проверьте, что Supabase клиент инициализирован
2. Проверьте консоль браузера на ошибки
3. Убедитесь, что cookies разрешены в браузере

## Следующие шаги

1. ✅ Исправьте профиль админа через SQL
2. ✅ Войдите в систему
3. ✅ Проверьте работу всех функций
4. ⏭️ (Опционально) Разверните Edge Functions для полного функционала

## Коммит изменений

Если все работает, можно закоммитить изменения:

```bash
git add .
git commit -m "feat: Add real Supabase authentication and user management"
git push
```


