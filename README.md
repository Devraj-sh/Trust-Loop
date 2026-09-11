# TrustLoop

## The Intelligent Trust Layer for E-Commerce Returns

> **ML predicts. Evidence explains. Humans verify.**

TrustLoop is an evidence-driven return decision platform for e-commerce. It evaluates a return using machine-learning risk prediction, deterministic return-policy checks, customer behaviour signals, and product-image evidence before producing a decision.

The central idea is simple:

> **A return decision should not depend on a single number.**

TrustLoop therefore treats the ML prediction as one signal. The system combines it with other evidence, identifies conflicts, and routes uncertain cases to human review.

---

## Why TrustLoop?

Traditional return systems often reduce a case to a single risk score. That can make the decision difficult to explain and can create problems when different pieces of evidence disagree.

TrustLoop creates a complete decision trail:

```text
Return Request
      |
      v
Customer + Order + Product + Return Details
      |
      v
41-Feature ML Risk Prediction
      |
      +------------------+------------------+------------------+
      |                  |                  |                  |
      v                  v                  v                  v
   Policy            Behaviour           Vision          ML Evidence
   Rules             Signals          Product Image       Contribution
      |                  |                  |                  |
      +------------------+------------------+------------------+
                                 |
                                 v
                         Evidence Fusion
                                 |
                  +--------------+--------------+
                  |              |              |
                  v              v              v
               Aligned        Conflict     Insufficient
                  |              |              |
                  |              +-------> Human Review
                  |                             |
                  +-----------------------------+
                                 |
                                 v
                          Decision Engine
                                 |
          +----------------------+----------------------+
          |                      |                      |
          v                      v                      v
    Auto-Approve          Refund on Inspection    Human Investigation
          |                      |                      |
          +----------------------+----------------------+
                                 |
                                 v
                            Audit Trail
```

---

## Core Decision Philosophy

TrustLoop follows this sequence:

```text
ML Prediction
      |
      v
Evidence Collection
      |
      v
Evidence Fusion
      |
      v
Decision Engine
      |
      +-------------------+
      |                   |
      v                   v
Clear Evidence       Uncertainty / Conflict
      |                   |
      v                   v
Automated Path       Human Verification
      |                   |
      +---------+---------+
                |
                v
          Auditable Outcome
```

The system is designed so that a model prediction is **not treated as ground truth**. Policy evaluation remains deterministic, visual analysis is treated as evidence, and conflicting or uncertain cases can be escalated to a human reviewer.

---

# System Architecture

The current application is a full-stack TypeScript application using TanStack Start, React, Supabase/PostgreSQL, and a server-side TrustLoop decision pipeline.

```mermaid
flowchart TB
    UI[TrustLoop Web App\nReact + TanStack Start]
    API[Server Functions / Application API]
    DB[(Supabase PostgreSQL)]
    STORAGE[(Supabase Storage\nReturn Evidence)]

    ML[ML Engine\n41 Features]
    XGB[XGBoost\n139 Gradient-Boosted Trees]
    LR[Logistic Regression\nLinear Baseline]
    DT[Decision Tree\nCART Baseline]

    POLICY[Policy Engine\nDeterministic Rules]
    BEHAV[Behaviour Analysis\nAccount History Signals]
    VISION[Vision Analysis\nProduct Image Evidence]
    FUSION[Evidence Fusion\nTrust Score + Agreement + Conflicts]
    DECIDE[Decision Engine\nExplicit Decision Rules]
    REVIEW[Human Review]
    AUDIT[Audit Events]

    UI --> API
    API --> DB
    API --> ML
    API --> POLICY
    API --> BEHAV
    API --> VISION
    API --> FUSION
    FUSION --> DECIDE
    DECIDE --> DB
    API --> AUDIT
    AUDIT --> DB
    VISION --> STORAGE
    REVIEW --> DB

    ML --> XGB
    ML --> LR
    ML --> DT
```

### Architecture in plain language

1. The user submits a return request.
2. TrustLoop loads the associated order, customer, and product-category context.
3. The feature pipeline creates the model input from the stored data.
4. The selected ML model produces a return-risk score, risk level, prediction, confidence, and feature contributions.
5. The policy engine evaluates deterministic return rules.
6. If an image is supplied, it is stored and passed to the vision-analysis stage.
7. Behaviour analysis calculates descriptive account-history signals.
8. Evidence Fusion combines ML, policy, behaviour, and vision evidence.
9. The Decision Engine applies explicit rules to determine the outcome.
10. Results from each stage are persisted in Supabase/PostgreSQL.
11. Important stages are written to the audit trail.
12. Cases requiring uncertainty resolution can be sent to human review.

---

# End-to-End Backend Workflow

The actual return-analysis workflow is implemented as a server-side pipeline.

```mermaid
sequenceDiagram
    participant U as User / Reviewer
    participant APP as TrustLoop App
    participant API as Server Function
    participant DB as Supabase PostgreSQL
    participant ML as ML Engine
    participant P as Policy Engine
    participant V as Vision Analysis
    participant B as Behaviour Analysis
    participant F as Evidence Fusion
    participant D as Decision Engine

    U->>APP: Submit return
    APP->>API: Return details + selected model + optional image

    API->>DB: Load order, customer, category
    DB-->>API: Context

    API->>DB: Create return request
    API->>ML: Build features + run selected model
    ML-->>API: Risk score + level + confidence + contributions

    API->>P: Evaluate policy rules
    P-->>API: Eligibility + rule results

    alt Image supplied
        API->>DB: Store image metadata
        API->>V: Analyse product image
        V-->>API: Condition + damage + claim match + findings
    else No image
        API->>API: Mark visual evidence unavailable
    end

    API->>B: Analyse account behaviour
    B-->>API: Behaviour score + signals

    API->>F: Combine ML + Policy + Behaviour + Vision
    F-->>API: Trust score + agreement + evidence + conflicts

    API->>D: Apply decision rules
    D-->>API: Decision + rationale + confidence

    API->>DB: Persist prediction, policy, behaviour,
    API->>DB: vision, fusion and decision results
    API->>DB: Persist audit events
    API-->>APP: Return reference + outcome
    APP-->>U: Explainable result
```

---

# 1. Return Intake

A return contains the context required to evaluate the claim:

- Order
- Customer
- Product category
- Return reason
- Claimed product condition
- Optional description
- Optional product image
- Selected ML model

Supported return reasons include:

- Arrived damaged
- Faulty / not working
- Wrong item sent
- Not as described
- Size or fit
- Arrived too late
- Changed my mind

Supported condition values include:

- Unopened
- Like new
- Used
- Damaged

---

# 2. Feature Engineering and ML Risk Prediction

TrustLoop constructs a **41-feature vector** from customer, order, and product-category information.

The ML layer currently supports three runnable models.

```mermaid
flowchart LR
    DATA[Customer + Order + Product Category]
    FEATURES[Feature Construction\n41 Features]
    DATA --> FEATURES

    FEATURES --> XGB[XGBoost]
    FEATURES --> LR[Logistic Regression]
    FEATURES --> DT[Decision Tree]

    XGB --> RESULT[ML Risk Result]
    LR --> RESULT
    DT --> RESULT

    RESULT --> SCORE[Risk Score]
    RESULT --> LEVEL[Risk Level]
    RESULT --> CONF[Confidence]
    RESULT --> CONTRIB[Feature Contributions]
```

## XGBoost

**Primary model:** gradient-boosted trees.

The current model artifact contains **139 trees**. It is useful for capturing nonlinear relationships and interactions in structured e-commerce data.

## Logistic Regression

**Linear baseline:** a standardised linear model.

It provides a simpler and more interpretable reference point against which the other models can be compared.

## Decision Tree

**Nonlinear interpretable baseline:** a single CART tree.

It provides straightforward feature-split behaviour and helps make the model layer easier to inspect.

### Important distinction

The three models are available as selectable model implementations. TrustLoop should not be described as blindly averaging all three model outputs unless an explicit ensemble is implemented.

The selected model produces the ML risk result that then becomes one input to the broader TrustLoop evidence pipeline.

---

# 3. Risk Thresholds

The current ML engine classifies the model score using these thresholds:

| Risk level | Score |
|---|---:|
| Low | `< 0.30` |
| Medium | `0.30 – < 0.60` |
| High | `>= 0.60` |

The ML prediction is marked as `RETURN_RISK` at or above the low-risk boundary of `0.30`; otherwise it is `NO_RETURN_RISK`.

The model also exposes feature contributions so the application can show which features had the strongest influence on the model result.

---

# 4. Policy Engine

Policy evaluation is deterministic and separate from probabilistic ML prediction.

The current policy engine evaluates rules including:

- Whether the order was delivered
- Whether the return is within the applicable return window
- Whether the claimed condition is compatible with the reason
- Whether photo evidence is required
- Whether the order reaches the high-value inspection threshold
- Delivery-performance context

Current return windows:

- Standard return window: **30 days**
- Change-of-mind return window: **14 days**

High-value orders at or above **500** are routed to the inspection outcome after the relevant decision checks.

---

# 5. Behaviour Analysis

Behaviour analysis uses account-history information to produce descriptive signals.

Current signals include:

- Low-rating history
- Account tenure
- Order value compared with the customer's average order value
- Delivery experience
- Ordering recency

The behaviour score is a heuristic signal based on these account-history features. It is not, by itself, proof of fraud or abusive intent.

---

# 6. Vision Analysis

When a return includes a product image, TrustLoop can send the image to the configured multimodal vision service for analysis.

The current implementation evaluates information such as:

- Observed product condition
- Damage score
- Whether the image supports the customer's stated condition
- Visual findings
- A concise image-analysis summary

The system explicitly handles unavailable vision analysis.

If the vision service is unavailable, the result is marked as unavailable/fallback rather than inventing a visual conclusion.

This is important because:

> **Vision is evidence, not ground truth.**

---

# 7. Evidence Fusion

Evidence Fusion is the central decision-intelligence layer.

It combines four evidence sources:

```mermaid
flowchart TB
    ML[ML Risk Prediction\nWeight: 35%]
    POLICY[Policy Evaluation\nWeight: 20%]
    BEHAV[Behaviour Signals\nWeight: 15%]
    VISION[Vision Evidence\nWeight: 30%\nwhen fully available]

    ML --> F[Fusion Engine]
    POLICY --> F
    BEHAV --> F
    VISION --> F

    F --> TS[Trust Score]
    F --> AG[Source Agreement]
    F --> EV[Evidence Items]
    F --> CF[Conflict Detection]
```

The current nominal fusion weights are:

| Evidence source | Weight |
|---|---:|
| ML | 35% |
| Policy | 20% |
| Behaviour | 15% |
| Vision | 30% |

When vision is unavailable, it does not receive an active fusion weight.

### Fusion outputs

The fusion stage produces:

- Trust score
- Source agreement
- Evidence items
- Conflicts

The Trust Score is a **prototype evidence-fusion score**, not a scientifically validated measure of a customer's character or trustworthiness.

---

# 8. Evidence Alignment and Conflict Detection

One of TrustLoop's key ideas is that different signals can disagree.

### Aligned evidence

```text
Customer Claim       ✓
Policy               ✓
Product Image        ✓
ML Prediction        ✓

          |
          v
   EVIDENCE ALIGNED
```

### Conflicting evidence

```text
Customer Claim       ✓
Policy               ✓
Product Image        ✕
ML Prediction        ⚠

          |
          v
   EVIDENCE CONFLICT
          |
          v
     HUMAN REVIEW
```

The current fusion engine detects conflicts such as:

- Vision contradicts low model risk
- Supporting vision evidence conflicts with high model risk
- Policy blocks a low-risk claim
- Damage/defect is claimed without a submitted image

This is the core reason TrustLoop is more than a simple risk classifier.

---

# 9. Decision Engine

The Decision Engine applies explicit, inspectable rules to the fused evidence.

```mermaid
flowchart TD
    START[Return analysed]
    POLICY{Policy eligible?}
    TRUST{Trust score >= 60?}
    CONFLICT{Evidence conflict?}
    VISION{Vision contradicts claim?}
    VALUE{Order value >= 500?}
    AUTO{Trust >= 75\nML risk < 30%\nAgreement >= 60%?}
    LOW{Trust score < 35?}

    APPROVE[AUTO_APPROVE]
    INSPECT[REFUND_ON_INSPECTION]
    REVIEW[MANUAL_REVIEW]
    DECLINE[DECLINE]

    START --> POLICY
    POLICY -- No --> TRUST
    TRUST -- Yes --> REVIEW
    TRUST -- No --> DECLINE
    POLICY -- Yes --> CONFLICT
    CONFLICT -- Yes --> REVIEW
    CONFLICT -- No --> VISION
    VISION -- Yes --> REVIEW
    VISION -- No --> VALUE
    VALUE -- Yes --> INSPECT
    VALUE -- No --> AUTO
    AUTO -- Yes --> APPROVE
    AUTO -- No --> LOW
    LOW -- Yes --> REVIEW
    LOW -- No --> REVIEW
```

Current decision outcomes are:

| Outcome | Meaning |
|---|---|
| `AUTO_APPROVE` | Evidence is sufficiently aligned for automatic approval |
| `MANUAL_REVIEW` | Uncertainty, conflict, or insufficient confidence requires human review |
| `REFUND_ON_INSPECTION` | High-value return requires physical inspection before refund |
| `DECLINE` | Blocking policy and low supporting evidence lead to decline |

The decision engine also records a rationale and decision confidence.

---

# 10. Human-in-the-Loop

TrustLoop is designed to keep humans in control of difficult decisions.

```text
ML Prediction
      |
      v
Evidence
      |
      v
Conflict / Uncertainty
      |
      v
Human Investigation
      |
      v
Human Verification
      |
      v
Auditable Outcome
```

A reviewer can inspect:

- ML prediction
- Model confidence
- Feature contributions
- Policy results
- Behaviour signals
- Product-image evidence
- Evidence conflicts
- Fusion result
- System rationale
- Previous case information available in the application

The goal is not to replace the reviewer. The goal is to give the reviewer the evidence needed to make a better decision.

---

# 11. Data Model

TrustLoop persists the main stages of a return decision in Supabase/PostgreSQL.

```mermaid
erDiagram
    PRODUCT_CATEGORIES ||--o{ ORDERS : categorises
    CUSTOMERS ||--o{ ORDERS : places
    ORDERS ||--o{ RETURN_REQUESTS : receives
    RETURN_REQUESTS ||--o{ RETURN_IMAGES : contains
    RETURN_REQUESTS ||--o{ PREDICTIONS : produces
    RETURN_REQUESTS ||--o{ POLICY_EVALUATIONS : evaluates
    RETURN_REQUESTS ||--o{ VISION_ANALYSES : analyses
    RETURN_REQUESTS ||--o{ BEHAVIOUR_SIGNALS : produces
    RETURN_REQUESTS ||--o{ FUSION_RESULTS : produces
    RETURN_REQUESTS ||--o{ DECISIONS : receives
    RETURN_REQUESTS ||--o{ HUMAN_REVIEWS : reviewed
    RETURN_REQUESTS ||--o{ AUDIT_EVENTS : records

    CUSTOMERS {
        uuid id PK
        text external_id
        int total_orders
        numeric total_spent
        numeric avg_order_value
    }

    ORDERS {
        uuid id PK
        text external_id
        uuid customer_id FK
        int category_code FK
        numeric total_price
        numeric review_score
        int historical_return_flag
    }

    RETURN_REQUESTS {
        uuid id PK
        text reference
        uuid order_id FK
        text reason_code
        text claimed_condition
        text status
    }

    PREDICTIONS {
        uuid id PK
        uuid return_id FK
        text model_key
        numeric risk_score
        text risk_level
        numeric confidence
    }

    POLICY_EVALUATIONS {
        uuid id PK
        uuid return_id FK
        boolean eligible
    }

    VISION_ANALYSES {
        uuid id PK
        uuid return_id FK
        text provider
        text model
        boolean is_fallback
        numeric damage_score
        boolean matches_claim
    }

    BEHAVIOUR_SIGNALS {
        uuid id PK
        uuid return_id FK
        numeric behaviour_score
    }

    FUSION_RESULTS {
        uuid id PK
        uuid return_id FK
        numeric trust_score
        numeric agreement
    }

    DECISIONS {
        uuid id PK
        uuid return_id FK
        text outcome
        numeric confidence
        boolean is_current
    }

    HUMAN_REVIEWS {
        uuid id PK
        uuid return_id FK
        text reviewer_name
        text verdict
        boolean agreed_with_system
    }

    AUDIT_EVENTS {
        uuid id PK
        uuid return_id FK
        text stage
        text actor
        text summary
    }
```

### Main persisted stages

- Customer context
- Order context
- Return request
- Return evidence image
- ML prediction
- Policy evaluation
- Vision analysis
- Behaviour signals
- Evidence Fusion result
- System decision
- Human review
- Audit events

---

# 12. Audit Trail

Every major stage of the return-analysis pipeline can generate an audit event.

Typical stages include:

```text
INTAKE
  |
  v
MODEL
  |
  v
POLICY
  |
  v
VISION
  |
  v
BEHAVIOUR
  |
  v
FUSION
  |
  v
DECISION
```

Each event can contain:

- Stage
- Actor
- Summary
- Structured payload
- Timestamp
- Associated return

This creates a traceable explanation of how the system reached its outcome.

---

# 13. Trust Passport

The Return Detail screen acts as a case-level Trust Passport.

It brings the decision story together so an operator does not have to manually reconstruct the case from separate systems.

The case view can expose:

- Customer context
- Order context
- Return reason
- ML prediction
- Model confidence
- Feature contributions
- Policy status
- Vision analysis
- Behaviour signals
- Evidence Fusion
- Conflicts
- Final decision
- Human review information
- Audit history

The objective is:

> **Understand a return in seconds without losing the evidence behind the decision.**

---

# 14. Application Routes

The current application contains these primary routes:

| Route | Purpose |
|---|---|
| `/` | Overview dashboard |
| `/returns/new` | Analyse a new return |
| `/returns/$id` | Return detail / Trust Passport |
| `/review` | Human review queue |
| `/audit` | Audit trail |
| `/data` | Data requirements |

---

# 15. Project Structure

```text
trustlayer-ai-main/
│
├── src/
│   ├── components/
│   │   ├── trustloop/
│   │   │   ├── app-shell.tsx
│   │   │   └── primitives.tsx
│   │   └── ui/
│   │
│   ├── integrations/
│   │   └── supabase/
│   │
│   ├── lib/
│   │   ├── ml/
│   │   │   ├── artifacts/
│   │   │   │   ├── features.json
│   │   │   │   ├── xgb.json
│   │   │   │   ├── lr.json
│   │   │   │   └── dt.json
│   │   │   └── engine.ts
│   │   │
│   │   └── trustloop/
│   │       ├── api.functions.ts
│   │       ├── audit.functions.ts
│   │       ├── behaviour.ts
│   │       ├── domain.ts
│   │       ├── features.ts
│   │       ├── fusion.ts
│   │       ├── policy.ts
│   │       ├── vision.server.ts
│   │       └── vision-types.ts
│   │
│   └── routes/
│       ├── index.tsx
│       ├── returns.new.tsx
│       ├── returns.$id.tsx
│       ├── review.tsx
│       ├── audit.tsx
│       └── data.tsx
│
├── drizzle/
│   └── migrations/
│
├── public/
├── package.json
└── README.md
```

---

# 16. Technology Stack

| Technology | Role |
|---|---|
| React 19 | User interface |
| TypeScript | Application and type safety |
| TanStack Start | Full-stack application framework |
| TanStack Router | File-based routing |
| TanStack Query | Client-side data/query management |
| Tailwind CSS | Styling |
| Radix UI | Accessible UI primitives |
| Lucide React | Icons |
| Recharts | Charts and visualisations |
| Zod | Input validation |
| Supabase | PostgreSQL database, storage and backend services |
| Drizzle Kit | Database migration tooling |
| XGBoost | Primary ML model |
| Logistic Regression | Linear ML baseline |
| Decision Tree | Interpretable nonlinear baseline |
| Lovable AI Gateway | Configured multimodal vision service |

---

# 17. Screenshot

### ML Risk Model Selection

The application exposes the three ML model implementations through the ML Risk Model interface.

![TrustLoop ML Risk Model Selection](docs/screenshots/trustloop-ml-model.png)

The active model can be selected for return evaluation, while the other implementations remain available as model alternatives.

---

# 18. Example Decision Scenarios

## Scenario A — Clear, low-risk return

```text
Low ML Risk
      +
Policy Eligible
      +
Positive Behaviour Context
      +
Supporting Vision Evidence
      +
No Evidence Conflict
      |
      v
AUTO_APPROVE
```

## Scenario B — Evidence conflict

```text
Low ML Risk
      +
Policy Eligible
      +
Vision Does Not Support Claim
      |
      v
EVIDENCE CONFLICT
      |
      v
MANUAL_REVIEW
```

## Scenario C — High-value return

```text
Policy Eligible
      +
Order Value >= 500
      |
      v
REFUND_ON_INSPECTION
```

## Scenario D — Policy failure

```text
Blocking Policy Rule Fails
          |
          v
   Evaluate Evidence
          |
     +----+----+
     |         |
     v         v
Strong       Weak
Evidence     Evidence
     |         |
     v         v
MANUAL       DECLINE
REVIEW
```

---

# 19. Design Principles

TrustLoop is designed around:

**Clarity → Evidence → Hierarchy → Confidence → Action**

The interface is intended to feel like an operational trust-and-safety product rather than a generic AI dashboard.

Key principles:

- Keep decisions explainable.
- Keep policy logic deterministic.
- Treat ML as a prediction signal, not ground truth.
- Treat vision as evidence, not proof.
- Make conflicts visible.
- Keep humans in control of uncertain cases.
- Preserve an audit trail.
- Avoid unsupported claims about fraud accuracy.

---

# 20. Model and Data Transparency

The current ML implementation evaluates exported model artifacts directly in TypeScript.

The model artifacts include:

- XGBoost tree structure
- Logistic Regression coefficients and scaling information
- Decision Tree structure
- Feature-column definitions
- Feature medians used for missing-value handling

The model engine does not retrain models at runtime.

The current project is a prototype/demo system built around representative e-commerce data and model artifacts. Therefore, the application should not claim real-world fraud-detection accuracy unless the model has been independently validated on an appropriate labelled dataset.

Likewise:

- Behaviour signals are descriptive heuristics.
- Fusion weights are application logic, not statistically validated probabilities.
- Trust Score is a fusion score, not a measure of a person's character.
- Vision output depends on the configured vision service.

These distinctions make the system easier to defend technically.

---

# 21. Installation

## Prerequisites

- Node.js or Bun
- A Supabase project
- Required environment variables

## Install dependencies

```bash
bun install
```

or:

```bash
npm install
```

## Environment

Configure the environment variables required by the application and Supabase integration.

Do not commit secrets or API keys to the repository.

## Database

Apply the SQL migrations under:

```text
dizzle/migrations/
```

The migrations create the TrustLoop core tables and return-evidence storage policies.

## Development

```bash
bun run dev
```

or:

```bash
npm run dev
```

## Production build

```bash
bun run build
```

or:

```bash
npm run build
```

## Lint

```bash
bun run lint
```

---

# 22. Security Note

The current project is structured as a hackathon/prototype application. Production deployment should additionally enforce:

- Authenticated user roles
- Tenant isolation
- Strict database row-level security
- Server-side authorization checks
- Restricted storage access
- Secret management
- Rate limiting
- Monitoring and alerting
- Production-grade audit retention

These controls should be added without changing the core TrustLoop decision architecture.

---

# 23. Limitations and Honest Claims

TrustLoop demonstrates an evidence-driven return-decision architecture. It should not be presented as a guaranteed fraud detector.

The current implementation has important limitations:

1. The ML models are based on the available representative training/model artifacts.
2. The project does not retrain models during a normal return-analysis request.
3. Behaviour scoring is heuristic.
4. Evidence-fusion weights are configured application logic.
5. Vision analysis depends on the configured external service and can be unavailable.
6. A model prediction does not prove fraud or abuse.
7. Production security and tenant isolation require additional hardening.

The strength of the prototype is therefore the **decision architecture**:

```text
ML Prediction
      +
Policy
      +
Behaviour
      +
Vision
      |
      v
Evidence Fusion
      |
      v
Conflict Detection
      |
      v
Decision Engine
      |
      v
Human Verification
      |
      v
Auditability
```

---

# 24. The TrustLoop in One Diagram

```mermaid
flowchart LR
    A[Return Request] --> B[Customer + Order Context]
    B --> C[41 Feature Vector]
    C --> D[ML Prediction]

    D --> E1[Policy]
    D --> E2[Behaviour]
    D --> E3[Vision]
    D --> E4[ML Contributions]

    E1 --> F[Evidence Fusion]
    E2 --> F
    E3 --> F
    E4 --> F

    F --> G{Evidence State}
    G -->|Aligned| H[Decision Engine]
    G -->|Conflict| I[Human Review]
    G -->|Insufficient| I

    H --> J[Auto Approve]
    H --> K[Refund on Inspection]
    H --> L[Manual Review]
    H --> M[Decline]

    I --> N[Human Verification]

    J --> O[Audit Trail]
    K --> O
    L --> O
    M --> O
    N --> O

    O --> P[(Supabase / PostgreSQL)]
```

---

# TrustLoop

### Smarter Returns. Safer Business.

**ML predicts. Evidence explains. Humans verify.**

The objective is not simply to identify risky returns. It is to create a return-decision workflow where every important recommendation can be understood, challenged, verified, and audited.
