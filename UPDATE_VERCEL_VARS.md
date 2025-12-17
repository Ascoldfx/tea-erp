# Обновление переменных окружения в Vercel

## 🔍 Проблема

В Vercel уже есть переменные, но они **неправильные**:

1. ❌ `VITE_SUPABASE_URL` = `https://nhsnxypdprellsmouhlp.supabase.co` (неправильный URL!)
   - ✅ Должно быть: `https://eopxmdywmjvpffcnlwck.supabase.co`

2. ❌ `VITE_SUPABASE_ANON_KEY` = `sb_publishable_YBmky4HEv2gw00e4P...` (новый формат)
   - ⚠️ Это новый формат ключа, но код может требовать legacy anon ключ

## ✅ Решение: Обновить существующие переменные

**Не нужно удалять и создавать заново!** Просто обновите значения.

### Вариант 1: Обновить через интерфейс (рекомендуется)

1. Откройте: https://vercel.com/antons-projects-93f1a619/tea-erp/settings/environment-variables

2. **Обновите `VITE_SUPABASE_URL`:**
   - Нажмите на переменную `VITE_SUPABASE_URL`
   - Измените значение на: `https://eopxmdywmjvpffcnlwck.supabase.co`
   - Убедитесь, что выбраны все окружения (Production, Preview, Development)
   - Нажмите "Save" или "Update"

3. **Обновите `VITE_SUPABASE_ANON_KEY`:**
   - Нажмите на переменную `VITE_SUPABASE_ANON_KEY`
   - Измените значение на legacy anon ключ:
     ```
     eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc254eXBkcHJlbGxzbW91aGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzE1MDgsImV4cCI6MjA4MTMwNzUwOH0.6q57TC_H-hHeKCQXowb4cF7GCpFzfwYVowVr4o4NPBg
     ```
   - Убедитесь, что выбраны все окружения
   - Нажмите "Save" или "Update"

### Вариант 2: Удалить и создать заново

Если обновление не работает:

1. **Удалите старые переменные:**
   - Нажмите на три точки (⋮) справа от каждой переменной
   - Выберите "Delete"
   - Подтвердите удаление

2. **Создайте новые переменные:**
   - Нажмите "+ Add Another"
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://eopxmdywmjvpffcnlwck.supabase.co`
   - Выберите все окружения
   
   - Нажмите "+ Add Another" еще раз
   - **Key**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc254eXBkcHJlbGxzbW91aGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzE1MDgsImV4cCI6MjA4MTMwNzUwOH0.6q57TC_H-hHeKCQXowb4cF7GCpFzfwYVowVr4o4NPBg`
   - Выберите все окружения

3. **Нажмите "Save"**

## 🔑 Какой ключ использовать?

### Legacy anon ключ (рекомендуется для текущего кода)
- Формат: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Где найти: Supabase Dashboard → Settings → API → "Legacy anon, service_role API keys" → "anon public"
- ✅ Работает с текущим кодом

### Новый publishable ключ
- Формат: `sb_publishable_...`
- Где найти: Supabase Dashboard → Settings → API → "Publishable and secret API keys" → "Publishable key"
- ⚠️ Может не работать с текущим кодом (нужна проверка)

## ✅ Правильные значения

| Переменная | Правильное значение |
|-----------|---------------------|
| `VITE_SUPABASE_URL` | `https://eopxmdywmjvpffcnlwck.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc254eXBkcHJlbGxzbW91aGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzE1MDgsImV4cCI6MjA4MTMwNzUwOH0.6q57TC_H-hHeKCQXowb4cF7GCpFzfwYVowVr4o4NPBg` |

## 📋 Чеклист

- [ ] URL обновлен на `https://eopxmdywmjvpffcnlwck.supabase.co`
- [ ] Anon ключ обновлен на legacy формат (`eyJ...`)
- [ ] Для обеих переменных выбраны все окружения
- [ ] Нажата кнопка "Save"
- [ ] Vercel перезапустил деплой
- [ ] Проверен сайт на https://tea-erp.vercel.app

## 🚀 После обновления

1. Vercel автоматически создаст новый деплой
2. Дождитесь завершения (статус "Ready")
3. Откройте: https://tea-erp.vercel.app
4. Ошибка "Failed to fetch" должна исчезнуть


