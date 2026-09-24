# SPARQ — Research & Development Chronicle

**FarmSync Quantum 2.0 · RJS Repository**  
**Repository:** https://github.com/Austin-Joshua/RJS  
**Version tag:** `v1` (`ff4ce30`, 2026-08-02)  
**Status:** All commits pushed to `origin/main`

> **Naming note:** There is no separate "Spark" module in this codebase. The quantum
> algorithm is **SPARQ** — **S**implex-**P**reserving **A**daptive **R**isk-aware
> **Q**AOA. This document traces SPARQ from project inception through the v1
> release for research and development purposes.

---

## Table of contents

1. [Executive summary](#1-executive-summary)
2. [Problem statement](#2-problem-statement)
3. [Development timeline](#3-development-timeline)
4. [Architecture](#4-architecture)
5. [Classical ML layer](#5-classical-ml-layer)
6. [SPARQ algorithm](#6-sparq-algorithm)
7. [Legacy QAOA baseline](#7-legacy-qaoa-baseline)
8. [Benchmark results](#8-benchmark-results)
9. [Risk-aware objective](#9-risk-aware-objective)
10. [API and orchestration](#10-api-and-orchestration)
11. [Frontend and ops dashboard](#11-frontend-and-ops-dashboard)
12. [Deployment](#12-deployment)
13. [Test coverage](#13-test-coverage)
14. [Claims and honest limits](#14-claims-and-honest-limits)
15. [Future R&D directions](#15-future-rd-directions)
16. [File map](#16-file-map)
17. [References](#17-references)

---

## 1. Executive summary

FarmSync Quantum 2.0 is an offline-first digital guidebook for new farmers. A
farmer enters land and soil readings; the system returns which crops can grow
there, the **order** to plant them across seasons, and what the soil needs first.

The system deliberately splits work between classical and quantum components:

| Layer | Technology | Role |
|---|---|---|
| Feasibility | Agronomic rules | Which crops are allowed (pH, EC, water, budget) |
| Prediction | LightGBM | How much each crop yields on this farm (₹ value) |
| Optimisation | SPARQ (PennyLane) | Best **sequence** of crops across seasons |
| Advisory | Rule engine | Soil treatment recommendations |

**SPARQ** replaces a legacy transverse-field QAOA that sampled nearly at random
on this problem (~3% feasible rate, ~1.8× uplift vs uniform). SPARQ enforces
one-crop-per-season **by circuit symmetry** (not penalty terms), warm-starts from
LightGBM values, and uses INTERP layerwise depth growth for better convergence and
a real optimisation trace for the UI.

---

## 2. Problem statement

### 2.1 Rotation ≠ sort

Ranking crops by standalone predicted profit is `sorted()`. Crop **sequencing**
is a different combinatorial problem.

A crop's realised value depends on what was planted before it:

- A cereal after a legume out-yields the same cereal after itself (pest break,
  inherited nitrogen, better soil structure).
- The same crop twice running carries a documented monoculture penalty.
- Legumes leave nitrogen credit the next crop can spend on less urea.

Objective (season × crop assignment):

```text
maximise  Σ_t  base[c_t]
               × yield_multiplier[family(c_{t-1})][family(c_t)]
               × (same_crop_penalty if c_t == c_{t-1})
          +     N_credit_rupees[c_{t-1}]
```

The multiplier term couples **adjacent seasons**, making the objective
**quadratic**. Drop it and the problem separates into independent per-season
picks that need no optimiser.

### 2.2 Why classical heuristics fail

Measured on 60 random farms (3 seasons × 4 crops):

| Classical baseline | Suboptimal plan | Mean cost lost | Worst case |
|---|---|---|---|
| Rank by predicted profit (sort) | **65%** of farms | ₹5,475 | ₹32,762 |
| Greedy with one-step lookahead | **50%** of farms | ₹5,201 | ₹21,820 |

Even a strong classical heuristic is wrong half the time. That is the case for
searching the order rather than sorting it.

### 2.3 Hard constraints

Beyond rotation economics, each plan must satisfy:

- **C1 — Simplex:** exactly one crop per season (structural in SPARQ).
- **C2 — Water:** `water_m3_per_ha × area ≤ water_available_m3`.
- **C3 — Budget:** `cost_rs_per_ha × area ≤ budget_rs`.

Coefficients live in `backend/models/v1/rotation.yaml` and
`backend/models/v1/crops.yaml`.

---

## 3. Development timeline

All development occurred over **four calendar days** (2026-07-30 → 2026-08-02).

| Date | Commit | Milestone |
|---|---|---|
| 2026-07-30 | `af40939` | Initial commit |
| 2026-07-30 | `edb7362` | Backend scaffold + legacy transverse-field QAOA (`quantum_optimizer.py`) |
| 2026-07-30 | `0249a9f` | Remove Landroid-main predecessor directory |
| 2026-07-30 | `3d4c5b3` | Railway Docker deploy + Flutter ↔ FastAPI wiring |
| 2026-07-30 | `2c3836b` | Flutter frontend scaffold |
| **2026-07-31** | **`3491000`** | **SPARQ landing** — `sparq.py`, `rotation.py`, `risk.py`, farm flow, NDVI charts, quantum dashboard, demo login |
| 2026-07-31 | `e831618` | Railway deployment hardening, farm JSON parsing |
| 2026-07-31 | `a64869c` | **Quantum Lab** — live water/budget re-ranking + `QUANTUM.md` |
| 2026-07-31 | `b63aa60` | Public ops dashboard |
| 2026-07-31 | `3257761` | Break-crop rotation rules, monoculture penalties |
| 2026-07-31 | `9628a08` | Delta kharif paddy curation (rice-fallow systems) |
| 2026-07-31 | `bc4b9a1` | Rotation dataclass startup crash fix |
| 2026-07-31 | `9f7c8f8` | SPARQ vs QAOA benchmark bar charts on ops dashboard |
| 2026-07-31 | `00b3557` | Ops chart polish — animations, tooltips, solver toggles |
| 2026-07-31 | `fdbaefd` | Ops dashboard 12-column bento grid |
| 2026-07-31 | `c86f69c` | Quantum tab value bars + rotation economics |
| 2026-07-31 | `294452c` | Quantum Lab dropdown overflow fix |
| 2026-07-31 | `ce50106` | UI polish, soil OCR, strategy comparison fixes |
| **2026-08-02** | **`ff4ce30`** | **v1 release tag** |

### Phase breakdown

```
Phase 0  (Jul 30)   Foundation — FastAPI backend, legacy QAOA, Flutter scaffold, Railway
Phase 1  (Jul 31)   SPARQ core — algorithm, rotation QUBO, farm pipeline, demo data
Phase 2  (Jul 31)   Product surface — Quantum Lab sliders, ops dashboard, rotation rules
Phase 3  (Jul 31)   Polish — UI economics, benchmarks, OCR, strategy comparisons
Phase 4  (Aug 02)   v1 tag
```

---

## 4. Architecture

### 4.1 End-to-end pipeline

```text
Farmer soil card + weather + NDVI
              │
              ▼
┌─────────────────────────────────────┐
│  Classical feasibility gates        │  pH, EC, soil type, water, budget
│  (crop_feasibility.py)              │  → which crops are even allowed
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  LightGBM yield model               │  mean + P10/P90 + SHAP
│  (app/ml/)                          │  → ₹ value per crop on this farm
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  Rotation QUBO                      │  season × crop, quadratic couplings
│  (quantum/rotation.py)              │  (predecessor changes next yield)
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│  SPARQ — primary quantum solver     │  PennyLane default.qubit simulator
│  (quantum/sparq.py)                 │  XY-ring QAOA, INTERP depth 1→3
└─────────────────────────────────────┘
              │
              ├── classical baselines (exact / sort / greedy) — always side-by-side
              └── plan + quantum report → Flutter Quantum Lab
```

### 4.2 Tech stack

| Layer | Technology |
|---|---|
| Mobile app | Flutter + Riverpod + Drift (offline-first) |
| API | FastAPI |
| Classical ML | LightGBM (yield prediction only) |
| Quantum | PennyLane (`default.qubit` simulator) |
| Optimiser | COBYLA, CVaR α=0.25, INTERP layer growth |
| Database | SQLAlchemy (SQLite dev / Postgres prod) |
| Auth | Clerk (Google sign-in) + dev login for demos |
| NDVI / weather | Google Earth Engine, Open-Meteo |
| Deploy | Railway (Docker) |
| Maps | MapLibre |

### 4.3 Hard architectural rules

From `.cursorrules` and PRD:

- **No CNN/CV for pests** — rule-based NDVI alerts only.
- **QAOA/SPARQ for optimisation only** — never prediction.
- **Offline-first** — local persistence via Drift.
- **No mocked data in production paths** — demo farms run the real pipeline.

---

## 5. Classical ML layer

### 5.1 LightGBM yield model

| Item | Detail |
|---|---|
| Algorithm | LightGBM regressor + two quantile models (P10 / P90) |
| Role | Tabular **yield prediction only** |
| Code | `backend/app/ml/` |
| Artifacts | `yield_lgbm.txt`, `yield_q10.txt`, `yield_q90.txt` |
| Features | Soil N/P/K/pH/OC, rainfall, GDD, humidity, ET₀, NDVI stats, area, crop, district, season |
| Training data | DES district APY + Open-Meteo ERA5 + MODIS NDVI |
| Holdout (temporal) | R² ≈ **0.96**, RMSE ≈ 7.1 t/ha |

Net value fed into quantum (per crop):

```text
v = yield_t_ha × area_ha × price_Rs/quintal × 10  −  cost_Rs/ha × area_ha
```

SPARQ **warm-starts** from this value matrix. It does **not** recompute yield.

### 5.2 Window-invariant features

Training aggregates a whole crop year; inference runs mid-season. Every
cumulative quantity is stored as a rate (`gdd_per_day`, `rainfall_mm_per_day`,
`et0_mm_per_day`, `ndvi_auc_per_day`, `dry_spell_frac`) so a 45-day window and
a 365-day window describe the same field the same way.

`build_feature_row` is the **only** implementation — shared by training and
inference.

### 5.3 Feasibility gates

Hard gates in `crop_feasibility.py`:

- pH tolerance per crop
- Salinity (EC) tolerance
- Season water sufficiency
- Drainage vs soil texture

Low nutrients are a **warning, not a gate** — a reason to fertilise, not to
rule a crop out.

---

## 6. SPARQ algorithm

**File:** `backend/app/quantum/sparq.py`  
**Device:** PennyLane `default.qubit` (simulator — no cloud QPU required)

### 6.1 Four design moves

| # | Technique | What it does |
|---|---|---|
| 1 | **Simplex preservation** | Each season is a qubit block in Hamming-weight-1. An **XY ring mixer** (`qml.IsingXY`) conserves that weight → **exactly one crop per season by symmetry**, not by penalty. |
| 2 | **Value-gradient warm start** | Block amplitudes ∝ √softmax(μ / τ), τ = 0.35. LightGBM net values seed the quantum prior. |
| 3 | **Zero slack qubits** | One-crop constraint is structural; water/budget use unbalanced penalisation → `n_qubits == n_decision`. |
| 4 | **INTERP layerwise growth** | Train depth p=1 → grow to p=2 → p=3 (Zhou et al.). Real optimisation trace for the UI chart. |

### 6.2 Circuit parameters

| Parameter | Value |
|---|---|
| Init | Weighted Dicke-1 (generalised W) per block |
| Mixer | Native `IsingXY` ring (**must not** Trotterise as separate XX+YY) |
| Cost layer | Diagonal QUBO Hamiltonian (`qml.qaoa.cost_layer`) |
| Depth | INTERP p = 1 → 2 → 3 |
| Classical outer loop | COBYLA, ~60 iters/stage |
| Train objective | CVaR of QUBO energy at α = 0.25 |
| Shots | 2048 final / 256 during training |
| Timeout | `QAOA_TIMEOUT_S` (default 10 s) → classical fallback |

### 6.3 Critical implementation invariant

> **The mixer must be a native gate.** `qml.qaoa.mixer_layer` Trotterises XX and
> YY as separate Pauli words, and XX *alone* maps |00⟩→|11⟩ — that silently
> destroys the symmetry the whole design rests on. `qml.IsingXY` annihilates
> |00⟩ and |11⟩ and rotates only within {|01⟩,|10⟩}.

Guarded by `test_xy_mixer_conserves_one_crop_per_plot`.

### 6.4 Rotation sequencing scale

At demo scale: 3 seasons × 4 crops = **12 qubits**, p=3 layers.

| Metric | Value |
|---|---|
| One crop per season | **100%** (structural) |
| Recovers exact optimum | **25/25** instances |
| Top measured outcome | 54–70% of distribution (uniform would be 1/64) |
| Wall clock | ~2.2 s |

### 6.5 Classical baselines (always computed side-by-side)

| Baseline | Function | Meaning |
|---|---|---|
| Exact | `brute_force_rotation` | Ground truth at demo scale |
| Sort by profit | `greedy_sort_rotation` | Naive "best crop first" |
| Greedy look-ahead | `greedy_myopic_rotation` | Strong classical heuristic |

Every `/rank` response ships all three, scored by the same `sequence_value`.

---

## 7. Legacy QAOA baseline

**File:** `backend/app/quantum/quantum_optimizer.py`

The stock QAOA uses a transverse-field mixer over the full 2ⁿ Hilbert space
and leans on penalty terms to discourage invalid one-crop-per-plot assignments.

Problems observed in benchmark:

- `feasible_rate` ~ 0.03 (samples mostly violate water/budget or simplex)
- `uplift_vs_uniform` ~ 1.8× — statistically indistinguishable from random
- Uses **11 qubits** (9 decision + 2 slack) vs SPARQ's 9
- Optimum still found sometimes, but by post-selecting the best of 2048 draws
  over a 64-element space — brute force wearing a costume

SPARQ was built specifically to address these failure modes while keeping the
legacy solver for honest head-to-head comparison.

---

## 8. Benchmark results

Frozen in `backend/models/v1/benchmark.json`.  
Protocol: 50 instances, 3 plots × 3 crops, p=3 layers, risk κ=0.35.

### 8.1 Allocation mode (SPARQ vs legacy QAOA)

| Metric | SPARQ | Legacy QAOA |
|---|---|---|
| Qubits | **9** | 11 (with slack) |
| Simplex rate (one crop / block) | **100%** | not enforced |
| Feasible rate (all constraints) | **~61.4%** | ~2.9% |
| Uplift vs 2ⁿ uniform | **~98.5×** | ~1.8× |
| Uplift vs feasible uniform | **~5.2×** | ~0.10× |
| Optimum match rate | **94%** | 92% |
| Approximation ratio | **1.0** | ~0.9997 |
| Wall clock | **~2.16 s** | ~3.31 s |

### 8.2 Rotation sequencing (12 qubits)

| Metric | Value |
|---|---|
| One crop per season | 100% (structural) |
| Recovers exact optimum | 25/25 |
| Plan quality vs uniform random | 0.81 vs 0.50 (every instance beats random) |
| Wall clock | ~2.2 s |

### 8.3 Running benchmarks offline

```bash
cd backend
python -m scripts.benchmark_qaoa
```

Ops dashboard visualises these numbers at `/ops` (static HTML + charts).

---

## 9. Risk-aware objective

**File:** `backend/app/quantum/risk.py`

Used when allocating **plots × crops** under water/budget (plan API). Rotation
ranking uses the sequencing objective; risk bands still come from LightGBM
P10/P90.

```text
maximise   Σᵢ μᵢ xᵢ  −  κ · Σᵢⱼ Cov(vᵢ, vⱼ) xᵢ xⱼ
```

| Piece | Detail |
|---|---|
| σ from bands | `(P90 − P10) / (2 · z₀.₉₀)`, z₀.₉₀ ≈ 1.282 |
| Cross-crop ρ | ~0.45 (`risk_cross_crop_rho`) |
| κ | Risk aversion (0 = ignore variance) |

Variance is **quadratic in x**, so mean–variance is a native QUBO term.

### QUBO encodings

| Encoding | Builder | Slack qubits | Used by |
|---|---|---|---|
| `simplex` | `build_simplex_qubo` | none | SPARQ (plot allocation) |
| `rotation_simplex` | `build_rotation_qubo` | none | SPARQ (crop order / Quantum Lab) |
| `slack` | `build_qubo` | water + budget bits | Legacy QAOA only |

**Classical fallback** (`classical_fallback.py`): brute force (n ≤ 20) +
simulated annealing. Quantum and classical run every request; timeout →
`solver: "classical_fallback"`.

---

## 10. API and orchestration

### 10.1 Primary endpoint

```http
POST /api/v1/farms/{id}/rank
```

Optional scenario body:

```json
{
  "water_available_m3": 12000,
  "budget_rs": 80000,
  "persist": false
}
```

`persist: false` for slider what-ifs (Quantum Lab) — avoids writing a new
`rotation_plan` row on every drag.

### 10.2 Orchestrator

`backend/app/services/rotation_service.py` runs the full pipeline:

1. Load farm + soil override
2. Fetch weather + NDVI adapters
3. Run feasibility gates
4. Predict yields (LightGBM)
5. Build rotation QUBO
6. Solve with SPARQ (+ classical baselines in parallel)
7. Return plan, quantum report, comparison board

### 10.3 Response payload highlights

- `rotation_model` — coefficients used (inspectable)
- `claim` — honest quantum claim string for UI
- `quantum_report` — circuit diagram data, gate counts, measurement distribution
- `comparisons` — exact / sort / greedy values side-by-side
- `convergence` — real INTERP optimisation trace (not synthetic)

---

## 11. Frontend and ops dashboard

### 11.1 Flutter — Quantum Lab

| File | Role |
|---|---|
| `flutter_app/lib/features/quantum/quantum_lab_screen.dart` | Live water/budget what-if sliders |
| `flutter_app/lib/features/farms/quantum_panel.dart` | Circuit diagram, gate counts, measurement distribution |
| `flutter_app/lib/features/farms/farm_detail_screen.dart` | Farm detail with quantum ranking |
| `flutter_app/lib/data/models/farm_models.dart` | Rank result / SPARQ payload models |

Farmer framing: *mazhai varalana?* (will rain come?) / *uram vela eriducha?*
(is the budget enough?)

| Slider | Backend field | Effect |
|---|---|---|
| Available water | `water_available_m3` | Hard gate — paddy (~6500 m³/ha) drops first |
| My budget | `budget_rs` | Hard gate — sugarcane/paddy cut first |

### 11.2 Ops dashboard (public benchmark UI)

| File | Role |
|---|---|
| `backend/static/ops/index.html` | SPARQ vs QAOA benchmark charts |
| `backend/static/ops/ops-charts.js` | Chart rendering with solver toggles |

Added in commits `b63aa60`, `9f7c8f8`, `00b3557`, `fdbaefd`.

### 11.3 Demo farms

Three seeded Thanjavur farms (`python -m scripts.seed_demo`) run the **real**
pipeline — not fixtures:

| Farm | Soil | Feasible | Plan |
|---|---|---|---|
| Home field | Alluvial, pH 6.7, ample water | 4/5 | groundnut ×3 — ₹2,67,028 |
| Canal plot | Heavy clay, pH 7.3 | 2/5 (drainage gate) | paddy → black gram → black gram — ₹59,616 |
| Upland strip | Red, pH 7.8, low water | 3/5 (paddy fails on water) | groundnut ×3 — ₹1,64,724 |

---

## 12. Deployment

| Item | Detail |
|---|---|
| Platform | Railway (Docker) |
| Config | `3d4c5b3` — Docker + Flutter ↔ FastAPI wiring |
| Hardening | `e831618` — Railway farm load fixes |
| Health | `/healthz` reports `dev_login_enabled` |
| Env vars | `SPARQ_LAYERS=3`, `SPARQ_WARM_START_TAU=0.35`, `SPARQ_SHOTS=2048`, `QAOA_TIMEOUT_S=10` |

### Local run

```bash
cd backend
python -m scripts.build_training_set && python -m scripts.train_model
uvicorn app.main:app --reload

cd ../flutter_app
flutter run --dart-define=CLERK_PUBLISHABLE_KEY=pk_... \
  --dart-define=API_BASE_URL=http://10.0.2.2:8000
```

---

## 13. Test coverage

| Suite | Count | Scope |
|---|---|---|
| Backend `pytest` | 55 | Quantum invariants, ML skew guards, API contract, isolation |
| Flutter `flutter test` | 12 | Widget and model tests |

Key quantum guards:

- `test_xy_mixer_conserves_one_crop_per_plot` — Hamming weight invariant
- `test_sampled_plans_are_better_than_random` — robust quality metric
- `test_features_are_window_invariant` — ML feature consistency
- `test_accounts_are_isolated` — multi-tenant farm isolation

---

## 14. Claims and honest limits

### We claim

| Claim | Evidence |
|---|---|
| Quantum-ready combinatorial formulation (QUBO) | `rotation.py`, `qubo.py` |
| SPARQ concentrates on good feasible plans (~5× vs feasible-uniform) | `benchmark.json` |
| Mean–variance / rotation couplings inside the QUBO | `risk.py` |
| Side-by-side classical + legacy QAOA for honesty | Every `/rank` response |
| 100% simplex rate by circuit symmetry | Structural invariant |
| Ranking read directly off measurement distribution | No post-hoc classical re-sort |

### We do **not** claim

| Limit | Reason |
|---|---|
| Quantum speedup at demo n (≤25 qubits) | Simulator wall clock ~2.2 s; classical exact search feasible |
| Quantum ML for yield | LightGBM handles all prediction |
| P(exact optimum) always >> uniform | On near-flat landscapes, spread is correct behaviour |
| Sorting by profit equals sequencing | 65% of farms get suboptimal sort plans |

**Stage rule:** if it isn't backed by a number in `benchmark.json` or
`metrics.json`, don't say it.

---

## 15. Future R&D directions

| Direction | Notes |
|---|---|
| Hardware execution | PennyLane device swap to IBM/IonQ when n grows beyond classical exact search |
| Larger instances | 4+ seasons, 5+ crops — qubit count scales linearly; ansatz structure holds |
| Real-time NDVI feedback | Closed-loop re-ranking mid-season (infrastructure exists via sliders) |
| District-specific rotation tables | Currently Thanjavur-focused; `rotation.yaml` is data-driven |
| CVaR farmer-facing score | Currently optimises CVaR internally; farmer sees expected ₹ |
| PennyLane GPU backend | `lightning.qubit` for faster shot batches at scale |
| Federated soil data | Offline-first Drift layer ready for sync |

---

## 16. File map

### Quantum core

| Path | Responsibility |
|---|---|
| `backend/app/quantum/sparq.py` | **SPARQ** ansatz + INTERP + sampling |
| `backend/app/quantum/rotation.py` | Season×crop QUBO + classical baselines |
| `backend/app/quantum/qubo.py` | Slack + simplex QUBO, feasibility |
| `backend/app/quantum/risk.py` | μ / Cov / CVaR report |
| `backend/app/quantum/quantum_optimizer.py` | Legacy transverse-field QAOA |
| `backend/app/quantum/pennylane_sim.py` | Exact Born probabilities + `qml.draw` |
| `backend/app/quantum/classical_fallback.py` | Brute force / simulated annealing |
| `backend/app/quantum/benchmark.py` | Head-to-head metrics |

### Orchestration & API

| Path | Responsibility |
|---|---|
| `backend/app/services/rotation_service.py` | Full farm pipeline orchestrator |
| `backend/app/services/crop_feasibility.py` | Soil / water / budget gates |
| `backend/app/api/v1/farms.py` | `POST /farms/{id}/rank` |
| `backend/app/api/v1/ops.py` | Public ops dashboard benchmark API |

### Model artifacts

| Path | Content |
|---|---|
| `backend/models/v1/yield_lgbm.txt` | LightGBM yield model |
| `backend/models/v1/rotation.yaml` | Yield multipliers, N credit, monoculture penalties |
| `backend/models/v1/crops.yaml` | Water, cost, rotation families per crop |
| `backend/models/v1/benchmark.json` | Frozen SPARQ vs QAOA numbers |
| `backend/models/v1/metrics.json` | LightGBM eval protocols |

### Documentation

| Path | Content |
|---|---|
| `QUANTUM.md` | Primary algorithm + model reference |
| `PRD.md` | Product requirements, quantum justification |
| `TRD.md` | Technical architecture, ansatz detail |
| `SPARQ_RND.md` | This document |

### Scripts

| Path | Purpose |
|---|---|
| `backend/scripts/benchmark_qaoa.py` | Offline SPARQ vs QAOA benchmark runner |
| `backend/scripts/simulate_pennylane.py` | PennyLane circuit simulation |
| `backend/scripts/seed_demo.py` | Demo farm seeder |

---

## 17. References

### Internal

- [QUANTUM.md](QUANTUM.md) — live algorithm reference
- [PRD.md](PRD.md) — product requirements
- [TRD.md](TRD.md) — technical design
- [README.md](README.md) — run instructions

### Algorithm literature (techniques used in SPARQ)

| Technique | Source |
|---|---|
| XY-ring mixer / QAOA+ | Hadfield et al., quantum alternating operator ansatz |
| INTERP layerwise growth | Zhou et al. — incremental depth training |
| CVaR objective | Barkoutsos et al. — CVaR-QAOA |
| Simplex encoding | Hamming-weight-1 subspace constraint |

### Repository

- **GitHub:** https://github.com/Austin-Joshua/RJS
- **Branch:** `main` (up to date with `origin/main`)
- **Latest commit:** `ff4ce30` — v1 (2026-08-02)

---

*Document generated for R&D purposes. For the live algorithm reference, see
[QUANTUM.md](QUANTUM.md).*
