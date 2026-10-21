---
template: Cycloidal_Gearbox/Implementation.html
---

# Optimization

The optimization loop of the Design Optimization section. `evaluate_stage` runs every previous check on one stage, `objective_two_stages` adds the two stages and the global constraints, and the solver searches the 14 design variables. The last cell evaluates a configuration entered by hand with the same functions.

---

## Stage evaluation

All the checks of one stage, in the order of the Theory: profile, contacts, shaft, radial budget, bearings and mass. Each violated limit adds a penalty, squared and weighted as in the Design Optimization section: $10^7$ for a design that does not exist, $10^6$ for the hard constraints, $10^5$ for the roller life and $10^2$ for the film.

**Inputs:** geometry of the stage, its torque and input speed, and the roller bearing data.

**Outputs:** penalty, disc mass (kg) and a dictionary of results for the report.

!!! python "Stage evaluation"
    ```python
    # ============================================================
    # STAGE EVALUATION: returns (penalty, disc_mass_kg, info)
    # Order of the checks: profile, contacts, shaft, radial budget, bearings, mass.
    # ============================================================
    def evaluate_stage(disc_width, eccentricity, roller_pitch_diameter, roller_diameter,
                       pin_pitch_diameter, pin_diameter, num_lobes, num_pins,
                       stage_torque, stage_input_speed,
                       roller_width, roller_dynamic_capacity, roller_static_capacity):
        penalty = 0.0
        info = {}

        num_rollers = num_lobes + 1
        roller_pitch_radius = roller_pitch_diameter / 2.0
        roller_radius = roller_diameter / 2.0
        pin_pitch_radius = pin_pitch_diameter / 2.0
        pin_bore_radius = pin_diameter/2.0 + eccentricity        # Qi et al. eq. 1
        K1 = eccentricity * num_rollers / roller_pitch_radius
        info["K1"] = K1

        # Stacked roller bearings: contact length = number stacked x bearing width
        stack_count = rollers_stack_count(disc_width, roller_width)
        roller_contact_length = min(disc_width, stack_count * roller_width)
        info["roller_stack_count"] = stack_count
        info["roller_contact_length"] = roller_contact_length

        # --- PROFILE: curtate coefficient in [0.50, 0.85] ---
        if K1 > 0.85:
            penalty += ((K1 - 0.85) / 0.85)**2 * 1e6
        if K1 < 0.50:
            penalty += ((0.50 - K1) / 0.50)**2 * 1e6

        # --- PROFILE: undercut, roller_radius <= margin x rho_min ---
        center_curve_radius = min_center_curve_radius(roller_pitch_radius, eccentricity, num_rollers)
        max_roller_radius = UNDERCUT_MARGIN * center_curve_radius
        info["undercut_min_radius"] = center_curve_radius
        if roller_radius > max_roller_radius:
            penalty += ((roller_radius - max_roller_radius) / max(max_roller_radius, 1e-3))**2 * 1e6

        # --- PROFILE: ligament between neighbouring pin bores ---
        if num_pins >= 3:
            ligament = 2 * pin_pitch_radius * np.sin(np.pi / num_pins) - 2 * pin_bore_radius
            info["pin_ligament"] = ligament
            if ligament < GEOM_MARGIN_MM:
                penalty += ((GEOM_MARGIN_MM - ligament) / GEOM_MARGIN_MM)**2 * 1e6

        # --- PROFILE: curvature in the hollow and on the lobe shoulder ---
        curvature = profile_curvature_extremes(roller_pitch_diameter, roller_diameter, eccentricity, num_lobes)
        if curvature is None:
            penalty += 1e7      # degenerate geometry
            return penalty, 1e3, info
        hollow_radius, shoulder_radius = curvature
        info["profile_radius_hollow"] = hollow_radius
        info["profile_radius_shoulder"] = shoulder_radius

        # --- CONTACTS: loads and equivalent radii ---
        roller_load = roller_force(stage_torque, roller_pitch_diameter, num_lobes)
        pin_load = pin_force(stage_torque, pin_pitch_diameter, num_pins)
        roller_radius_shoulder = equivalent_radius_roller_disc(roller_radius, shoulder_radius)
        roller_radius_hollow   = equivalent_radius_roller_disc(roller_radius, hollow_radius)
        pin_equivalent_radius  = equivalent_radius_pin_bore(pin_diameter, eccentricity)
        info["roller_load_nominal"] = roller_load
        info["pin_load"] = pin_load

        # --- CONTACTS: Hertz pressure (worst case of the rollers: lobe shoulder) ---
        pressure_roller = hertz_pressure(roller_load, roller_radius_shoulder, roller_contact_length, E_STAR_ROLLER_DISC)
        pressure_pin    = hertz_pressure(pin_load, pin_equivalent_radius, disc_width, E_STAR_PIN_BORE)
        info["hertz_roller"] = pressure_roller
        info["hertz_roller_hollow"] = hertz_pressure(roller_load, roller_radius_hollow, roller_contact_length, E_STAR_ROLLER_DISC)
        info["hertz_pin"] = pressure_pin
        if pressure_roller > HERTZ_ALLOW_ROLLER_DISC:
            penalty += ((pressure_roller / HERTZ_ALLOW_ROLLER_DISC) - 1)**2 * 1e6
        if pressure_pin > HERTZ_ALLOW_PIN_BORE:
            penalty += ((pressure_pin / HERTZ_ALLOW_PIN_BORE) - 1)**2 * 1e6

        # --- CONTACTS: lubricant film (soft constraint) ---
        profile_perimeter = profile_length(roller_pitch_diameter, roller_diameter, eccentricity, num_lobes)
        roller_speed = roller_entrainment_speed(profile_perimeter, num_lobes, stage_input_speed)
        pin_speed = pin_entrainment_speed(pin_diameter, eccentricity, num_lobes, stage_input_speed)
        roller_film_um, roller_film = film_ratio(roller_load, roller_radius_shoulder, roller_contact_length,
                                                 roller_speed, E_PRIME_ROLLER_DISC)
        pin_film_um, pin_film = film_ratio(pin_load, pin_equivalent_radius, disc_width, pin_speed, E_PRIME_PIN_BORE)
        info["roller_speed"] = roller_speed
        info["pin_speed"] = pin_speed
        info["film_roller_um"] = roller_film_um
        info["film_pin_um"] = pin_film_um
        info["film_roller"] = roller_film
        info["film_pin"] = pin_film
        if roller_film < MIN_FILM_RATIO:
            penalty += ((MIN_FILM_RATIO - roller_film) / MIN_FILM_RATIO)**2 * 1e2
        if pin_film < MIN_FILM_RATIO:
            penalty += ((MIN_FILM_RATIO - pin_film) / MIN_FILM_RATIO)**2 * 1e2

        # --- SHAFT: Von Mises minimum diameter, then catalogue eccentric bearing ---
        shaft_diameter = min_shaft_diameter(stage_torque, eccentricity, num_lobes)
        info["shaft_min_diameter"] = shaft_diameter
        eccentric_bearing = select_eccentric_bearing(shaft_diameter, disc_width)
        if eccentric_bearing is None:
            penalty += 1e7
            info["eccentric_bearing"] = None
            return penalty, 1e3, info
        ecc_bore, ecc_outer, ecc_width, ecc_capacity, ecc_life_exponent = eccentric_bearing
        info["eccentric_bearing"] = (ecc_bore, ecc_outer, ecc_width, ecc_capacity)
        central_bore_diameter = ecc_outer     # the disc houses the outer ring of the bearing

        # --- RADIAL BUDGET: pin bores clear of the eccentric bearing ---
        overlap_pins = (central_bore_diameter/2.0 + GEOM_MARGIN_MM) - (pin_pitch_radius - pin_bore_radius)
        info["clearance_bearing_pins"] = -overlap_pins
        if overlap_pins > 0:
            penalty += (overlap_pins / max(pin_pitch_radius, 1.0))**2 * 1e6

        # --- RADIAL BUDGET: pin bores inside the profile root ---
        profile_root_radius = roller_pitch_radius - eccentricity - roller_radius
        overlap_profile = (pin_pitch_radius + pin_bore_radius + GEOM_MARGIN_MM) - profile_root_radius
        info["clearance_pins_profile"] = -overlap_profile
        if overlap_profile > 0:
            penalty += (overlap_profile / max(profile_root_radius, 1.0))**2 * 1e6

        # --- BEARINGS: eccentric bearing life (ISO 281) ---
        eccentric_load = eccentric_bearing_force(stage_torque, eccentricity, num_lobes)
        eccentric_speed = eccentric_bearing_speed(stage_input_speed, num_lobes)
        eccentric_life = bearing_life_hours(ecc_capacity, eccentric_load, eccentric_speed, life_exponent=ecc_life_exponent)
        info["eccentric_load"] = eccentric_load
        info["eccentric_life_hours"] = eccentric_life
        if eccentric_life < MIN_BEARING_LIFE_H:
            penalty += ((MIN_BEARING_LIFE_H - eccentric_life) / MIN_BEARING_LIFE_H)**2 * 1e7

        # --- BEARINGS: roller bearings, static capacity and life ---
        ring_speed = roller_ring_speed(roller_speed, roller_diameter)
        static_ok, life_ok, roller_life_h, peak_load, effective_C0 = check_roller_bearing(
            roller_load, roller_dynamic_capacity, roller_static_capacity, ring_speed, stack_count)
        info["roller_ring_speed_rpm"] = ring_speed * 60 / (2*np.pi)
        info["roller_load_peak"] = peak_load
        info["roller_effective_C0"] = effective_C0
        info["roller_life_hours"] = roller_life_h
        if not static_ok:
            penalty += ((peak_load / max(effective_C0 / ROLLER_STATIC_SAFETY, 1e-9)) - 1)**2 * 1e6
        if CHECK_ROLLER_LIFE and not life_ok:
            penalty += ((MIN_BEARING_LIFE_H - roller_life_h) / MIN_BEARING_LIFE_H)**2 * 1e5

        # --- MASS of the disc ---
        mass = disc_mass(roller_pitch_diameter, roller_diameter, pin_pitch_diameter, pin_diameter,
                         eccentricity, num_pins, disc_width, central_bore_diameter)
        info["disc_mass_kg"] = mass
        return penalty, mass, info
    ```

## Design vector and objective

`DESIGN` gives a name to each of the 14 positions of the vector. The ratio of each stage is its number of lobes, so stage 1 carries $T / z_{c,2}$ and stage 2 turns at $\omega_{\text{in}} / z_{c,1}$. The objective is the mass of the two discs in grams, plus the penalties of both stages and of the three shared constraints: ratio, axial budget and radial envelope.

**Inputs:** a design vector of 14 values.

**Outputs:** score: mass (g) + penalties.

!!! python "Design vector and objective"
    ```python
    # ============================================================
    # DESIGN VECTOR: 14 variables
    # Index 11 is the POSITION of the roller bearing in its catalogue (integer).
    # ============================================================
    DESIGN = {
        "num_lobes_1":        0,
        "num_pins_1":         1,
        "num_lobes_2":        2,
        "num_pins_2":         3,
        "eccentricity_1":     4,
        "pin_pitch_diam_1":   5,
        "pin_diam_1":         6,
        "eccentricity_2":     7,
        "pin_pitch_diam_2":   8,
        "pin_diam_2":         9,
        "roller_pitch_diam": 10,
        "roller_index":      11,
        "disc_width_1":      12,
        "disc_width_2":      13,
    }

    def decode_design(x):
        """Named values of a design vector: integers rounded, roller read from the catalogue."""
        design = {name: x[position] for name, position in DESIGN.items()}
        for name in ("num_lobes_1", "num_pins_1", "num_lobes_2", "num_pins_2"):
            design[name] = int(np.round(design[name]))
        reference, _bore, outer, width, dynamic_capacity, static_capacity = get_roller_bearing(design["roller_index"])
        design.update(roller_reference=reference, roller_diameter=outer, roller_width=width,
                      roller_C=dynamic_capacity, roller_C0=static_capacity)
        return design

    def stage_operating_points(num_lobes_1, num_lobes_2):
        """Torque and input speed of each stage. The ratio of a stage is its number of lobes."""
        stage_2_torque = OUTPUT_TORQUE_NMM
        stage_1_torque = stage_2_torque / num_lobes_2
        stage_1_speed  = INPUT_SPEED_RAD_S
        stage_2_speed  = stage_1_speed / num_lobes_1
        return stage_1_torque, stage_2_torque, stage_1_speed, stage_2_speed

    def evaluate_design(x):
        """Evaluates both stages, with the same roller and roller pitch diameter.
           Returns (design, results of stage 1, results of stage 2)."""
        design = decode_design(x)
        stage_1_torque, stage_2_torque, stage_1_speed, stage_2_speed = stage_operating_points(
            design["num_lobes_1"], design["num_lobes_2"])
        results = []
        for stage, torque, speed in ((1, stage_1_torque, stage_1_speed), (2, stage_2_torque, stage_2_speed)):
            results.append(evaluate_stage(
                design[f"disc_width_{stage}"], design[f"eccentricity_{stage}"],
                design["roller_pitch_diam"], design["roller_diameter"],
                design[f"pin_pitch_diam_{stage}"], design[f"pin_diam_{stage}"],
                design[f"num_lobes_{stage}"], design[f"num_pins_{stage}"],
                torque, speed,
                design["roller_width"], design["roller_C"], design["roller_C0"]))
        return design, results[0], results[1]

    def global_penalties(design):
        """Constraints shared by the two stages: ratio, axial budget, radial envelope."""
        total_ratio = design["num_lobes_1"] * design["num_lobes_2"]
        ratio_penalty = ((total_ratio - TARGET_RATIO) / TARGET_RATIO)**2 * 1e6

        axial_used = design["disc_width_1"] + design["disc_width_2"] + FLANGE_THICKNESS_MM
        axial_penalty = 0.0
        if axial_used > AXIAL_BUDGET_MM:
            axial_penalty = ((axial_used - AXIAL_BUDGET_MM) / AXIAL_BUDGET_MM)**2 * 1e6

        radial_used = design["roller_pitch_diam"] + design["roller_diameter"] + 2*GEOM_MARGIN_MM
        radial_penalty = 0.0
        if radial_used > MAX_OUTER_DIAMETER_MM:
            radial_penalty = ((radial_used - MAX_OUTER_DIAMETER_MM) / MAX_OUTER_DIAMETER_MM)**2 * 1e6
        return ratio_penalty + axial_penalty + radial_penalty

    def objective_two_stages(x):
        """Total mass of the two discs (g) + penalties."""
        design, (penalty_1, mass_1, _), (penalty_2, mass_2, _) = evaluate_design(x)
        total_mass_grams = (mass_1 + mass_2) * 1000.0
        return total_mass_grams + penalty_1 + penalty_2 + global_penalties(design)

    # Lobe pairs compatible with the target ratio (display only)
    valid_lobe_pairs = [(lobes_1, lobes_2, lobes_1 * lobes_2)
                        for lobes_1 in range(5, 12) for lobes_2 in range(5, 12)
                        if abs(lobes_1 * lobes_2 - TARGET_RATIO) <= 5]
    print("Lobe pairs close to the target ratio:", valid_lobe_pairs)
    ```

## Differential evolution and refinement

Differential evolution (SciPy, strategy `best1bin`) on the 14 variables, five of them integers. When it stops, the integers are frozen and SLSQP refines the nine continuous variables. The refined solution is kept only if it scores better.

**Inputs:** `objective_two_stages`, `design_bounds`.

**Outputs:** `best_vector`.

!!! python "Differential evolution and refinement"
    ```python
    # ============================================================
    # BOUNDS OF THE DESIGN VECTOR
    # ============================================================
    design_bounds = [
        ( 5, 11),      # num_lobes_1
        ( 6, 14),      # num_pins_1
        ( 5, 11),      # num_lobes_2
        ( 6, 14),      # num_pins_2
        (1.0,  6.0),   # eccentricity_1   (mm)
        (15.0, 70.0),  # pin_pitch_diam_1 (mm)
        (4.0,  10.0),  # pin_diam_1       (mm)
        (1.0,  6.0),   # eccentricity_2   (mm)
        (15.0, 70.0),  # pin_pitch_diam_2 (mm)
        (4.0,  10.0),  # pin_diam_2       (mm)
        (50.0, 110.0), # roller_pitch_diam (mm)
        (0, len(ROLLER_BEARINGS) - 1),  # roller_index (integer)
        (3.0,  22.0),  # disc_width_1     (mm)
        (3.0,  22.0),  # disc_width_2     (mm)
    ]
    INTEGER_POSITIONS    = [DESIGN["num_lobes_1"], DESIGN["num_pins_1"], DESIGN["num_lobes_2"],
                            DESIGN["num_pins_2"], DESIGN["roller_index"]]
    CONTINUOUS_POSITIONS = [position for position in range(len(DESIGN)) if position not in INTEGER_POSITIONS]
    integer_flags = [position in INTEGER_POSITIONS for position in range(len(DESIGN))]

    # ============================================================
    # PHASE 1: DIFFERENTIAL EVOLUTION (whole domain)
    # ============================================================
    print("=" * 60)
    print(" DIFFERENTIAL EVOLUTION, TWO STAGES")
    print("=" * 60)
    de_result = differential_evolution(
        objective_two_stages,
        design_bounds,
        integrality=integer_flags,
        strategy="best1bin",
        maxiter=500,
        popsize=30,
        mutation=(0.5, 1.5),
        recombination=0.9,
        tol=1e-8,
        seed=7,
        disp=True,
        polish=False,
        workers=1,
    )
    print("\nDifferential evolution score:", round(de_result.fun, 4))
    print("Converged before the generation limit:", de_result.success)

    # ============================================================
    # PHASE 1 (end): SLSQP REFINEMENT, integers frozen
    # ============================================================
    frozen_vector = de_result.x.copy()
    frozen_vector[INTEGER_POSITIONS] = np.round(frozen_vector[INTEGER_POSITIONS])

    def continuous_objective(continuous_part):
        full_vector = frozen_vector.copy()
        full_vector[CONTINUOUS_POSITIONS] = continuous_part
        return objective_two_stages(full_vector)

    slsqp_result = minimize(
        continuous_objective, frozen_vector[CONTINUOUS_POSITIONS], method="SLSQP",
        bounds=[design_bounds[position] for position in CONTINUOUS_POSITIONS],
        options={"ftol": 1e-10, "maxiter": 500, "disp": True})

    refined_vector = frozen_vector.copy()
    refined_vector[CONTINUOUS_POSITIONS] = slsqp_result.x

    # Final check: the refinement is kept only if it improves the score
    de_score = objective_two_stages(frozen_vector)
    slsqp_score = objective_two_stages(refined_vector)
    if slsqp_score < de_score:
        best_vector = refined_vector
    else:
        best_vector = frozen_vector
        print("(SLSQP refinement discarded: the differential evolution solution was better)")
    print("\nBest score:", round(min(de_score, slsqp_score), 4), "g")
    ```

## Report

Evaluates a design vector again with the same functions and prints every result next to its limit.

**Inputs:** a design vector and a title.

**Outputs:** printed report.

!!! python "Report"
    ```python
    # ============================================================
    # DETAILED REPORT OF A DESIGN VECTOR
    # ============================================================
    def print_report(x, title="OPTIMAL CONFIGURATION"):
        design, (penalty_1, mass_1, info_1), (penalty_2, mass_2, info_2) = evaluate_design(x)
        stage_1_torque, stage_2_torque, stage_1_speed, stage_2_speed = stage_operating_points(
            design["num_lobes_1"], design["num_lobes_2"])
        output_speed_rpm = stage_2_speed / design["num_lobes_2"] * 60 / (2*np.pi)

        print("=" * 66)
        print(" " + title + ": TWO-STAGE CYCLOIDAL REDUCER")
        print("=" * 66)
        print("Ratio           :", design["num_lobes_1"], "x", design["num_lobes_2"], "=",
              design["num_lobes_1"] * design["num_lobes_2"], "(target", TARGET_RATIO, ")")
        print("Output speed    :", round(output_speed_rpm, 1), "rpm")
        print("Roller          :", design["roller_reference"], "| Ø", design["roller_diameter"], "mm | width",
              design["roller_width"], "mm | C", design["roller_C"], "N | C0", design["roller_C0"], "N")
        print("Roller pitch Ø  :", round(design["roller_pitch_diam"], 2), "mm")
        print("Radial envelope :", round(design["roller_pitch_diam"] + design["roller_diameter"], 1), "/",
              MAX_OUTER_DIAMETER_MM, "mm")
        print("Axial budget    :", round(design["disc_width_1"] + design["disc_width_2"] + FLANGE_THICKNESS_MM, 1),
              "/", AXIAL_BUDGET_MM, "mm")

        for stage, info, torque in ((1, info_1, stage_1_torque), (2, info_2, stage_2_torque)):
            lobes = design[f"num_lobes_{stage}"]
            print(f"\n-- STAGE {stage} (T = {torque/1000:.1f} N.m) --")
            print("  lobes / rollers / pins       :", lobes, "/", lobes + 1, "/", design[f"num_pins_{stage}"])
            print("  eccentricity                 :", round(design[f"eccentricity_{stage}"], 3), "mm | pin pitch Ø",
                  round(design[f"pin_pitch_diam_{stage}"], 2), "mm | pin Ø", round(design[f"pin_diam_{stage}"], 2), "mm")
            print("  K1                           :", round(info.get("K1", 0), 3))
            print("  profile radius hollow/shoulder:", round(info.get("profile_radius_hollow", 0), 2), "/",
                  round(info.get("profile_radius_shoulder", 0), 2), "mm")
            print("  Hertz roller hollow/shoulder :", round(info.get("hertz_roller_hollow", 0)), "/",
                  round(info.get("hertz_roller", 0)), "MPa (adm", HERTZ_ALLOW_ROLLER_DISC, ")")
            print("  Hertz pin                    :", round(info.get("hertz_pin", 0), 1), "MPa (adm", HERTZ_ALLOW_PIN_BORE, ")")
            print("  film lambda roller / pin     :", round(info.get("film_roller", 0), 2), "/",
                  round(info.get("film_pin", 0), 2), "(min", MIN_FILM_RATIO, ")")
            print("  shaft minimum diameter       :", round(info.get("shaft_min_diameter", 0), 2), "mm")
            print("  eccentric bearing (d,D,B,C)  :", info.get("eccentric_bearing"), "| life",
                  round(info.get("eccentric_life_hours", 0)), "h (min", MIN_BEARING_LIFE_H, ")")
            roller_ok = info.get("roller_load_peak", 0) <= info.get("roller_effective_C0", 1e9) / ROLLER_STATIC_SAFETY
            print("  roller bearings              : stacked", info.get("roller_stack_count"), "| F nominal / peak",
                  round(info.get("roller_load_nominal", 0)), "/", round(info.get("roller_load_peak", 0)), "N")
            print("    C0 effective / admissible  :", round(info.get("roller_effective_C0", 0)), "/",
                  round(info.get("roller_effective_C0", 0) / ROLLER_STATIC_SAFETY), "N",
                  "[OK]" if roller_ok else "[OVERLOAD]")
            print("    ring speed / roller life   :", round(info.get("roller_ring_speed_rpm", 0)), "rpm /",
                  round(info.get("roller_life_hours", 0)), "h")
            print("  clearance bearing/pins, pins/profile:", round(info.get("clearance_bearing_pins", 0), 2), "/",
                  round(info.get("clearance_pins_profile", 0), 2), "mm")
            print("  disc mass                    :", round(info.get("disc_mass_kg", 0) * 1000, 2), "g")

        print("\n-- SUMMARY --")
        print("  mass of the two discs (steel):", round((mass_1 + mass_2) * 1000, 2), "g")
        print("  housing mass (aluminium, indicative):", round(housing_mass_estimate() * 1000), "g")
        print("  penalties stage 1 / stage 2 / global:", round(penalty_1, 2), "/", round(penalty_2, 2), "/",
              round(global_penalties(design), 2))
        if penalty_1 + penalty_2 + global_penalties(design) < 100:
            print("  -> admissible: only soft constraints (film) can remain slightly violated")
        else:
            print("  -> constraints violated: increase maxiter or adjust the bounds")

    print_report(best_vector)
    ```

## Manual check

The retained design: the optimizer output adjusted to a machinable eccentricity,  pins and a roller pitch diameter of 118 mm, checked again with the same functions.

**Inputs:** `manual_config`.

**Outputs:** printed report of the retained design.

!!! python "Manual check"
    ```python
    # ============================================================
    # MANUAL CHECK OF A CONFIGURATION
    # Fill in the values below, then run the cell.
    # (num_* are integers, the other values are in mm)
    # ============================================================
    manual_config = {
        "num_lobes_1":       10,
        "num_pins_1":        10,
        "num_lobes_2":       10,
        "num_pins_2":        12,
        "eccentricity_1":    3.0,
        "pin_pitch_diam_1":  52.0,
        "pin_diam_1":        6.0,     # Pin Ø6
        "eccentricity_2":    3.5,
        "pin_pitch_diam_2":  64.0,
        "pin_diam_2":        4.0,     # Pin Ø4
        "roller_pitch_diam": 118.0,
        "roller_index":      33,      # 61903, Ø30
        "disc_width_1":      10.0,
        "disc_width_2":      14.0,
    }

    # Builds the vector in the order of DESIGN, then evaluates it with the same functions
    manual_vector = np.zeros(len(DESIGN))
    for name, position in DESIGN.items():
        manual_vector[position] = manual_config[name]

    print_report(manual_vector, title="MANUAL CONFIGURATION")
    ```
