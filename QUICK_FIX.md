# Быстрое исправление ошибок

## ✅ Проблема 1: Git предупреждение - ИСПРАВЛЕНО

Добавлен `.gemini/` в `.gitignore`. Теперь можно коммитить:

```bash
git add .
git commit -m "feat: Add real Supabase authentication with email/password"
git push origin main
```

## ❌ Проблема 2: "Failed to fetch" - ТРЕБУЕТ ИСПРАВЛЕНИЯ

### Причина
В файле `.env` указан неправильный ключ Supabase. Ключ `sb_secret_...` - это `service_role` ключ, который нельзя использовать на фронтенде.

### Решение

1. **Получите правильный anon ключ:**
   - Откройте: https://supabase.com/dashboard/project/nhsnxypdprellsmouhlp/settings/api
   - Найдите секцию **Project API Keys**
   - Скопируйте ключ **`anon` `public`** (начинается с `eyJ...`)

2. **Обновите `.env` файл:**
   ```bash
   # Откройте .env и замените:
   VITE_SUPABASE_URL=https://eopxmdywmjvpffcnlwck.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...  # ← Вставьте правильный anon ключ
   ```

3. **Перезапустите dev сервер:**
   ```bash
   # Остановите сервер (Ctrl+C в терминале где запущен npm run dev)
   # Затем запустите снова:
   npm run dev
   ```

4. **Проверьте в браузере:**
   - Обновите страницу (F5)
   - Попробуйте войти снова
   - Откройте консоль (F12) и проверьте ошибки

### Как отличить правильный ключ:

✅ **Правильный (anon public):**
- Начинается с `eyJ...`
- Длинный (100+ символов)
- В Dashboard помечен как `anon` `public`

❌ **Неправильный (service_role):**
- Начинается с `sb_secret_...`
- В Dashboard помечен как `service_role`
- **НЕ используйте его на фронтенде!**

## После исправления

1. ✅ Ошибка "Failed to fetch" исчезнет
2. ✅ Вход будет работать
3. ✅ Можно будет закоммитить изменения

## Проверка

После исправления ключа, откройте консоль браузера (F12) и проверьте:
- Нет ошибок "Failed to fetch"
- Нет ошибок "Invalid API key"
- При входе появляется сессия в Local Storage

