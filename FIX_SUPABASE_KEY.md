# Исправление ошибки "Failed to fetch"

## Проблема

Ошибка "Failed to fetch" возникает из-за неправильного ключа Supabase в `.env` файле.

## Решение

### Шаг 1: Получите правильный anon ключ

1. Откройте Supabase Dashboard: https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp
2. Перейдите в **Project Settings** → **API**
3. Найдите секцию **Project API Keys**
4. Скопируйте ключ **`anon` `public`** (он начинается с `eyJ...`)

### Шаг 2: Обновите .env файл

Откройте файл `.env` и замените ключ:

```bash
VITE_SUPABASE_URL=https://eopxmdywmjvpffcnlwck.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...  # ← Вставьте правильный anon ключ здесь
```

**Важно:** 
- ❌ НЕ используйте `service_role` ключ (он начинается с `sb_secret_...`)
- ✅ Используйте только `anon` `public` ключ (начинается с `eyJ...`)

### Шаг 3: Перезапустите dev сервер

```bash
# Остановите текущий сервер (Ctrl+C)
# Затем запустите снова:
npm run dev
```

### Шаг 4: Проверьте подключение

Откройте консоль браузера (F12) и проверьте:
- Нет ли ошибок "Failed to fetch"
- Нет ли ошибок "Invalid API key"

## Проверка ключа

Правильный anon ключ:
- ✅ Начинается с `eyJ...`
- ✅ Длинный (более 100 символов)
- ✅ Помечен как `anon` `public` в Supabase Dashboard

Неправильный ключ:
- ❌ Начинается с `sb_secret_...` (это service_role)
- ❌ Короткий
- ❌ Помечен как `service_role` в Supabase Dashboard

## Если проблема сохраняется

1. Проверьте, что файл `.env` находится в корне проекта
2. Проверьте, что переменные начинаются с `VITE_`
3. Перезапустите dev сервер после изменения `.env`
4. Очистите кеш браузера (Ctrl+Shift+R или Cmd+Shift+R)

