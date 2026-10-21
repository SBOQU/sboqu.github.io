---
template: Simulateur/Implementation.html
---

# Front Axle Control

The primary steering actuator is driven by three cascaded control layers of increasing sophistication. The active strategy is selected by `Control_Mode` in `Parameters.sce` — each mode builds on the previous one.

---

## Front\_Axle.sce

Orchestrates the front steering command $\delta_F$ through the selected control strategy.

| Mode | Strategy | Description |
|------|----------|-------------|
| `1` | PD | Baseline linear controller — fast to tune, blind to curvature and slip |
| `2` | Backstepping | Exact linearization of the nonlinear kinematic model into a chained integrator |
| `3` | GPC | Predictive feedforward on top of Backstepping — compensates actuator phase lag |

**Outputs** — final front steering angle $\delta_F$, predicted steering horizon $\delta_H$, integral of lateral error for anti-windup monitoring, and corrective steering contribution.

!!! scilab "Front_Axle.sce"
    ```matlab
    function [F_Steer_A, Steer_H_Pred, Int_Lat_Err, Corrective_Steering] = Model_Front_Axle_Output(...
    Lateral_Error, ...
    Heading_Error, ...
    Curvature, ...
    Front_Beta, ...
    Rear_Beta, ...
    Speed, ...
    Rear_Steering_Angle, ...
    N_1_Front_Steering_Angle, ...
    N_2_Front_Steering_Angle, ...
    N1_Corrective_Steering, ...
    Integral_Lateral_Error, ...
    Horizon_Of_Prediction, ...
    Curvature_Horizon_Of_Prediction, ...
    Steering_Horizon_Of_Prediction, ...
    Rear_Steering_Reference, ...
    Law_Type)


        // ============================================================================================
        //                      Local renaming for compactness
        // ============================================================================================

        global Wheelbase Act_State_Matrix Act_Input_Matrix  ;

        Lat_Err           = Lateral_Error                   ;
        H_Err             = Heading_Error                   ;
        C                 = Curvature                       ;
        F_Beta            = Front_Beta                      ; 
        R_Beta            = Rear_Beta                       ;
        R_Steer_A         = Rear_Steering_Angle             ;
        N1_F_Stee_A       = N_1_Front_Steering_Angle        ;
        N2_F_Stee_A       = N_2_Front_Steering_Angle        ;
        N1_Correct_Steer  = N1_Corrective_Steering          ;
        Int_Lat_Err       = Integral_Lateral_Error          ;
        H_Pred            = Horizon_Of_Prediction           ;
        C_H_Pred          = Curvature_Horizon_Of_Prediction ;
        Steer_H_Pred      = Steering_Horizon_Of_Prediction  ;
        R_Steer_Ref       = Rear_Steering_Reference         ;

        // ============================================================================================
        //                      The Command Law
        // ============================================================================================
            
        Min_Angle = -30  ;   
        Max_Angle =  30  ;
        Max_Rad = Max_Angle * %pi / 180 ;
        Min_Rad = Min_Angle * %pi / 180 ;

        select Law_Type

            // ============================================================================================
            //                       Proportional Derivative
            // ============================================================================================
            case 1 then

            // ---------- Parameters
            Kd        = -0.6 ;
            Kp        = -0.2 ;

            // ---------- Computation
            F_Steer_A  = Kp * Lat_Err + Kd * H_Err    ;

            F_Steer_A = min( Max_Rad, F_Steer_A )     ;
            F_Steer_A = max( Min_Rad, F_Steer_A )     ;
            
            // ---------- Output Adaptation
            Steer_H_Pred = 0                          ;
            Int_Lat_Err  = Int_Lat_Err + Lat_Err      ;
            Corrective_Steering = 0                   ;

            // ============================================================================================
            //                      Predictive Chained System
            // ============================================================================================
            case 2 then

            // ---------- Parameters
            Kd        = -0.9 ;
            Kp        = -0.3 ;

            // ---------- Effective Rear Heading
            Eff_R_H = H_Err + R_Beta + R_Steer_A ; 

            // ---------- Path_Scale_Factor
            Path_Scale_Factor = 1 - (C_H_Pred * Lat_Err) ;   // Use of C_H_Pred instead of C
            PSF               = Path_Scale_Factor        ;   // For compacteness
            if PSF < 0.1 then PSF = 0.1 ; end

            // ---------- Desired Yaw Rate Computation
            Omega_Desired = Kp * (Lat_Err) / PSF ;
            Omega         = tan(Eff_R_H)         ;
            
            // ---------- Computation
            Virtual_Control          = (cos(Eff_R_H)^3) * Kd * (Omega - Omega_Desired) / PSF + C_H_Pred * cos(Eff_R_H) / PSF               ; // From chained System        
            F_Steer_A                = atan((Wheelbase / cos(R_Steer_A + R_Beta)) * Virtual_Control + tan(R_Steer_A + R_Beta)) - F_Beta    ; // Inverse Kinematics

            // ---------- Saturation
            F_Steer_A = min( Max_Rad, F_Steer_A )     ;
            F_Steer_A = max( Min_Rad, F_Steer_A )     ;
        
            // ---------- Output Adaptation
            Steer_H_Pred = 0                     ;
            Int_Lat_Err  = Int_Lat_Err + Lat_Err ;
            Corrective_Steering = 0              ;

            // ============================================================================================
            //                      Exact Linearization with Curvature Feedforward
            // ============================================================================================
            case 3 then
            
            // ---------- Parameters
            Y_Desired     = 0                   ;
            Conv_Distance = 5                   ; // Convergence distance in meter
            Kp            = -3 / Conv_Distance  ;
            Kd            = 3 * Kp              ; 
            F_Steer_A   = N1_F_Stee_A           ;

            // ---------- Path_Scale_Factor
            Path_Scale_Factor = 1 - (C * Lat_Err) ;
            PSF               = Path_Scale_Factor ;   // For compacteness
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
            Virtual_Control          = (cos(Eff_R_H)^3) * Kd * (Omega - Omega_Desired) / PSF + C_H_Pred * cos(Eff_R_H) / PSF               ; // From chained System        
            F_Steer_A                   = atan((Wheelbase / cos(R_Steer_A + R_Beta)) * Virtual_Control + tan(R_Steer_A + R_Beta)) - F_Beta ; // Inverse Kinematics

            // ---------- Saturation
            F_Steer_A = min( Max_Rad, F_Steer_A )     ;
            F_Steer_A = max( Min_Rad, F_Steer_A )     ;
        
            // ---------- Output Adaptation
            Steer_H_Pred = 0                     ;
            Int_Lat_Err  = Int_Lat_Err + Lat_Err ;
            Corrective_Steering = 0              ;

            // ============================================================================================
            //                      Exact Linearization with Actuator Delay Compensation AND GPC
            // ============================================================================================
            case 4 then
            
            // ---------- Parameters
            Y_Desired   = 0                         ; // Target lateral error
            Kd          = 1.5                       ;
            Xi          = 1.0                       ; // Damping ratio
            Kp          = (Kd^2) / (4 * sqrt(Xi))   ; 
            Ki          = 0.1                       ;
            Gamma       = 0.5                       ; // Between 0(Fast) and 1(Slow) ---> How fast the robot join the trajectory
            Preview_Steps = round(20 * abs(H_Pred)) ;
            if Preview_Steps < 1 then Preview_Steps = 10 ; end
            
            // ---------- Computation
            Int_Lat_Err = Int_Lat_Err + 0.1 * Lat_Err ;
            Eff_R_H     = H_Err + R_Beta + R_Steer_A  ; 

            // ---------- Path_Scale_Factor
            Path_Scale_Factor = 1 - (C * Lat_Err) ;
            PSF               = Path_Scale_Factor ;   // For compacteness
            if PSF < 0.1 then PSF = 0.1 ; end
            
            // ---------- Computation
            Deviation_Correction_Effort = -Kd * PSF * tan(Eff_R_H) - Kp * (Lat_Err - Y_Desired) - Ki * Int_Lat_Err + C * PSF * (tan(Eff_R_H)^2) ;
            
            U_H_Term = Wheelbase * C_H_Pred ;
            U_Term = (Wheelbase / cos(R_Steer_A + R_Beta)) * (C * cos(Eff_R_H) / PSF) ;
            V_Term = (Wheelbase / cos(R_Steer_A + R_Beta)) * ( ((cos(Eff_R_H)^3) / (PSF^2)) * Deviation_Correction_Effort ) + tan(R_Steer_A + R_Beta) ;
            
            Corrective_Steering = atan(V_Term / (1 + U_Term * V_Term + U_Term^2)) - F_Beta ;

            // ---------- Trajectory Prevailing Parts
            Preview_Trajectory_Steering = atan(U_H_Term) ; 
            Current_Trajectory_Steering = atan(U_Term)   ; 

            Actuator_State_Error = [N1_F_Stee_A - N1_Correct_Steer    ;
                                    N2_F_Stee_A - N1_Correct_Steer    ;
                                    Steer_H_Pred]                     ;   
            
            //---------- GPC
            Delta_Future                     = Future_Reference(Preview_Trajectory_Steering, Current_Trajectory_Steering)         ;
            Delta_Desired                    = Desired_Response(Delta_Future ,Actuator_State_Error(1) ,Preview_Steps ,Gamma )     ;
            Free_Response                    = Free_Response_Computation(Actuator_State_Error ,Act_State_Matrix ,Preview_Steps )  ;
            Forced_Response                  = Forced_Response_Function(Act_State_Matrix ,Act_Input_Matrix ,Preview_Steps )       ;
            Command_Shape                    = Control_Structure("Echelon", Preview_Steps)                                        ;
            Optimal_Trajectory_Steering      = Optimal_Minimization(Delta_Desired, Free_Response, Forced_Response, Command_Shape) ;
            
            // ---------- Saturation
            
            F_Steer_A  = Corrective_Steering + Optimal_Trajectory_Steering(1) ;
            Steer_H_Pred = Optimal_Trajectory_Steering(1)                     ;
            
            // ---------- Saturation
            F_Steer_A = min( Max_Rad, F_Steer_A )     ;
            F_Steer_A = max( Min_Rad, F_Steer_A )     ;
        
            end

    endfunction
    ```

---

## GPC.sce

Standalone computation of the **Generalized Predictive Control** feedforward term. Predicts the future desired steering angle over a horizon $N_H$ using the lookahead curvature, then minimizes the GPC cost function to cancel the phase lag introduced by hydraulic actuator inertia. Called internally by `Front_Axle.sce` when `Control_Mode = 3`.

$$
\delta_{GPC} = \arg\min_{\delta} \sum_{k=1}^{N_H} \left( \delta_{ref}(k) - \delta(k) \right)^2 + \lambda \, \Delta\delta(k)^2
$$

!!! scilab "GPC.sce"
    ```matlab
    // ==========================================================================================================
    //                  STEP 1 : Computation of the future reference
    // ==========================================================================================================

    // Equation : Delta_Future = arctan(L * c(s + s_H))

    function Delta_Future = Future_Reference(Curvature_Future,Wheelbase)
        Delta_Future = atan(Wheelbase * Curvature_Future) ;
    endfunction

    // ==========================================================================================================
    //                  STEP 2 : Computation of the desired response
    // ==========================================================================================================

    // Equation : Delta_Desired = Delta_Future - Gamma^i * (Delta_Future - Delta_Present)

    function Delta_Desired = Desired_Response(Delta_Future, Current_Delta, Prediction_Horizon, Gamma)

        Delta_Desired = zeros(1, Prediction_Horizon) ;
        for i = 1 : Prediction_Horizon
            Delta_Desired(i) = Delta_Future - (Gamma^i) * (Delta_Future - Current_Delta) ;
        end
    endfunction
    // ==========================================================================================================
    //                  STEP 3 : Computation of the free response and the forced response
    // ==========================================================================================================
    // ----------------------------------------------------- Free Response -----------------------------------------------------
    // Equation : Free_Response = C * F^i * X(n)

    function Free_Response = Free_Response_Computation(Current_State, System_Matrix, Prediction_Horizon)
        C = [1, 0, 0] ;
        Free_Response = zeros(1, Prediction_Horizon) ;
        for i = 1 : Prediction_Horizon
            Free_Response(i) = C * (System_Matrix^i) * Current_State ;
        end
    endfunction

    // ----------------------------------------------------- Forced Response -----------------------------------------------------

    // Equation : Forced_Response = Sum of (C * F(i-j) * K * Delta_C_B(n+j-1) ), with Delta_C_B(n+j-1) = 1, because we supose a echelon's response

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

    // ==========================================================================================================
    //                  STEP 4 : Selection of the structure command for the forced response
    // ==========================================================================================================

    function Command_Shape = Control_Structure(Shape_Type, Prediction_Horizon)
        // Allow the choosing of the shape for the command*

        // Echelon command ---> 1   => Most simple and common shape.
        // Ramp command    ---> i   => Useful for spiral shape curvature.
        // Parabol command ---> i^2 => Uncomon in robotic, but usefull for hyper dynamics systems.

        select Shape_Type

            case "Echelon" then
                Command_Shape = ones(1, Prediction_Horizon) ; // Vecteur de 1
            case "Ramp" then
                Command_Shape = 1:Prediction_Horizon        ; // Vecteur [1, 2, 3...]
            case "Parabola" then
                Command_Shape = (1:Prediction_Horizon).^2   ; // Vecteur [1, 4, 9...]
        end
    endfunction 


    // ==========================================================================================================
    //                  STEP 5 : Optimize command
    // ==========================================================================================================


    function Delta_Pred = Optimal_Minimization(Delta_Desired, Free_Response, Forced_Response, Command_Shape)
        
        // Criteria d(n_i) = Delta_Desired(i) - Free_Response(i)
        
        R1 = 0 ;
        R2 = 0 ;
        Lambda = 0.05 ; // <-- FACTEUR DE RÉGULARISATION VITAL

        Prediction_Horizon = length(Delta_Desired) ;
        
        for i = 1 : Prediction_Horizon
            d_i = Delta_Desired(i) - Free_Response(i);
            
            R1 = R1 + (d_i * Forced_Response(i));
            R2 = R2 + (Forced_Response(i)^2);
        end
        
        mu_opt = R1 / (R2);
        Delta_Pred = mu_opt * Command_Shape;
    endfunction
    ```
