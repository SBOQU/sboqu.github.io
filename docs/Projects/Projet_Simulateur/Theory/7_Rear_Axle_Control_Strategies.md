---
template: Simulateur/Theory.html
---

# 7\. Rear Axle Control Strategies

In a 4-Wheel Steering (4WS) agricultural robot, the rear axle is not merely a follower; it is an active participant in path tracking. Its primary roles are:
* **Turning Radius Reduction:** By steering in the opposite direction to the front wheels (counter-phase), the robot can negotiate tight headland turns.
* **Crab Steering:** By steering in the same direction as the front wheels (in-phase), the robot can compensate for lateral sliding on slopes, maintaining the chassis parallel to the path.
* **Heading Stabilization:** The rear axle provides an additional degree of freedom to decouple the regulation of the lateral error ($y$) from the heading error ($\tilde{\theta}$), leading to much smoother trajectories.

## 7.1. Curvature-Based Control Law

The control strategy for the rear axle implemented in this simulator is based on an analytical approach that relates the steering effort to the path's geometry.

### 7.1.1. Quadratic Resolution

The core logic aims to satisfy a specific heading error convergence. Unlike traditional controllers, we solve for the steering angle that satisfies a second-order geometric relationship. 

Let us define the desired variation of the heading error as a proportional correction:

$$
\Delta\tilde{\theta} = K_{d2} \cdot (\tilde{\theta} - \tilde{\theta}_{desired})
$$

Where $K_{d2}$ is a tuning gain and $\tilde{\theta}_{desired}$ is the target heading (usually zero). 

The simulator seeks to solve the following quadratic equation for a virtual term $X$:

$$
X^2 - K_d \cdot X + c(s) \cdot \Delta\tilde{\theta} = 0
$$

Where $K_d$ is a damping-like gain and $c(s)$ is the local curvature. To find the solution, we calculate the **discriminant** ($\Delta$):

$$
\Delta = K_d^2 - 4 \cdot c(s) \cdot \Delta\tilde{\theta}
$$

This discriminant is a critical stability indicator:
1. **If $\Delta \ge 0$:** Real solutions exist. We select the root that minimizes the steering effort:

$$
RootTerm = \frac{K_d - \sqrt{\Delta}}{2}
$$

2. **If $\Delta < 0$:** The required correction is mathematically impossible for the current curvature/error state (complex solutions). The simulator triggers a safety warning and clips $\Delta$ to $0$ to maintain numerical continuity.

The target effective orientation for the rear axle is then derived from the ratio of this root to the curvature:

$$
\tan(\tilde{\theta} + \beta_R + \delta_R) = \frac{Root\_Term}{c(s)}
$$

### 7.1.2. Singularity Management (Straight-Line Navigation)

A major mathematical challenge arises when the robot moves in a straight line. As the curvature $c(s)$ approaches zero, the term $\frac{RootTerm}{c(s)}$ tends toward an undefined form ($\frac{0}{0}$). 

To ensure a seamless transition, the simulator detects when $|c(s)| < 0.01$. In this case, it abandons the quadratic resolution and switches to a **Linear Term** derived from a first-order Taylor expansion. This term reintroduces the lateral error ($y$) to ensure the rear axle helps the robot "stick" to the line:

$$
LinearTerm = \frac{\Delta\tilde{\theta}}{K_d} - \frac{K_d \cdot y}{4}
$$

By using this logic, the robot maintains high-precision tracking on straight segments where the quadratic equation would otherwise become singular.

### 7.1.3. Dynamic Compensation and Saturation

Once the target tangent (either from the quadratic root or the linear term) is determined, we must solve for the actual mechanical steering angle $\delta_R$.

1. **Heading and Slip Inversion:**
The angle we calculated is the absolute orientation of the velocity vector. To find the mechanical angle $\delta_R$ relative to the chassis, we must subtract the current heading error and the estimated dynamic slip angle:

$$
\delta_{R, raw} = \arctan(TargetTangent) - \tilde{\theta} - \beta_R
$$

2. **Safety Bounding:**
To protect the physical integrity of the actuators and prevent tangent singularities (as discussed in section 3.3), a strict saturation is applied:

$$
\delta_R = \max(\delta_{min}, \min(\delta_{max}, \delta_{R, raw}))
$$

where $\delta_{min} = -30^\circ$ and $\delta_{max} = 30^\circ$.

This final command ensures that the rear axle actively corrects the robot's posture while accounting for the non-linear physics of tire slip and path curvature.

!!! scilab "Front_Axle.sce"

    ``` matlab
    function Rear_Axle_Output = Model_Rear_Axle_Output(...
    Lateral_Error, ...
    Heading_Error, ...
    Curvature, ...
    Front_Beta, ...
    Rear_Beta)

    // ---------- Parameters ----------
    Kd  = 0.4        ;
    Kp  = (Kd^2) / 4 ;
    Kd2 = 0.5        ;

    global Heading_Error_Desired ;
    Min_Angle = -30  ;
    Max_Angle =  30  ;

    // ---------- Computation ----------
    Heading_Error_Diff = Kd2 * (Heading_Error - Heading_Error_Desired) ; 
    Discriminant = (Kd^2) - 4 * Curvature * Heading_Error_Diff         ;
    
    // If the solution become complexe
    if Discriminant < 0 then
        disp("Warning : Compelexe solution !") ;
        Discriminant = 0                       ;
    end

    Root_Term = 0.5 * (Kd - sqrt(Discriminant)) ; 

    // ---------- Singularity for straight line ----------
    if abs(Curvature) < 0.01 then
        Linear_Term = (Heading_Error_Diff / Kd) - (Kd * Lateral_Error / 4)       ;
        Rear_Steer_A = atan(Linear_Term) - Heading_Error - Rear_Beta             ;
    else
        Rear_Steer_A = atan(Root_Term / Curvature) - Heading_Error - Rear_Beta   ;
    end

    // ---------- Saturation ----------
    if Rear_Steer_A > (Max_Angle * %pi / 180) then
        Rear_Steer_A = Max_Angle * %pi / 180 ;
    elseif Rear_Steer_A < (Min_Angle * %pi / 180) then
        Rear_Steer_A = Min_Angle * %pi / 180 ;
    end

    // ---------- Output ----------
    Rear_Axle_Output = Rear_Steer_A ;

    endfunction
    ```