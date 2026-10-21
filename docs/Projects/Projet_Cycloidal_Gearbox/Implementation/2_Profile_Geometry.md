---
template: Cycloidal_Gearbox/Implementation.html
---

# Profile Geometry

Two pieces of code use the profile equations of the Cycloidal Profile section. The profile generator is a separate notebook that draws the disc of one stage and exports it to the CAD with a DXF file. The sizing notebook uses the same equations to check the undercut, the curvature and the length of the profile for every candidate.

---

## Profile generator: parameters and checks

The only cell to edit: the stage is selected with `SELECTED_STAGE`. The cell computes the curtate coefficient $K_1 = e \, z_p / R_p$ and checks the undercut criterion $r_p \leq 0{,}9 \, \rho_{\min}$, with the exact radius of the roller-centre path.

**Outputs:** $K_1$, $\rho_{\min}$ and the two checks, printed.

!!! python "Parameters and checks"
    ```python
    import numpy as np
    import matplotlib.pyplot as plt

    plt.rcParams.update({
        "font.family": "DejaVu Sans",
        "font.size": 10,
        "figure.dpi": 120,
        "axes.grid": True,
        "grid.alpha": 0.3,
    })
    print("Imports OK")

    # ============================================================
    # PARAMETERS: the only cell to edit
    # The roller pitch diameter (118 mm) and the roller (Ø30) are shared by the two
    # stages: only the eccentricity and the eccentric bearing change.
    # ============================================================
    STAGE_PARAMETERS = {
        1: {"eccentricity": 3.0, "eccentric_bearing_outer_diameter": 16.0},
        2: {"eccentricity": 3.5, "eccentric_bearing_outer_diameter": 47.0},
    }
    SELECTED_STAGE = 2

    roller_pitch_radius = 59.0     # mm, roller pitch diameter 118 / 2
    roller_radius       = 15.0     # mm, 61903 bearing Ø30 / 2
    num_lobes           = 10
    num_rollers         = num_lobes + 1
    num_profile_points  = 720

    eccentricity = STAGE_PARAMETERS[SELECTED_STAGE]["eccentricity"]
    eccentric_bearing_outer_diameter = STAGE_PARAMETERS[SELECTED_STAGE]["eccentric_bearing_outer_diameter"]

    # Machining offsets: slightly larger roller, slightly smaller pitch circle
    ROLLER_RADIUS_OFFSET_MM = 0.05
    PITCH_RADIUS_OFFSET_MM  = -0.05
    machining_pitch_radius  = roller_pitch_radius + PITCH_RADIUS_OFFSET_MM
    machining_roller_radius = roller_radius + ROLLER_RADIUS_OFFSET_MM

    UNDERCUT_MARGIN = 0.90
    DXF_PATH = f"cycloidal_profile_stage_{SELECTED_STAGE}.dxf"

    # Curtate coefficient K1, Qi et al. eq. 7
    curtate_coefficient           = eccentricity * num_rollers / roller_pitch_radius
    machining_curtate_coefficient = eccentricity * num_rollers / machining_pitch_radius

    # ============================================================
    # UNDERCUT: exact criterion (minimum radius of the roller-centre path)
    # ============================================================
    def min_center_curve_radius(pitch_radius, eccentricity, num_rollers, n_points=4000):
        """Minimum radius of curvature of the convex parts of the roller-centre path."""
        phi = np.linspace(0, 2*np.pi, n_points, endpoint=False)
        first_x  = -pitch_radius*np.sin(phi) + eccentricity*num_rollers*np.sin(num_rollers*phi)
        first_y  =  pitch_radius*np.cos(phi) - eccentricity*num_rollers*np.cos(num_rollers*phi)
        second_x = -pitch_radius*np.cos(phi) + eccentricity*num_rollers**2*np.cos(num_rollers*phi)
        second_y = -pitch_radius*np.sin(phi) + eccentricity*num_rollers**2*np.sin(num_rollers*phi)
        with np.errstate(divide="ignore", invalid="ignore"):
            radius = (first_x**2 + first_y**2)**1.5 / (first_x*second_y - first_y*second_x)
        positive = radius[radius > 0]
        return float(positive.min()) if positive.size else np.inf

    center_curve_radius = min_center_curve_radius(roller_pitch_radius, eccentricity, num_rollers)

    print("=" * 44)
    print(f"ACTIVE PARAMETERS, STAGE {SELECTED_STAGE}")
    print("=" * 44)
    print(f"  roller pitch radius = {roller_pitch_radius} mm (diameter {2*roller_pitch_radius:.0f})")
    print(f"  eccentricity        = {eccentricity} mm")
    print(f"  roller radius       = {roller_radius} mm (roller Ø{2*roller_radius:.0f})")
    print(f"  lobes / rollers     = {num_lobes} / {num_rollers}")
    print()
    in_range = 0.50 <= curtate_coefficient <= 0.85
    print(f"  K1 = e z_p / R_p = {curtate_coefficient:.4f}  ", "OK, in [0.50, 0.85]" if in_range else "OUT OF RANGE")
    assert num_rollers == num_lobes + 1, "the ring must have one roller more than the disc has lobes"
    print(f"  rho_min of the roller-centre path = {center_curve_radius:.3f} mm")
    if roller_radius <= UNDERCUT_MARGIN * center_curve_radius:
        print(f"  r_p <= 0.9 rho_min = {UNDERCUT_MARGIN*center_curve_radius:.3f} mm   OK, no undercut")
    else:
        print(f"  r_p >  0.9 rho_min = {UNDERCUT_MARGIN*center_curve_radius:.3f} mm   UNDERCUT RISK, reduce r_p or e")
    ```

## Profile generator: profile

Evaluates Qi et al. eq. 6 on 720 points with the machining offsets of the Cycloidal Profile section ($R_p - 0{,}05$ mm, $r_p + 0{,}05$ mm), then plots the disc with its rollers and its eccentric bearing for a visual check before the export.

**Inputs:** the parameters of the previous cell.

**Outputs:** `profile_x`, `profile_y` and the plot.

!!! python "Profile"
    ```python
    # ============================================================
    # DISC PROFILE: Qi et al. eq. 6, generated with the machining offsets
    # ============================================================
    phi = np.linspace(0, 2*np.pi, num_profile_points, endpoint=False)
    normalisation = np.sqrt(1 + machining_curtate_coefficient**2
                            - 2*machining_curtate_coefficient*np.cos(num_lobes*phi))
    valid = normalisation > 1e-10

    offset_x = machining_curtate_coefficient*np.sin(num_rollers*phi) - np.sin(phi)
    offset_y = machining_curtate_coefficient*np.cos(num_rollers*phi) - np.cos(phi)

    profile_x = np.where(valid, machining_pitch_radius*np.sin(phi) - eccentricity*np.sin(num_rollers*phi)
                         + machining_roller_radius*offset_x/normalisation, np.nan)
    profile_y = np.where(valid, machining_pitch_radius*np.cos(phi) - eccentricity*np.cos(num_rollers*phi)
                         + machining_roller_radius*offset_y/normalisation, np.nan)

    keep = ~np.isnan(profile_x)
    profile_x = profile_x[keep]
    profile_y = profile_y[keep]

    print(f"Profile computed : {len(profile_x)}/{num_profile_points} valid points")
    print(f"X extent         : [{profile_x.min():.3f}, {profile_x.max():.3f}] mm")
    print(f"Y extent         : [{profile_y.min():.3f}, {profile_y.max():.3f}] mm")
    print(f"Outer diameter   : {2*np.hypot(profile_x, profile_y).max():.3f} mm")

    # --- Visual check before the export ---
    figure, axis = plt.subplots(figsize=(6, 6))
    axis.plot(np.append(profile_x, profile_x[0]), np.append(profile_y, profile_y[0]),
              "b-", linewidth=1.5, label="Cycloidal profile")
    for roller_angle in np.linspace(0, 2*np.pi, num_rollers, endpoint=False):
        axis.add_patch(plt.Circle((roller_pitch_radius*np.sin(roller_angle), roller_pitch_radius*np.cos(roller_angle)),
                                  roller_radius, fill=False, color="orange", linewidth=0.8, linestyle="--"))
    axis.add_patch(plt.Circle((0, 0), eccentric_bearing_outer_diameter/2, fill=False, color="cyan", linewidth=1,
                              label=f"Eccentric bearing Ø{eccentric_bearing_outer_diameter:.0f} mm"))
    axis.plot(0, 0, "+r", markersize=10)
    axis.set_aspect("equal")
    axis.set_xlabel("X (mm)")
    axis.set_ylabel("Y (mm)")
    axis.set_title(f"Stage {SELECTED_STAGE}: {num_lobes} lobes, e = {eccentricity} mm, K1 = {curtate_coefficient:.3f}")
    axis.legend()
    plt.tight_layout()
    plt.show()
    ```

## Profile generator: DXF export

Writes the profile as a closed spline in a DXF file. The millimetre units are declared explicitly, otherwise 3DExperience reads the coordinates in metres.

**Inputs:** `profile_x`, `profile_y`.

**Outputs:** `cycloidal_profile_stage_<n>.dxf`.

!!! python "DXF export"
    ```python
    # ============================================================
    # DXF EXPORT: Python -> DXF -> 3DExperience
    # ============================================================
    # pip install ezdxf
    import os
    import ezdxf
    from ezdxf import units

    document = ezdxf.new("R2010", setup=True)

    # Millimetres declared explicitly: without them, 3DExperience reads metres
    document.units = units.MM
    document.header["$INSUNITS"] = 4      # 4 = millimetres
    document.header["$MEASUREMENT"] = 1   # 1 = metric
    document.header["$LUNITS"] = 2        # decimal units

    model_space = document.modelspace()
    spline_points = [(x, y, 0.0) for x, y in zip(profile_x, profile_y)]
    spline_points.append(spline_points[0])   # close the curve
    spline = model_space.add_spline(spline_points, dxfattribs={"layer": "CYCLOIDAL_PROFILE"})
    spline.closed = True
    document.saveas(DXF_PATH)

    print("DXF EXPORT")
    print(f"  File   : {DXF_PATH} ({os.path.getsize(DXF_PATH)/1024:.1f} kB)")
    print(f"  Points : {len(profile_x)}, closed spline, DXF R2010, millimetres")
    print("  3DExperience: import the DXF in a sketch, then pad to the disc width.")
    ```

## Undercut criterion

Sizing notebook. The profile is the roller-centre path moved inward by $r_p$, so it folds over itself where the path bends more tightly than the roller. The function returns the minimum radius of curvature of the convex parts of the path, the $\rho_{\min}$ of the undercut criterion.

**Inputs:** roller pitch radius, eccentricity, number of rollers.

**Outputs:** $\rho_{\min}$ (mm).

!!! python "Undercut criterion"
    ```python
    # ============================================================
    # UNDERCUT: exact geometric criterion
    # The profile is the roller-centre path moved inward by the roller radius.
    # It folds over itself as soon as the roller radius exceeds the minimum
    # radius of curvature of the convex parts of that path.
    #   Condition: roller_radius <= UNDERCUT_MARGIN * rho_min
    # ============================================================
    UNDERCUT_MARGIN = 0.90   # 10 % margin for manufacturing tolerances

    def min_center_curve_radius(roller_pitch_radius, eccentricity, num_rollers, n_points=1500):
        """Minimum radius of curvature of the convex parts of the roller-centre path (epitrochoid)."""
        phi = np.linspace(0, 2*np.pi, n_points, endpoint=False)
        first_x  = -roller_pitch_radius*np.sin(phi) + eccentricity*num_rollers*np.sin(num_rollers*phi)
        first_y  =  roller_pitch_radius*np.cos(phi) - eccentricity*num_rollers*np.cos(num_rollers*phi)
        second_x = -roller_pitch_radius*np.cos(phi) + eccentricity*num_rollers**2*np.cos(num_rollers*phi)
        second_y = -roller_pitch_radius*np.sin(phi) + eccentricity*num_rollers**2*np.sin(num_rollers*phi)
        cross_product = first_x*second_y - first_y*second_x
        with np.errstate(divide="ignore", invalid="ignore"):
            radius = (first_x**2 + first_y**2)**1.5 / cross_product
        positive = radius[radius > 0]
        if positive.size == 0:
            return np.inf
        return float(positive.min())
    ```

## Radius of curvature

Qi et al. eq. 9, with the sign convention of the Cycloidal Profile section: positive in the hollow (concave), negative on the lobe (convex). `profile_curvature_extremes` returns the radius in the hollow and the tightest convex radius, on the lobe shoulder, which is the worst case for the Hertz pressure.

**Inputs:** roller pitch diameter, roller diameter, eccentricity, number of lobes.

**Outputs:** (hollow radius, shoulder radius), or `None` for a degenerate geometry.

!!! python "Radius of curvature"
    ```python
    # ============================================================
    # RADIUS OF CURVATURE OF THE PROFILE: Qi et al. eq. 9
    #   rho > 0: concave profile (hollow)
    #   rho < 0: convex profile (lobe shoulder)
    # ============================================================
    def profile_curvature_radius(roller_pitch_radius, roller_radius, eccentricity, num_lobes, phi):
        """Radius of curvature of the disc profile at the parameter angles phi."""
        num_rollers = num_lobes + 1
        K1 = eccentricity * num_rollers / roller_pitch_radius
        cos_term = np.cos(num_lobes * phi)
        numerator   = (1 + K1**2 - 2*K1*cos_term) ** 1.5
        denominator = K1*(1 + num_rollers)*cos_term - (1 + num_rollers*K1**2)
        with np.errstate(divide="ignore", invalid="ignore"):
            return numerator / denominator * roller_pitch_radius + roller_radius

    def profile_curvature_extremes(roller_pitch_diameter, roller_diameter, eccentricity, num_lobes, n_points=4000):
        """Radius in the hollow (smallest concave value) and at the tightest convex point
           (lobe shoulder, the worst case for the Hertz pressure).
           Returns (hollow_radius, shoulder_radius), or None for a degenerate geometry."""
        roller_pitch_radius = roller_pitch_diameter / 2.0
        roller_radius = roller_diameter / 2.0
        K1 = eccentricity * (num_lobes + 1) / roller_pitch_radius
        if K1 <= 0 or K1 >= 1:
            return None
        phi = np.linspace(0, 2*np.pi, n_points)
        curvature_radius = profile_curvature_radius(roller_pitch_radius, roller_radius, eccentricity, num_lobes, phi)
        concave = curvature_radius[curvature_radius > 0]
        convex  = curvature_radius[curvature_radius < 0]
        if convex.size == 0:
            return None
        hollow_radius = concave.min() if concave.size else np.inf
        return float(hollow_radius), float(convex.max())

    print("Curvature, stage 2 (D=118, d=30, e=3.5, 10 lobes):",
          [round(value, 2) for value in profile_curvature_extremes(118, 30, 3.5, 10)], "mm")
    ```

## Profile length

Points of the profile (Qi et al. eq. 6, nominal geometry) and its perimeter. Each roller travels one lobe of this perimeter per input turn, which gives its rolling speed in the Forces & Contacts page.

**Inputs:** roller pitch diameter, roller diameter, eccentricity, number of lobes.

**Outputs:** perimeter (mm).

!!! python "Profile length"
    ```python
    # ============================================================
    # PROFILE POINTS AND PERIMETER: Qi et al. eq. 6
    # ============================================================
    def profile_points(roller_pitch_radius, roller_radius, eccentricity, num_lobes, n_points=720):
        """Points of the disc profile (nominal geometry, without machining offsets)."""
        num_rollers = num_lobes + 1
        K1 = eccentricity * num_rollers / roller_pitch_radius
        phi = np.linspace(0, 2*np.pi, n_points, endpoint=False)
        normalisation = np.sqrt(1 + K1**2 - 2*K1*np.cos(num_lobes*phi))
        x = (roller_pitch_radius*np.sin(phi) - eccentricity*np.sin(num_rollers*phi)
             + roller_radius*(K1*np.sin(num_rollers*phi) - np.sin(phi)) / normalisation)
        y = (roller_pitch_radius*np.cos(phi) - eccentricity*np.cos(num_rollers*phi)
             + roller_radius*(K1*np.cos(num_rollers*phi) - np.cos(phi)) / normalisation)
        return x, y

    def profile_length(roller_pitch_diameter, roller_diameter, eccentricity, num_lobes, n_points=2000):
        """Perimeter of the disc profile (mm). Each roller travels one lobe of it per input turn."""
        x, y = profile_points(roller_pitch_diameter/2.0, roller_diameter/2.0, eccentricity, num_lobes, n_points)
        closed_x = np.append(x, x[0])
        closed_y = np.append(y, y[0])
        return float(np.sum(np.hypot(np.diff(closed_x), np.diff(closed_y))))

    print("Profile perimeter, stage 2:", round(profile_length(118, 30, 3.5, 10)), "mm")
    ```
