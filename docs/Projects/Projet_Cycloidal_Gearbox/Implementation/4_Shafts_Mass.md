---
template: Cycloidal_Gearbox/Implementation.html
---

# Shafts & Mass

The Von Mises check of the eccentric shafts, as in the Shaft Design section, and the mass of the discs, which is the objective of the optimization.

---

## Minimum shaft diameter

The eccentric sits in the middle of the 30 mm span, the worst case, so $M_f = FL/4$ with $F = T/(z_c e)$. The torque of the shaft is $M_t = T/z_c$, and the two are combined in $M_{eq} = \sqrt{M_f^2 + 0{,}75 M_t^2}$ with $\sigma_{\text{adm}} = R_e / s$ .

**Inputs:** stage torque (N·mm), eccentricity (mm), number of lobes.

**Outputs:** $d_{\min}$ (mm).

!!! python "Minimum shaft diameter"
    ```python
    # ============================================================
    # VON MISES: minimum diameter of the eccentric shaft
    #   Worst case: the eccentric in the middle of the span, M_f = F L / 4
    # ============================================================
    SHAFT_SPAN_MM = 30.0   # distance between the two shaft bearings

    def min_shaft_diameter(stage_torque, eccentricity, num_lobes):
        """Minimum shaft diameter (mm) under combined bending and torsion."""
        if eccentricity <= 0:
            return 1e6
        eccentric_force   = stage_torque / (num_lobes * eccentricity)     # F = T / (z_c e)
        bending_moment    = eccentric_force * SHAFT_SPAN_MM / 4            # M_f = F L / 4
        torsion_moment    = stage_torque / num_lobes                       # M_t = T / z_c
        equivalent_moment = np.sqrt(bending_moment**2 + 0.75 * torsion_moment**2)
        allowable_stress  = SHAFT_STEEL["yield_MPa"] / SAFETY_FACTOR
        return (32 * equivalent_moment / (np.pi * allowable_stress)) ** (1/3)

    print("Minimum shaft diameter: stage 1", round(min_shaft_diameter(25000, 3.0, 10), 2),
          "mm | stage 2", round(min_shaft_diameter(250000, 3.5, 10), 2), "mm")
    ```

## Masses

The disc is approximated as a plain disc up to the root of the profile, minus the central bore and the pin bores, as stated in the limits of the Design Optimization section. The housing mass is only indicative and is not part of the objective.

**Inputs:** geometry of the disc and diameter of its central bore.

**Outputs:** mass of a disc and of the housing (kg).

!!! python "Masses"
    ```python
    # ============================================================
    # MASSES
    # ============================================================
    def disc_mass(roller_pitch_diameter, roller_diameter, pin_pitch_diameter, pin_diameter,
                  eccentricity, num_pins, disc_width, central_bore_diameter):
        """Mass of a cycloidal disc (kg): plain disc up to the profile, minus the central bore
           and the pin bores. The lobed outline is not integrated."""
        outer_radius    = roller_pitch_diameter/2.0 - roller_diameter/2.0
        central_radius  = central_bore_diameter / 2.0
        pin_bore_radius = pin_diameter/2.0 + eccentricity     # oversized by e (Qi et al. eq. 1)

        net_area = np.pi * (outer_radius**2 - central_radius**2 - num_pins * pin_bore_radius**2)
        if net_area <= 0:
            return 1e3   # invalid geometry
        return DISC_STEEL["density_kg_per_mm3"] * net_area * disc_width

    def housing_mass_estimate():
        """Indicative mass of the aluminium housing (kg): 5 mm wall tube of outer
           diameter MAX_OUTER_DIAMETER_MM over the axial budget."""
        wall_thickness = 5.0
        outer_radius = MAX_OUTER_DIAMETER_MM / 2.0
        inner_radius = outer_radius - wall_thickness
        ring_area = np.pi * (outer_radius**2 - inner_radius**2)
        return HOUSING_ALUMINIUM["density_kg_per_mm3"] * ring_area * AXIAL_BUDGET_MM

    print("Housing mass (indicative):", round(housing_mass_estimate()*1000), "g")
    ```
