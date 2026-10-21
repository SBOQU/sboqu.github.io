---
template: Simulateur/Implementation.html
---

# Rear Axle Control

The rear axle is an active contributor to path tracking — not a passive follower. Its steering angle $\delta_R$ is computed to decouple lateral error from heading error, enabling crab steering on slopes and tighter headland turns.

---

## Implementation note

The rear axle logic is **embedded inside `Front_Axle.sce`** as a dedicated sub-block rather than a separate file. This co-location is intentional — the rear law depends on the front steering output and the corrective steering term computed in the same tick, so sharing state in a single function avoids synchronization overhead.

!!! scilab "Rear_Axle.sce"
    ```matlab
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
