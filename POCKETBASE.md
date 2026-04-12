# PocketBase Setup Guide

PocketBase is a self-hosted, open-source backend — a single binary (or Docker container) that provides a database, authentication, and real-time subscriptions. It is an optional alternative to Firebase for groups that want full control over their data.

## 1. Run PocketBase

### Docker Compose (recommended)

Uncomment the `pocketbase` service in `docker-compose.yml`, then run:

```bash
docker compose up -d
```

PocketBase will be available at `http://your-host:8090`.

### Standalone binary

Download the binary for your platform from [pocketbase.io](https://pocketbase.io) and run:

```bash
./pocketbase serve
```

## 2. Create the admin account

Visit `http://your-host:8090/_/` and create the superuser (admin) account. This is the PocketBase admin UI — keep these credentials private.

## 3. Create the required collections

In the PocketBase admin UI, go to **Collections** and create the following four collections. All fields are plain **Text** type unless noted.

### `assets`
| Field | Type | Required |
|---|---|---|
| `app_id` | Text | yes |
| `item` | Text | yes |
| `amount` | Number | yes |
| `buyPrice` | Number | yes |
| `location` | Text | yes |
| `createdAt` | Text | yes |
| `loggedBy` | Text | no |
| `uexBuyId` | Number | no |

### `trades`
| Field | Type | Required |
|---|---|---|
| `app_id` | Text | yes |
| `assetId` | Text | yes |
| `item` | Text | yes |
| `amountSold` | Number | yes |
| `sellPrice` | Number | yes |
| `sellLocation` | Text | yes |
| `soldAt` | Text | yes |
| `buyPrice` | Number | no |
| `buyLocation` | Text | no |
| `loggedBy` | Text | no |
| `uexSellId` | Number | no |

### `roles`
| Field | Type | Required |
|---|---|---|
| `userId` | Text | yes |
| `role` | Text | yes |

### `profiles`
| Field | Type | Required |
|---|---|---|
| `userId` | Text | yes |
| `email` | Text | yes |

## 4. Set collection API rules

For each of the four collections above, set the **API rules** (under the collection's gear icon → API Rules):

- **List / View / Create / Update / Delete** — set to `@request.auth.id != ""`

This restricts all access to authenticated users. For `roles` and `profiles`, you may tighten this further (e.g. allow only admins to write roles) using PocketBase's filter syntax.

## 5. Create user accounts

In the PocketBase admin UI, go to **Collections → users** and create accounts for each org member. Members sign in with their email and password in the app's **Settings → Backend → PocketBase** section.

## 6. Seed the first admin role

The first admin role must be set manually. In the admin UI, go to **Collections → roles** and create a record:

```
userId: <uid of the user — visible in Collections → users>
role:   admin
```

After this, the admin can manage other users' roles directly from the app's **Settings → Backend → PocketBase → Role Management** section.

## 7. Connect the app

In SC Asset Manager, open **Settings → Backend**, select **PocketBase** from the dropdown, enter your server URL (e.g. `http://your-host:8090`), and click **Connect**. Then sign in with your user account.

## CORS

If the app is hosted on a different domain than PocketBase, you may need to add the app's origin to PocketBase's allowed origins. In the admin UI go to **Settings → Application → CORS allowed origins** and add your app URL.
