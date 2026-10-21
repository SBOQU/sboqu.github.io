---
template: Simulateur/Implementation.html
---

# Vehicle Dynamics

The physical core of the simulator. A single, self-contained module that propagates the full vehicle state forward in time using the extended bicycle model and Pacejka tire forces.

---

## Dynamic\_Mouvement.sce

The **heart of the simulator**. Propagates the full rigid-body state $(X, Y, \theta, \dot{\theta}, \beta)$ forward by one time step using Euler integration. Implements the extended bicycle model with Pacejka-inspired lateral tire force generation for front and rear axles. Actuator lag is modeled as a first-order filter on the steering commands.

**Inputs** — current state vector, front and rear steering angles $\delta_F$, $\delta_R$, longitudinal speed $v$, terrain slope $\phi$, and time step $\Delta t$.

**Outputs** — updated state $(X, Y, \theta, \dot{\theta}, \beta)$, tracked positions for plotting, and the generated lateral forces $F_{y,F}$, $F_{y,R}$ for observer feedback.

!!! scilab "Dynamic_Mouvement.sce"
    ```matlab
    function [X, Y, X_Tracked, Y_Tracked, Theta, Theta_Dot, Vehicle_Beta, F_Lat_Force, R_Lat_Force] = Dynamic_Mouvement (...
    X, ... 
    Y, ...
    Theta, ...
    Theta_Dot, ...
    Speed, ...
    Vehicle_Beta, ...
    Front_Lateral_Force, ...
    Rear_Lateral_Force, ...
    Front_Steering_Angle, ...
    Rear_Steering_Angle, ...
    Tire_Model)

    
        // ============================================================================================
        //                      Local renaming for compactness
        // ============================================================================================
        global Wheelbase Length_Front Length_Rear Vehicle_Mass Yaw_Inertia Cornering_Stiffness Sample_Time g ;

        F_Lat_Force = Front_Lateral_Force ;
        R_Lat_Force = Rear_Lateral_Force ;
        F_Steer_A = Front_Steering_Angle ;
        R_Steer_A = Rear_Steering_Angle ;

        L = Wheelbase ;
        LF = Length_Front ;
        LR = Length_Rear ;
        M = Vehicle_Mass ;
        Iz = Yaw_Inertia ;
        C = Cornering_Stiffness ;
        dt = Sample_Time ;



        // ============================================================================================
        //                      The fundamental principle of dynamics in rotation
        // ============================================================================================

        Theta_Double_Dot = (1/Iz) * (-LF * F_Lat_Force * cos(F_Steer_A) + LR * R_Lat_Force * cos(R_Steer_A)) ;

        // -------------------------------------------------------- Euler Integration to get Theta and Theta_Dot ------------------------------------
        Theta_Dot = Theta_Dot + Theta_Double_Dot * dt ;
        Theta = Theta + Theta_Dot * dt ;


        // ============================================================================================
        //                      Derivative Update
        // ============================================================================================


        Slope = 0 ;                                    // Selection of the sloap in deg
        Slope_Rad = Slope * %pi/180 ;

        if Speed > 0.25                                // Safty to avoid to divise by 0 when the robot close to stop
            CoG_Speed  = Speed / cos(Vehicle_Beta) ;           // Speed of the center of gravity
            Vehicle_Beta_Dot   = (-1/(M * CoG_Speed)) * ((F_Lat_Force) * cos(Vehicle_Beta - F_Steer_A)...
                            + (R_Lat_Force) * cos(Vehicle_Beta - R_Steer_A)) + (g*sin(Slope_Rad) / CoG_Speed) - Theta_Dot ;
            
            Vehicle_Beta       = Vehicle_Beta + Vehicle_Beta_Dot * dt ;
            Front_Beta = atan( (tan(Vehicle_Beta)) + (LF * Theta_Dot) / (CoG_Speed * cos(Vehicle_Beta))) - F_Steer_A ;
            Rear_Beta  = atan( (tan(Vehicle_Beta)) - (LR * Theta_Dot) / (CoG_Speed * cos(Vehicle_Beta))) - R_Steer_A ;

        else
            Front_Beta = 0 ;
            Rear_Beta = 0 ;
        end
            
        
        // ============================================================================================
        //                      Lateral Forces
        // ============================================================================================
        

        select Tire_Model
        
            // ---------- Linear Model ----------    
            case 1 then
                F_Lat_Force = C * Front_Beta;
                R_Lat_Force = C * Rear_Beta;

            
            // ---------- Pacejka Model ----------  
            case 2 then
                // Pacejka model's parameter
                // From the article : Etude, modélisation et validation du contact roue/sol pour la simulation de véhicules et robots mobiles sous le logiciel Adams, TABLEAU 6 - p. 42/50
                // (https://hal.inrae.fr/hal-02597620v1)

                a0 = 1.3   ;    // Shape Factor
                a1 = -8    ;    // Second order coefficient to model the peak adhesion curve
                a2 = 100   ;    // First order coefficient to model the peak adhesion curve
                a3 = 200   ;    // Stiffness coefficient B, dictates the slope of the force curve at the origin
                a4 = 1.82  ;    // Adjusts the stiffness evolution according to the vertical load Fz
                a5 = 0.208 ;    // Fine-tunes the stiffness based on the applied vertical load on the wheel
                a6 = 0     ;    // Shape factor E, controls the curvature at the peak of the curve
                a7 = 0.354 ;    // Manages the transition between the elastic zone and the pure slip zone
                a8 = 5     ;    // Adapts the transition based on the applied weight on the wheel

                // --------- Normal Forces
                F_Fz = (LR / L) * M * g ;   // Front normal force
                R_Fz = (LF / L) * M * g ;   // Rear normal force

                // Equation : Lateral_Force = D * sin(C * atan(B*x - E*(B*x - atan(B*x)))), with a0 = C

                //  --------- Front Wheel
                D_Front = a1 * (F_Fz^2) + (a2 * F_Fz) ;
                B_Front = (a3 * sin(a4 * atan(a5 * F_Fz) ))  / (a0 * D_Front + 1e-6) ;
                E_Front = a6 * (F_Fz^2) + ( (a7 * F_Fz) + a8) ; 
                
                //  --------- Rear Wheel
                D_Rear = a1 * (R_Fz^2) + (a2 * R_Fz) ; 
                B_Rear = (a3 * sin(a4 * atan(a5 * R_Fz) )) / (a0 * D_Rear + 1e-6) ;
                E_Rear = a6 * (R_Fz^2) + ( (a7*R_Fz) + a8) ;

                // Radian to degree conversion
                Front_Beta_Deg = Front_Beta * 180 / %pi ; 
                Rear_Beta_Deg  = Rear_Beta  * 180 / %pi ;

                // Lateral Forces
                F_Lat_Force = D_Front * sin(a0 * atan(B_Front * ((1 - E_Front) * Front_Beta_Deg + (E_Front / B_Front) * atan(B_Front * Front_Beta_Deg)))) ;
                R_Lat_Force = D_Rear  * sin(a0 * atan(B_Rear  * ((1 - E_Rear)  * Rear_Beta_Deg  + (E_Rear  / B_Rear ) * atan(B_Rear  * Rear_Beta_Deg))))  ;
            end

        // ============================================================================================
        //                      Pos Update
        // ============================================================================================

        // X point to the right and Y to the top.
        // Theta = 0 when aligned with the negative Y-axis (pointing downwards) and increases counter-clockwise
        // --------- Euler Integration to get X and Y

        X = X + Speed * dt * sin(Theta + Rear_Beta + R_Steer_A) ;     // X represents the X-coordinate of the rear axle center
        Y = Y - Speed * dt * cos(Theta + Rear_Beta + R_Steer_A) ;     // Y represents the Y-coordinate of the rear axle center.
        
        // --------- Coordinates of a specific interest point (e.g., tool or sensor) with a potential offset from the rear axle center.
        
        Tx=0 ;
        Ty=0 ;

        X_Tracked = X + Tx * cos(Theta - (%pi / 2)) - Ty * sin(Theta - (%pi / 2)) ;
        Y_Tracked = Y + Tx * sin(Theta - (%pi / 2)) + Ty * cos(Theta - (%pi / 2)) ;
    endfunction  
    ```
