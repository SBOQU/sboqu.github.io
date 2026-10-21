---
template: Cycloidal_Gearbox/Implementation.html
---

# Bearings

The catalogue bearings of the Bearings section: the eccentric bearing of each stage, checked with the ISO 281 life, and the roller bearings, checked with their static capacity and their life.

!!! note "Catalogue reference"

    The bearing catalogues of this page follow the SKF references. The dimensions, the dynamic capacities and the static capacities to confirm (the code estimates C₀ at 0,40 C) can be checked in the [SKF rolling bearings catalogue (PDF)](https://cdn.skfmediahub.skf.com/api/public/0901d1968094ddb3/pdf_preview_medium/0901d1968094ddb3_pdf_preview_medium.pdf){target="_blank" rel="noopener"}.

---

## Eccentric bearings

The bearing with the highest dynamic capacity whose bore accepts the shaft and whose width fits in the disc. Its speed is the speed of the cam relative to the disc, $n_{\text{in}}(1 + 1/z_c)$, and its life uses $p = 10/3$ for needles and rollers.

**Inputs:** minimum shaft diameter, disc width, load, speed.

**Outputs:** selected bearing (d, D, B, C, p) and $L_{10h}$ (h).

!!! python "Eccentric bearings"
    ```python
    # ============================================================
    # ECCENTRIC BEARING CATALOGUES
    # Format: (bore_mm, outer_diameter_mm, width_mm, dynamic_capacity_N)
    # ============================================================
    CYLINDRICAL_BEARINGS = [
        (25, 47, 12.0, 14300), (30, 55, 13.0, 17900), (35, 62, 14.0, 25100),
        (40, 68, 15.0, 25100), (45, 75, 16.0, 44600), (50, 80, 16.0, 46800),
        (15, 35, 11.0, 12500), (17, 40, 12.0, 16800), (20, 47, 14.0, 28500),
        (25, 52, 15.0, 28500), (30, 62, 16.0, 44000), (35, 72, 17.0, 56000),
        (40, 80, 18.0, 62000),
    ]
    NEEDLE_BEARINGS = [
        ( 6, 10,  8.0,  2010), ( 8, 12,  8.0,  2750), (10, 14, 10.0,  4290),
        (12, 16, 10.0,  4950), (15, 21, 12.0,  7650), (17, 23, 12.0,  8420),
        (20, 26, 12.0,  9130), (20, 26, 16.0, 12800), (25, 32, 16.0, 16100),
        (30, 37, 20.0, 24200), ( 5, 10, 12.0,  3030), ( 6, 12, 12.0,  3690),
        ( 8, 15, 12.0,  4840), (10, 17, 12.0,  5940), (12, 19, 12.0,  6820),
        (15, 24, 12.0,  9130), (17, 25, 16.0, 12100), (20, 28, 16.0, 14300),
        (25, 33, 16.0, 16500), (30, 40, 20.0, 25100),
    ]
    # ISO 281 life exponent of each family: 10/3 for rollers and needles
    ECCENTRIC_BEARING_FAMILIES = [
        (NEEDLE_BEARINGS,      10/3),
        (CYLINDRICAL_BEARINGS, 10/3),
    ]

    def select_eccentric_bearing(min_bore_diameter, disc_width):
        """Eccentric bearing with the highest dynamic capacity whose bore accepts the shaft
           and whose width fits in the disc. Returns (d, D, B, C, life_exponent) or None."""
        tolerance = 1e-6
        best_bearing = None
        best_capacity = -1.0
        for family, life_exponent in ECCENTRIC_BEARING_FAMILIES:
            for bore, outer, width, capacity in family:
                fits_shaft = bore >= min_bore_diameter
                fits_width = width <= disc_width + tolerance
                if fits_shaft and fits_width and capacity > best_capacity:
                    best_capacity = capacity
                    best_bearing = (bore, outer, width, capacity, life_exponent)
        return best_bearing

    def eccentric_bearing_speed(stage_input_speed, num_lobes):
        """Speed of the cam relative to the disc (rad/s): the disc turns back by 1/z_c."""
        return stage_input_speed * (1 + 1/num_lobes)

    # ============================================================
    # L10 LIFE: ISO 281
    #   L10 [million revolutions] = (C / P)^p
    #   L10h = L10 * 1e6 / (60 n)
    # ============================================================
    def bearing_life_hours(dynamic_capacity, equivalent_load, speed_rad_s, life_exponent=3):
        """L10 life in hours (ISO 281). P = F_r, since all the loads lie in the plane of the disc."""
        if equivalent_load <= 0 or speed_rad_s <= 0:
            return 0.0
        speed_rpm = speed_rad_s * 60 / (2*np.pi)
        life_million_revolutions = (dynamic_capacity / equivalent_load) ** life_exponent
        return life_million_revolutions * 1e6 / (60 * speed_rpm)

    print("Eccentric bearing, stage 1:", select_eccentric_bearing(4.97, 10),
          "| stage 2:", select_eccentric_bearing(10.23, 14))
    ```

## Roller bearings

Small ball bearings whose outer ring is the roller. The roller index of the design vector points into this catalogue. Bearings are stacked on each pin when the disc is wide enough, which multiplies both capacities. $C_0$ is estimated at 0,40 C. The peak load, twice the nominal load, must stay below $C_0 / s_0$ with $s_0$ = 2.

**Inputs:** catalogue index, disc width, nominal load, ring speed.

**Outputs:** bearing data, number stacked, static check and life.

!!! python "Roller bearings"
    ```python
    # ============================================================
    # ROLLER BEARING CATALOGUE (the outer ring is the roller)
    # Small ball bearings with a 100Cr6 outer ring, mounted on fixed pins.
    # Format: (reference, bore, outer_diameter, width, C, C0)
    # C0 is estimated at 0.40 x C, to be confirmed with the SKF catalogue.
    # ============================================================
    STATIC_TO_DYNAMIC_RATIO = 0.40

    def estimated_static_capacity(dynamic_capacity):
        return round(STATIC_TO_DYNAMIC_RATIO * dynamic_capacity)

    _raw_roller_catalog = [
        # (reference, bore, outer_diameter, width, C)
        ("623",    3, 10, 4.0,  637), ("618/5",  5, 11, 3.0,  715),
        ("628/4",  4, 11, 4.0,  936), ("604",    4, 12, 4.0,  975),
        ("618/6",  6, 13, 3.5,  715), ("619/5",  5, 13, 4.0, 1080),
        ("624",    4, 13, 5.0, 1300), ("618/7",  7, 14, 3.5,  845),
        ("605",    5, 14, 5.0, 1330), ("619/6",  6, 15, 5.0, 1380),
        ("618/8",  8, 16, 4.0, 1140), ("625",    5, 16, 5.0, 1780),
        ("619/7",  7, 17, 5.0, 1600), ("606",    6, 17, 6.0, 2340),
        ("618/9",  9, 17, 4.0, 1330), ("61800", 10, 19, 5.0, 1380),
        ("619/8",  8, 19, 6.0, 2250), ("607",    7, 19, 6.0, 2340),
        ("626",    6, 19, 6.0, 2340), ("61801", 12, 21, 5.0, 1430),
        ("61900", 10, 22, 6.0, 2700), ("608",    8, 22, 7.0, 3450),
        ("627",    7, 22, 7.0, 3320), ("61802", 15, 24, 5.0, 1560),
        ("61901", 12, 24, 6.0, 2860), ("609",    9, 24, 7.0, 3450),
        ("628",    8, 24, 8.0, 3320), ("61803", 17, 26, 5.0, 1680),
        ("6000",  10, 26, 8.0, 4620), ("629",    9, 26, 8.0, 4550),
        ("61902", 15, 28, 7.0, 4360), ("6001",  12, 28, 8.0, 5070),
        ("6200",  10, 30, 9.0, 5400), ("61903", 17, 30, 7.0, 4620),
    ]
    ROLLER_BEARINGS = [(reference, bore, outer, width, capacity, estimated_static_capacity(capacity))
                       for reference, bore, outer, width, capacity in _raw_roller_catalog]

    ROLLER_STATIC_SAFETY = 2.0    # static safety factor s0
    PEAK_LOAD_FACTOR     = 2.0    # peak load = 2 x nominal load
    CHECK_ROLLER_LIFE    = True   # include the L10 check of the rollers
    STACK_BEARINGS       = True   # stack several bearings on each roller pin

    def get_roller_bearing(index):
        """Roller bearing at the given catalogue index (rounded and bounded).
           Returns (reference, bore, outer_diameter, width, C, C0)."""
        position = int(np.clip(np.round(index), 0, len(ROLLER_BEARINGS) - 1))
        return ROLLER_BEARINGS[position]

    def rollers_stack_count(disc_width, bearing_width):
        """Number of bearings stacked on one roller pin."""
        if not STACK_BEARINGS or bearing_width <= 0:
            return 1
        return max(1, int(disc_width // bearing_width))

    def check_roller_bearing(nominal_load, dynamic_capacity, static_capacity, ring_speed, stack_count):
        """Static check (C0) and L10 life of a roller. Both capacities are multiplied by the
           number of stacked bearings. Returns (static_ok, life_ok, life_hours, peak_load, effective_C0)."""
        effective_static_capacity  = stack_count * static_capacity
        effective_dynamic_capacity = stack_count * dynamic_capacity
        peak_load = PEAK_LOAD_FACTOR * nominal_load
        static_ok = peak_load <= effective_static_capacity / ROLLER_STATIC_SAFETY
        life_hours = bearing_life_hours(effective_dynamic_capacity, nominal_load, ring_speed, life_exponent=3)
        life_ok = life_hours >= MIN_BEARING_LIFE_H
        return static_ok, life_ok, life_hours, peak_load, effective_static_capacity

    print("Roller 61903 (index 33):", get_roller_bearing(33))
    ```
