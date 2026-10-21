---
template: Simulateur/Implementation.html
---

# State Observers

Tire slip angles $\beta_F$ and $\beta_R$ cannot be measured directly without costly sensors. This module reconstructs them in real-time from available measurements using three observer architectures selectable at runtime.

---

## Observer.sce

Runs the three observer architectures in parallel and selects the active one based on the `Observer_Mode` parameter set in `Parameters.sce`.

| Mode | Architecture | Description |
|------|-------------|-------------|
| `1` | Kinematic Inversion | Algebraic reconstruction from kinematic model — no dynamics, zero lag |
| `2` | Luenberger | Linear state observer with pole-placement gain matrix |
| `3` | Lyapunov-based Adaptive | Nonlinear observer with adaptive gain, stable on slopes and low-adhesion terrain |

**Outputs** — estimated slip angles $\hat{\beta}_F$, $\hat{\beta}_R$, vehicle sideslip $\hat{\beta}$, and the reconstructed tracking errors $\hat{y}$, $\hat{\tilde{\theta}}$ fed back to the controllers.

!!! scilab "Observer.sce"
    ```matlab
    function [Front_Beta, Rear_Beta, Vehicle_Beta_Esti, Lat_Err_Esti, H_Err_Esti] = State_Observer(...
    Lateral_Error, ...
    Heading_Error, ...
    Curvature, ...
    Speed, ...
    Front_Steering_Angle, ...
    Rear_Steering_Angle, ...
    Estimated_Lateral_Error, ...
    Estimated_Heading_Error, ...
    N_1_Front_Beta, ...
    N_1_Rear_Beta, ...
    Observer_Type)

        // ============================================================================================
        //                      Local renaming for compactness
        // ============================================================================================

        Lat_Err      = Lateral_Error           ;
        H_Err        = Heading_Error           ;
        C            = Curvature               ;
        F_Steer_A    = Front_Steering_Angle    ;
        R_Steer_A    = Rear_Steering_Angle     ;
        Lat_Err_Esti = Estimated_Lateral_Error ;
        H_Err_Esti   = Estimated_Heading_Error ;
        N1_F_Beta    = N_1_Front_Beta          ;
        N1_R_Beta    = N_1_Rear_Beta           ;

        // ---------- Parameters ----------
        global Wheelbase Length_Front Length_Rear Sensor_Sample_Time ;

        LF = Length_Front ;
        LR = Length_Rear  ;
        Min_Angle = -30   ;
        Max_Angle =  30   ;
        Max_Rad = Max_Angle * %pi / 180 ;
        Min_Rad = Min_Angle * %pi / 180 ;

        // ============================================================================================
        //                      Observer Logic
        // ============================================================================================

        select Observer_Type

            // ============================================================================================
            //                      Kinematic Inversion
            // ============================================================================================
            case 1 then

            // -------------------------------------------------------------------------------- Parameters 
            Gy = -30 ;
            Gt = -10 ;

            // -------------------------------------------------------------------------------- Computation 
            
            // ---------- Low Speed
            if Speed < 0.5 then
                Lat_Err_Esti = Lat_Err ;
                H_Err_Esti   = H_Err   ;
                Front_Beta   = 0       ;
                Rear_Beta    = 0       ;
            
            // ---------- Normal Speed
            else       
                Eps_Lat             = Lat_Err_Esti - Lat_Err ;
                Eps_H               = H_Err_Esti - H_Err     ;
                Path_Scale_Factor   = 1 - C * Lat_Err_Esti   ;
                PSF                  = Path_Scale_Factor     ;

                // ---------- Rear Beta from Kinematic Model
                Valeur_Asin = (Gy * Eps_Lat ) / Speed ; // Desired dynamic from Gy
                Valeur_Asin = min( 1 ,Valeur_Asin)    ; // Safty because Asin ∈ [1,-1]
                Valeur_Asin = max(-1 ,Valeur_Asin)    ;

                Rear_Beta = asin(Valeur_Asin) - (H_Err_Esti + R_Steer_A) ;
                Rear_Beta = atan( sin(Rear_Beta), cos(Rear_Beta) )       ; // Angle wrapping between [-π,π]

                // ---------- Front Beta from Kinematic Model
                Theta_2 = H_Err_Esti + Rear_Beta + R_Steer_A ;
                Theta_3 = Rear_Beta + R_Steer_A              ;

                Front_Beta = atan( (Wheelbase / (Speed * cos(Theta_3) ) ) ...                       // Desired dynamic from G_Theta      
                            * (Gt * Eps_H + Speed * C * cos(Theta_2) / PSF) + tan(Theta_3) ) ...
                            - F_Steer_A ;             
                Front_Beta = atan( sin(Front_Beta), cos(Front_Beta) ) ;                             // Angle wrapping between [-π,π]             
                
                
                // ---------- Estimation Update
                Lat_Err_Esti = Lat_Err_Esti + Speed * Sensor_Sample_Time * sin( H_Err_Esti + Theta_3 ) ;

                H_Err_Esti   = H_Err_Esti + Speed * Sensor_Sample_Time * cos(Theta_3) * ...
                            (tan(F_Steer_A + Front_Beta) - tan(Theta_3)) / Wheelbase - ...
                            Speed * Sensor_Sample_Time * (C * cos(H_Err_Esti + Theta_3)) / (1 - C * Lat_Err_Esti) ;
            end


            // ============================================================================================
            //                      Luenberger Extended Adaptive Observer
            // ============================================================================================
            case 2 then

            // ---------- Parameters ----------
            K1 = 30 * [-1, 0 ; 0,   -1] ;
            K2 = 10 * [-1, 0 ; 0, -0.4] ;

            // ---------- Low Speed
            if Speed < 0.2 then
                Lat_Err_Esti = Lat_Err ;
                H_Err_Esti   = H_Err   ;
                Front_Beta   = 0       ;
                Rear_Beta    = 0       ;
            
            // ---------- Normal Speed    
            else
                Eps_Lat = Lat_Err_Esti - Lat_Err ;
                Eps_Lat = min( 0.5 ,Eps_Lat)     ;
                Eps_Lat = max(-0.5 ,Eps_Lat)     ;

                Eps_H   = H_Err_Esti - H_Err     ;
                Eps_H = min( 0.2 ,Eps_H)         ; 
                Eps_H = max(-0.2 ,Eps_H)         ;
        
                X_Tild  = [Eps_Lat ; Eps_H]      ;

                // ---------- Path Scale Factor
                Path_Scale_Factor = 1 - C * Lat_Err_Esti ;
                PSF = Path_Scale_Factor
                if PSF < 0.1 then PSF = 0.1 ; end  

                // ---------- Saturation of Effective Front Steering
                Eff_F_Steer = F_Steer_A + N1_F_Beta       ;
                Eff_F_Steer     = min( 1.2, Eff_F_Steer ) ;
                Eff_F_Steer     = max(-1.2, Eff_F_Steer ) ;
                
                // ---------- Saturation of N1_R_Beta
                Safe_N1_R_Beta = N1_R_Beta ;
                Safe_N1_R_Beta = min( 1.2, Safe_N1_R_Beta ) ; 
                Safe_N1_R_Beta = max(-1.2, Safe_N1_R_Beta ) ;

                // ---------- Beta Jacobian
                Beta_Jacobian = zeros(2,2)                                                                                      ;
                
                Beta_Jacobian(1,1) = 0                                                                                          ;
                Beta_Jacobian(1,2) = Speed * cos(H_Err_Esti + N1_R_Beta)                                                        ;
                Beta_Jacobian(2,1) = Speed * cos(N1_R_Beta) * (1 + tan(Eff_F_Steer)^2) / Wheelbase                              ;
                Beta_Jacobian(2,2) = -Speed * sin(N1_R_Beta) * (-tan(Safe_N1_R_Beta) + tan(Eff_F_Steer)) / Wheelbase ...
                                    -Speed * C * cos(N1_R_Beta) * (1 + tan(Safe_N1_R_Beta)^2) / Wheelbase ...
                                    + Speed * C * sin(H_Err_Esti + N1_R_Beta) / PSF                                            ;

                // ---------- Beta Update with Leakage
                Leakage = 0.98 ; 
                
                Beta_Update = Leakage * [N1_F_Beta ; N1_R_Beta] + Sensor_Sample_Time * (Beta_Jacobian') * (K2') * X_Tild ;
                Front_Beta  = Beta_Update(1) ;
                Rear_Beta   = Beta_Update(2) ;
                
                // ---------- Saturation of F_Beta & R_Beta
                Rear_Beta  = min( Max_Rad, Rear_Beta ) ;
                Rear_Beta  = max( Min_Rad, Rear_Beta ) ;

                Front_Beta = min( Max_Rad, Front_Beta ) ;
                Front_Beta = max( Min_Rad, Front_Beta ) ;

                // ---------- Saturation of Velocity Angle
                Front_Velocity_Angle = F_Steer_A + Front_Beta           ;
                Front_Velocity_Angle = min( 1.2, Front_Velocity_Angle ) ; 
                Front_Velocity_Angle = max(-1.2, Front_Velocity_Angle ) ;
                
                Rear_Velocity_Angle = R_Steer_A + Rear_Beta           ;
                Rear_Velocity_Angle = min( 1.2, Rear_Velocity_Angle ) ; 
                Rear_Velocity_Angle = max(-1.2, Rear_Velocity_Angle ) ;

                // ---------- Kinematic Derivative
                Kinematic_Derivative = zeros(2,1);
                Kinematic_Derivative(1) = Speed * sin(H_Err_Esti + Rear_Beta + R_Steer_A) ;
                Kinematic_Derivative(2) = Speed * cos(Rear_Beta + R_Steer_A) * (tan(Front_Velocity_Angle) - tan(Rear_Velocity_Angle)) / Wheelbase ...
                                        - Speed * (C * cos(R_Steer_A + H_Err_Esti + Rear_Beta)) / PSF ;

                // ---------- Estimation Update
                Estimated_State_Update = [Lat_Err_Esti ; H_Err_Esti] + Sensor_Sample_Time * (Kinematic_Derivative + K1 * X_Tild) ;
                Lat_Err_Esti           = Estimated_State_Update(1) ;
                H_Err_Esti             = Estimated_State_Update(2) ;
            
            end


            // ============================================================================================
            //                      CASE 3 : Pure Lyapunov Gradient Adaptive Observer
            // ============================================================================================
            case 3 then

            // ---------- Parameters (Lyapunov stability requires K < 0 and Gamma > 0) ----------
            K_y     = -20.0 ;  // Gain de correction latérale (doit être < 0 pour forcer e_y -> 0)
            K_h     = -10.0 ;  // Gain de correction de cap (doit être < 0 pour forcer e_th -> 0)
            Gamma_F =  15.0 ;  // Gain adaptatif pour Front Beta (doit être > 0)
            Gamma_R =  15.0 ;  // Gain adaptatif pour Rear Beta (doit être > 0)
            Leakage =  0.98 ;  // Anti-dérive

            // ---------- Low Speed Safety ----------
            if Speed < 0.2 then
                Lat_Err_Esti = Lat_Err ;
                H_Err_Esti   = H_Err   ;
                Front_Beta   = 0       ;
                Rear_Beta    = 0       ;
            
            // ---------- Normal Speed ----------    
            else
                // STEP 1 : Innovations (Erreurs de l'observateur)
                Eps_Lat = Lat_Err_Esti - Lat_Err ;
                Eps_Lat = min( 0.5, max(-0.5, Eps_Lat) ) ; // Saturation anti-divergence

                Eps_H   = H_Err_Esti - H_Err ;
                Eps_H   = min( 0.2, max(-0.2, Eps_H) )   ;
        
                // ---------- Path Scale Factor
                PSF = 1 - C * Lat_Err_Esti ;
                if PSF < 0.1 then PSF = 0.1 ; end  

                // ---------- Angles Effectifs (Sécurité numérique pour les tangentes)
                Eff_F_Steer    = min( 1.2, max(-1.2, F_Steer_A + N1_F_Beta) ) ;
                Safe_N1_R_Beta = min( 1.2, max(-1.2, N1_R_Beta) ) ;

                // STEP 2 : Gradient du modèle (Dérivées partielles : ∂f/∂β)
                // C'est le cœur de la méthode de Lyapunov pour annuler la dynamique d'erreur
                dFy_dBF = 0 ;
                dFy_dBR = Speed * cos(H_Err_Esti + N1_R_Beta + R_Steer_A) ;

                dFh_dBF = Speed * cos(N1_R_Beta + R_Steer_A) * (1 + tan(Eff_F_Steer)^2) / Wheelbase ;
                
                dFh_dBR = -Speed * sin(N1_R_Beta + R_Steer_A) * (-tan(Safe_N1_R_Beta + R_Steer_A) + tan(Eff_F_Steer)) / Wheelbase ...
                        -Speed * cos(N1_R_Beta + R_Steer_A) * (1 + tan(Safe_N1_R_Beta + R_Steer_A)^2) / Wheelbase ...
                        + Speed * C * sin(H_Err_Esti + N1_R_Beta + R_Steer_A) / PSF ;

                // STEP 3 : Loi d'adaptation par Gradient de Lyapunov
                // Formule : β̇ = -Γ · ( e_y·(∂fy/∂β) + e_h·(∂fh/∂β) )
                Delta_Beta_F = -Gamma_F * (Eps_Lat * dFy_dBF + Eps_H * dFh_dBF) ;
                Delta_Beta_R = -Gamma_R * (Eps_Lat * dFy_dBR + Eps_H * dFh_dBR) ;

                // Mise à jour (Intégration d'Euler)
                Front_Beta = Leakage * N1_F_Beta + Sensor_Sample_Time * Delta_Beta_F ;
                Rear_Beta  = Leakage * N1_R_Beta + Sensor_Sample_Time * Delta_Beta_R ;
                
                // Saturation des estimations de glissement
                Front_Beta = min( Max_Rad, max(Min_Rad, Front_Beta) ) ;
                Rear_Beta  = min( Max_Rad, max(Min_Rad, Rear_Beta) ) ;

                // Angles de vitesse avec les nouveaux Betas
                Front_Vel_Angle = min( 1.2, max(-1.2, F_Steer_A + Front_Beta) ) ;
                Rear_Vel_Angle  = min( 1.2, max(-1.2, R_Steer_A + Rear_Beta) ) ;

                // STEP 4 : Dérivées Cinématiques de l'état (f_y et f_h)
                f_y = Speed * sin(H_Err_Esti + Rear_Beta + R_Steer_A) ;
                
                f_h = Speed * cos(Rear_Beta + R_Steer_A) * (tan(Front_Vel_Angle) - tan(Rear_Vel_Angle)) / Wheelbase ...
                    - Speed * C * cos(R_Steer_A + H_Err_Esti + Rear_Beta) / PSF ;

                // STEP 5 : Mise à jour de l'état avec termes de correction (K < 0)
                // Formule : x̂̇ = f(x̂) + K·e
                Lat_Err_Esti = Lat_Err_Esti + Sensor_Sample_Time * (f_y + K_y * Eps_Lat) ;
                H_Err_Esti   = H_Err_Esti   + Sensor_Sample_Time * (f_h + K_h * Eps_H)   ;
            end
        end

        // ============================================================================================
        //                      Output
        // ============================================================================================

        // Saturation for Rear_Beta
        Rear_Beta = min( Max_Rad, Rear_Beta ) ;
        Rear_Beta = max( Min_Rad, Rear_Beta ) ;
        
        // Saturation for Front_Beta
        Front_Beta = min( Max_Rad, Front_Beta ) ;
        Front_Beta = max( Min_Rad, Front_Beta ) ;
        
        // ---------- Beta Vehicle
        Vehicle_Beta_Esti = (LF * (Rear_Beta + R_Steer_A) + LR * (Front_Beta + F_Steer_A)) / (LF + LR) ;

    endfunction
    ```
