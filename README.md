# BARDAHL — очередь мастеров

PWA для автосервиса: очередь по боксам, учёт работ и заказов, отчёты. Бэкенд — Supabase (таблицы `queue_*`, `work_orders`, RPC `branch_queue_action` и др.). Сборки нет: сайт статический, публикуется через GitHub Pages.

## Структура
- `index.html` — разметка
- `styles.css` — все стили (блоки идут в порядке каскада, у каждого комментарий с прежним id)
- `js/app.js` — основная логика (вход, очередь, заказы, отчёты)
- `js/clock.js`, `backgrounds.js`, `opacity-slider.js`, `rounds-clip.js`, `report-date-sync.js` — дополнения интерфейса; подключаются в этом порядке
- `sw.js` — service worker (офлайн-оболочка). **При изменении любого файла из списка CORE в sw.js поднимайте `CACHE_NAME`.**
- `manifest.webmanifest`, `icon-*.png` — установка как приложение (есть maskable-иконки)

## Подключение к Supabase
URL и publishable-ключ заданы в начале `js/app.js`. Ключ публичный по замыслу; безопасность обеспечивается политиками RLS на стороне Supabase.
