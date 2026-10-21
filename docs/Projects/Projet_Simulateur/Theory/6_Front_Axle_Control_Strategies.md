---
template: Simulateur/Theory.html
---

# 6\. Front Axle Control Strategies

In our 4-Wheel Steering (4WS) architecture, the front and rear axles have distinct responsibilities. The front axle is the primary path-tracking actuator. Its main objective is to aggressively reduce the lateral error ($y$) and align the vehicle's heading with the reference trajectory ($\tilde{\theta}$). 

Because agricultural terrains induce severe non-linear behaviors (slip angles, varying grip), simple linear controllers are often insufficient. Therefore, the simulator implements multiple control laws for the front axle, ranging from a basic PD controller to advanced predictive non-linear strategies.

## 6.1. Proportional-Derivative (PD) Control

The most fundamental approach is the linear Proportional-Derivative controller. It directly penalizes the lateral error and the heading error using constant gains.

$$
\delta_F = K_p \cdot y + K_d \cdot \tilde{\theta}
$$

* **The Proportional term ($K_p \cdot y$):** Steers the wheels towards the trajectory. A higher $K_p$ produces a faster return but risks overshooting.
* **The Derivative term ($K_d \cdot \tilde{\theta}$):** Acts as a damping factor. Since $\tilde{\theta}$ is directly related to the rate of change of $y$, this term prevents oscillations by straightening the wheels as the robot approaches the path.

**Limitations:** While computationally lightweight, the PD controller is completely "blind" to the trajectory's curvature $c(s)$ and the dynamic slip angles ($\beta$). In sharp corners or slippery slopes, it will inevitably produce a steady-state tracking error because it only reacts *after* an error has occurred.

!!! scilab "Front_Axle.sce"

    ``` matlab
    // ---------- Parameters
    Kd        = -0.6 ;
    Kp        = -0.2 ;

    // ---------- Computation
    F_Steer_A  = Kp * Lat_Err + Kd * H_Err    ;

    F_Steer_A = min( Max_Rad, F_Steer_A )     ;
    F_Steer_A = max( Min_Rad, F_Steer_A )     ;
    ```

## 6.2. Predictive Chained System (Exact Linearization)

To achieve perfect tracking in curves, we must abandon simple linear corrections (like the PD controller) and use the actual non-linear kinematic equations derived in Section 3. However, designing a stable controller directly on non-linear differential equations (which involve multiplied sines, cosines, and tangents) is incredibly complex.

The **Chained System** is a powerful mathematical transformation known as Exact Linearization. It converts our complex non-linear robot into a virtual system that behaves exactly like a simple cascade of linear integrators. Once the system is mathematically "linearized," it becomes trivial to control.

### 6.2.1. The Derivative Chain Logic

**Mathematical Reminder: The Extended Kinematic Model**

Before diving into the chained system, let us recall the fundamental kinematic equations established previously. To simplify the notation, we define the **effective heading angle** $\tilde{\theta}_{eff}$ as the sum of the pure heading error, the rear dynamic slip, and the rear steering angle:

$$
\tilde{\theta}_{eff} = \tilde{\theta} + \beta_R + \delta_R
$$

Using this effective angle, the rates of change for the curvilinear progression along the path ($\dot{s}$) and the lateral tracking error ($\dot{y}$) are exactly expressed in matrix form as:

$$
\begin{aligned}
\begin{bmatrix}
\dot{s} \\
\dot{y}
\end{bmatrix}
=
\begin{bmatrix}
\frac{v \cos(\tilde{\theta}_{eff})}{1 - c(s)y} \\[1.5em]
v \sin(\tilde{\theta}_{eff})
\end{bmatrix}
\end{aligned}
$$

In a standard dynamic system, variables evolve with respect to time ($t$). However, for path tracking, we want the steering correction to depend strictly on the distance traveled, regardless of the vehicle's speed. If the tractor drives faster, it should correct faster over time, but the geometric curve it draws on the ground should remain identical.

### 6.2.2. The Evolution Variable

We completely abandon time $t$ and replace it with the curvilinear abscissa $s$ (the exact distance traveled along the reference trajectory). This becomes our new independent "clock" or evolution parameter.

$$
a_1 = s
$$

### 6.2.3. The Variable to Control

The ultimate goal of the front axle is to cancel the lateral tracking error. We define this physical distance as our starting state:

$$
a_2 = y
$$

### 6.2.4. The First Derivative

We calculate how the lateral error $y$ changes with respect to the traveled distance $s$. Using the chain rule, we divide the time-derivative of $y$ by the time-derivative of $s$:

$$
a_3 = \frac{da_2}{da_1} = \frac{dy}{ds} = \frac{\frac{dy}{dt}}{\frac{ds}{dt}} = \frac{\dot{y}}{\dot{s}}
$$

We substitute $\dot{y}$ and $\dot{s}$ with the exact continuous kinematic equations recalled above:

$$
a_3 = \frac{v \sin(\tilde{\theta}_{eff})}{\frac{v \cos(\tilde{\theta}_{eff})}{1 - c(s)y}}
$$

The longitudinal velocity $v$ cancels out perfectly. This proves mathematically that our spatial transformation successfully decoupled the steering geometry from the vehicle's speed. Rearranging the fraction yields the first exact derivative:

$$
a_3 = (1 - c(s)y) \tan(\tilde{\theta}_{eff})
$$

### 6.2.5. Deriving Until the Command Appears

This step represents the heart of the Chained System process. We derive $a_3$ with respect to $s$ until $\delta_F$ appears.

We explicitly compute the derivative of $a_3 = (1 - c(s)y)\tan(\tilde{\theta}_{eff})$ with respect to the curvilinear abscissa $s$:

$$
m_3 = \frac{da_3}{ds} = \underbrace{\frac{d(1 - c(s)y)}{ds} \tan(\tilde{\theta}_{eff})}_{\text{Geometry variation}} + \underbrace{(1 - c(s)y) \frac{1}{\cos^2(\tilde{\theta}_{eff})} \frac{d\tilde{\theta}_{eff}}{ds}}_{\text{Orientation variation}}
$$

---
**a) Expanding the Geometry Variation Term**

We develop $\frac{d(1 - c(s)y)}{ds}$ using the product rule:

$$
\frac{d(1 - c(s)y)}{ds} = -c'(s)\,y - c(s)\,\frac{dy}{ds}
$$

In curvilinear coordinates, the lateral position derivative with respect to arc length is:

$$
\frac{dy}{ds} = \frac{\dot{y}}{\dot{s}} = (1 - c(s)y)\tan(\tilde{\theta}_{eff}) = a_3
$$

Substituting back, the geometry variation term becomes:

$$
\frac{d(1 - c(s)y)}{ds}\,\tan(\tilde{\theta}_{eff}) = \Bigl(-c'(s)\,y - c(s)(1 - c(s)y)\tan(\tilde{\theta}_{eff})\Bigr)\tan(\tilde{\theta}_{eff})
$$

---
**b) Expanding the Orientation Variation Term**

By expanding the derivative of the effective heading $\frac{d\tilde{\theta}_{eff}}{ds}$ using the chain rule:

$$
\frac{d\tilde{\theta}_{eff}}{ds} = \frac{\dot{\tilde{\theta}}_{eff}}{\dot{s}}
$$

Injecting the vehicle's yaw rate $\dot{\theta}$, the command $\delta_F$ becomes visible:

$$
\frac{d\tilde{\theta}_{eff}}{ds} = \frac{\dfrac{v \cos(\beta_R + \delta_R) \tan(\delta_F + \beta_F - \delta_R - \beta_R)}{L} - \dot{\theta}_M + \dot{\beta}_R + \dot{\delta}_R}{\dot{s}}
$$

---
**c) Full Expression of $m_3$**

Combining both terms, the complete expression is:

$$
m_3 = \Bigl(-c'(s)\,y - c(s)(1 - c(s)y)\tan(\tilde{\theta}_{eff})\Bigr)\tan(\tilde{\theta}_{eff}) + \frac{1 - c(s)y}{\cos^2(\tilde{\theta}_{eff})} \left( \frac{\dfrac{v \cos(\beta_R + \delta_R)\tan(\delta_F + \beta_F - \delta_R - \beta_R)}{L} - \dot{\theta}_M + \dot{\beta}_R + \dot{\delta}_R}{\dot{s}} \right)
$$

Since the control input $\delta_F$ has successfully appeared in the equation, we stop the process here.

---
**d) Stopping Condition and Results**

We walk back up the integrator chain to define the complete linearized system:

$$
\begin{aligned}
a_1 &= s \\
a_2 &= y \\
a_2' &= a_3 \\
a_3' &= m_3
\end{aligned}
$$

### 6.2.6. Backstepping

While the chained system derivation gives an exact analytical expression for $m_3$ (Step 4), using it directly as a global PD controller ($m_3 = -K_p \cdot a_2 - K_d \cdot a_3$) presents major limitations in real-world robotics:
1. **Noise Sensitivity:** The raw expression of $m_3$ depends on the spatial derivative of the curvature ($c'(s)$) and dynamic slip variations ($\dot{\beta}$), which are often highly noisy or impossible to measure precisely.
2. **Physical Abstraction:** $m_3$ represents a "spatial acceleration", an abstract quantity that makes tuning the $K_p$ and $K_d$ gains highly unintuitive for engineers.
3. **Numerical Instability:** A large initial tracking error can cause the raw unconstrained formula to output aberrant steering commands, instantly destabilizing the simulation.

To overcome this, the model refactors the math into a **Backstepping** (cascade control) approach. The problem is factored into two distinct physical sub-objectives: defining a target orientation, and then rallying that orientation.

---
**a) Target Orientation Construction ($\Omega_{desired}$)**

First, we determine the ideal orientation the vehicle should adopt to smoothly cancel the lateral error $y$. We define the state $\Omega = \tan(\tilde{\theta}_{eff})$.
From Step 3, we have the relationship:

$$
\frac{dy}{ds} = (1 - c(s)y) \tan(\tilde{\theta}_{eff}) = PSF \cdot \Omega
$$

Where **$PSF = 1 - c(s)y$** is the *Path Scale Factor*. To impose a stable first-order convergence for the lateral error ($\frac{dy}{ds} = -K_p \cdot y$), we must algebraically impose:

$$
\Omega_{desired} = \frac{-K_p \cdot y}{PSF}
$$

**Why divide by the PSF?** This is a crucial safety feature implemented in the code. The PSF represents the geometric deformation of space due to curvature. 
* **Inside a curve ($c \cdot y > 0$):** The PSF is small ($<1$). Space is "compressed". To compensate, the controller divides by this small number to *increase* the target angle, forcing the robot to steer much harder to catch the track.
* **On a straight line ($c = 0$):** The $PSF = 1$, returning seamlessly to a classic proportional law ($\Omega_{desired} = -K_p \cdot y$).

---
**b) Virtual Control ($m_3$) Computation**

Now, to make the system physically implementable, the Backstepping approach redefines $m_3$. Instead of representing the raw spatial acceleration, **the practical $m_3$ used in the control code represents the commanded spatial yaw rate** ($\frac{\dot{\theta}}{v}$).

 We impose a first-order stable dynamic relative to the traveled distance $s$, governed by the derivative gain $K_d$:

$$
\frac{d\Omega}{ds} = K_d \cdot (\Omega - \Omega_{desired})
$$

Since we defined $\Omega = \tan(\tilde{\theta}_{eff})$, we can expand the left side using the chain rule:

$$
\frac{d\Omega}{ds} = \frac{1}{\cos^2(\tilde{\theta}_{eff})} \cdot \frac{d\tilde{\theta}_{eff}}{ds}
$$

Next, we must expand the spatial derivative of the effective heading ($\frac{d\tilde{\theta}_{eff}}{ds}$). Knowing that $\tilde{\theta}_{eff} \approx \theta - \theta_M$, its spatial variation is the difference between the vehicle's spatial yaw rate and the trajectory's curvature:

$$
\frac{d\tilde{\theta}_{eff}}{ds} = \frac{d\theta}{ds} - \frac{d\theta_M}{ds} = \frac{\dot{\theta}}{\dot{s}} - c(s)
$$

We now inject our practical definition of $m_3 = \frac{\dot{\theta}}{v}$ (which implies $\dot{\theta} = m_3 \cdot v$), and substitute the kinematic equation for $\dot{s} = \frac{v \cos(\tilde{\theta}_{eff})}{PSF}$:

$$
\frac{d\tilde{\theta}_{eff}}{ds} = \frac{m_3 \cdot v}{\frac{v \cos(\tilde{\theta}_{eff})}{PSF}} - c(s) = m_3 \cdot \frac{PSF}{\cos(\tilde{\theta}_{eff})} - c(s)
$$

Substituting this back into our chain rule expansion gives the full geometric evolution of our orientation:

$$
\frac{d\Omega}{ds} = \frac{1}{\cos^2(\tilde{\theta}_{eff})} \left[ m_3 \cdot \frac{PSF}{\cos(\tilde{\theta}_{eff})} - c(s) \right]
$$

Finally, we equate this physical evolution to our desired stable dynamic ($K_d \cdot (\Omega - \Omega_{desired})$) to isolate the exact virtual command $m_3$ that the vehicle must execute:

$$
K_d \cdot (\Omega - \Omega_{desired}) = \frac{1}{\cos^2(\tilde{\theta}_{eff})} \left[ m_3 \cdot \frac{PSF}{\cos(\tilde{\theta}_{eff})} - c(s) \right]
$$

By multiplying both sides by $\cos^2(\tilde{\theta}_{eff})$ and moving the curvature term $c(s)$ to the left, we obtain:

$$
\cos^2(\tilde{\theta}_{eff}) \cdot K_d \cdot (\Omega - \Omega_{desired}) + c(s) = m_3 \cdot \frac{PSF}{\cos(\tilde{\theta}_{eff})}
$$

Multiplying by the inverse of the remaining fraction strictly isolates $m_3$, yielding the exact analytical equation implemented in the simulator:

$$
m_3 = \frac{\cos^3(\tilde{\theta}_{eff})}{PSF} \cdot K_d \cdot (\Omega - \Omega_{desired}) + \frac{c(s) \cos(\tilde{\theta}_{eff})}{PSF}
$$

This powerful derivation successfully eliminates the need for $c'(s)$ and $\dot{\beta}$. The resulting command is broken down into two highly intuitive physical terms:

!!! scilab "Front_Axle.sce"

    ``` matlab
    Virtual_Control = (cos(Eff_R_H)^3) * Kd * (Omega - Omega_Desired) / PSF + C_H_Pred * cos(Eff_R_H) / PSF ;
    ```

* **Proportional Term:** $\frac{\cos^3(\tilde{\theta}_{eff})}{PSF} \cdot K_d \cdot (\Omega - \Omega_{desired})$ drives the current orientation toward the target. The $\cos^3$ factor mathematically emerges from the derivative of the tangent function during the change of basis.
* **Feedforward Term:** $\frac{c(s) \cos(\tilde{\theta}_{eff})}{PSF}$ anticipates the upcoming curvature (`C_H_Pred` in the simulator) so the robot physically begins curving its trajectory before a tracking error even appears.

---
**c) Final Steering Command Synthesis ($\delta_F$)**

Finally, we "walk back" up to the physical steering angle by inverting the last kinematic layer (the yaw rate). We isolate $\delta_F$ so that the vehicle physically executes the exact $m_3$ requested by the cascade:

$$
\delta_F = \arctan\left( \frac{L}{\cos(\beta_R + \delta_R)} m_3 + \tan(\delta_R + \beta_R) \right) - \beta_F
$$

!!! scilab "Front_Axle.sce"

    ``` matlab
    F_Steer_A = atan((Wheelbase / cos(R_Steer_A + R_Beta)) * Virtual_Control + tan(R_Steer_A + R_Beta)) - F_Beta ;
    ```

This cascaded structure (Compute $\Omega_{desired} \rightarrow$ Compute $m_3 \rightarrow$ Compute $\delta_F$) ensures that every step has physical meaning and remains numerically stable, even in severe off-road slipping conditions.

## 6.3. Exact Linearization with Curvature Feedforward

The control law derived in section 6.2 (Backstepping) is highly effective for maintaining a null tracking error on smooth paths. However, it is fundamentally reactive: it computes a correction based on the *current* measured error. In high-speed agricultural applications or sharp turns, the delay between error detection and actuator response can lead to a "cutting the corner" effect.

To solve this, section 6.3 implements an anticipation logic. Instead of basing the Backstepping command on the current state, we project the robot's kinematics into the future using a prediction horizon $H_{Pred}$.

### 6.3.1. The Prediction Loop via Euler Integration

The simulator runs a high-speed internal prediction loop that integrates the non-linear kinematics over a series of small time steps $\Delta_t$ (set to 0.05s in the code). Starting from the current measured lateral error $y$ and heading error $\tilde{\theta}$, the predicted states are updated as follows:

1.  **Update of Predicted Lateral Error:**
    The variation of the lateral error over one prediction step is:

$$
y_{pred}(k+1) = y_{pred}(k) + (v \cdot \sin(\tilde{\theta}_{eff}(k)) \cdot \Delta t_{p})
$$

2.  **Update of Predicted Heading Error:**
    The heading error evolution is computed by subtracting the trajectory's angular velocity from the vehicle's yaw rate:

$$
\tilde{\theta}_{pred}(k+1) = \tilde{\theta}_{pred}(k) + \Delta t_{p} \cdot \left[ \frac{v \cos(\beta_R) (\tan(\delta_F + \beta_F) - \tan(\delta_R + \beta_R))}{L} - \frac{v \cdot c(s) \cos(\tilde{\theta}_{eff})}{1 - y_{pred} \cdot c(s)} \right]
$$

This loop repeats for $N = \frac{H_{Pred}}{\Delta t_{p}}$ iterations. The final values of $y_{pred}$ and $\tilde{\theta}_{pred}$ represent the expected position of the robot at the end of the horizon if the current steering remains constant.

### 6.3.2. Feedforward Control Synthesis

Once the predicted errors are known, the simulator applies the same Backstepping logic established in section 6.2, but substituting the current errors with the predicted ones. This allows the robot to "see" an upcoming error and begin its steering maneuver prematurely.

The virtual command $m_3$ becomes:

$$
m_3 = \frac{\cos^3(\tilde{\theta}_{pred})}{PSF} \cdot K_d \cdot (\tan(\tilde{\theta}_{pred}) - \Omega_{desired, pred}) + \frac{c(s) \cos(\tilde{\theta}_{pred})}{PSF}
$$

By utilizing this anticipated state, the robot effectively cancels the phase lag of the system, ensuring the trajectory is followed with much higher precision in transient phases.

!!! scilab "Front_Axle.sce"

    ``` matlab
    // ---------- Parameters
        Y_Desired     = 0                   ;
        Conv_Distance = 5                   ;
        Kp            = -3 / Conv_Distance  ;
        Kd            = 3 * Kp              ; 
        F_Steer_A   = N1_F_Stee_A           ;

    // ---------- Path_Scale_Factor
    Path_Scale_Factor = 1 - (C * Lat_Err) ;
    PSF               = Path_Scale_Factor ;
    if PSF < 0.1 then PSF = 0.1 ; end

    // ---------- Prediction Loop
    for i = 1 : round(20 * abs(H_Pred))
        Lat_Err = Lat_Err + Speed * sin(H_Err + R_Beta + R_Steer_A) * 0.05 ;
        H_Err   = H_Err + 0.05 * Speed * cos(R_Beta) * (tan(F_Steer_A + F_Beta) - tan(R_Steer_A + R_Beta)) / Wheelbase ...
                        - 0.05 * Speed * (C * cos(R_Steer_A + H_Err + R_Beta)) / PSF ;
    end

    
    // ---------- Effective Rear Heading
    Eff_R_H  = H_Err + R_Beta + R_Steer_A ;


    // ---------- Desired Yaw Rate Computation 
    Omega_Desired = Kp * (Lat_Err - Y_Desired) / PSF ;
    Omega         = tan(Eff_R_H) ;

    // ---------- Computation
    Virtual_Control          = (cos(Eff_R_H)^3) * Kd * (Omega - Omega_Desired) / PSF + C_H_Pred * cos(Eff_R_H) / PSF               ;      
    F_Steer_A                   = atan((Wheelbase / cos(R_Steer_A + R_Beta)) * Virtual_Control + tan(R_Steer_A + R_Beta)) - F_Beta ;
    ```

## 6.4. Actuator Delay Compensation via Generalized Predictive Control (GPC)

In a real agricultural vehicle, the steering command $\delta_{cmd}$ calculated by the high-level controller is not instantly executed by the wheels. Hydraulic cylinders and electric motors follow a first-order dynamic:

$$
\delta_{cmd} = \delta +\underbrace{\tau \dot{\delta}}_{\text{Actuator Inertia }}
$$

This section details how the simulator uses Generalized Predictive Control (GPC) to compensate for this lag by calculating an optimal sequence of commands that forces the mechanical steering to track the desired trajectory orientation.

### 6.4.1. Future Reference & Desired Response

The GPC algorithm first defines where the steering *should* be in the future. We define a future reference $\delta_{future}$ based on the curvature $c(s+H)$ at the end of the lookahead distance:

$$
\delta_{future} = \arctan(L \cdot c_{future})
$$

!!! scilab "GPC.sce"

    ``` matlab
    function Delta_Future = Future_Reference(Curvature_Future,Wheelbase)
        Delta_Future = atan(Wheelbase * Curvature_Future) ;
    endfunction
    ```

To avoid violent actuator movements, we do not target this reference abruptly. We define a **Desired Response** trajectory that smoothly bridges the gap between the current steering angle $\delta(k)$ and the future reference $\delta_{future}$ using a smoothing factor $\gamma \in [0, 1]$:

$$
\delta_{desired}(i) = \delta_{future} - \gamma^i \cdot (\delta_{future} - \delta(k))
$$

where $i$ is the step index within the prediction horizon.

!!! scilab "GPC.sce"

    ``` matlab
    function Delta_Desired = Desired_Response(Delta_Future, Current_Delta, Prediction_Horizon, Gamma)
    Delta_Desired = zeros(1, Prediction_Horizon) ;
    for i = 1 : Prediction_Horizon
        Delta_Desired(i) = Delta_Future - (Gamma^i) * (Delta_Future - Current_Delta) ;
    end
    endfunction
    ```

### 6.4.2. Free and Forced Responses

To predict the future behavior of the steering motor, we represent the actuator as a discrete-time state-space system:

$$
X(k+1) = A \cdot X(k) + B \cdot u(k)
$$

$$
y(k) = C \cdot X(k)
$$

The future output of the actuator over the horizon is decomposed into two parts:

1.  **The Free Response ($Y_{free}$):**
    This is the evolution of the steering angle if we keep the command constant ($u=0$). It depends only on the current state of the motor (inertia, current position):

$$
Y_{free}(i) = C \cdot A^i \cdot X(k)
$$

!!! scilab "GPC.sce"

    ``` matlab
    function Free_Response = Free_Response_Computation(Current_State, System_Matrix, Prediction_Horizon)
    C = [1, 0, 0] ;
    Free_Response = zeros(1, Prediction_Horizon) ;
    for i = 1 : Prediction_Horizon
        Free_Response(i) = C * (System_Matrix^i) * Current_State ;
    end
    endfunction
    ```

2.  **The Forced Response ($Y_{forced}$):**
    This is the additional movement caused by a new sequence of control increments $\Delta u$. In our simulator, we assume a "Step" (Echelon) command shape. The contribution of a unit command to the output is:

$$
Y_{forced}(i) = \sum_{j=0}^{i-1} C \cdot A^{i-1-j} \cdot B
$$

!!! scilab "GPC.sce"

    ``` matlab
    function Forced_Response = Forced_Response_Function(System_Matrix, Input_Matrix, Prediction_Horizon)
    C = [1, 0, 0] ; 
    Forced_Response = zeros(1, Prediction_Horizon) ;
    
    for i = 1 : Prediction_Horizon
        Forced_Response_Valors = 0 ;
        for j = 0 : i-1
            Forced_Response_Valors = Forced_Response_Valors + C * (System_Matrix^(i - 1 - j)) * Input_Matrix ;
        end
        Forced_Response(i) = Forced_Response_Valors ;
    end
    endfunction
    ```

### 6.4.3. Optimization and Regularization

The goal is to find the optimal control increment $\mu$ that minimizes the squared error between the desired response and the predicted response. We define the cost function $J$:

$$
J = \sum_{i=1}^{N} (\delta_{desired}(i) - Y_{predicted}(i))^2 + \lambda \cdot \mu^2
$$

Substituting $Y_{predicted} = Y_{free} + \mu \cdot Y_{forced}$ and solving for the minimum ($\frac{\partial J}{\partial \mu} = 0$), we isolate the optimal scaling factor $\mu_{opt}$:

$$
\mu_{opt} = \frac{\sum_{i=1}^{N} (\delta_{desired}(i) - Y_{free}(i)) \cdot Y_{forced}(i)}{\sum_{i=1}^{N} Y_{forced}(i)^2 + \lambda}
$$

The term $\lambda$ is a **regularization factor** that penalizes excessive control effort, preventing the steering motor from vibrating or saturating.

!!! scilab "GPC.sce"

    ``` matlab
    function Delta_Pred = Optimal_Minimization(Delta_Desired, Free_Response, Forced_Response, Command_Shape)
    
    // Criteria d(n_i) = Delta_Desired(i) - Free_Response(i)
    R1 = 0 ;
    R2 = 0 ;
    Lambda = 0.05 ;

    Prediction_Horizon = length(Delta_Desired) ;
    for i = 1 : Prediction_Horizon
        d_i = Delta_Desired(i) - Free_Response(i);
        
        R1 = R1 + (d_i * Forced_Response(i));
        R2 = R2 + (Forced_Response(i)^2);
    end
    
    mu_opt = R1 / (R2 + Lambda);
    Delta_Pred = mu_opt * Command_Shape;
    endfunction
    ```

### 6.4.4. High-Order Nonlinear Regulation (Spatial PID)

In standard exact linearization (as seen in Section 6.2), the system uses a first-order proportional decay to correct the lateral error. While mathematically elegant, a pure first-order response lacks the stiffness and disturbance rejection required for heavy agricultural machinery operating on muddy, uneven terrain or constant side-slopes.

To provide the Generalized Predictive Control (GPC) with a robust foundation, we implement a **second-order spatial dynamic** (a Spatial PID). This requires computing a specific corrective effort, denoted as $v_{cor}$ (`Deviation_Correction_Effort` in the software).

-----

**a) What does $v_{cor}$ represent?**

$v_{cor}$ is a **desired spatial acceleration**. Just as a standard PID controller outputs a desired physical acceleration ($\frac{d^2y}{dt^2}$) to reach a target speed, our spatial controller outputs a desired spatial acceleration ($\frac{d^2y}{ds^2}$) to reach the target path. It defines exactly how the lateral error's rate of change ($y'$) should accelerate or decelerate per meter traveled ($s$).

-----

**b) The Mathematical Origin: Defining the Desired Dynamic**

We want the lateral error $y$ to behave like a stable, damped harmonic oscillator over the distance traveled $s$. We impose the following closed-loop differential equation for the error $\epsilon = y - y_{des}$:

$$
\epsilon^{\prime\prime} + K_d \cdot \epsilon' + K_p \cdot \epsilon + K_i \cdot \int \epsilon \, ds = 0
$$

Assuming the desired path is the centerline ($y_{des} = 0$), then $\epsilon = y$. We isolate the required second-order derivative $y^{\prime\prime}$ to define our target PID effort ($v_{PID}$):

$$
y^{\prime\prime}_{desired} = -K_d \cdot y' - K_p \cdot y - K_i \cdot \int y \, ds
$$

From the chained system derivation, we already established that $y'$ depends on the *Path Scale Factor* ($PSF = 1 - c(s)y$) and the effective heading:

$$
y' = PSF \cdot \tan(\tilde{\theta}_{eff})
$$

Substituting $y'$ into the PID equation gives our baseline effort:

$$
v_{PID} = -K_d \cdot \big( PSF \cdot \tan(\tilde{\theta}_{eff}) \big) - K_p \cdot y - K_i \cdot \int y \, ds
$$

-----

**c) Deriving the Physical System Acceleration ($y^{\prime\prime}$)**

To force the vehicle to obey the PID dynamic, we must find the expression for the actual physical acceleration $y^{\prime\prime}$ of the robot. We derive $y' = PSF \cdot \tan(\tilde{\theta}_{eff})$ with respect to the curvilinear abscissa $s$ using the product rule:

$$
y^{\prime\prime} = \frac{d}{ds} \Big( PSF \cdot \tan(\tilde{\theta}_{eff}) \Big)
$$

$$
y^{\prime\prime} = \frac{d(PSF)}{ds} \cdot \tan(\tilde{\theta}_{eff}) + PSF \cdot \frac{d}{ds} \Big( \tan(\tilde{\theta}_{eff}) \Big)
$$

First, we expand the geometric derivative of the PSF ($PSF = 1 - c(s)y$):

$$
\frac{d(PSF)}{ds} = \frac{d}{ds} \big( 1 - c(s)y \big) = -c'(s) \cdot y - c(s) \cdot y'
$$

In agricultural robotics, the curvature varies slowly enough over short horizons that we can assume $c'(s) \approx 0$. Substituting $y' = PSF \cdot \tan(\tilde{\theta}_{eff})$:

$$
\frac{d(PSF)}{ds} \approx -c(s) \cdot PSF \cdot \tan(\tilde{\theta}_{eff})
$$

Now, we substitute this back into the $y^{\prime\prime}$ equation:

$$
y^{\prime\prime} = \Big[ -c(s) \cdot PSF \cdot \tan(\tilde{\theta}_{eff}) \Big] \cdot \tan(\tilde{\theta}_{eff}) + PSF \cdot \frac{d}{ds} \Big( \tan(\tilde{\theta}_{eff}) \Big)
$$

$$
y^{\prime\prime} = -c(s) \cdot PSF \cdot \tan^2(\tilde{\theta}_{eff}) + PSF \cdot \frac{d}{ds} \Big( \tan(\tilde{\theta}_{eff}) \Big)
$$

-----

**d) Isolating the Control Effort**

The simulator's high-level controller manipulates the vehicle's orientation variation, which is the term:

$$
PSF \cdot \frac{d}{ds}(\tan(\tilde{\theta}_{eff}))
$$

We define this term as our total control input $v_{cor}$. Therefore:

$$
y^{\prime\prime} = -c(s) \cdot PSF \cdot \tan^2(\tilde{\theta}_{eff}) + v_{cor}
$$

To ensure the robot follows our desired PID behavior, we set the physical acceleration equal to the desired acceleration ($y^{\prime\prime} = v_{PID}$):

$$
v_{PID} = -c(s) \cdot PSF \cdot \tan^2(\tilde{\theta}_{eff}) + v_{cor}
$$

Isolating $v_{cor}$:

$$
v_{cor} = v_{PID} + c(s) \cdot PSF \cdot \tan^2(\tilde{\theta}_{eff})
$$

Finally, by expanding the $v_{PID}$ term derived in Step 2, we obtain the complete analytical formula implemented in the Scilab code:

$$
v_{cor} = \underbrace{-K_d \cdot PSF \cdot \tan(\tilde{\theta}_{eff}) - K_p \cdot y - K_i \cdot \int y \, ds}_{\text{Spatial PID Regulation}} + \underbrace{c(s) \cdot PSF \cdot \tan^2(\tilde{\theta}_{eff})}_{\text{Geometric Feedforward Cancellation}}
$$

-----

**e) Physical Interpretation**

The formula is composed of two distinct parts that allow the vehicle to navigate complex environments:

1.  **The Spatial PID Regulation:** This is the reactive part. It calculates the necessary acceleration to return to the path based on the current lateral error ($y$), the current direction of travel ($\tan$), and the history of past errors (the integral term). This ensures the robot "stiffens" its reaction if a disturbance like wind or a slope pushes it away.
2.  **The Geometric Feedforward Cancellation:** This is the proactive part. When a vehicle is tilted relative to a curved path ($\tan \neq 0$ and $c \neq 0$), the pure geometry of the Frenet frame creates an artificial outward "push" on the lateral error. This term calculates that distortion and cancels it exactly.

By mathematically neutralizing the frame's curvature, the controller allows the PID terms to operate as if the vehicle were on a perfectly straight line, significantly improving tracking precision and stability in sharp turns.

### 6.4.5. Analytic Factorization: The $U$ and $V$ Terms

The introduction of the variables $U$ and $V$ is a mathematical strategy designed to decouple the steering command. In a Generalized Predictive Control (GPC) framework, we need to isolate the **corrective effort** from the **trajectory-following effort**.

To understand where these terms originate, we must start from the final non-linear steering law derived in the Backstepping section (Section 6.2.6):

$$
\tan(\delta_F + \beta_F) = \frac{L}{\cos(\beta_R + \delta_R)} m_3 + tan(\delta_R + \beta_R)
$$

-----

**a) Decomposing the Virtual Command $m_3$**

In Section 6.4.4, we established that the virtual spatial yaw rate $m_3$ is composed of a feedforward term (curvature) and a feedback term (correction via $v_{cor}$):

$$
m_3 = \underbrace{\frac{c(s) \cos(\tilde{\theta}_{eff})}{PSF}}_{\text{Curvature term}} + \underbrace{\frac{\cos^3(\tilde{\theta}_{eff})}{PSF^2} v_{cor}}_{\text{Corrective term}}
$$

By substituting this expression of $m_3$ into our steering law, we get:

$$
\tan(\delta_F + \beta_F) = \frac{L}{\cos(\beta_R + \delta_R)} \left[ \frac{c(s) \cos(\tilde{\theta}_{eff})}{PSF} + \frac{\cos^3(\tilde{\theta}_{eff})}{PSF^2} v_{cor} \right] + \tan(\delta_R + \beta_R)
$$

-----

**b) Identifying $U$ and $V$**

We can now distribute the leading fraction across the two terms inside the brackets. This allows us to group the variables into two distinct physical components:

$$
\tan(\delta_F + \beta_F) = \underbrace{\frac{L}{\cos(\beta_R + \delta_R)} \left( \frac{c(s) \cos(\tilde{\theta}_{eff})}{PSF} \right)}_{U} + \underbrace{\frac{L}{\cos(\beta_R + \delta_R)} \left( \frac{\cos^3(\tilde{\theta}_{eff})}{PSF^2} v_{cor} \right) + \tan(\delta_R + \beta_R)}_{V}
$$

  * **$U$ (The Trajectory Component):** This term represents the theoretical steering angle required to follow the path perfectly, assuming the robot is already perfectly aligned with the trajectory ($v_{cor} = 0$). It depends strictly on the wheelbase $L$, the local curvature $c(s)$, and the path scale factor.
  * **$V$ (The Correction & Coupling Component):** This term aggregates the corrective effort ($v_{cor}$) required to cancel current tracking errors, and adds the compensation for the rear axle's current orientation ($``\tan(\delta_R + \beta_R)``$).

The total steering command (compensated for slip) is thus simplified to a clean algebraic sum of tangents:

$$
\tan(\delta_{total} + \beta_F) = U + V
$$

!!! scilab "Front_Axle.sce"

    ``` matlab
    U_Term = (Wheelbase / cos(R_Steer_A + R_Beta)) * (C * cos(Eff_R_H) / PSF) ;
    V_Term = (Wheelbase / cos(R_Steer_A + R_Beta)) * ( ((cos(Eff_R_H)^3) / (PSF^2)) * Deviation_Correction_Effort ) + tan(R_Steer_A + R_Beta) ;
    ```

### 6.4.6. Geometric Decoupling via Trigonometric Identity

The GPC algorithm needs to optimize the **corrective steering angle** $\delta_{corr}$ specifically. However, because the system is non-linear, we cannot simply subtract angles (i.e., $\delta_{corr} \neq \delta_{total} - \delta_{traj}$). We must remain in the "tangent space" to preserve mathematical exactness.

-----

**a) Defining the Target Angles**

We define:

  * The total angle: $A = \delta_{total} + \beta_F$, where $\tan(A) = U + V$.
  * The trajectory angle: $B = \delta_{traj}$, where $\tan(B) = U$.

We seek the corrective angle $\delta_{corr}$ such that the total steering is the sum of the trajectory and the correction:

$$
\delta_{total} + \beta_F = \delta_{traj} + \delta_{corr} \implies \delta_{corr} = A - B
$$

-----

**b) Applying the Tangent Subtraction Identity**

To find $\delta_{corr}$, we use the fundamental trigonometric identity for the subtraction of tangents:

$$
\tan(A - B) = \frac{\tan A - \tan B}{1 + \tan A \tan B}
$$

Substituting our definitions of $\tan A$ and $\tan B$:

$$
\tan(\delta_{corr}) = \frac{(U + V) - (U)}{1 + (U + V) \cdot U}
$$

Expanding the denominator:

$$
\tan(\delta_{corr}) = \frac{V}{1 + U^2 + UV}
$$

-----

**c) Final Corrective Effort**

By applying the arctangent function, we isolate the exact corrective steering angle:

$$
\delta_{corr} = \arctan\left( \frac{V}{1 + U^2 + UV} \right)
$$

This formula is the one used in the Scilab code to feed the GPC optimizer. It ensures that the predictive controller only works on the "error-correcting" portion of the steering, while the path curvature is handled separately by the exact linearization logic. This decoupling is what allows the simulator to maintain sub-centimeter precision even during sharp turns with slow hydraulic actuators.

!!! scilab "Front_Axle.sce"

    ``` matlab
    Corrective_Steering = atan(V_Term / (1 + U_Term^2 + U_Term * V_Term));
    ```

### 6.4.7. Final Command Synthesis

The final steering command applied to the front axle is a synthesis of two distinct control efforts:

1.  **Corrective Steering ($\delta_{corr}$):** The term derived above that corrects current spatial errors ($y, \tilde{\theta}$) and compensates for dynamic slip.
2.  **Optimal Trajectory Steering ($\delta_{GPC}$):** The predictive term calculated in section 6.4.3 that prepares the actuator for upcoming changes in path geometry.

$$
\delta_{F, final} = \delta_{corr} + \delta_{GPC, optimal}
$$

By combining the geometric precision of exact linearization with the temporal foresight of GPC, the simulator achieves high-fidelity tracking even with slow, heavy-duty hydraulic actuators.