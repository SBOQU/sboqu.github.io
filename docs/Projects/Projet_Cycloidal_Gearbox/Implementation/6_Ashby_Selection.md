---
template: Cycloidal_Gearbox/Implementation.html
---

# Ashby Selection

The material selection of the Material Selection section, in a separate notebook. It turns the governing contact into four requirements, filters a database of 1 544 materials, then ranks the candidates and tests the ranking against its weights. The database is the Kaggle dataset purushottamnawale/materials (`Data.csv`).

!!! note "Dataset"

    The notebook reads the file `Data.csv` of the [Materials dataset on Kaggle](https://www.kaggle.com/datasets/purushottamnawale/materials){target="_blank" rel="noopener"}. Download it from Kaggle and place it next to the notebook before running the cells.

---

## Requirements

Peak pressure of the pin and bore contact of stage 2, shear stress under the surface (Johnson), and the four requirements: surface hardness (E1), core strength under the case (E2), core hardness (E3) and core ductility (E4).

**Inputs:** nominal pressure of 1 042,5 MPa, pin Ø4 mm, $e$ = 3,5 mm, peak factor 2.

**Outputs:** $\tau_{\max}$, required hardness, required core yield for each treatment, plot of $\tau(z)$.

!!! python "Requirements"
    ```python
    import re
    import numpy as np
    import pandas as pd
    import matplotlib.pyplot as plt
    from collections import Counter
    import warnings
    warnings.filterwarnings("ignore")

    plt.rcParams.update({
        "font.family": "DejaVu Sans", "font.size": 10,
        "axes.titlesize": 12, "axes.labelsize": 11,
        "figure.dpi": 120, "axes.grid": True,
        "grid.alpha": 0.3, "grid.linestyle": "--",
    })
    pd.set_option("display.width", 200)
    print("Libraries loaded.")

    # ============================================================
    # INPUTS FROM THE SIZING NOTEBOOK (stage 2, pin / bore contact)
    # ============================================================
    hertz_pressure_nominal_MPa = 1042.5
    pin_diameter_mm            = 4.0
    eccentricity_mm            = 3.5
    young_modulus_MPa          = 210000.0
    poisson_ratio              = 0.30
    safety_factor              = 2.0
    peak_load_factor           = 2.0

    # --- Contact geometry (bore oversized by e, Qi et al. eq. 1) ---
    pin_radius_mm        = pin_diameter_mm / 2
    bore_radius_mm       = pin_radius_mm + eccentricity_mm
    equivalent_radius_mm = pin_radius_mm * bore_radius_mm / (bore_radius_mm - pin_radius_mm)
    reduced_modulus_MPa  = young_modulus_MPa / (2 * (1 - poisson_ratio**2))

    # --- Peak pressure and contact half-width ---
    hertz_pressure_peak_MPa = hertz_pressure_nominal_MPa * np.sqrt(peak_load_factor)
    contact_half_width_mm   = 2 * hertz_pressure_peak_MPa * equivalent_radius_mm / reduced_modulus_MPa

    def subsurface_shear_stress(depth_mm):
        """Shear stress tau(z) under a Hertz line contact (Johnson 1985)."""
        relative_depth = depth_mm / contact_half_width_mm
        root_term = np.sqrt(1 + relative_depth**2)
        normal_stress_z = -hertz_pressure_peak_MPa / root_term
        normal_stress_x = -hertz_pressure_peak_MPa * ((1 + 2 * relative_depth**2) / root_term - 2 * relative_depth)
        return abs(normal_stress_x - normal_stress_z) / 2

    depth_scan_mm        = np.linspace(1e-4, 5 * contact_half_width_mm, 2000)
    shear_scan_MPa       = subsurface_shear_stress(depth_scan_mm)
    max_shear_stress_MPa = shear_scan_MPa.max()
    max_shear_depth_mm   = depth_scan_mm[shear_scan_MPa.argmax()]

    # --- E1: surface hardness ---
    required_surface_yield_MPa      = 2 * safety_factor * max_shear_stress_MPa
    required_hardness_from_yield_HV = required_surface_yield_MPa / (0.9 * 3.3)   # Re = 0.9 Rm, Rm = 3.3 HV
    rolling_contact_hardness_HV     = 653     # 58 HRC
    required_surface_hardness_HV    = max(required_hardness_from_yield_HV, rolling_contact_hardness_HV)

    # --- E2: typical case depth of each treatment ---
    typical_case_depth_mm = {"case-hardening": 0.8, "nitriding": 0.3, "induction": 1.5}
    def required_core_yield(case_depth_mm):
        return 2 * safety_factor * subsurface_shear_stress(case_depth_mm)

    # --- E3, E4 ---
    required_core_tensile_MPa    = 850.0      # 25 HRC, ISO 6336-5
    required_core_elongation_pct = 5.0

    print(f"Equivalent radius R*          : {equivalent_radius_mm:.3f} mm")
    print(f"P_peak = {hertz_pressure_nominal_MPa} x sqrt({peak_load_factor:.0f})  : {hertz_pressure_peak_MPa:.0f} MPa")
    print(f"Half-width b                  : {contact_half_width_mm*1000:.0f} µm")
    print(f"tau_max = {max_shear_stress_MPa:.0f} MPa at z = {max_shear_depth_mm*1000:.0f} µm "
          f"({max_shear_depth_mm/contact_half_width_mm:.3f} b)")
    print()
    print(f"E1  surface hardness : {required_surface_hardness_HV:.0f} HV (calculation {required_hardness_from_yield_HV:.0f} HV, "
          f"58 HRC rule {rolling_contact_hardness_HV} HV)")
    for treatment_name, case_depth in typical_case_depth_mm.items():
        print(f"E2  core Re ({treatment_name:<14}, delta = {case_depth} mm) : >= {required_core_yield(case_depth):.0f} MPa")
    print(f"E3  core Rm          : >= {required_core_tensile_MPa:.0f} MPa (25 HRC)")
    print(f"E4  core A5          : >= {required_core_elongation_pct:.0f} %")

    figure, axis = plt.subplots(figsize=(8, 4.5))
    depth_plot_mm = np.linspace(1e-4, 1.0, 500)
    axis.plot(subsurface_shear_stress(depth_plot_mm), depth_plot_mm * 1000, color="#1565C0", lw=2, label="tau(z) at P_peak")
    for treatment_name, color in [("nitriding", "#E53935"), ("case-hardening", "#43A047")]:
        axis.axhline(typical_case_depth_mm[treatment_name] * 1000, color=color, ls="--",
                     label=f"{treatment_name} case = {typical_case_depth_mm[treatment_name]} mm")
    axis.invert_yaxis()
    axis.set_xlabel("Shear stress tau (MPa)")
    axis.set_ylabel("Depth z (µm)")
    axis.set_title("Subsurface shear, pin / bore contact of stage 2", fontweight="bold")
    axis.legend()
    plt.tight_layout()
    plt.show()
    ```

## Database

Loads the database, sorts the materials into families and the steels by treatment. For a surface-treated steel, the hardness is the one of the surface, while the strength and the elongation describe the core.

**Inputs:** `Data.csv`.

**Outputs:** `materials_database`, `steel_database`.

!!! python "Database"
    ```python
    # ============================================================
    # DATABASE: Kaggle, purushottamnawale/materials (Data.csv)
    # For surface-treated steels, HV is the surface hardness while Su, Sy and A5 describe the core.
    # ============================================================
    materials_database = pd.read_csv("Data.csv")
    for column in ["Su", "Sy", "E", "Ro", "A5", "HV", "Bhn"]:
        materials_database[column] = pd.to_numeric(materials_database[column], errors="coerce")
    materials_database = materials_database.dropna(subset=["Su", "Sy", "E", "Ro"])
    materials_database["Heat treatment"] = materials_database["Heat treatment"].fillna("not specified")

    def material_family(name):
        lowered_name = str(name).lower()
        if "cast iron" in lowered_name or re.search(r"\bgg|\bgts|\bggg|csn 42", lowered_name): return "Cast iron"
        if "aluminum" in lowered_name or "aluminium" in lowered_name: return "Aluminium"
        if any(word in lowered_name for word in ["copper", "bronze", "brass"]): return "Copper alloy"
        if "titanium" in lowered_name: return "Titanium"
        if "magnesium" in lowered_name: return "Magnesium"
        return None

    def classify_row(row):
        family = material_family(row["Material"])
        if family:
            return family
        return "Steel" if 7700 <= row["Ro"] <= 8100 else "Other"

    def surface_treatment(heat_treatment):
        lowered = str(heat_treatment).lower()
        if "case" in lowered and "nitro" not in lowered: return "case-hardening"
        if "nitr" in lowered: return "nitriding"
        if "face hardened" in lowered: return "induction"
        return "through"

    materials_database["family"]    = materials_database.apply(classify_row, axis=1)
    materials_database["treatment"] = materials_database["Heat treatment"].apply(surface_treatment)
    materials_database["hardness_HV"] = np.where(materials_database["HV"].notna(), materials_database["HV"],
                                        np.where(materials_database["Bhn"].notna(), materials_database["Bhn"] * 1.05, np.nan))
    materials_database["endurance_limit_MPa"] = np.where(materials_database["Su"] <= 1400,
                                                         0.5 * materials_database["Su"], 700)   # Shigley

    print(f"Materials loaded: {len(materials_database)}")
    print(materials_database["family"].value_counts().to_string())
    print()
    steel_database = materials_database[materials_database["family"] == "Steel"]
    print("Steels by treatment:")
    print(steel_database["treatment"].value_counts().to_string())
    ```

## Ashby diagrams

Endurance limit against density for all the materials, then hardness against elongation for the steels. No through-hardened steel reaches the target zone.

**Inputs:** the database.

**Outputs:** the two diagrams and the number of through-hardened steels in the target zone.

!!! python "Ashby diagrams"
    ```python
    # ============================================================
    # ASHBY DIAGRAMS
    #   1: endurance limit vs density, index M1 = sigma_e / rho
    #   2: hardness vs core elongation A5, steels only
    # ============================================================
    family_colors = {"Steel": "#1565C0", "Aluminium": "#FB8C00", "Copper alloy": "#C62828",
                     "Titanium": "#6A1B9A", "Magnesium": "#2E7D32", "Cast iron": "#546E7A", "Other": "#9E9E9E"}
    treatment_colors = {"through": "#9E9E9E", "induction": "#FB8C00", "nitriding": "#E53935", "case-hardening": "#43A047"}

    figure, axes = plt.subplots(1, 2, figsize=(17, 7))

    axis = axes[0]
    for family, color in family_colors.items():
        subset = materials_database[materials_database["family"] == family]
        if len(subset):
            axis.scatter(subset["Ro"], subset["endurance_limit_MPa"], s=12, alpha=0.5, c=color, label=f"{family} ({len(subset)})")
    density_line = np.array([1000, 13000])
    for index_value in [20, 50, 100]:
        axis.plot(density_line, index_value * density_line / 1000, "k--", lw=0.8, alpha=0.5)
        axis.text(1100, index_value * 1.1 * 1.1, f"M1 = {index_value}", fontsize=8, alpha=0.7)
    axis.set_xscale("log")
    axis.set_yscale("log")
    axis.set_xlim(1000, 13000)
    axis.set_ylim(20, 1000)
    axis.set_xlabel("Density rho (kg/m³)")
    axis.set_ylabel("Endurance limit sigma_e (MPa)")
    axis.set_title(f"Ashby 1: sigma_e vs rho ({len(materials_database)} materials)", fontweight="bold")
    axis.legend(loc="lower right", fontsize=8)

    axis = axes[1]
    steels_with_data = steel_database.dropna(subset=["hardness_HV", "A5"])
    for treatment_name, color in treatment_colors.items():
        subset = steels_with_data[steels_with_data["treatment"] == treatment_name]
        is_treated = treatment_name != "through"
        axis.scatter(subset["A5"], subset["hardness_HV"], s=30 if is_treated else 12,
                     alpha=0.8 if is_treated else 0.35, c=color, label=f"{treatment_name} ({len(subset)})")
    axis.axhline(required_surface_hardness_HV, color="red", ls="--", lw=1.2)
    axis.axvline(required_core_elongation_pct, color="orange", ls="--", lw=1.2)
    axis.fill_between([required_core_elongation_pct, 45], required_surface_hardness_HV, 900, color="green", alpha=0.08)
    axis.text(25, required_surface_hardness_HV + 40, "Target zone\nsurface >= 653 HV and A5 >= 5 %", color="green", fontsize=9)
    axis.set_xlim(0, 45)
    axis.set_ylim(0, 900)
    axis.set_xlabel("Core elongation A5 (%)")
    axis.set_ylabel("Hardness (HV), surface if treated")
    axis.set_title(f"Ashby 2: hardness vs ductility ({len(steels_with_data)} steels with data)", fontweight="bold")
    axis.legend(loc="upper right", fontsize=8.5)
    plt.tight_layout()
    plt.savefig("ashby_disc_diagrams.png", dpi=150, bbox_inches="tight")
    plt.show()

    through_in_zone = steels_with_data[(steels_with_data["treatment"] == "through")
                                       & (steels_with_data["hardness_HV"] >= required_surface_hardness_HV)
                                       & (steels_with_data["A5"] >= required_core_elongation_pct)]
    print(f"Through-hardened steels in the target zone: {len(through_in_zone)}")
    print("=> A surface treatment is required.")
    ```

## Equivalent grades

The same steel listed under several standards is merged into one grade, with averaged properties, so that it takes only one place in the ranking.

**Inputs:** `steel_database`.

**Outputs:** `consolidated_steels`.

!!! python "Equivalent grades"
    ```python
    # ============================================================
    # EQUIVALENT GRADES: the same steel listed under several standards
    # ============================================================
    equivalent_grades = {
        "EN 16MnCr5": "16MnCr5", "DIN 16MnCr5": "16MnCr5", "NF 16MC5": "16MnCr5", "CSN 14220": "16MnCr5",
        "EN 20MnCr5": "20MnCr5", "DIN 20MnCr5": "20MnCr5", "NF 20MC5": "20MnCr5",
    }
    steel_database = steel_database.copy()
    steel_database["grade"] = steel_database["Material"].map(equivalent_grades).fillna(steel_database["Material"])

    consolidated_steels = (steel_database
        .groupby(["grade", "treatment", "Heat treatment"], as_index=False)
        .agg(core_tensile_MPa=("Su", "mean"), core_yield_MPa=("Sy", "mean"), core_elongation_pct=("A5", "mean"),
             surface_hardness_HV=("hardness_HV", "mean"), density=("Ro", "mean"),
             sources=("Material", " / ".join), source_count=("Material", "count")))

    merged = consolidated_steels[consolidated_steels["source_count"] > 1]
    print(f"Steels before consolidation: {len(steel_database)}  ->  after: {len(consolidated_steels)}")
    print()
    print("Merged grades (surface-treated):")
    print(merged[merged["treatment"] != "through"][["grade", "sources", "core_tensile_MPa", "core_yield_MPa",
          "core_elongation_pct", "surface_hardness_HV"]].to_string(index=False, float_format=lambda x: f"{x:.0f}"))
    ```

## Selection funnel

The four requirements applied in order as elimination filters, with the list of the steels rejected by F3 and F4.

**Inputs:** `consolidated_steels` and the requirements.

**Outputs:** `filtered_steels` and the funnel chart.

!!! python "Selection funnel"
    ```python
    # ============================================================
    # ELIMINATION FILTERS (funnel)
    #   F1  surface HV >= 653        (E1)
    #   F2  core A5 >= 5 %           (E4)
    #   F3  core Re >= 2 s tau(delta) (E2)
    #   F4  core Rm >= 850 MPa       (E3)
    # ============================================================
    funnel_steps = [("Full database", len(materials_database)),
                    ("Steels (consolidated)", len(consolidated_steels))]

    filtered_steels = consolidated_steels[consolidated_steels["surface_hardness_HV"] >= required_surface_hardness_HV].copy()
    funnel_steps.append(("F1  surface >= 653 HV", len(filtered_steels)))

    filtered_steels = filtered_steels[filtered_steels["core_elongation_pct"] >= required_core_elongation_pct]
    funnel_steps.append(("F2  core A5 >= 5 %", len(filtered_steels)))

    filtered_steels["case_depth_mm"] = filtered_steels["treatment"].map(typical_case_depth_mm)
    filtered_steels["required_core_yield_MPa"] = filtered_steels["case_depth_mm"].apply(required_core_yield)
    rejected_by_core = filtered_steels[filtered_steels["core_yield_MPa"] < filtered_steels["required_core_yield_MPa"]]
    filtered_steels = filtered_steels[filtered_steels["core_yield_MPa"] >= filtered_steels["required_core_yield_MPa"]]
    funnel_steps.append(("F3  core under the case", len(filtered_steels)))

    rejected_by_core_hardness = filtered_steels[filtered_steels["core_tensile_MPa"] < required_core_tensile_MPa]
    filtered_steels = filtered_steels[filtered_steels["core_tensile_MPa"] >= required_core_tensile_MPa]
    funnel_steps.append(("F4  core >= 25 HRC", len(filtered_steels)))

    for step_name, count in funnel_steps:
        print(f"{step_name:<26} : {count}")
    print()
    print("Rejected by F3 (case too thin for their core):")
    print(rejected_by_core[["sources", "treatment", "case_depth_mm", "core_yield_MPa", "required_core_yield_MPa"]]
          .to_string(index=False, float_format=lambda x: f"{x:.1f}"))
    print()
    print("Rejected by F4 (core too soft):")
    print(rejected_by_core_hardness[["sources", "treatment", "core_tensile_MPa"]]
          .to_string(index=False, float_format=lambda x: f"{x:.0f}"))

    figure, axis = plt.subplots(figsize=(9, 4))
    step_names  = [name for name, _ in funnel_steps][::-1]
    step_counts = [count for _, count in funnel_steps][::-1]
    axis.barh(step_names, step_counts, color="#1565C0")
    for position, count in enumerate(step_counts):
        axis.text(count * 1.15, position, str(count), va="center")
    axis.set_xscale("log")
    axis.set_xlabel("Number of candidates (log scale)")
    axis.set_title("Selection funnel, cycloidal disc", fontweight="bold")
    plt.tight_layout()
    plt.savefig("ashby_disc_funnel.png", dpi=150, bbox_inches="tight")
    plt.show()
    ```

## Weighted score

Each criterion is scaled between 0 for the worst candidate and 1 for the best, then weighted. The cost index is read from the alloy family in the name of the grade.

**Inputs:** `filtered_steels`.

**Outputs:** `ranked_steels`.

!!! python "Weighted score"
    ```python
    # ============================================================
    # WEIGHTED SCORE (weighted property method, Ashby)
    # Cost index estimated from the alloy family; nitriding adds a long cycle.
    # ============================================================
    def alloy_family(sources):
        designation = sources.split(" / ")[0]
        designation = re.sub(r"^(EN|DIN|NF|BS|CSN|ISO)\s+", "", designation)
        if re.search(r"Ni|NC|^16\d{3}$", designation):                      return "Ni-Cr(-Mo)", 2.0
        if re.search(r"MnCr|MC\d|^14\d{3}$", designation):                  return "Mn-Cr", 1.3
        if re.search(r"CD|CAD|CrV|CrMo|^15\d{3}$|M39|M24", designation):    return "Cr-Mo(-V)", 1.6
        return "Carbon", 1.0

    filtered_steels[["alloy_family", "relative_cost"]] = filtered_steels["sources"].apply(lambda s: pd.Series(alloy_family(s)))
    filtered_steels["relative_cost"] += np.where(filtered_steels["treatment"] == "nitriding", 0.3, 0.0)

    def normalize(values):
        """Linear scaling between 0 (worst candidate) and 1 (best candidate)."""
        value_range = values.max() - values.min()
        if value_range == 0:
            return pd.Series(np.zeros(len(values)), index=values.index)
        return (values - values.min()) / value_range

    criteria_weights = {"hardness": 0.20, "core_strength": 0.20, "toughness": 0.20, "cost": 0.25, "case_depth": 0.15}

    def compute_scores(candidates, weights):
        normalized = pd.DataFrame(index=candidates.index)
        normalized["hardness"]      = normalize(candidates["surface_hardness_HV"])
        normalized["core_strength"] = normalize(candidates["core_yield_MPa"])
        normalized["toughness"]     = normalize(candidates["core_elongation_pct"])
        normalized["cost"]          = normalize(1 / candidates["relative_cost"])
        normalized["case_depth"]    = normalize(candidates["case_depth_mm"])
        weighted = normalized * pd.Series(weights)
        return weighted, weighted.sum(axis=1)

    weighted_scores, filtered_steels["score"] = compute_scores(filtered_steels, criteria_weights)
    ranked_steels = filtered_steels.sort_values("score", ascending=False)

    print("=== RANKING OF THE ADMISSIBLE CANDIDATES ===")
    print(ranked_steels[["sources", "treatment", "alloy_family", "surface_hardness_HV", "core_yield_MPa",
                         "core_elongation_pct", "relative_cost", "case_depth_mm", "score"]]
          .to_string(index=False, float_format=lambda x: f"{x:.2f}"))
    ```

## Sensitivity to the weights

Each weight is moved by ±10 points in turn, the others are rescaled to keep a total of 100 %, and the winner is computed again.

**Inputs:** `filtered_steels`, `criteria_weights`.

**Outputs:** winner of each of the ten variants.

!!! python "Sensitivity to the weights"
    ```python
    # ============================================================
    # SENSITIVITY TO THE WEIGHTS: each weight moved by +/- 10 points,
    # the others rescaled so that the total stays 100 %
    # ============================================================
    winner_count = Counter()
    for criterion in criteria_weights:
        for delta in [-0.10, +0.10]:
            varied_weights = dict(criteria_weights)
            varied_weights[criterion] = max(0.0, varied_weights[criterion] + delta)
            total_weight = sum(varied_weights.values())
            varied_weights = {key: value / total_weight for key, value in varied_weights.items()}
            _, varied_scores = compute_scores(filtered_steels, varied_weights)
            winner = filtered_steels.loc[varied_scores.idxmax(), "grade"]
            winner_count[winner] += 1
            print(f"{criterion:<14} {delta:+.2f} -> winner: {winner}")
    print()
    print("Winners over the 10 variants:", dict(winner_count))
    ```

## Ranking chart

Stacked bars of the weighted criteria, so that each score can be read as its five contributions.

**Inputs:** `ranked_steels`, `weighted_scores`.

**Outputs:** the ranking chart.

!!! python "Ranking chart"
    ```python
    # ============================================================
    # STACKED BAR CHART OF THE WEIGHTED SCORES
    # ============================================================
    figure, axis = plt.subplots(figsize=(12, 5.5))
    labels = [f"{row['grade']}  ({row['treatment']})" for _, row in ranked_steels.iterrows()]
    criterion_colors = {"hardness": "#43A047", "core_strength": "#1565C0", "toughness": "#7B1FA2",
                        "cost": "#FB8C00", "case_depth": "#E53935"}
    criterion_labels = {"hardness": "Hardness 20 %", "core_strength": "Core Re 20 %", "toughness": "Core A5 20 %",
                        "cost": "Cost 25 %", "case_depth": "Case depth 15 %"}
    ordered_weighted = weighted_scores.loc[ranked_steels.index]
    left_position = np.zeros(len(ranked_steels))
    for criterion, color in criterion_colors.items():
        axis.barh(labels, ordered_weighted[criterion], left=left_position, color=color, label=criterion_labels[criterion])
        left_position += ordered_weighted[criterion].values
    for position, score in enumerate(ranked_steels["score"]):
        axis.text(score + 0.01, position, f"{score:.3f}", va="center")
    axis.invert_yaxis()
    axis.set_xlim(0, 1)
    axis.set_xlabel("Weighted score (0 to 1)")
    axis.set_title("Weighted ranking, cycloidal disc", fontweight="bold")
    axis.legend(loc="lower right", fontsize=8.5)
    plt.tight_layout()
    plt.savefig("ashby_disc_ranking.png", dpi=150, bbox_inches="tight")
    plt.show()
    ```

## Selected material

Prints the selected steel next to the requirements it meets, and the properties used in the sizing notebook.

**Inputs:** `ranked_steels`, `winner_count`.

**Outputs:** summary of 16MnCr5, case-hardened.

!!! python "Selected material"
    ```python
    # ============================================================
    # SELECTED MATERIAL
    # ============================================================
    selected_steel = ranked_steels.iloc[0]
    runner_up      = ranked_steels.iloc[1]
    print("=" * 70)
    print("SELECTED MATERIAL, CYCLOIDAL DISC")
    print("=" * 70)
    print(f" {selected_steel['grade']}, {selected_steel['Heat treatment']}  (sources: {selected_steel['sources']})")
    print(f"  Surface   : {selected_steel['surface_hardness_HV']:.0f} HV >= {required_surface_hardness_HV:.0f} HV required")
    print(f"  Core      : Rm = {selected_steel['core_tensile_MPa']:.0f} MPa | Re = {selected_steel['core_yield_MPa']:.0f} MPa "
          f"| A5 = {selected_steel['core_elongation_pct']:.1f} %")
    print(f"  Case      : delta = {selected_steel['case_depth_mm']} mm (core Re required {selected_steel['required_core_yield_MPa']:.0f} MPa)")
    print(f"  Score     : {selected_steel['score']:.3f}  |  second: {runner_up['grade']} ({runner_up['score']:.3f})")
    print(f"  Robustness: winner in {winner_count[selected_steel['grade']]} weight variants out of 10")
    print()
    print(" Properties used in the sizing notebook (DISC_STEEL):")
    print(f"  E = 210 000 MPa | nu = 0.30 | database density = {selected_steel['density']:.0f} kg/m³")
    print(f"  core yield = {selected_steel['core_yield_MPa']:.0f} MPa | admissible Hertz pressure = 2000 MPa (case-hardened surface)")
    ```
