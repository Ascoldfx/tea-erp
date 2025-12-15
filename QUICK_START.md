# Быстрый старт без Edge Functions

Если у вас проблемы с установкой Supabase CLI, вы можете использовать приложение **без Edge Functions**. 

## Что будет работать:
✅ Вход в систему (email/password)  
✅ Просмотр пользователей  
✅ Редактирование ролей существующих пользователей  
✅ Все остальные функции приложения  

## Что НЕ будет работать:
❌ Создание новых пользователей через UI  
❌ Сброс паролей через UI  

## Решение: Создание пользователей вручную

### Вариант 1: Через Supabase Dashboard (рекомендуется)

1. Откройте Supabase Dashboard: https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp
2. Перейдите в **Authentication** → **Users**
3. Нажмите **Add User** → **Create new user**
4. Введите email и пароль
5. После создания пользователя, выполните SQL для назначения роли:

```sql
-- В Supabase SQL Editor выполните:
UPDATE profiles
SET 
    role = 'admin',  -- или 'procurement', 'production_planner', 'warehouse', 'director'
    full_name = 'Имя Пользователя',
    is_active = true
WHERE email = 'email_пользователя@example.com';
```

### Вариант 2: Через SQL напрямую

Если пользователь уже существует в `auth.users`, просто обновите профиль:

```sql
UPDATE profiles
SET 
    role = 'admin',
    full_name = 'Имя Пользователя',
    is_active = true
WHERE email = 'email_пользователя@example.com';
```

## Исправление вашего профиля админа

Выполните в Supabase SQL Editor:

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

## После исправления профиля

1. Войдите в систему с вашим email и паролем
2. Сессия будет сохраняться между перезагрузками
3. Вы сможете редактировать роли существующих пользователей
4. Для создания новых пользователей используйте Supabase Dashboard + SQL

