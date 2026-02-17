# Railway deployment

Проект состоит из двух частей:
- `html/js/css` (основной фронт, работает с Supabase)
- `registration-form` (PHP + MySQL)

В репозитории уже добавлен `Dockerfile`, который запускает Apache + PHP и учитывает порт Railway через `$PORT`.

## 1. Создать проект в Railway

1. В Railway: `New Project` -> `Deploy from GitHub Repo`.
2. Выбрать этот репозиторий и сервис с `Dockerfile`.

## 2. Поднять MySQL в Railway

1. В этом же Railway project добавить базу MySQL (plugin/service).
2. Из MySQL сервиса взять переменные:
   - `MYSQLHOST`
   - `MYSQLPORT`
   - `MYSQLDATABASE`
   - `MYSQLUSER`
   - `MYSQLPASSWORD`

## 3. Передать переменные в web-сервис

В web-сервисе добавить переменные окружения (см. `.env.railway.example`):
- `DB_HOST`
- `DB_PORT`
- `DB_NAME`
- `DB_USER`
- `DB_PASSWORD`

Важно: код также умеет читать `MYSQL*`, но явные `DB_*` удобнее поддерживать.

## 4. Импортировать схему БД

Локально выполнить импорт `db.railway.sql` в Railway MySQL:

```bash
mysql -h <MYSQLHOST> -P <MYSQLPORT> -u <MYSQLUSER> -p <MYSQLDATABASE> < db.railway.sql
```

Если пользователь/пароль содержит спецсимволы, удобнее запускать команду без пароля в строке и ввести пароль интерактивно.

## 5. Проверить после деплоя

1. Открыть:
   - `/index.html`
   - `/auth.html`
   - `/registration-form/index.php`
2. Проверить регистрацию/авторизацию в `registration-form`.
3. Проверить страницы Supabase-потока (`index.html`, `profile.html`, `ad.html`, `admin.html`).

## 6. Что еще важно

- Файлы в `registration-form/uploads` в Railway не персистентны между redeploy/restart.
- Для постоянного хранения фото лучше вынести загрузки в object storage (например, Supabase Storage/S3).
