# 🔴 КРИТИЧЕСКАЯ ОШИБКА: ERR_NAME_NOT_RESOLVED

## Проблема

Ошибка `net::ERR_NAME_NOT_RESOLVED` означает, что браузер не может найти сервер `eopxmdywmjvpffcnlwck.supabase.co`.

**Это значит, что в Vercel переменные окружения НЕ ОБНОВЛЕНЫ или неправильные!**

## ✅ СРОЧНОЕ РЕШЕНИЕ

### Шаг 1: Проверьте правильный URL проекта

Откройте Supabase Dashboard:
https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp/settings/general

В разделе **"Reference ID"** вы увидите правильный URL проекта.

**Важно:** URL должен быть `https://nhsnxypdprellsmouhlp.supabase.co`, а НЕ `https://eopxmdywmjvpffcnlwck.supabase.co`!

### Шаг 2: Обновите переменные окружения в Vercel

1. Откройте: https://vercel.com/antons-projects-93f1a619/tea-erp/settings/environment-variables

2. **УДАЛИТЕ старую переменную `VITE_SUPABASE_URL`** (если она есть с неправильным URL)

3. **СОЗДАЙТЕ/ОБНОВИТЕ переменную `VITE_SUPABASE_URL`:**
   - Key: `VITE_SUPABASE_URL`
   - Value: `https://nhsnxypdprellsmouhlp.supabase.co` ← **ПРАВИЛЬНЫЙ URL!**
   - Выберите все окружения: Production, Preview, Development

4. **СОЗДАЙТЕ/ОБНОВИТЕ переменную `VITE_SUPABASE_ANON_KEY`:**
   - Key: `VITE_SUPABASE_ANON_KEY`
   - Value: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc254eXBkcHJlbGxzbW91aGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzE1MDgsImV4cCI6MjA4MTMwNzUwOH0.6q57TC_H-hHeKCQXowb4cF7GCpFzfwYVowVr4o4NPBg`
   - Выберите все окружения: Production, Preview, Development

5. **Нажмите "Save"**

6. **Дождитесь перезапуска деплоя** (Vercel автоматически перезапустит)

### Шаг 3: Обновите локальный .env файл

```bash
# В локальном .env файле должно быть:
VITE_SUPABASE_URL=https://nhsnxypdprellsmouhlp.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oc254eXBkcHJlbGxzbW91aGxwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU3MzE1MDgsImV4cCI6MjA4MTMwNzUwOH0.6q57TC_H-hHeKCQXowb4cF7GCpFzfwYVowVr4o4NPBg
```

## 🔍 Как проверить правильный URL

1. Откройте: https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp/settings/general
2. Найдите **"Reference ID"** - это `nhsnxypdprellsmouhlp`
3. URL проекта: `https://nhsnxypdprellsmouhlp.supabase.co`

## ⚠️ Важно

- ❌ **НЕПРАВИЛЬНО:** `https://eopxmdywmjvpffcnlwck.supabase.co` (этот домен не существует!)
- ✅ **ПРАВИЛЬНО:** `https://nhsnxypdprellsmouhlp.supabase.co` (это правильный URL вашего проекта)

## 📋 Чеклист

- [ ] Проверен правильный URL в Supabase Dashboard
- [ ] Обновлена переменная `VITE_SUPABASE_URL` в Vercel на правильный URL
- [ ] Обновлена переменная `VITE_SUPABASE_ANON_KEY` в Vercel
- [ ] Выбраны все окружения для обеих переменных
- [ ] Нажата кнопка "Save" в Vercel
- [ ] Дождались перезапуска деплоя
- [ ] Обновлен локальный .env файл
- [ ] Проверен сайт после деплоя

## 🚀 После исправления

1. Vercel перезапустит деплой с правильными переменными
2. Дождитесь завершения (статус "Ready")
3. Откройте: https://tea-erp.vercel.app
4. Ошибка `ERR_NAME_NOT_RESOLVED` должна исчезнуть
5. Вход должен работать



