# Настройка Edge Functions для создания пользователей

## Проблема
Для создания пользователей через Admin API требуется `service_role` ключ, который нельзя использовать на фронтенде из соображений безопасности.

## Решение
Используем Supabase Edge Functions, которые выполняются на сервере и имеют доступ к `service_role` ключу.

## Шаги развертывания

### 1. Установите Supabase CLI (если еще не установлен)

**Для macOS (рекомендуется через Homebrew):**

```bash
# Установите Homebrew, если еще не установлен:
# /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Установите Supabase CLI:
brew install supabase/tap/supabase
```

**Альтернативные способы установки:**

**Через npm (локально в проект):**
```bash
npm install supabase --save-dev
npx supabase --version
```

**Или скачайте бинарник напрямую:**
- Перейдите на https://github.com/supabase/cli/releases
- Скачайте подходящую версию для macOS
- Добавьте в PATH

### 2. Войдите в Supabase

```bash
# Если установили через Homebrew:
supabase login

# Если установили через npm локально:
npx supabase login
```

### 3. Свяжите проект с вашим Supabase проектом

```bash
# Если установили через Homebrew:
supabase link --project-ref nhsnxypdprellsmouhlp

# Если установили через npm локально:
npx supabase link --project-ref nhsnxypdprellsmouhlp
```

### 4. Установите секреты для Edge Functions

```bash
# Получите service_role ключ из Supabase Dashboard:
# Project Settings -> API -> Project API Keys -> service_role

# Если установили через Homebrew:
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Если установили через npm локально:
npx supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 5. Разверните Edge Functions

```bash
# Если установили через Homebrew:
supabase functions deploy create-user
supabase functions deploy reset-password

# Если установили через npm локально:
npx supabase functions deploy create-user
npx supabase functions deploy reset-password
```

### 6. Проверьте развертывание

После развертывания функции будут доступны по адресам:
- `https://nhsnxypdprellsmouhlp.supabase.co/functions/v1/create-user`
- `https://nhsnxypdprellsmouhlp.supabase.co/functions/v1/reset-password`

## Альтернатива: Использование без Edge Functions

Если вы не хотите использовать Edge Functions, можно:

1. Создавать пользователей вручную через Supabase Dashboard
2. Затем обновлять их роли через UI приложения

Для этого используйте SQL из `migrations/fix_admin_profile.sql` для создания первого админа.

## Исправление профиля админа

Если у вас уже есть пользователь в `auth.users`, но нет профиля или неправильная роль:

```sql
-- Выполните в Supabase SQL Editor:
INSERT INTO profiles (id, email, full_name, role)
SELECT 
    id,
    email,
    'Антон',
    'admin'
FROM auth.users
WHERE email = 'ascoldfx@gmail.com'
ON CONFLICT (id) 
DO UPDATE SET 
    role = 'admin',
    full_name = COALESCE(profiles.full_name, 'Антон'),
    is_active = true;
```

