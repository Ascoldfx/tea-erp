# Правильная настройка переменных окружения в Vercel

## ❌ Ошибка в настройке

Вы перепутали поля **Key** и **Value**!

В Vercel нужно добавить **ДВЕ** отдельные переменные:

## ✅ Правильная настройка

### Переменная 1: Supabase URL

1. Нажмите **"Add Another"** (если уже есть одна переменная)
2. В поле **Key** введите: `VITE_SUPABASE_URL`
3. В поле **Value** введите: `https://eopxmdywmjvpffcnlwck.supabase.co`
4. Выберите окружения: **Production**, **Preview**, **Development** (все три)

### Переменная 2: Supabase Anon Key

1. Нажмите **"Add Another"** еще раз
2. В поле **Key** введите: `VITE_SUPABASE_ANON_KEY`
3. В поле **Value** вставьте **ПОЛНЫЙ** anon ключ:
   ```
   eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc254eXBkcHJlbGxzbW91aGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzE1MDgsImV4cCI6MjA4MTMwNzUwOH0.6q57TC_H-hHeKCQXowb4cF7GCpFzfwYVowVr4o4NPBg
   ```
4. Выберите окружения: **Production**, **Preview**, **Development** (все три)

### Итоговый результат

Должно быть **2 переменные**:

| Key | Value |
|-----|-------|
| `VITE_SUPABASE_URL` | `https://eopxmdywmjvpffcnlwck.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc254eXBkcHJlbGxzbW91aGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzE1MDgsImV4cCI6MjA4MTMwNzUwOH0.6q57TC_H-hHeKCQXowb4cF7GCpFzfwYVowVr4o4NPBg` |

## 📋 Пошаговая инструкция

1. Откройте: https://vercel.com/antons-projects-93f1a619/tea-erp/settings/environment-variables

2. Удалите неправильную переменную (если есть):
   - Нажмите на кнопку с крестиком справа от переменной

3. Добавьте первую переменную:
   - Нажмите **"Add Another"** (или если список пуст, просто начните вводить)
   - **Key**: `VITE_SUPABASE_URL`
   - **Value**: `https://eopxmdywmjvpffcnlwck.supabase.co`
   - Выберите все окружения (Production, Preview, Development)

4. Добавьте вторую переменную:
   - Нажмите **"Add Another"**
   - **Key**: `VITE_SUPABASE_ANON_KEY`
   - **Value**: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc254eXBkcHJlbGxzbW91aGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzE1MDgsImV4cCI6MjA4MTMwNzUwOH0.6q57TC_H-hHeKCQXowb4cF7GCpFzfwYVowVr4o4NPBg`
   - Выберите все окружения (Production, Preview, Development)

5. Нажмите **"Save"** внизу страницы

6. После сохранения Vercel автоматически перезапустит деплой

## 🔍 Откуда взять anon ключ

В Supabase Dashboard:

1. Откройте: https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp/settings/api-keys
2. Перейдите на вкладку **"Legacy anon, service_role API keys"**
3. Найдите секцию **"anon public"**
4. Скопируйте ключ (начинается с `eyJ...`)
5. Это и есть правильный ключ для `VITE_SUPABASE_ANON_KEY`

## ⚠️ Важно

- **Key** = имя переменной (например, `VITE_SUPABASE_URL`)
- **Value** = значение переменной (например, URL или ключ)
- Не перепутывайте их местами!
- Anon ключ должен быть **полным** (весь длинный ключ, не только часть)

## ✅ Проверка

После сохранения:
1. Дождитесь завершения деплоя (проверьте в Deployments)
2. Откройте ваш сайт: https://tea-erp.vercel.app
3. Ошибка "Failed to fetch" должна исчезнуть
4. Вход должен работать


