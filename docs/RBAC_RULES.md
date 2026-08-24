FINAL PRODUCTION RBAC + TRANSACTION INTEGRITY IMPLEMENTATION
============================================================

> **🚨 IMPORTANT UPDATE (SIMPLIFIED RBAC):** 
> To keep the system fast, simple, and maintainable, the following 6 complex features originally proposed in this spec have been **OFFICIALLY DROPPED** and will NOT be implemented:
> 1. Async Approval Queue (Pending Requests)
> 2. Cashier Discount Limits (%)
> 3. Inventory Adjustment Limits (Amount gating)
> 4. Supplier Payment High-Value Approval (Amount gating)
> 5. Expense Reversal Approval workflows
> 6. Sensitive Customer-Credit adjustment gating
>
> Any references to "APPROVAL", "PENDING_APPROVAL", or "Limits" in the document below should be ignored. The system uses strict Role-Based (Admin/Manager/Cashier) binary permissions instead of complex threshold-based async queues> **📡 CLOUD DATA SYNC RULES — ALL DEVICES SAME (MANDATORY)**
>
> ### Core Principle
> **Supabase cloud = ONLY source of truth.** Every device must show identical data on every refresh.
> `localStorage` / IndexedDB (Dexie) = display cache ONLY. NEVER used as source of truth.
>
> ---
>
> ### ✅ Tables fetched from cloud on EVERY startup (`useAppLoadData.ts`)
>
> All 24 tables below are loaded fresh from Supabase on every app start + refresh,
> written to localDb cache AND Zustand store.
>
> | # | Table | localDb key | Zustand Store | Purpose |
> |---|-------|-------------|--------------|---------|
> | 1 | `products` | `products` | `useProductsStore` | Inventory catalog |
> | 2 | `customers` | `customers` | `useCustomersStore` | Customer directory |
> | 3 | `users` | `users` | `useUsersStore` | Staff/login accounts |
> | 4 | `salesmen` | `salesmen` | `useUsersStore` | Salesman list |
> | 5 | `categories` | `categories` | `useInventoryStore` | Product groups |
> | 6 | `discounts` | `discounts` | `useAppStore` | Discount rules |
> | 7 | `payment_modes` | `paymentModes` | `useSettingsStore` | Cash/Card/Online wallets |
> | 8 | `payments` | `payments` | `usePaymentsStore` | Payment ledger (for reports) |
> | 9 | `expenses` | `expenses` | `useExpensesStore` | Expense entries |
> | 10 | `suppliers` | `suppliers` | `useInventoryStore` | Supplier directory |
> | 11 | `supplier_transactions` | `supplierTransactions` | `useInventoryStore` | Supplier payment ledger |
> | 12 | `purchase_records` | `purchaseRecords` | `useInventoryStore` | Stock purchase records |
> | 13 | `purchase_orders` | `purchaseOrders` | `useInventoryStore` | Pending restock orders |
> | 14 | `purchase_order_items` | `purchaseOrderItems` | localDb only | PO line items |
> | 15 | `bundles` | `bundles` | `useAppStore` | Bundle/deal products |
> | 16 | `bundle_items` | `bundleItems` | localDb only | Bundle product detail |
> | 17 | `toppings` | `toppings` | localDb only | Restaurant addon toppings |
> | 18 | `product_addons` | `productAddons` | localDb only | Product cross-sell addons |
> | 19 | `product_toppings` | _(no localDb table)_ | localDb only (via toppings) | Topping-product mapping |
> | 20 | `sales` | `sales` | `useSalesStore` | Transaction history (latest 500) |
> | 21 | `stock_history` | `stockHistory` | localDb only | Product movement history |
> | 22 | `variant_stock_history` | `variantStockHistory` | localDb only | Variant-level movements |
> | 23 | `sales_tabs` | `salesTabs` | `useCartStore` | POS cart tabs (per `user_id`) |
> | 24 | `app_settings` | `appSettings` | `useSettingsStore` | Business configuration |
> | 25 | `customer_ledger` | `customerLedger` | localDb only | Per-customer debit/credit history |
>
> ---
>
> ### ❌ Tables NOT fetched at startup (deliberate exclusions)
>
> | Table | Reason |
> |-------|--------|
> | `customer_ledger` | Append-only ledger; balance derived from `sales` at query time |
> | `payment_movements` | Written via `apply_payment_movements` RPC only; read via `payments` |
> | `row_tombstones` | Internal delete-guard tracking; backend only |
> | `sale_audit_log` | Backend audit trail only; never shown directly in UI |
> | `stock_mismatches` | Backend reconciliation table; no UI component |
> | `price_history` | Not yet exposed in frontend UI |
> | `sessions` | Backend auth session tracking; no frontend use |
>
> ---
>
> ### 🖥️ Device-Local ONLY (NEVER written to cloud)
>
> | Key | Storage | Purpose |
> |-----|---------|---------|
> | `pos_local_prefs.theme` | `localStorage` | Dark/Light mode per device |
> | `pos_local_prefs.posGridColumns` | `localStorage` | POS grid density (1–8) per device |
> | `pos_active_sales_tab` | `localStorage` | Which POS tab is active on this device |
>
> ---
>
> ### 🔒 Hard Rules for Developers
>
> 1. **NEVER** read business data (sales, products, stock) from `localStorage` — always from Zustand store (populated from cloud).
> 2. **NEVER** save `theme` or `posGridColumns` to Supabase `app_settings`. Device-only prefs.
> 3. **NEVER** add a new table without ALSO adding it to `useAppLoadData.ts` AND `localDb` cache write.
> 4. **ALWAYS** map raw cloud data (snake_case) to application types (camelCase) using `map*` functions (e.g. `mapSettings`, `mapSupplier`) BEFORE inserting into `localDb`. **NEVER insert raw Supabase row objects into Dexie**, as this breaks cross-device syncing and causes missing data fields on refresh.
> 5. **ALL COLUMNS MUST SYNC:** Ensure every single column in the database schema is accounted for in the `map*` and `toRemote*` functions. No data should be left behind on cloud upload/download.
> 6. **ALWAYS** `localDb.TABLE.clear()` then `bulkPut()` on startup — prevents stale ghost data from old sessions.
> 7. **ALWAYS** populate the corresponding Zustand store after fetching from cloud.
> 8. **Realtime handlers** (`src/context/realtime/handlers-*.ts`) must update BOTH localDb AND Zustand on INSERT/UPDATE/DELETE.
> 9. `stock_history` and `variant_stock_history` — append-only; never delete from frontend. Only DB triggers write `products.stock`.
> 10. `sales_tabs` — always filter by `user_id`; never share across users.
> 11. **New table checklist**: Schema SQL → Migration file → `localDb.ts` table → Mapper functions (`map*`, `toRemote*`) → `useAppLoadData.ts` fetch (with mapper) → localDb persist → Zustand store set → Realtime handler.


============================================================
IMPORTANT:
Do NOT just patch the UI.
Permanently fix the complete system across:

- Database schema
- Database functions / RPC
- Server-side authorization
- API / Edge Functions
- Frontend permissions
- Routes
- Navigation
- Hooks
- Modals
- Forms
- Actions
- Inventory
- Wallets
- Sales
- Returns
- Refunds
- Expenses
- Suppliers
- Customers
- Users
- Audit logs
- Approval workflows
- Transaction lifecycle
- Reversal lifecycle
- Legacy permission systems

Do not remove existing working functionality unnecessarily.
Do not make assumptions that break existing business logic.
First understand the current implementation, then make the permanent fix.

============================================================
1. CORE OBJECTIVE
============================================================

The system must have ONE authoritative RBAC system and ONE reliable transaction/effect system.

Every sensitive action must be:

1. Permission checked
2. Server-side authorized
3. Database/RPC authorized
4. Validated
5. Executed atomically
6. Audited
7. Linked to all resulting Inventory/Wallet/Ledger effects

Frontend permission checks are only for UX.

Actual security MUST exist server-side and database/RPC-side.

The client must NEVER be trusted for:

- role
- isAdmin
- permissions
- approval status
- wallet balance
- inventory balance
- financial amounts
- transaction ownership
- authorization

============================================================
2. FINAL ROLES
============================================================

Use these core roles:

ADMIN
MANAGER
CASHIER

Final hierarchy:

ADMIN > MANAGER > CASHIER

ADMIN = CONTROL
MANAGER = OPERATE
CASHIER = SELL

If legacy roles exist, audit them first.
Do not blindly delete them.

If an unused legacy role is confirmed unnecessary:
- migrate/remove safely
- update DB constraints
- update frontend selectors
- update server checks
- update tests

There must be one authoritative role system.

============================================================
3. ADMIN — FULL ACCESS
============================================================

ADMIN has full system/business authority.

ALLOW:

- Dashboard
- All Reports
- Sales
- Sale Create
- Sale Edit
- Sale Reverse/Delete
- Returns
- Refunds
- Inventory View
- Restock
- Purchase Orders
- Inventory Adjustments
- Products View
- Products Add
- Products Edit
- Product Archive/Delete
- Wallet View
- Wallet Management
- Manual Wallet Adjustment
- Wallet Transfer
- Expenses
- Expense Create/Edit/Reverse
- Suppliers
- Supplier Ledger
- Supplier Payments
- Customers
- Customer Ledger
- Customer Credit
- Customer Payments
- Users View
- Create Users
- Edit Users
- Disable/Enable Users
- Roles
- Permissions
- Approval Management
- Audit Logs
- System Settings
- Business Settings
- Security Settings
- Data Export
- All sensitive operations
- All reversals/corrections

ADMIN does not require approval for normal administrative actions.

============================================================
4. MANAGER — OPERATIONAL ACCESS
============================================================

MANAGER has broad daily business access.

ALLOW:

Dashboard
Reports
Sales
Sale Create
Sale Edit
Returns
Normal Refunds
Inventory View
Restock
Purchase Orders
Stock Receiving
Products View
Products Add/Edit/Archive (Only if `canEditProduct` is explicitly enabled)
Expenses
Supplier Management
Supplier Ledger
Supplier Operations
Customer Management
Customer Ledger
Customer Credit
Customer Payments
Operational Wallet View
Audit Logs View

Manager may perform normal operational actions.

Manager must NOT have:

- User creation
- User editing
- User disabling/enabling
- Role management
- Permission management
- System settings
- Security settings
- Approval-rule configuration
- Manual wallet adjustment
- Database/architecture controls
- Data export
- Audit log modification/deletion

============================================================
5. MANAGER HIGH-RISK APPROVALS
============================================================

Manager may REQUEST high-risk actions, but where approval is configured they must not execute the final financial/inventory effect directly.

Recommended approval-required actions:

- Sale Reverse/Delete
- High-value Refund
- Large Inventory Adjustment
- High-value Supplier Payment
- Sensitive Expense Reverse
- Other configured high-risk financial corrections

Flow:

MANAGER REQUEST
      ↓
PENDING_APPROVAL
      ↓
ADMIN REVIEW
      ↓
APPROVE / REJECT

PENDING_APPROVAL must NOT create:

- Inventory IN
- Inventory OUT
- Wallet IN
- Wallet OUT
- Customer ledger effect
- Supplier ledger effect

Only APPROVE executes the actual atomic transaction.

REJECT = zero business effect.

ADMIN can execute directly.

============================================================
6. CASHIER — POS ACCESS
============================================================

CASHIER is for normal counter/POS operations.

ALLOW:

- POS
- Create Sale
- Search Products
- View product information needed for POS
- Process payments
- Split payments if configured
- Print receipt
- Reprint allowed receipts
- Customers
- Add Customer
- Edit basic customer details
- View Customer
- Customer Ledger/View
- Customer Payment
- Normal Customer Credit according to configured rules
- Normal Customer Return
- Limited Refund within configured limit
- Assigned Wallet/Shift View
- Own/current shift sales
- Basic operational dashboard

CASHIER MUST NOT:

- Sale Reverse/Delete
- Unrestricted historical Sale Edit
- Inventory Adjustment
- Manual Stock IN
- Manual Stock OUT
- Restock
- Purchase Order
- Supplier Management
- Supplier Payment
- Manual Wallet Adjustment
- Wallet Transfer
- Change Wallet Opening Balance
- Expenses
- Product Add/Edit/Delete
- Product Archive
- User Management
- Role Management
- Permission Management
- System Settings
- Security Settings
- Approval Management
- Database Export
- Audit Log Management
- Modify historical financial records
- Bypass approvals
- Change another user's permissions
- Access sensitive company-wide financial controls

============================================================
7. CASHIER DASHBOARD / REPORTS
============================================================

Cashier may see:

- POS/shift dashboard
- Own sales
- Current shift totals
- Assigned wallet/shift information
- Basic operational statistics

Cashier must NOT see:

- Company-wide Profit/Loss
- Sensitive financial reports
- Full company wallet balances
- Complete supplier outstanding
- Complete company expenses
- Sensitive business analytics

Hide unauthorized tabs/buttons/routes from UI.

BUT remember:

UI hiding is NOT security.
Server/database must still reject unauthorized requests.

============================================================
8. CASHIER DISCOUNT
============================================================

If discount functionality exists:

Cashier may apply discount only within configured limit.

Example:

Cashier discount <= configured percentage/amount:
ALLOW

Above limit:
REQUIRE APPROVAL

Cashier cannot change discount limits.

Manager/Admin can manage according to their permissions.

============================================================
9. FINAL PERMISSION MATRIX
============================================================

Permission                         ADMIN   MANAGER   CASHIER

Dashboard                           YES      YES       LIMITED
Reports                             YES      YES       LIMITED
Profit/Financial Reports            YES      YES       NO
Products View                       YES      YES       POS ONLY
Product Add                         YES      YES       NO
Product Edit                        YES      YES       NO
Product Archive/Delete              YES      CONTROL  NO
Sales Create                        YES      YES       YES
Sale Edit                           YES      YES       LIMITED
Sale Reverse/Delete                 YES      APPROVAL NO
Returns                             YES      YES       YES
Refunds                             YES      APPROVAL LIMITED
Inventory View                      YES      YES       LIMITED
Restock                             YES      YES       NO
Purchase Orders                     YES      YES       NO
Inventory Adjustment                YES      APPROVAL NO
Wallet View                         YES      YES       ASSIGNED
Manual Wallet Adjustment            YES      NO        NO
Wallet Transfer                     YES      APPROVAL NO
Expenses                            YES      YES       NO
Expense Reverse/Delete              YES      APPROVAL NO
Supplier Ledger                     YES      YES       NO
Supplier Payment                    YES      APPROVAL NO
Customer Ledger                     YES      YES       YES
Customer Credit                     YES      YES       LIMITED
Customer Payment                    YES      YES       YES
Users View                          YES      NO        NO
Create User                         YES      NO        NO
Edit User                           YES      NO        NO
Disable/Enable User                 YES      NO        NO
Roles Management                   YES      NO        NO
Permissions Management             YES      NO        NO
Approval Management                YES      NO        NO
Audit Logs                          YES      VIEW      NO
System Settings                     YES      NO        NO
Security Settings                   YES      NO        NO
Data Export                         YES      NO        NO
Database/Architecture Controls      YES      NO        NO

"CONTROL" means operationally allowed but sensitive operations may require approval.
"APPROVAL" means actual approval workflow, not merely a warning.

============================================================
10. CENTRAL PERMISSION SYSTEM
============================================================

Create/use ONE centralized permission definition.

Do not scatter permission strings throughout the application.

Use the existing permission architecture where possible, but normalize it.

Examples:

dashboard.view

reports.view
reports.financial

products.view
products.create
products.edit
products.archive

sales.create
sales.view
sales.edit
sales.reverse

returns.create
returns.view
returns.reverse

refunds.create
refunds.approve

inventory.view
inventory.restock
inventory.adjust

wallet.view
wallet.adjust
wallet.transfer

expenses.view
expenses.create
expenses.edit
expenses.reverse

suppliers.view
suppliers.manage
suppliers.payment

customers.view
customers.create
customers.edit
customers.credit
customers.payment

users.view
users.create
users.edit
users.disable

roles.manage
permissions.manage

approvals.create
approvals.approve
approvals.reject

audit.view

settings.manage
security.manage

exports.create

Use exact naming conventions already used by the project where appropriate.

There must be ONE authoritative permission source.

============================================================
11. REMOVE UI BYPASSES
============================================================

The audit identified hardcoded admin bypasses in areas such as:

- TransactionDetailModal.body.tsx
- TransactionsManager.body.tsx
- useExpenseManagerActions.ts
- InventoryManager.tsx
- bundles/index.tsx
- usePurchaseOrder.ts
- useSupplierManagerLogic.ts

Remove patterns such as:

isAdmin = true

and any equivalent:

- hardcoded admin
- fake permission
- single-tenant bypass
- unconditional action access
- role spoofing
- bypass comments

Every action must use centralized permission checks.

Example concept:

can("sales.reverse")

NOT:

isAdmin === true

============================================================
12. FRONTEND AUTHORIZATION
============================================================

Use centralized permission checks for:

- buttons
- tabs
- menus
- routes
- modals
- forms
- action menus
- hooks
- navigation
- mobile navigation
- desktop navigation

Unauthorized UI should be hidden/disabled.

But never rely on UI for security.

============================================================
13. SERVER-SIDE AUTHORIZATION
============================================================

Every sensitive API/Edge Function/RPC must independently check:

1. authenticated user
2. active user
3. real role
4. required permission
5. approval state if applicable
6. target/resource access
7. transaction validity

Do NOT trust client-provided:

role
isAdmin
permissions
approval
wallet
balance
inventory
amount

Example:

client sends:
role = "admin"

Server MUST IGNORE IT.

Resolve role from trusted authenticated identity/database.

============================================================
14. DATABASE/RPC ENFORCEMENT
============================================================

Sensitive operations must be protected at DB/RPC/server level.

At minimum audit and protect:

create_sale
edit_sale
reverse_sale
delete_sale if applicable
create_return
reverse_return
create_refund
approve_refund
restock_inventory
stock_adjustment
create_expense
edit_expense
reverse_expense
supplier_payment
customer_payment
wallet_adjustment
wallet_transfer
user_create
user_update
user_disable
role_update
permission_update
settings_update
data_export

Unauthorized request:

REJECT

No mutation.

No partial effect.

============================================================
15. STOCK_ADJUSTMENT — CRITICAL
============================================================

The identified stock_adjustment gap must be permanently fixed.

ADMIN:
FULL ACCESS

MANAGER:
CONTROLLED / APPROVAL BASED

CASHIER:
DENY

Direct RPC/API call by cashier:

DENY

No:

Inventory IN
Inventory OUT
Stock balance change
Ledger entry

must occur.

Permission must be checked before the adjustment transaction starts.

============================================================
16. MANUAL WALLET ADJUSTMENT
============================================================

ADMIN ONLY.

Manager:
DENY

Cashier:
DENY

Manual wallet adjustment requires:

- permission
- wallet
- amount
- direction
- reason
- actor
- timestamp
- request ID
- audit record

Never directly mutate wallet balance with:

balance = balance + amount

outside the controlled transaction system.

============================================================
17. FAIL-CLOSED AUTHORIZATION
============================================================

Current fail-open behavior must be removed.

If:

- permission missing
- permission unknown
- role missing
- role invalid
- token missing
- token invalid
- token expired
- action hash missing
- authorization lookup fails
- user inactive
- security verification fails

Result:

DENY

Never ALLOW.

Golden rule:

UNKNOWN = DENY

============================================================
18. ACTION TOKEN SECURITY
============================================================

Audit and permanently fix action-token verification.

If token/hash is:

- missing
- malformed
- invalid
- expired
- mismatched

then:

DENY

Do not skip authorization because a legacy action_hash is NULL.

Remove legacy fail-open branches.

============================================================
19. LEGACY PERMISSIONS
============================================================

Audit existing legacy:

TEXT[] permissions

or any second permission authority.

If centralized RBAC is now authoritative:

1. identify all consumers
2. migrate them
3. update frontend
4. update server
5. update DB
6. update types
7. remove legacy authority

Example identified consumer:

ReportHeader.tsx

must not remain dependent on a separate permission authority.

There must NOT be two systems where:

System A says ALLOW
System B says DENY

Choose ONE authoritative RBAC system.

============================================================
20. DEAD AUTHORIZATION CODE
============================================================

Remove or properly integrate dead code such as:

SERVER_ROLE_GUARD

and any other unused authorization mechanism.

Do not leave confusing duplicate security layers.

Final code should have clear authorization flow.

============================================================
21. USER MANAGEMENT
============================================================

ONLY ADMIN:

Create User
Edit User
Disable User
Enable User
Change Role
Change Permissions
Reset permissions

Manager:
DENY

Cashier:
DENY

Manager must not be able to:

- promote self
- promote another user
- grant Admin
- grant sensitive permissions
- change Admin
- modify role hierarchy

============================================================
22. ROLE MANAGEMENT
============================================================

ONLY ADMIN.

Admin controls:

- role definitions
- role-permission mapping
- approval rules
- sensitive security settings

Manager:
NO

Cashier:
NO

============================================================
23. SYSTEM SETTINGS
============================================================

ONLY ADMIN.

Manager:
NO

Cashier:
NO

Sensitive settings include:

- global POS settings
- inventory policies
- negative-stock rules
- wallet configuration
- approval thresholds
- security settings
- permission configuration
- business-wide settings

============================================================
24. AUDIT LOGS
============================================================

ADMIN:
Full view

MANAGER:
View only

CASHIER:
No access

Audit records should be immutable from normal application operations.

Nobody should be able to edit/delete audit history through normal UI/RPC.

Audit sensitive events:

- permission changes
- role changes
- user creation
- user disable
- sale reverse
- sale edit
- refund
- return
- inventory adjustment
- wallet adjustment
- wallet transfer
- expense reverse
- supplier payment
- customer payment
- approval
- rejection
- settings changes
- export

Store:

- actor
- actor role
- action
- target
- before state where appropriate
- after state where appropriate
- timestamp
- request ID
- approval ID if applicable

============================================================
25. TRANSACTION INTEGRITY
============================================================

This is equally important as RBAC.

Every real business action must create its complete effects atomically.

Example Sale:

Sale successfully committed
+
Inventory OUT
+
Wallet IN
+
Customer/Supplier effect if applicable
+
Audit

All linked.

No independent orphan records.

============================================================
26. REAL IN/OUT RULE
============================================================

NO REAL BUSINESS ACTION
=
NO INVENTORY/WALLET IN/OUT

If Sale fails:

Inventory = NO MOVEMENT
Wallet = NO MOVEMENT

If Return fails:

Inventory = NO MOVEMENT
Wallet = NO MOVEMENT

If Refund fails:

Wallet = NO MOVEMENT

If transaction rolls back:

ALL effects roll back.

============================================================
27. ATOMIC TRANSACTIONS
============================================================

All required effects must commit together.

Example:

Sale
Inventory
Wallet
Customer Ledger
Audit

must be inside one reliable transaction boundary.

If any required operation fails:

ROLLBACK ALL

Never:

Sale SUCCESS
Inventory SUCCESS
Wallet FAILED

with partial records remaining.

Golden rule:

ALL EFFECTS COMMIT
OR
ZERO EFFECTS COMMIT

============================================================
28. SALE FLOW
============================================================

Normal cash sale:

Sale = SUCCESS
Inventory = OUT
Cash Wallet = IN

Bank sale:

Sale = SUCCESS
Inventory = OUT
Bank Wallet = IN

Split payment:

Inventory = OUT
Cash = IN
Bank = IN
Card = IN

according to actual amounts.

Credit sale:

Inventory = OUT
Wallet = NO MOVEMENT
Customer Receivable = INCREASE

Partial credit:

Inventory = OUT
Actual payment wallet = IN
Remaining receivable = INCREASE

============================================================
29. SALE REVERSE/DELETE
============================================================

"Delete Sale" must NOT mean simply deleting the sale row.

It means:

COMPLETE REVERSAL

Original:

Inventory OUT
Cash IN

Reverse:

Inventory IN
Cash OUT

Original:

Inventory OUT
Cash IN
Bank IN
Receivable increase

Reverse:

Inventory IN
Cash OUT
Bank OUT
Receivable decrease

Every original effect must have its exact opposite.

Original transaction must remain traceable.

Create a reversal relationship.

Do not silently destroy financial history.

============================================================
30. REVERSAL BASED ON ORIGINAL EFFECTS
============================================================

Never calculate reversal from guessed/current values.

Retrieve actual committed effects from the original transaction.

Example:

Original:

Inventory OUT 5
Cash IN 2,000
Bank IN 3,000
Receivable +1,000

Reverse:

Inventory IN 5
Cash OUT 2,000
Bank OUT 3,000
Receivable -1,000

Exact opposite.

============================================================
31. PREVENT DOUBLE REVERSAL
============================================================

A transaction cannot be reversed twice.

If already reversed:

REJECT

No duplicate:

- inventory reversal
- wallet reversal
- ledger reversal

must be created.

============================================================
32. EDIT BILL
============================================================

Bill edit is NOT simple row overwrite.

Compare:

ORIGINAL COMMITTED STATE
vs
NEW STATE

Calculate exact delta for:

- Inventory
- Cash
- Bank
- Card
- Online Wallet
- Customer Receivable
- Supplier Payable
- Discount
- Other effects

Example:

Original Qty = 2
New Qty = 1

Required:

Inventory IN 1

Original Cash IN = 5,000
New Cash IN = 3,000

Required:

Cash OUT 2,000

Original Cash IN = 5,000
New Bank IN = 5,000

Required:

Cash OUT 5,000
Bank IN 5,000

Never simply overwrite the old ledger.

============================================================
33. RETURN
============================================================

Normal return:

Inventory IN

Return + refund:

Inventory IN
Wallet OUT

Return without refund:

Inventory IN
Wallet NO MOVEMENT

Refund without physical return:

Inventory NO MOVEMENT
Wallet OUT

============================================================
34. RETURN REVERSAL
============================================================

If original return:

Inventory IN 1
Cash OUT 2,000

Reverse return:

Inventory OUT 1
Cash IN 2,000

Exact opposite.

============================================================
35. RESTOCK
============================================================

Original restock:

Inventory IN

If payment exists:

actual wallet/payment effect

Reverse restock:

Inventory OUT
+
exact opposite financial effect if applicable

All linked.

============================================================
36. EXPENSE
============================================================

Original:

Cash OUT 5,000

Reverse:

Cash IN 5,000

Do not delete financial history without reversal.

============================================================
37. CUSTOMER PAYMENT
============================================================

Original:

Wallet IN 5,000
Customer Receivable DECREASE 5,000

Reverse:

Wallet OUT 5,000
Customer Receivable INCREASE 5,000

Both effects must reverse.

============================================================
38. SUPPLIER PAYMENT
============================================================

Original:

Wallet OUT 10,000
Supplier Payable DECREASE 10,000

Reverse:

Wallet IN 10,000
Supplier Payable INCREASE 10,000

Both effects must reverse.

============================================================
39. WALLET TRANSFER
============================================================

Example:

Cash OUT 10,000
Bank IN 10,000

Both must commit atomically.

Reverse:

Cash IN 10,000
Bank OUT 10,000

If one side fails:

ROLLBACK BOTH

============================================================
40. INVENTORY ADJUSTMENT
============================================================

Inventory Plus:

Inventory IN

Inventory Minus:

Inventory OUT

Every adjustment requires:

- authorization
- reason
- actor
- timestamp
- reference/request ID
- audit

Reverse:

Exact opposite movement.

============================================================
41. NO ORPHAN LEDGER RECORDS
============================================================

Every Inventory IN/OUT must reference a valid committed source transaction.

Every Wallet IN/OUT must reference a valid committed source transaction.

Every reversal must reference original transaction.

Every effect must have:

- transaction_id
- source_type
- source_id/reference
- actor/user
- timestamp
- request context

No orphan record.

============================================================
42. ERROR HANDLING
============================================================

If an error happens anywhere:

NO partial business effect.

Example:

Sale inserted
Inventory inserted
Wallet insertion fails

Result:

Sale = rollback
Inventory = rollback
Wallet = no record

Example:

Return created
Inventory IN created
Refund Wallet OUT fails

Result:

Return = rollback
Inventory IN = rollback
Wallet OUT = no record

User may see an error.

Database must remain clean.

============================================================
43. RETRY / DUPLICATE PROTECTION
============================================================

Protect against:

- double click
- duplicate request
- network retry
- timeout retry
- two devices
- repeated API call

Use idempotency/request identifiers where appropriate.

Same request must NOT create duplicate:

- Sale
- Inventory IN/OUT
- Wallet IN/OUT
- Refund
- Return
- Payment
- Reversal

============================================================
44. CONCURRENCY
============================================================

Protect inventory and wallet from race conditions.

Two simultaneous operations must not corrupt:

- stock
- wallet balance
- transaction state

Use proper database transaction/locking/constraints according to existing architecture.

Never solve race conditions only in frontend.

============================================================
45. TRANSACTION GRAPH
============================================================

Every business action must form a complete linked transaction graph:

MAIN TRANSACTION
+
INVENTORY EFFECTS
+
WALLET EFFECTS
+
CUSTOMER/SUPPLIER EFFECTS
+
AUDIT
+
APPROVAL if applicable
+
REVERSAL relationship if reversed

System must be able to answer:

"Exactly which Inventory/Wallet/Ledger records were created by this transaction?"

and:

"Exactly which original effects were reversed?"

============================================================
46. APPROVAL WORKFLOW
============================================================

Approval record should contain:

- approval_id
- source_transaction_id
- source_type
- requested_by
- requested_role
- approved_by
- status
- reason
- created_at
- approved_at/rejected_at

Statuses:

PENDING
APPROVED
REJECTED
CANCELLED

PENDING must create ZERO actual business effects.

APPROVED executes atomic action.

REJECTED creates ZERO business effect.

============================================================
47. PERMISSION CHECK ORDER
============================================================

Sensitive action flow:

AUTHENTICATE
↓
VERIFY ACTIVE USER
↓
RESOLVE REAL ROLE
↓
CHECK PERMISSION
↓
CHECK APPROVAL REQUIREMENT
↓
VALIDATE BUSINESS DATA
↓
START ATOMIC TRANSACTION
↓
CREATE MAIN TRANSACTION
↓
CREATE ALL EFFECTS
↓
VALIDATE FINAL STATE
↓
AUDIT
↓
COMMIT

Never create Inventory/Wallet effect before authorization and transaction validation.

============================================================
48. DATABASE SCHEMA AUDIT
============================================================

Audit schema for:

- duplicate role systems
- duplicate permission systems
- legacy TEXT[] permissions
- duplicate authorization columns
- unused roles
- dead permission records
- old action-token logic
- old server guard logic
- orphan ledger rows
- missing transaction references
- missing reversal references
- missing approval references

Do NOT blindly delete schema.

Process:

IDENTIFY
↓
VERIFY USAGE
↓
MIGRATE
↓
TEST
↓
REMOVE LEGACY
↓
MIGRATION VERIFY

Final database must have ONE authoritative RBAC system.

============================================================
49. CODE AUDIT
============================================================

Search entire codebase for:

- isAdmin
- role checks
- permission checks
- admin bypasses
- hardcoded true
- hardcoded role
- legacy permissions
- action token verification
- stock adjustment
- wallet adjustment
- sale delete
- sale reverse
- refund
- return
- expense
- supplier payment
- user management
- settings

Do not only inspect obvious files.

Search all:

- components
- hooks
- services
- utilities
- RPC wrappers
- API routes
- Edge Functions
- server actions
- DB migrations
- SQL functions
- policies
- types

============================================================
50. DO NOT CREATE SECOND AUTH SYSTEM
============================================================

If current permission infrastructure already exists and is valid:

USE IT.

Improve/fix it.

Do not create an unrelated second RBAC architecture.

Goal:

ONE SOURCE OF TRUTH.

============================================================
51. DATA MIGRATION
============================================================

If existing permissions/roles need migration:

- preserve legitimate existing users
- preserve admin
- preserve business data
- preserve sales
- preserve inventory history
- preserve wallet history
- preserve audit history

Do not reset production data.

Do not delete transaction history merely to implement RBAC.

============================================================
52. HARD DELETE POLICY
============================================================

Financial/business transactions should generally NOT be physically deleted.

Use:

- reverse
- void
- cancel
- archive
- soft-delete where appropriate

while preserving audit/history.

Products may be archived rather than hard-deleted if referenced by historical transactions.

Historical transactions must remain traceable.

============================================================
53. BALANCE INTEGRITY
============================================================

Inventory:

Opening
+
valid IN
-
valid OUT
=
Current Inventory

Wallet:

Opening
+
valid IN
-
valid OUT
=
Current Wallet

Customer:

Opening Receivable
+
Credit
-
Payments
-
valid adjustments
=
Current Receivable

Supplier:

Opening Payable
+
Purchases
-
Payments
-
valid adjustments
=
Current Payable

Do not hide discrepancies using fake clamps such as:

Math.max(0, balance)

unless explicitly required by an actual business rule.

Real discrepancy must be detectable.

============================================================
54. AUTOMATIC DATA INTEGRITY CHECKS
============================================================

Implement/check:

1. Every inventory row has valid source transaction.
2. Every wallet row has valid source transaction.
3. Every reversal has original transaction.
4. Every original transaction can identify its effects.
5. Reversal cannot happen twice.
6. Failed transaction leaves zero effects.
7. Successful transaction has all mandatory effects.
8. Inventory-derived balance matches actual inventory.
9. Wallet-derived balance matches actual wallet.
10. Customer ledger matches receivable.
11. Supplier ledger matches payable.
12. No orphan effects.
13. No duplicate effects.
14. No unauthorized effects.

============================================================
55. PERMISSION BEFORE EFFECT
============================================================

This is NON-NEGOTIABLE.

Example:

Cashier attempts stock adjustment.

Correct:

Permission check
→ DENIED
→ ZERO inventory movement

Wrong:

Inventory OUT
→ permission error

Example:

Cashier attempts wallet adjustment.

Correct:

Permission check
→ DENIED
→ ZERO wallet movement

No unauthorized request may create a ledger record.

============================================================
56. UI ROUTES / NAVIGATION
============================================================

Route guards must match centralized permissions.

Navigation must be filtered according to role/permission.

Check:

- desktop nav
- mobile nav
- bottom nav
- nested routes
- direct URL access
- modals
- action menus

A user must not gain access by manually typing a protected URL.

Route guard alone is still not enough; server/database must enforce.

============================================================
57. DIRECT ACCESS TEST
============================================================

Test unauthorized users by direct:

- route
- API
- RPC
- server action
- browser request
- manually crafted payload

Expected:

DENIED

No business data mutation.

============================================================
58. ROLE TESTING
============================================================

ADMIN:

Every authorized operation succeeds.

MANAGER:

Allowed operations succeed.

Restricted operations:
DENIED or APPROVAL.

CASHIER:

POS operations succeed.

Restricted operations:
DENIED.

Test every permission against every role.

============================================================
59. REQUIRED PRODUCTION TESTS
============================================================

Test:

- normal sale
- cash sale
- bank sale
- card sale
- split sale
- credit sale
- partial credit sale
- sale edit quantity
- sale edit amount
- sale edit payment
- sale payment-wallet change
- sale reverse
- sale reverse after split payment
- return
- return with refund
- return without refund
- refund without return
- return reversal
- restock
- restock reversal
- inventory plus
- inventory minus
- inventory adjustment reversal
- expense
- expense reversal
- customer payment
- customer payment reversal
- supplier payment
- supplier payment reversal
- wallet transfer
- wallet transfer reversal
- failed transaction
- timeout
- retry
- double click
- duplicate request
- concurrent operations
- unauthorized RPC
- unauthorized API
- unauthorized direct URL
- manager approval
- manager rejection
- cashier restricted actions
- permission changes
- role changes

============================================================
60. CRITICAL FAILURE CASES THAT MUST NEVER HAPPEN
============================================================

NEVER:

Sale fails but Inventory OUT exists.

Sale fails but Wallet IN exists.

Return fails but Inventory IN exists.

Refund fails but Wallet OUT exists.

Sale reverse happens but Inventory remains OUT.

Sale reverse happens but Cash remains IN.

Split payment reverse misses one wallet.

Bill edit changes sale but does not update inventory.

Bill edit changes payment but old wallet effect remains.

Return deletion removes return but leaves refund.

Expense deletion removes expense but leaves Wallet OUT.

Customer payment reverse changes wallet but not receivable.

Supplier payment reverse changes wallet but not payable.

Unauthorized user creates inventory movement.

Unauthorized user creates wallet movement.

Unauthorized user creates ledger entry.

Approval pending creates actual financial effect.

Failed authorization creates any business record.

Duplicate request creates duplicate movement.

============================================================
61. FINAL ROLE RULES
============================================================

ADMIN:

FULL CONTROL.

MANAGER:

DAILY BUSINESS OPERATIONS.

MANAGER CANNOT:

- manage users
- manage roles
- manage permissions
- change system/security settings
- manually adjust wallet
- export sensitive database/business data
- modify audit history
- bypass configured approvals

CASHIER:

POS / CUSTOMER / NORMAL PAYMENT OPERATIONS.

CASHIER CANNOT:

- control inventory
- control wallets
- manage suppliers
- manage expenses
- reverse/delete sales
- manage users
- manage permissions
- manage settings
- access sensitive financial reports

============================================================
62. FINAL GOLDEN RBAC RULE
============================================================

ADMIN = CONTROL

MANAGER = OPERATE

CASHIER = SELL

============================================================
63. FINAL GOLDEN TRANSACTION RULE
============================================================

NO REAL BUSINESS ACTION
=
NO REAL IN/OUT

REAL SUCCESSFUL ACTION
=
ALL REQUIRED EFFECTS

EDIT
=
EXACT DELTA

REVERSE
=
EXACT OPPOSITE OF ORIGINAL EFFECTS

ERROR
=
ZERO COMMITTED EFFECTS

APPROVAL PENDING
=
ZERO BUSINESS EFFECTS

APPROVAL APPROVED
=
ATOMIC BUSINESS EFFECTS

============================================================
64. FINAL SECURITY RULE
============================================================

UI HIDE
=
UX ONLY

SERVER CHECK
=
SECURITY

DATABASE/RPC CHECK
=
FINAL AUTHORITY

Never trust frontend role or permission values.

============================================================
65. FINAL IMPLEMENTATION REQUIREMENT
============================================================

Implement this permanently in:

- code
- database
- schema
- SQL/RPC
- server
- Edge Functions
- API
- frontend
- routes
- navigation
- hooks
- actions
- modals
- permission definitions
- approval system
- transaction system
- audit system

Do not merely change labels or hide buttons.

Do not only fix the currently reported files.

Search the COMPLETE codebase and database for all affected paths.

Do not leave:

- hardcoded admin bypass
- fail-open authorization
- unguarded stock adjustment
- unguarded wallet adjustment
- legacy permission authority
- dead role guards
- unauthorized RPC
- unauthorized API
- orphan ledger records
- partial transaction effects
- missing reversals
- missing approval enforcement

============================================================
66. FINAL ACCEPTANCE CRITERIA
============================================================

The implementation is COMPLETE only if ALL are true:

[ ] Admin has full intended access.

[ ] Manager has operational access only.

[ ] Cashier has POS-level access only.

[ ] User creation is Admin-only.

[ ] User management is Admin-only.

[ ] Roles are Admin-only.

[ ] Permissions are Admin-only.

[ ] System settings are Admin-only.

[ ] Database/data export is Admin-only.

[ ] Manual wallet adjustment is Admin-only.

[ ] Stock adjustment is protected.

[ ] Cashier cannot adjust inventory.

[ ] Cashier cannot adjust wallet.

[ ] Cashier cannot reverse/delete sales.

[ ] Manager high-risk actions use approval where configured.

[ ] High-value refunds use approval where configured.

[ ] Supplier payment approval works where configured.

[ ] Wallet transfer approval works where configured.

[ ] Frontend bypasses removed.

[ ] Hardcoded isAdmin bypasses removed.

[ ] Legacy permission authority removed.

[ ] Fail-open authorization removed.

[ ] Action token verification fails closed.

[ ] Every sensitive RPC is protected.

[ ] Every sensitive API/server action is protected.

[ ] Direct unauthorized calls are rejected.

[ ] Unauthorized actions create ZERO business effects.

[ ] Every successful sale has correct Inventory/Wallet effects.

[ ] Every return has correct Inventory/Wallet effects.

[ ] Every refund has correct Wallet effect.

[ ] Every edit creates exact delta.

[ ] Every reversal creates exact opposite effects.

[ ] Every approval is enforced server-side.

[ ] Pending approval creates no financial/inventory effect.

[ ] Failed transactions leave zero partial effects.

[ ] Duplicate requests do not duplicate effects.

[ ] Concurrent transactions cannot corrupt balances.

[ ] No orphan inventory ledger records.

[ ] No orphan wallet ledger records.

[ ] No missing reversal records.

[ ] No duplicate reversal.

[ ] Customer ledger remains accurate.

[ ] Supplier ledger remains accurate.

[ ] Inventory balance remains accurate.

[ ] Wallet balance remains accurate.

[ ] Audit logs capture sensitive actions.

[ ] Audit logs cannot be modified normally.

[ ] Existing legitimate functionality remains working.

[ ] Typecheck passes.

[ ] Lint passes.

[ ] Build passes.

[ ] Database migrations pass.

[ ] RPC tests pass.

[ ] Role × permission tests pass.

[ ] Production security tests pass.

============================================================
FINAL NON-NEGOTIABLE STATEMENT
============================================================

DO NOT CONSIDER THIS TASK COMPLETE JUST BECAUSE THE UI LOOKS CORRECT.

The final system must remain secure even if a user:

- bypasses the UI
- manually calls an API
- directly calls an RPC
- changes request payload
- sends role="admin"
- sends isAdmin=true
- modifies frontend JavaScript
- directly opens a protected URL
- repeats the request
- double-clicks
- retries after timeout

The server/database must still enforce the correct permissions.

AND:

NO unauthorized action may create:

- Inventory IN
- Inventory OUT
- Wallet IN
- Wallet OUT
- Customer Ledger movement
- Supplier Ledger movement
- Financial movement
- Partial business transaction

Every legitimate business action must create its complete linked effects atomically.

EVERY EFFECT MUST HAVE A REAL SOURCE.

EVERY REVERSAL MUST REVERSE THE ACTUAL ORIGINAL EFFECTS.

EVERY HIGH-RISK ACTION MUST REQUIRE THE CORRECT AUTHORIZATION/APPROVAL.

EVERY UNKNOWN/INVALID AUTHORIZATION MUST FAIL CLOSED.

ONE RBAC.
ONE SOURCE OF TRUTH.
NO BYPASSES.
NO ORPHAN EFFECTS.
NO PARTIAL TRANSACTIONS.
NO FAKE IN/OUT RECORDS.
NO MISSING REVERSALS.
NO UNAUTHORIZED FINANCIAL OR INVENTORY MOVEMENT.

ADMIN CONTROLS.
MANAGER OPERATES.
CASHIER SELLS.

============================================================
67. CLOUD COLUMN COMPLETENESS — IDENTICAL DATA ON ALL DEVICES
============================================================

Supabase cloud is the ONLY source of truth. Every column of every business
table MUST live in the cloud and be fully synced to every device.

MANDATORY:

- Every column defined in `SUPER_MASTER_SCHEMA.sql` MUST be stored in the cloud.
  No business column may be device-local-only.
- Every device, on every refresh, MUST receive the COMPLETE row — all columns,
  no truncation, no client-side column filtering.
- Mappers (`map*`, `toRemote*`) MUST account for every column. A column missing
  from a mapper is a bug (extends Hard Rule #5).
- A business column MUST NEVER be "hidden" from sync to save bandwidth or simplify UI.
- Two devices refreshing at the same moment MUST show byte-identical business data.
- If a column genuinely cannot be cloud-synced, it MUST be device-local ONLY and
  explicitly listed (e.g. `pos_local_prefs.*`) — never a business column.
- ALL COLUMNS IN = ALL COLUMNS OUT. No partial column sync.

This reinforces CLOUD DATA SYNC RULES (lines 13–92) and §54 integrity checks.
