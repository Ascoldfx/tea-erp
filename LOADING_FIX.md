# 🔴 Проблема: Бесконечная загрузка

## Проблема

Сайт застрял в загрузке и не завершается. Это может быть из-за:
1. Бесконечной рекурсии в RLS политиках (основная причина)
2. Зависания запросов к Supabase
3. Отсутствия таймаутов

## ✅ Решение

### Шаг 1: Исправьте RLS политики (ОБЯЗАТЕЛЬНО!)

**Это самая важная часть!** Без этого сайт будет зависать.

1. Откройте: https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp/sql/new

2. Выполните SQL из `migrations/fix_rls_recursion.sql`:

```sql
-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can create profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can update profiles" ON profiles;
DROP POLICY IF EXISTS "Admins can delete profiles" ON profiles;

-- Create a function to check if user is admin (using SECURITY DEFINER to bypass RLS)
CREATE OR REPLACE FUNCTION is_admin(user_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles
        WHERE id = user_id
        AND role = 'admin'
        AND is_active = true
    );
END;
$$;

-- Recreate policies using the function
CREATE POLICY "Admins can view all profiles"
    ON profiles FOR SELECT
    TO authenticated
    USING (is_admin(auth.uid()));

CREATE POLICY "Admins can create profiles"
    ON profiles FOR INSERT
    TO authenticated
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can update profiles"
    ON profiles FOR UPDATE
    TO authenticated
    USING (is_admin(auth.uid()))
    WITH CHECK (is_admin(auth.uid()));

CREATE POLICY "Admins can delete profiles"
    ON profiles FOR DELETE
    TO authenticated
    USING (is_admin(auth.uid()));
```

### Шаг 2: Дождитесь нового деплоя

Изменения в коде уже запушены в GitHub. Vercel автоматически запустит новый деплой.

Проверьте статус: https://vercel.com/antons-projects-93f1a619/tea-erp/deployments

### Шаг 3: Проверьте сайт

После завершения деплоя:
1. Откройте: https://tea-erp.vercel.app
2. Обновите страницу (Ctrl+Shift+R или Cmd+Shift+R для очистки кеша)
3. Загрузка должна завершиться в течение 5 секунд
4. Если нет сессии, вы будете перенаправлены на страницу входа

## 🔍 Что было исправлено в коде

1. ✅ Добавлен таймаут 5 секунд для проверки сессии
2. ✅ Добавлен таймаут 5 секунд для загрузки профиля
3. ✅ Улучшена обработка ошибок - загрузка всегда завершается
4. ✅ Создана SQL миграция для исправления RLS рекурсии

## ⚠️ Важно

**Без выполнения SQL миграции сайт будет продолжать зависать!**

RLS политики вызывают бесконечную рекурсию, которая блокирует все запросы к таблице `profiles`.

## 📋 Чеклист

- [ ] SQL миграция выполнена в Supabase SQL Editor
- [ ] Функция `is_admin()` создана
- [ ] Политики пересозданы
- [ ] Новый деплой завершен в Vercel
- [ ] Страница обновлена с очисткой кеша
- [ ] Загрузка завершается в течение 5 секунд
- [ ] Сайт работает корректно

## 🆘 Если проблема сохраняется

1. Откройте консоль браузера (F12)
2. Проверьте ошибки
3. Убедитесь, что SQL миграция выполнена
4. Проверьте, что переменные окружения в Vercel правильные
5. Попробуйте открыть сайт в режиме инкогнито



