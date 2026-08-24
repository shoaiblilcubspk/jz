# 360° UNIVERSAL IMPACT MAPPING — ZERO-MISSED-ROOT PROTOCOL

### ABSOLUTE PURPOSE

This is a production POS system.

A feature, bug fix, calculation change, workflow change, database change, payment change, inventory change, UI change, or business-rule change MUST NEVER be treated as an isolated file/page/component task.

The agent MUST discover the COMPLETE IMPACT of the requested change across the CURRENT EXISTING SYSTEM before implementation.

The objective is:

**ZERO MISSED EXISTING RELEVANT ROOTS**

while simultaneously maintaining:

**ZERO UNREQUESTED NEW SYSTEMS**

The agent must always follow:

**EXPLORE → DISCOVER → MAP → TRACE → IMPLEMENT ROOT → PROPAGATE → RE-SCAN → VERIFY → AUDIT → COMPLETE**

Never:

**READ ONE FILE → GUESS → PATCH → DECLARE DONE**

---

# 10.1 — THE GOLDEN RULE

The user's request describes the **desired capability**, NOT the complete technical implementation map.

The agent is responsible for discovering:

* where the feature originates
* where it is stored
* where it is processed
* where it is calculated
* where it is displayed
* where it is consumed
* where it is edited
* where it is reversed
* where it is refunded
* where it affects inventory
* where it affects payments
* where it affects sales
* where it affects orders
* where it affects customers
* where it affects reports
* where it affects history
* where it affects dashboards
* where it affects permissions
* where it affects settings
* where it affects synchronization
* where it affects exports
* where it affects audit
* where it affects existing workflows

The user MUST NOT need to provide this dependency list manually.

---

# 10.2 — EXISTING SYSTEM ONLY

This protocol is an **impact-discovery protocol**, NOT a permission to invent product functionality.

For every discovered area:

### EXISTING + RELEVANT

→ MUST inspect and update if affected.

### EXISTING + NOT RELEVANT

→ inspect enough to confirm it is unrelated, then leave it unchanged.

### NON-EXISTING + REQUIRED FOR THE REQUEST

→ create the smallest technically necessary structure.

### NON-EXISTING + NOT REQUIRED

→ DO NOT CREATE.

Never create an imaginary module simply because another POS normally has it.

Examples:

If the project has no:

* accounting module
* supplier settlement module
* loyalty system
* warehouse management module
* CRM
* notification center

do NOT create those systems just because a new payment/inventory feature could theoretically interact with them.

---

# 10.3 — MANDATORY PRE-IMPLEMENTATION DISCOVERY

Before changing ANY code, perform repository-wide discovery.

Do NOT start implementation after finding the first relevant file.

You MUST investigate the complete current repository.

Search:

* pages
* routes
* screens
* components
* shared components
* modules
* submodules
* tabs
* modals
* drawers
* forms
* action menus
* services
* APIs
* hooks
* stores
* contexts
* utilities
* calculations
* models
* types
* enums
* constants
* database schema
* migrations
* RPCs
* triggers
* queries
* reports
* dashboards
* histories
* audit logs
* settings
* permissions
* integrations
* sync logic
* exports
* imports
* tests

---

# 10.4 — SEARCH THE WHOLE REPOSITORY, NOT THE OBVIOUS FILES

NEVER limit exploration to:

* current file
* current page
* screenshot
* file named by the user
* currently open component
* first grep result
* first matching function
* first matching API
* current folder

The visible bug location is NOT necessarily the root cause.

The requested UI location is NOT necessarily the complete feature location.

---

# 10.5 — SEARCH BY EXACT NAME + CONCEPT + DATA

For every task, perform multiple search dimensions.

### Search Layer 1 — Exact

Search the exact feature/bug terminology.

### Search Layer 2 — Aliases

Search alternative names and abbreviations.

### Search Layer 3 — Business Concepts

Search the underlying business concept.

### Search Layer 4 — Data

Search:

* database field
* table
* column
* type
* enum
* API field
* RPC
* query
* state variable

### Search Layer 5 — Behavior

Search:

* calculation
* mutation
* create
* update
* delete
* refund
* return
* reversal
* adjustment
* sync
* report

### Search Layer 6 — UI

Search:

* labels
* buttons
* tabs
* filters
* modals
* pages

Example:

For:

**Portal Payment**

do not search only:

`portalPayment`

Also search relevant concepts such as:

`payment`
`paymentMethod`
`transaction`
`checkout`
`POS`
`sale`
`order`
`wallet`
`cash`
`bank`
`refund`
`return`
`reversal`
`receiving`
`settlement`
`ledger`
`history`
`report`

Adapt search terms to the actual architecture.

---

# 10.6 — "FIND MORE OF THIS" RECURSIVE DISCOVERY

Finding one implementation is NEVER considered sufficient.

Every time you discover a relevant:

* page
* component
* function
* service
* API
* query
* calculation
* store
* database table
* report

you MUST ask:

> "Where else is this same business concept used, calculated, displayed, stored, transformed, or consumed?"

Then search again.

Repeat recursively until additional searches stop revealing relevant existing implementations.

This means:

**FOUND ROOT → SEARCH ITS CONSUMERS → SEARCH THEIR CONSUMERS → SEARCH RELATED ROOTS**

Do NOT stop at the first generation of dependencies.

---

# 10.7 — BUILD AN INTERNAL IMPACT MAP BEFORE CODING

Before implementation, create an internal **Feature/Bug Impact Map**.

The map MUST contain every discovered EXISTING relevant root.

Minimum structure:

### ROOT

What is the original source of truth?

### PRODUCERS

Where is the data/action created?

### PROCESSORS

Where is it calculated/transformed?

### STORAGE

Where is it persisted?

### CONSUMERS

Where is it read?

### UI

Where is it shown or edited?

### SIDE EFFECTS

What else changes because of it?

### REPORTING

Which existing reports consume it?

### HISTORY

Which existing histories consume it?

### POS

Which existing POS workflows consume it?

### INVENTORY

Which existing inventory workflows consume it?

### PAYMENTS

Which existing payment workflows consume it?

### SYNC

Which existing synchronization flows consume it?

### PERMISSIONS

Which existing roles/actions are affected?

### TESTS

Which existing tests cover it?

The agent MUST keep track of discovered roots throughout implementation.

---

# 10.8 — IMPACT MAP IS A LIVING MAP

The Impact Map is NOT a one-time search.

If implementation reveals a new dependency:

**ADD IT TO THE IMPACT MAP → INSPECT IT → TRACE ITS CONSUMERS → UPDATE IF REQUIRED**

Never ignore newly discovered dependencies because implementation already started.

---

# 10.9 — TRACE THE COMPLETE DATA LIFECYCLE

For every affected concept, trace:

**SOURCE**
→ **INPUT**
→ **STATE**
→ **VALIDATION**
→ **API**
→ **BACKEND**
→ **DATABASE**
→ **BUSINESS LOGIC**
→ **CALCULATION**
→ **TRANSACTION**
→ **SIDE EFFECTS**
→ **HISTORY**
→ **REPORTING**
→ **DASHBOARD**
→ **UI**
→ **SYNC**
→ **AUDIT**

Only applicable existing stages need modification.

But every relevant stage MUST be inspected.

---

# 10.10 — TRACE UPSTREAM

For every affected component ask:

> "Where does this data/action originate?"

Inspect:

* settings
* user input
* POS input
* checkout
* API
* database
* RPC
* shared service
* shared state
* external integration

Do not fix a downstream symptom without understanding upstream origin.

---

# 10.11 — TRACE DOWNSTREAM

For every affected component ask:

> "Who consumes this result?"

Search:

* other components
* pages
* stores
* services
* APIs
* reports
* dashboards
* histories
* inventory
* payments
* orders
* exports
* sync
* audit

A feature is incomplete if downstream consumers still use old behavior.

---

# 10.12 — TRACE SIDE EFFECTS

Every business action can have side effects.

For every change inspect whether it affects:

* stock
* payment
* cash
* wallet
* bank
* customer balance
* supplier balance
* order status
* sale status
* revenue
* discount
* tax
* quantity
* history
* reports
* dashboard
* audit
* sync

Only modify applicable existing systems.

---

# 10.13 — POS MASTER AUDIT

For ANY feature involving:

* sale
* order
* payment
* product
* inventory
* customer
* transaction
* return
* refund
* checkout

POS MUST be treated as a complete ecosystem.

Inspect ALL EXISTING POS roots.

### POS ENTRY

* product search
* barcode
* scanning
* product selection
* variant
* modifier
* quantity
* price
* discount
* tax
* customer
* salesman
* cashier

### POS CART

* add
* remove
* quantity change
* price change
* discount
* customer assignment
* hold
* resume

### POS CHECKOUT

* payment selection
* payment amount
* payment validation
* split payment if existing
* change
* completion
* receipt
* order creation

### POS SALE

* create
* edit
* cancel
* delete
* void
* reverse
* duplicate prevention

### POS RETURNS

* return
* partial return
* refund
* partial refund
* exchange if existing
* reversal

### POS HISTORY

* sales history
* transaction history
* payment history
* return history
* refund history
* edit history
* cancellation history

### POS REPORTING

Inspect every EXISTING relevant:

* sales report
* payment report
* cashier report
* daily report
* closing report
* refund report
* return report
* discount report
* inventory report
* dashboard

### POS SETTINGS

Inspect existing:

* payment settings
* receipt settings
* POS settings
* permissions
* cashier settings
* discount settings
* tax settings
* order settings

Do NOT create any missing POS subsystem merely because it would be useful.

---

# 10.14 — PAYMENT MASTER AUDIT

For any payment-related change, inspect:

**Payment Settings**
→ **Payment Selection**
→ **POS**
→ **Checkout**
→ **Sale**
→ **Order**
→ **Transaction**
→ **Database**
→ **Payment History**
→ **Receiving** IF EXISTING
→ **Settlement** IF EXISTING
→ **Ledger** IF EXISTING
→ **Refund**
→ **Partial Refund**
→ **Reversal**
→ **Reports**
→ **Dashboard**
→ **Audit**
→ **Sync**
→ **Exports**

Every EXISTING applicable root must be checked.

---

# 10.15 — INVENTORY MASTER AUDIT

For inventory-related changes inspect:

**Product**
→ **Stock**
→ **Receiving**
→ **Stock In**
→ **Sale**
→ **Stock Out**
→ **Return**
→ **Refund**
→ **Adjustment**
→ **Transfer IF EXISTING**
→ **Stock History**
→ **Inventory Reports**
→ **Dashboard**
→ **Barcode**
→ **Online Sync IF EXISTING**

Verify the same transaction cannot produce contradictory stock values.

---

# 10.16 — RECEIVING MASTER AUDIT

If Receiving exists and the feature can affect it:

Inspect:

* receiving page
* receiving creation
* receiving edit
* receiving history
* receiving totals
* stock-in
* payment
* supplier information IF EXISTING
* receiving reports
* inventory effect
* reversal/cancellation
* audit

Do NOT create Receiving if it does not exist.

---

# 10.17 — REPORT MASTER AUDIT

Whenever business data changes:

Search every EXISTING consumer of that data in reporting.

Inspect:

* reports
* dashboard cards
* charts
* summaries
* totals
* subtotals
* filters
* date filters
* payment breakdown
* inventory breakdown
* sales breakdown
* refund calculations
* exports

Never assume:

> "The transaction is correct, therefore the report is correct."

Reports are separate consumers and MUST be verified.

---

# 10.18 — HISTORY/AUDIT MASTER AUDIT

If history exists:

Find every applicable existing history root.

Check:

* create
* edit
* delete
* refund
* return
* reversal
* payment change
* inventory change
* status change

Do not create duplicate history infrastructure.

---

# 10.19 — SETTINGS MASTER AUDIT

If a feature is configurable:

Search existing:

* global settings
* POS settings
* payment settings
* order settings
* inventory settings
* user settings

If configuration already exists, extend the existing configuration system.

Do not create a second settings architecture.

---

# 10.20 — PERMISSION MASTER AUDIT

If the feature introduces an action, inspect existing:

* roles
* permissions
* role guards
* action permissions
* UI visibility rules
* backend authorization

Determine who can:

* view
* create
* edit
* delete
* refund
* reverse
* approve
* configure

Use the existing permission architecture.

---

# 10.21 — SYNC MASTER AUDIT

If sync/offline functionality EXISTS:

inspect:

* create
* update
* delete
* refund
* reversal
* retry
* duplicate prevention
* conflict handling
* reconciliation

If the current architecture is cloud-direct and has NO offline transaction system, do NOT invent one.

---

# 10.22 — DATABASE ROOT AUDIT

If data changes, inspect:

* schema
* table
* columns
* foreign keys
* indexes
* constraints
* triggers
* RPCs
* migrations
* queries
* views
* reports
* history tables

Determine the authoritative source of truth.

Never create a second source of truth for data already owned by an existing root.

---

# 10.23 — SHARED ROOT RULE

If multiple pages use the same:

* service
* hook
* utility
* store
* API
* RPC
* query
* calculation

identify the shared root.

Prefer fixing the correct shared root rather than patching individual consumers.

BUT after modifying a shared root:

**FIND EVERY CONSUMER → VERIFY EVERY CONSUMER**

A shared-root change is NOT complete until all consumers have been checked.

---

# 10.24 — DUPLICATE LOGIC AUDIT

Search for duplicated business logic.

Example:

If today's wallet/payment calculation appears in:

* FinancialReport
* WalletStrip
* SalesTabManager

do NOT assume all are synchronized.

Compare them.

Determine the correct source of truth.

If the architecture allows it, consolidate duplicated calculations into the appropriate existing shared root.

Never leave known conflicting calculations.

---

# 10.25 — DATABASE / API / UI CONSISTENCY

A feature is incomplete if:

### UI works

but API does not.

### API works

but database does not correctly persist it.

### Database works

but history does not record it.

### Transaction works

but reports ignore it.

### POS works

but checkout does not.

### Checkout works

but refund breaks.

### Sale works

but inventory is wrong.

### Inventory works

but history is wrong.

### Cloud works

but existing sync logic breaks.

All layers MUST remain consistent.

---

# 10.26 — BACKWARD COMPATIBILITY AUDIT

When changing existing behavior, inspect existing records.

Check:

* old records
* old statuses
* old enum values
* old transactions
* old reports
* old database rows
* existing historical data

Do not assume only newly created data matters.

---

# 10.27 — EDGE-CASE IMPACT AUDIT

For every affected transaction, inspect applicable:

* zero value
* partial value
* duplicate action
* retry
* cancellation
* edit
* deletion
* reversal
* refund
* partial refund
* invalid input
* failed API
* failed DB operation
* permission denial
* stale state
* repeated click
* concurrent action

Do not invent unsupported workflows, but verify existing applicable ones.

---

# 10.28 — NO PARALLEL ARCHITECTURE

Never create a second:

* payment system
* inventory calculation
* history system
* permission system
* report engine
* state system
* service layer
* sync system

when an existing authoritative implementation already exists.

Extend the existing architecture.

---

# 10.29 — NO "FIRST RESULT" STOPPING

The following are NOT acceptable evidence of complete discovery:

* "I found the component."
* "I found the page."
* "I found the API."
* "I found the database field."
* "I found the report."
* "The screenshot location is fixed."
* "The main flow works."

Finding one root does not prove all roots were found.

---

# 10.30 — NO USER MICRO-MANAGEMENT

The user should NEVER have to say:

> "Also add it to checkout."

> "Also add it to receiving."

> "Also add it to history."

> "Also add it to reports."

> "Also add it to refunds."

> "Also add it to POS."

> "Also add it to dashboard."

> "Also add it to settings."

The agent MUST discover all EXISTING relevant roots itself.

---

# 10.31 — DO NOT OVER-IMPLEMENT

The opposite failure is also forbidden.

Do NOT create unrelated functionality simply because it could theoretically be connected.

Use:

**EXISTING + RELEVANT → UPDATE**

**EXISTING + UNRELATED → LEAVE**

**NON-EXISTING + REQUIRED → MINIMUM NEW STRUCTURE**

**NON-EXISTING + NOT REQUIRED → DO NOT CREATE**

---

# 10.32 — PRE-CODING STOP GATE

Before writing implementation code, the agent MUST have enough understanding to answer internally:

1. What is the source of truth?
2. Where is this data created?
3. Where is it stored?
4. Where is it calculated?
5. Where is it transformed?
6. Where is it displayed?
7. Where is it edited?
8. Where is it reversed/refunded?
9. What existing POS flows consume it?
10. What existing inventory flows consume it?
11. What existing payment flows consume it?
12. What existing history consumes it?
13. What existing reports consume it?
14. What existing dashboards consume it?
15. What existing permissions affect it?
16. What existing settings affect it?
17. What existing APIs/services consume it?
18. What existing sync consumes it?
19. Are there duplicate implementations?
20. Are there existing consumers that could be missed?

If these cannot be answered from repository exploration, continue exploring before coding.

---

# 10.33 — POST-CODING SECOND DISCOVERY

After implementation, perform another repository-wide search.

Search:

* feature name
* aliases
* business concepts
* old calculations
* old states
* old enums
* old hardcoded values
* related APIs
* related components
* related reports
* related histories

Compare the results against the original Impact Map.

Every discovered relevant root MUST be accounted for.

---

# 10.34 — "WHAT DID I MISS?" FINAL SEARCH

Before completion, perform a deliberate final search:

> "Where else could this existing business concept appear in this application?"

Search again.

Then:

> "What existing page/component/service/report/history could still be using the old behavior?"

Search again.

Then:

> "Did I accidentally create a duplicate implementation?"

Search again.

Then:

> "Did I accidentally create a new system that did not exist or was not required?"

Verify.

---

# 10.35 — CHANGE-SCOPE AUDIT

Before completion, compare:

### REQUESTED

What did the user actually ask?

### REQUIRED

What existing areas were technically required to satisfy it?

### CHANGED

What files/modules were actually modified?

Every changed area must be explainable as:

**Requested OR Required Dependency**

If a changed area is neither, revert/avoid the unnecessary change.

---

# 10.36 — COMPLETION MATRIX

Before declaring COMPLETE, verify every applicable category:

* [ ] Repository-wide discovery
* [ ] Exact keyword search
* [ ] Concept search
* [ ] Data/schema search
* [ ] API search
* [ ] UI search
* [ ] Recursive dependency discovery
* [ ] Impact Map created
* [ ] Source of truth identified
* [ ] Upstream traced
* [ ] Downstream traced
* [ ] Shared roots checked
* [ ] Duplicate logic checked
* [ ] Database checked
* [ ] RPC/trigger checked
* [ ] POS checked
* [ ] Checkout checked IF EXISTING
* [ ] Sales checked
* [ ] Orders checked IF EXISTING
* [ ] Payments checked
* [ ] Receiving checked IF EXISTING
* [ ] Inventory checked
* [ ] Returns checked IF EXISTING
* [ ] Refunds checked IF EXISTING
* [ ] History checked IF EXISTING
* [ ] Audit checked IF EXISTING
* [ ] Reports checked IF EXISTING
* [ ] Dashboard checked IF EXISTING
* [ ] Settings checked IF EXISTING
* [ ] Permissions checked IF EXISTING
* [ ] Sync checked IF EXISTING
* [ ] Exports checked IF EXISTING
* [ ] Existing data checked
* [ ] Edge cases checked
* [ ] Post-implementation search completed
* [ ] New dependencies re-added to Impact Map
* [ ] No duplicate architecture created
* [ ] No unrelated systems invented
* [ ] No relevant existing root left unexplained

---

# 10.37 — ZERO-MISSED-ROOT PRINCIPLE

The agent MUST assume:

> "There may be another implementation somewhere."

until repository-wide exploration demonstrates otherwise.

Do not assume:

> "This is probably the only place."

Instead:

> "Search until all relevant existing roots are identified."

---

# 10.38 — ZERO-INVENTION PRINCIPLE

The agent MUST simultaneously assume:

> "A system that I cannot find may not exist."

Do not invent it.

Therefore:

**SEARCH TO DISCOVER.**

**DO NOT GUESS TO CREATE.**

---

# 10.39 — SUPPLIER LEDGER & WALLET STRICT IMPACT

When auditing or modifying the **Supplier Ledger (Khata)**, the agent MUST strictly differentiate between **Payments** and **Bills**:

### 1. PAYMENT ("PAID" / Settle Debt)
* **Creation**: MUST deduct from the Real Wallet (Cash/Bank) AND decrease Supplier Outstanding Debt AND book an Expense (Supplies category).
* **Deletion**: MUST reverse the flow. MUST return cash back to the Real Wallet (Plus) AND restore Supplier Outstanding Debt AND cascade-delete the linked Expense.

### 2. BILL ("BILL" / Manual Bill / Udhaar)
* **Creation**: MUST NOT touch the Real Wallet. MUST ONLY increase the Supplier Outstanding Debt.
* **Deletion**: MUST NOT touch the Real Wallet. MUST ONLY decrease the Supplier Outstanding Debt.

The agent MUST NEVER assume that all ledger transactions affect the wallet. The transaction `type` dictates the exact systemic impact.

---

# 10.40 — CUSTOMER LEDGER & SALE REVERSAL STRICT IMPACT

When auditing or modifying the **Customer Ledger**, the agent MUST strictly adhere to the following accounting logic for **Sale Reversals (Deletions/Refunds)**:

### 1. SALE DELETION (Refund / Reversal)
* **Impact**: MUST Credit (Refund) the customer's ledger by the exact original sale amount to reverse the original Debit (Udhaar).
* **Negative Balance**: If the customer had already made partial or full payments (Credits) against that sale, reversing the sale WILL result in a Negative Balance (e.g., `-300`).
* **Meaning**: A negative balance in the Customer Ledger correctly indicates that the business now holds an **Advance / Refundable amount** belonging to the customer, because the customer paid for a sale that no longer exists.
* **Correction**: The agent MUST NEVER attempt to "fix" or block this negative balance, as it is mathematically and financially accurate.

---

# 10.41 — FINAL ABSOLUTE RULE

NEVER:

**VISIBLE BUG → PATCH VISIBLE FILE → DONE**

NEVER:

**REQUESTED PAGE → ADD FEATURE THERE → DONE**

NEVER:

**FIND ONE MATCH → ASSUME COMPLETE**

NEVER:

**IMAGINE MISSING MODULE → BUILD NEW SYSTEM**

ALWAYS:

**FULL REPOSITORY DISCOVERY**
→ **CONCEPT + DATA SEARCH**
→ **RECURSIVE "FIND MORE OF THIS"**
→ **IMPACT MAP**
→ **UPSTREAM + DOWNSTREAM TRACE**
→ **SHARED ROOT IDENTIFICATION**
→ **POS MASTER AUDIT**
→ **PAYMENT / INVENTORY / RECEIVING / REPORT / HISTORY / PERMISSION / SYNC AUDITS WHERE EXISTING**
→ **IMPLEMENT CORRECT ROOT**
→ **PROPAGATE TO ALL AFFECTED EXISTING CONSUMERS**
→ **POST-IMPLEMENTATION RE-SCAN**
→ **WHAT-DID-I-MISS SEARCH**
→ **CHANGE-SCOPE AUDIT**
→ **COMPLETION MATRIX**
→ **ONLY THEN COMPLETE**

## FINAL DEFINITION

**"ALL PLACES" means ALL EXISTING RELEVANT PLACES DISCOVERED THROUGH COMPLETE REPOSITORY + DEPENDENCY + DATA-FLOW ANALYSIS.**

It does NOT mean creating every theoretically possible page or module.

**Goal: ZERO MISSED EXISTING IMPACT + ZERO UNREQUESTED SYSTEM INVENTION.**
