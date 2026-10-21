---
template: Cycloidal_Gearbox/Implementation.html
---

# Parameters & Materials

The fixed inputs of the sizing notebook: the specification, the material of each part and the contact constants derived from them. Torques are in N·mm and speeds in rad/s throughout, so that millimetres, newtons and the film formula combine without conversion factors.

---

## Specification

The values of the specification given in the Overview, the lubricant chosen in the Mechanical Contacts section (ISO VG 460, assumed at 40 °C) and the roughness of the ground surfaces.

**Outputs:** global constants of the specification, the margins and the lubricant.

!!! python "Specification"
    ```python
    import numpy as np
    from scipy.optimize import differential_evolution, minimize
    import warnings
    warnings.filterwarnings("ignore")

    # ============================================================
    # SPECIFICATION: KUKA KR 10, joint J2 (shoulder)
    # ============================================================
    OUTPUT_TORQUE_NMM     = 250000.0            # nominal output torque (250 N.m)
    INPUT_SPEED_RAD_S     = 4000 * 2*np.pi/60   # motor speed 4000 rpm (418.9 rad/s)
    TARGET_RATIO          = 100                 # overall ratio 100:1 = 10 x 10 lobes
    MAX_OUTER_DIAMETER_MM = 155.0               # outer envelope of the housing
    AXIAL_BUDGET_MM       = 40.0                # axial length for the two discs and the flange
    FLANGE_THICKNESS_MM   = 10.0                # intermediate flange between the stages

    # ============================================================
    # SAFETY FACTORS AND MARGINS
    # ============================================================
    SAFETY_FACTOR      = 2.0     # mechanical safety factor s
    GEOM_MARGIN_MM     = 2.0     # minimum machinable ligament delta
    MIN_BEARING_LIFE_H = 500.0   # minimum L10 life (ISO 281)

    # ============================================================
    # LUBRICANT AND SURFACE FINISH (EHD film)
    # ============================================================
    OIL_VISCOSITY_PAS       = 0.4025   # ISO VG 460 at 40 °C: 460 mm²/s x 875 kg/m³
    PRESSURE_VISCOSITY_COEF = 2.0e-8   # pressure-viscosity coefficient alpha (1/Pa)
    SURFACE_ROUGHNESS_UM    = 0.2      # RMS roughness Rq of each surface (µm)
    MIN_FILM_RATIO          = 1.0      # lambda threshold for a separating film

    print("Axial budget           :", AXIAL_BUDGET_MM, "mm")
    print("Maximum disc thickness :", (AXIAL_BUDGET_MM - FLANGE_THICKNESS_MM) / 2, "mm")
    ```

## Materials

One dictionary per part. The disc uses the 16MnCr5 selected in the Material Selection section, with its admissible pressure of 2 000 MPa. The eccentric shafts keep the case-hardened steel of the Shaft Design section, with $R_e$ = 1 100 MPa. The density of the steels stays at 7 850 kg/m³, 0,1 % below the database value of 16MnCr5.

**Outputs:** `DISC_STEEL`, `SHAFT_STEEL`, `PIN_STEEL`, `BEARING_RING_100CR6`, `HOUSING_ALUMINIUM`.

!!! python "Materials"
    ```python
    # ============================================================
    # MATERIALS: one dictionary per component
    #   young_modulus_MPa  : Young's modulus E
    #   poisson            : Poisson's ratio nu
    #   yield_MPa          : yield strength Re
    #   density_kg_per_mm3 : density
    #   hertz_allow_MPa    : admissible Hertz pressure
    # ============================================================
    DISC_STEEL = {
        "name": "16MnCr5, case-hardened (disc)",
        "young_modulus_MPa": 210000.0,
        "poisson": 0.30,
        "yield_MPa": 662.0,              # core yield strength, from the Ashby selection
        "density_kg_per_mm3": 7850e-9,
        "hertz_allow_MPa": 2000.0,       # case-hardened surface
    }
    SHAFT_STEEL = {
        "name": "Case-hardened steel (eccentric shafts)",
        "young_modulus_MPa": 210000.0,
        "poisson": 0.30,
        "yield_MPa": 1100.0,
        "density_kg_per_mm3": 7850e-9,
    }
    PIN_STEEL = {
        "name": "Hardened steel (output pins)",
        "young_modulus_MPa": 210000.0,
        "poisson": 0.30,
        "yield_MPa": 1500.0,
        "density_kg_per_mm3": 7850e-9,
        "hertz_allow_MPa": 1800.0,
    }
    BEARING_RING_100CR6 = {
        "name": "Bearing steel 100Cr6 (outer ring of the rollers)",
        "young_modulus_MPa": 210000.0,
        "poisson": 0.30,
        "yield_MPa": 1600.0,
        "density_kg_per_mm3": 7850e-9,
        "hertz_allow_MPa": 2500.0,
    }
    HOUSING_ALUMINIUM = {
        "name": "Aluminium 7075-T6 (housing)",
        "young_modulus_MPa": 71700.0,
        "poisson": 0.33,
        "yield_MPa": 503.0,
        "density_kg_per_mm3": 2810e-9,
    }
    ```

## Contact constants

The reduced modulus $E^*$ of each contact, the modulus $E' = 2E^*$ of the film formula, and the admissible pressure, set by the weaker material of the pair: 2 000 MPa for the roller on the disc, 1 800 MPa for the pin in its bore.

**Inputs:** the material dictionaries.

**Outputs:** `E_STAR_*`, `E_PRIME_*` and `HERTZ_ALLOW_*` for the two contacts.

!!! python "Contact constants"
    ```python
    # ============================================================
    # CONTACT CONSTANTS: one pair of materials per contact
    # ============================================================
    def reduced_modulus_hertz(material_a, material_b):
        """Reduced modulus E* for the Hertz pressure: 1/E* = (1-va²)/Ea + (1-vb²)/Eb.
           For two identical steels, E* = E / (2 (1 - nu²))."""
        term_a = (1 - material_a["poisson"]**2) / material_a["young_modulus_MPa"]
        term_b = (1 - material_b["poisson"]**2) / material_b["young_modulus_MPa"]
        return 1.0 / (term_a + term_b)

    def reduced_modulus_ehd(material_a, material_b):
        """Reduced modulus E' of the film formula (Pan & Hamrock): E' = 2 E*."""
        return 2.0 * reduced_modulus_hertz(material_a, material_b)

    def allowable_hertz_pressure(material_a, material_b):
        """Admissible pressure of a contact: the one of the weaker material."""
        return min(material_a["hertz_allow_MPa"], material_b["hertz_allow_MPa"])

    # Roller / disc: 100Cr6 outer ring against the disc steel
    E_STAR_ROLLER_DISC      = reduced_modulus_hertz(BEARING_RING_100CR6, DISC_STEEL)
    E_PRIME_ROLLER_DISC     = reduced_modulus_ehd(BEARING_RING_100CR6, DISC_STEEL)
    HERTZ_ALLOW_ROLLER_DISC = allowable_hertz_pressure(BEARING_RING_100CR6, DISC_STEEL)

    # Pin / bore: pin steel against the disc steel
    E_STAR_PIN_BORE      = reduced_modulus_hertz(PIN_STEEL, DISC_STEEL)
    E_PRIME_PIN_BORE     = reduced_modulus_ehd(PIN_STEEL, DISC_STEEL)
    HERTZ_ALLOW_PIN_BORE = allowable_hertz_pressure(PIN_STEEL, DISC_STEEL)

    print("Roller / disc : E* =", round(E_STAR_ROLLER_DISC), "MPa | P_adm =", HERTZ_ALLOW_ROLLER_DISC, "MPa")
    print("Pin / bore    : E* =", round(E_STAR_PIN_BORE), "MPa | P_adm =", HERTZ_ALLOW_PIN_BORE, "MPa")
    ```
