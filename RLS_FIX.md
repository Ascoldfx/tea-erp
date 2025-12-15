# 🔴 КРИТИЧЕСКАЯ ОШИБКА: Infinite Recursion в RLS

## Проблема

Ошибка: `infinite recursion detected in policy for relation "profiles"`

Это происходит потому, что RLS политики проверяют роль пользователя из таблицы `profiles`, но для этого нужно прочитать `profiles`, что снова вызывает проверку политики - получается бесконечный цикл.

## ✅ Решение

Выполните SQL миграцию в Supabase SQL Editor:

1. Откройте: https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp/sql/new

2. Скопируйте и выполните SQL из файла `migrations/fix_rls_recursion.sql`

Или выполните напрямую:

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

## 🔍 Как это работает

Функция `is_admin()` использует `SECURITY DEFINER`, что позволяет ей обходить RLS и читать таблицу `profiles` напрямую, избегая рекурсии.

## ✅ После выполнения

1. Обновите страницу: https://tea-erp.vercel.app
2. Попробуйте войти снова
3. Ошибка "infinite recursion" должна исчезнуть
4. Вход должен работать

## 📋 Проверка

После выполнения SQL, проверьте:

```sql
-- Проверка функции
SELECT is_admin('ваш_user_id');

-- Проверка политик
SELECT * FROM pg_policies WHERE tablename = 'profiles';
```

