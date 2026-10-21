---
template: Cycloidal_Gearbox/Implementation.html
---

# Forces & Contacts

The contact calculations of the Mechanical Contacts section: the forces of the simplified Malhotra model, the equivalent radius, the Hertz pressure, the surface speeds and the lubricant film.

---

## Forces

Half of the rollers and half of the pins carry the torque, with the same force each. The force on the eccentric bearing is $F = T/(z_c \, e)$. These are mean forces, as explained in the Mechanical Contacts section.

**Inputs:** stage torque (N·mm), pitch diameters, numbers of lobes and pins, eccentricity.

**Outputs:** forces on a roller, a pin and the eccentric bearing (N).

!!! python "Forces"
    ```python
    # ============================================================
    # FORCES: simplified Malhotra model (mean force per loaded element)
    # ============================================================
    def rollers_in_contact(num_rollers):
        """Number of rollers loaded at the same time: half of them, rounded down."""
        return max(2, num_rollers // 2)

    def roller_force(stage_torque, roller_pitch_diameter, num_lobes):
        """Mean force on a loaded roller: T / (n_r R_p)."""
        loaded_rollers = rollers_in_contact(num_lobes + 1)
        return stage_torque / (loaded_rollers * roller_pitch_diameter / 2.0)

    def pin_force(stage_torque, pin_pitch_diameter, num_pins):
        """Mean force on a loaded output pin: T / (n_p R_pin), with half of the pins loaded."""
        loaded_pins = max(2, num_pins // 2)
        return stage_torque / (loaded_pins * pin_pitch_diameter / 2.0)

    def eccentric_bearing_force(stage_torque, eccentricity, num_lobes):
        """Force on the eccentric bearing: F = T / (z_c e)."""
        if eccentricity <= 0 or num_lobes <= 0:
            return 1e9
        return stage_torque / (num_lobes * eccentricity)

    print("Stage 2 (T = 250 N.m): roller", round(roller_force(250000, 118, 10)), "N | pin",
          round(pin_force(250000, 64, 12)), "N | eccentric", round(eccentric_bearing_force(250000, 3.5, 10)), "N")
    ```

## Equivalent radius

Each contact is reduced to a cylinder of radius $R^*$ on a plane. For the roller, the profile radius $\rho$ keeps its sign, so a single formula covers the hollow and the lobe shoulder. For the pin, the bore radius is $r_{\text{pin}} + e$.

**Inputs:** roller radius and profile radius, or pin diameter and eccentricity.

**Outputs:** $R^*$ (mm).

!!! python "Equivalent radii"
    ```python
    # ============================================================
    # EQUIVALENT RADIUS R*: two curved bodies -> one cylinder on a plane
    # ============================================================
    def equivalent_radius_roller_disc(roller_radius, profile_radius):
        """R* of the roller / profile contact: 1/R* = 1/r_p - 1/rho,
           with rho signed (positive in the hollow, negative on the lobe)."""
        inverse_radius = 1.0/roller_radius - 1.0/profile_radius
        if inverse_radius <= 0:
            return 0.0
        return 1.0 / inverse_radius

    def equivalent_radius_pin_bore(pin_diameter, eccentricity):
        """R* of the pin / bore contact, with a bore radius r_pin + e (Qi et al. eq. 1)."""
        pin_radius  = pin_diameter / 2.0
        bore_radius = pin_radius + eccentricity
        return pin_radius * bore_radius / (bore_radius - pin_radius)
    ```

## Hertz pressure

Maximum pressure of a line contact, $p_{\max} = \sqrt{F E^* / (\pi R^* L)}$. A huge input returns a very large value, which the optimizer penalises.

**Inputs:** load (N), $R^*$ (mm), contact length (mm), $E^*$ (MPa).

**Outputs:** $p_{\max}$ (MPa).

!!! python "Hertz pressure"
    ```python
    # ============================================================
    # HERTZ PRESSURE: line contact, cylinder on a plane
    #   p_max = sqrt(F E* / (pi R* L))
    # ============================================================
    def hertz_pressure(load, equivalent_radius, contact_length, reduced_modulus):
        """Maximum Hertz pressure (MPa) for a load in N and lengths in mm."""
        if equivalent_radius <= 0 or contact_length <= 0 or load <= 0:
            return 1e9
        return np.sqrt(reduced_modulus * load / (np.pi * equivalent_radius * contact_length))

    print("Pin / bore, stage 2:", round(hertz_pressure(pin_force(250000, 64, 12),
          equivalent_radius_pin_bore(4, 3.5), 14, E_STAR_PIN_BORE), 1), "MPa")
    ```

## Surface speeds

The roller rolls one lobe of the profile per input turn. The bore of a pin turns around it at the speed of the eccentric relative to the disc, $\omega_{\text{in}}(1 + 1/z_c)$. The rotation speed of the roller ring is its rolling speed divided by its radius.

**Inputs:** profile length, pin geometry, number of lobes, input speed of the stage (rad/s).

**Outputs:** entrainment speeds (m/s) and ring speed (rad/s).

!!! python "Surface speeds"
    ```python
    # ============================================================
    # SURFACE SPEEDS (m/s)
    # ============================================================
    def roller_entrainment_speed(profile_length_mm, num_lobes, stage_input_speed):
        """Rolling speed of a roller on the profile: one lobe of profile per input turn."""
        turns_per_second = stage_input_speed / (2*np.pi)
        return profile_length_mm / num_lobes * 1e-3 * turns_per_second

    def pin_entrainment_speed(pin_diameter, eccentricity, num_lobes, stage_input_speed):
        """Mean surface speed in the pin / bore contact. The bore centre turns around the pin
           at the speed of the eccentric relative to the disc, w_in (1 + 1/z_c)."""
        relative_speed = stage_input_speed * (1 + 1/num_lobes)
        pin_radius  = pin_diameter / 2.0
        bore_radius = pin_radius + eccentricity
        return relative_speed * (pin_radius + bore_radius) / 2.0 * 1e-3

    def roller_ring_speed(entrainment_speed, roller_diameter):
        """Rotation speed of the roller outer ring (rad/s): rolling speed / ring radius."""
        return entrainment_speed / (roller_diameter / 2.0 * 1e-3)
    ```

## Lubricant film

Pan and Hamrock formula for line contacts, then the film parameter $\lambda = h_{\min} / \sqrt{R_{q,1}^2 + R_{q,2}^2}$, with $R_q$ = 0,2 µm on both surfaces.

**Inputs:** load, $R^*$, contact length, entrainment speed, $E'$.

**Outputs:** $h_{\min}$ (µm) and $\lambda$.

!!! python "Lubricant film"
    ```python
    # ============================================================
    # EHD FILM: Pan & Hamrock (1989), line contact
    #   h_min / R* = 1.714 U^0.694 G^0.568 W^-0.128
    #   U = eta0 u / (E' R*)    G = alpha E'    W = (F/L) / (E' R*)
    #   lambda = h_min / sqrt(Rq1² + Rq2²)
    # ============================================================
    def film_ratio(load, equivalent_radius_mm, contact_length_mm, entrainment_speed, reduced_modulus_ehd_MPa):
        """Minimum film thickness (µm) and film parameter lambda. Internal quantities in SI units."""
        if equivalent_radius_mm <= 0 or contact_length_mm <= 0 or load <= 0 or entrainment_speed <= 0:
            return 0.0, 0.0
        radius_m   = equivalent_radius_mm * 1e-3
        length_m   = contact_length_mm * 1e-3
        modulus_pa = reduced_modulus_ehd_MPa * 1e6

        speed_parameter    = OIL_VISCOSITY_PAS * entrainment_speed / (modulus_pa * radius_m)
        material_parameter = PRESSURE_VISCOSITY_COEF * modulus_pa
        load_parameter     = (load / length_m) / (modulus_pa * radius_m)

        dimensionless_film = 1.714 * speed_parameter**0.694 * material_parameter**0.568 * load_parameter**(-0.128)
        film_thickness_um  = radius_m * dimensionless_film * 1e6
        composite_roughness_um = np.sqrt(2 * SURFACE_ROUGHNESS_UM**2)
        return film_thickness_um, film_thickness_um / composite_roughness_um
    ```
