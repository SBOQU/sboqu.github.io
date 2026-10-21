---
template: Simulateur/Implementation.html
---

# Implementation

Source code of all Scilab modules. Each block can be **downloaded individually** or copied with a **double-click**. The files are organized to mirror the Theory documentation — same modules, same order.

---

## A. Parameters & Launch

### Parameters.sce

Defines every global variable used across the simulator — vehicle geometry, ground parameters, trajectory reference, observer gains, and controller tuning. **This file must be executed first.** All other modules read from these globals via the `global` keyword.

!!! scilab "Parameters.sce"
    ```matlab
    // paste code here
    ```

### ZZZ\_Pre\_Launch.sce

Master launcher that sequentially calls `exec()` on every module in the correct dependency order. Run this single file to initialize the full simulation environment in one shot.

!!! scilab "ZZZ_Pre_Launch.sce"
    ```matlab
    // paste code here
    ```

---

## B. Path Tracking

### Path\_Filter.sce

Applies a **Butterworth low-pass filter** to the raw RTK-GPS waypoints to produce a smooth, derivable trajectory stored in `Smoothed_Traj`. The filter order and cutoff frequency are set in `Parameters.sce`.

!!! scilab "Path_Filter.sce"
    ```matlab
    // paste code here
    ```

### Closest\_Point.sce

Iterates over all waypoints using **vectorized squared-distance computation** (no `sqrt` needed) to find the index of the trajectory point closest to the robot's current position. Called at every simulation tick to anchor the Frenet frame.

!!! scilab "Closest_Point.sce"
    ```matlab
    // paste code here
    ```

### Compute\_Distance.sce

Utility function — returns the **Euclidean distance** between two 2D points. Used internally by several modules to avoid code duplication.

!!! scilab "Compute_Distance.sce"
    ```matlab
    // paste code here
    ```

### Find\_Current\_Pos\_Desired.sce

From the closest point index, computes the **exact desired position and tangent** on the path at the robot's current arc-length position. Supports both orthogonal projection and polynomial interpolation methods, selectable via `Projection_Method`.

!!! scilab "Find_Current_Pos_Desired.sce"
    ```matlab
    // paste code here
    ```

### Find\_Future\_Pos\_Desired.sce

Looks ahead by `Lookahead_Distance` along the arc to return the **future desired position** used by the GPC feedforward layer and the curvature anticipation block.

!!! scilab "Find_Future_Pos_Desired.sce"
    ```matlab
    // paste code here
    ```

### Tracking\_Errors.sce

Computes the two primary control errors in the **Frenet-Serret frame** : lateral error $y$ (signed perpendicular distance to path) and heading error $\tilde{\theta}$ (angular deviation from the path tangent). Both errors feed every controller downstream.

!!! scilab "Tracking_Errors.sce"
    ```matlab
    // paste code here
    ```

### Curvature.sce

Estimates the **local curvature** $\kappa(s)$ of the trajectory at a given arc-length index using a finite-difference approximation on the smoothed waypoints. Used both as a feedforward term in the controllers and as an input to the rear axle quadratic law.

!!! scilab "Curvature.sce"
    ```matlab
    // paste code here
    ```

---

## C. Vehicle Dynamics

### Dynamic\_Mouvement.sce

The **heart of the simulator**. Propagates the full rigid-body state $(X, Y, \theta, \dot{\theta}, \beta)$ forward by one time step using Euler integration. Implements the extended bicycle model with Pacejka-inspired lateral tire force generation for front and rear axles. Actuator lag is modeled as a first-order filter on the steering commands.

!!! scilab "Dynamic_Mouvement.sce"
    ```matlab
    // paste code here
    ```

---

## D. State Observers

### Observer.sce

Runs the three observer architectures in parallel and selects the active one based on the `Observer_Mode` parameter set in `Parameters.sce` :

| Mode | Architecture |
|------|-------------|
| `1` | Kinematic Inversion |
| `2` | Luenberger |
| `3` | Lyapunov-based Adaptive |

Outputs estimated slip angles $\hat{\beta}_F$, $\hat{\beta}_R$, and the estimated tracking errors $\hat{y}$, $\hat{\tilde{\theta}}$ fed back to the controllers.

!!! scilab "Observer.sce"
    ```matlab
    // paste code here
    ```

---

## E. Front Axle Control

### Front\_Axle.sce

Orchestrates the front steering command through **three cascaded control layers**, activated by the `Control_Mode` flag in `Parameters.sce` :

| Mode | Strategy |
|------|----------|
| `1` | PD — baseline linear controller |
| `2` | Backstepping — exact linearization of the kinematic model |
| `3` | GPC — predictive feedforward on top of Backstepping |

Returns the final front steering angle $\delta_F$, the predicted steering horizon $\delta_{H}$, and the integral of the lateral error for anti-windup monitoring.

!!! scilab "Front_Axle.sce"
    ```matlab
    // paste code here
    ```

### GPC.sce

Standalone computation of the **Generalized Predictive Control** feedforward term. Predicts the future desired steering angle over a horizon $N_H$ using the lookahead curvature, then solves the GPC cost function to compensate for actuator phase lag. Called internally by `Front_Axle.sce` when `Control_Mode = 3`.

!!! scilab "GPC.sce"
    ```matlab
    // paste code here
    ```

---

## F. Rear Axle Control

The rear axle logic is embedded directly inside `Front_Axle.sce` as a dedicated sub-block. It computes $\delta_R$ from the **quadratic curvature law** :

$$
a\,\delta_R^2 + b\,\delta_R + c = 0
$$

where the coefficients depend on the current curvature $\kappa$, the lateral error $y$, and the vehicle geometry. Counter-phase is applied for tight turns; in-phase for slope crab steering. No separate file is needed — the logic is co-located with the front axle for state sharing efficiency.