# Cafe Tempo API

Cafe Tempo is a virtual study cafe where a student plans tasks, chooses a cafe area, completes focus sessions, reserves seats, and orders virtual drinks or snacks. The API uses Express, MongoDB Atlas, and Mongoose. It calculates task priority, focus recommendations, seat availability, focus scores, statistics, streaks, and order totals.

## Team and repositories

- Jan Matthew Ferreras: backend API, database models, seed data, and server documentation.
- Frontend partner: add their confirmed name and contributions before submission.
- Client repository: <https://github.com/ferrerasjan/tempo-client>
- Server repository: <https://github.com/ferrerasjan/tempo-server>

The project instructions conflict on whether to submit one repository or two. The group chose separate client and server repositories; confirm the final submission format with the instructor.

## Run locally

Use Node.js 20 or newer and a MongoDB Atlas database. From the `server` folder:

```powershell
npm.cmd install
Copy-Item .env.example .env
```

Edit `.env` and replace the example `MONGO_URI` with your own Atlas connection string. Keep the database name after `.net/` simple, such as `cafe-tempo`. Do not commit `.env`.

```powershell
npm.cmd run seed
npm.cmd run dev
```

The API starts at `http://localhost:5000`. Open `/api/health` to check the server and `/api/menu-items` to check seeded data. Running the seed again will reuse its sample records.

| Variable | Purpose |
| --- | --- |
| `PORT` | API port; defaults to `5000`. |
| `MONGO_URI` | MongoDB Atlas connection string, including database name. |
| `CLIENT_ORIGIN` | Allowed React development origin; defaults to `http://localhost:5173`. |

The seed creates a demo user (`demo@cafetempo.test`), tasks, cafe areas, focus history, menu items, a reservation, and an order. Get the user's `_id` from `GET /api/tasks` or MongoDB Atlas. Replace `<userId>`, `<taskId>`, `<areaId>`, `<itemId>`, and other bracketed IDs in the examples below with real `_id` values. Date-time inputs must include a timezone, for example `2030-06-01T10:00:00+08:00`. Reservation dates must be in the future when you test them.

## Data and calculations

Seven related collections are used: `users`, `tasks`, `focusSessions`, `cafeAreas`, `reservations`, `menuItems`, and `orders`. Mongoose schemas define required fields, validation, references, and timestamps. There is no login in this version; requests use the selected demo user's ID. Authentication is optional in the project rubric.

- **Task priority:** today or overdue +3, tomorrow +2, high difficulty +2, and estimated work over 120 minutes +1. Unfinished tasks are sorted by score, then deadline.
- **Focus recommendation:** starts at 25, 40, or 50 minutes for low, medium, or high energy. Difficulty and urgency adjust the length; it stays within the task estimate and at least 15 minutes. The break is 5, 10, or 15 minutes based on the result.
- **Focus score:** completed minutes divided by planned minutes, multiplied by 100 and rounded. Sessions can exceed 100% if the student works longer than planned.
- **Seat availability:** counts the highest number of overlapping active reservations and running focus sessions in the requested time interval, then subtracts it from area capacity.
- **Statistics and streak:** totals use completed sessions. Calendar days use Philippine time (UTC+8). A current streak remains active through the day after the latest completed session.
- **Order total:** menu prices come from the database. A completed focus session today gives 10% off, rounded to whole credits. Orders use virtual credits; no payment is taken.

## API inventory

There are **28 project endpoints**, including six processing endpoints marked **P**. `/api/health` is an additional server check. All error responses use `{ "message": "..." }`; invalid input returns `400`, missing records return `404`, successful creates return `201`, and unexpected errors return `500`.

In the table, `GET` request examples show query strings where useful. Body examples are abbreviated JSON; omitted fields are described in the route section below.

| Method | Path | Purpose | Sample request | Sample response |
| --- | --- | --- | --- | --- |
| GET | `/api/users` | Choose an existing demo profile (not authentication) | `/api/users` | `[{"_id":"<userId>","displayName":"Demo Student"}]` |
| GET | `/api/tasks` | List tasks | `?user=<userId>` | `[{"title":"Prepare API demo"}]` |
| GET | `/api/tasks/priorities` **P** | Rank unfinished tasks | `?user=<userId>` | `{"rules":{...},"tasks":[{"priorityScore":3}]}` |
| GET | `/api/tasks/:id` | Get one task | `/api/tasks/<taskId>` | `{"title":"Prepare API demo"}` |
| POST | `/api/tasks` | Create task | `{"user":"<userId>","title":"Read notes","deadline":"2030-06-01T10:00:00+08:00","difficulty":"medium","estimatedMinutes":45}` | `{"_id":"<taskId>","status":"todo"}` |
| PATCH | `/api/tasks/:id` | Edit task or status | `{"status":"completed"}` | `{"status":"completed","completedAt":"..."}` |
| DELETE | `/api/tasks/:id` | Delete unlinked task | `/api/tasks/<taskId>` | `{"message":"Task deleted","task":{...}}` |
| GET | `/api/cafe-areas` | List spaces | `/api/cafe-areas` | `[{"name":"Quiet Corner","capacity":4}]` |
| GET | `/api/cafe-areas/:id` | Get one space | `/api/cafe-areas/<areaId>` | `{"name":"Quiet Corner"}` |
| GET | `/api/cafe-areas/:id/availability` **P** | Calculate free seats | `?startsAt=2030-06-01T10:00:00%2B08:00&endsAt=2030-06-01T11:00:00%2B08:00` | `{"reservedSeats":0,"remainingSeats":4,"available":true}` |
| GET | `/api/reservations` | List reservations | `?user=<userId>` | `[{"status":"active"}]` |
| GET | `/api/reservations/:id` | Get reservation | `/api/reservations/<reservationId>` | `{"status":"active"}` |
| POST | `/api/reservations` | Reserve a seat | `{"user":"<userId>","area":"<areaId>","startsAt":"2030-06-01T10:00:00+08:00","endsAt":"2030-06-01T11:00:00+08:00"}` | `{"_id":"<reservationId>","status":"active"}` |
| PATCH | `/api/reservations/:id` | Cancel reservation | `{"status":"cancelled"}` | `{"status":"cancelled"}` |
| POST | `/api/focus/recommendation` **P** | Suggest study and break minutes | `{"task":"<taskId>","energyLevel":"high"}` | `{"plannedMinutes":40,"breakMinutes":10}` |
| GET | `/api/focus/statistics` **P** | Summarize productivity | `?user=<userId>` | `{"totalFocusMinutes":85,"completedTasks":1}` |
| GET | `/api/focus/streak` **P** | Count current and longest streak | `?user=<userId>` | `{"currentStreak":1,"longestStreak":1}` |
| GET | `/api/focus-sessions` | List sessions | `?user=<userId>&status=completed` | `[{"status":"completed","focusScore":100}]` |
| GET | `/api/focus-sessions/:id` | Get session | `/api/focus-sessions/<sessionId>` | `{"status":"completed","focusScore":100}` |
| POST | `/api/focus-sessions` | Start a session | `{"user":"<userId>","task":"<taskId>","area":"<areaId>","energyLevel":"medium"}` | `{"_id":"<sessionId>","status":"active"}` |
| PATCH | `/api/focus-sessions/:id` | Timer actions or manual completion/cancellation | `{"status":"completed","completedMinutes":30}` | `{"status":"completed","focusScore":75}` |
| GET | `/api/menu-items` | List menu items | `?category=drink` | `[{"name":"Cafe Latte","priceCredits":30}]` |
| GET | `/api/menu-items/:id` | Get menu item | `/api/menu-items/<itemId>` | `{"name":"Cafe Latte","priceCredits":30}` |
| GET | `/api/orders` | List orders | `?user=<userId>` | `[{"status":"placed","totalCredits":30}]` |
| GET | `/api/orders/:id` | Get order | `/api/orders/<orderId>` | `{"status":"placed","totalCredits":30}` |
| POST | `/api/orders/calculate` **P** | Preview stored prices and discount | `{"user":"<userId>","items":[{"menuItem":"<itemId>","quantity":2}]}` | `{"subtotalCredits":60,"discountCredits":6,"totalCredits":54}` |
| POST | `/api/orders` | Place order | Same body as `/api/orders/calculate` | `{"_id":"<orderId>","status":"placed","totalCredits":54}` |
| PATCH | `/api/orders/:id` | Cancel placed order | `{"status":"cancelled"}` | `{"status":"cancelled"}` |

Task difficulty is `low`, `medium`, or `high`; task status is `todo`, `in_progress`, or `completed`. Focus session status can be `planned`, `active`, `paused`, `completed`, or `cancelled` through the public routes. Order quantity must be a whole number from 1 to 20 per item; list each item once. Totals and discounts are recalculated when an order is placed. A task already linked to a focus session cannot be deleted.

For a real request in Thunder Client, first call `GET /api/menu-items`, copy a menu item's `_id`, then send `POST /api/orders/calculate` with the demo user ID and that item ID. The preview does not save an order; `POST /api/orders` saves it.

## Checks and current limits

The server routes have been checked against Atlas for task priorities, seat availability and reservations, focus recommendations and sessions, statistics and streaks, menu pricing, order placement, and cancellation. The React draft's browser tests also cover task creation/editing/deletion, session reload/completion, discounts, orders, reservations, statistics, mobile navigation, and error recovery using an isolated profile. Final review after UI refinement is still needed.

- A working React draft and its screenshots are in the client repository. Final UI refinement and the frontend partner's name/contributions remain before submission.
- There is no password login or payment. The draft uses a selected user ID, virtual credits, and a browser countdown derived from the saved session timestamp.
- A shared Promise queue serializes booking and session seat checks within one Node process. Concurrent one-seat booking/start tests pass. Multiple server instances would require database-level concurrency protection.
- Confirm the repository submission format and exact deadline in the Microsoft Teams assignment.

For the defense, demonstrate one successful request, one `400` validation error, one `404` missing record, and the flow React → Express → MongoDB Atlas → JSON response → React screen.

## Drink-size sessions and timer actions

The original recommendation-based POST remains supported. For the drink flow, POST `/api/focus-sessions` with the usual user/task/area/energyLevel fields plus:

```json
{ "drink": "<menuItemId>", "drinkSize": "grande", "sessionLabel": "My study label", "status": "planned" }
```

This prepares a session without starting the timer or taking a seat. The server sets Tall to 25 minutes, Grande to 45, and Venti to 60. Their break durations are 5, 10, and 15 minutes. The menu item must be an available drink. The label is at most 80 characters. One user can have only one planned, active, or paused session.

PATCH `/api/focus-sessions/:id` with `{ "action": "start" }`, `pause`, `resume`, `move`, or `stop`. Start/resume/move may include an `area` ID. The server checks capacity over the remaining focus window before assigning a seat. Arrows in the client only preview spaces; a move request changes the actual seat.

Pause persists its timestamp and releases the seat. Resume checks seats again and adds the paused interval to `pausedMilliseconds`. Stop calculates elapsed whole minutes excluding pauses; zero minutes becomes cancelled, otherwise completed. GET responses include `serverTime` and `elapsedSeconds`. Planned sessions have no start timestamp. Finished sessions reject further timer actions. The existing manual completion request is retained for direct API activities.

Availability includes running sessions until their predicted timer end. Completed, cancelled, paused, and planned sessions do not occupy seats. A user's overlapping future reservation must be cancelled before taking a live session seat. This avoids counting the same user's booking twice.
