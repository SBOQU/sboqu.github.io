---
template: Simulateur/Implementation.html
---

# Path Tracking

Seven modules that transform raw GPS waypoints into the geometric quantities needed by every controller downstream — smooth trajectory, closest point, desired positions, tracking errors, and local curvature.

---

## Path\_Filter.sce

Applies a **Butterworth low-pass filter** to the raw RTK-GPS waypoints to produce a smooth, derivable trajectory stored in `Smoothed_Traj`. Filter order and cutoff frequency are set in `Parameters.sce`.

!!! scilab "Path_Filter.sce"
    ```matlab
    function Smoothed_Traj = Path_Filter(Traj)

        // ---------- Extraction of the starting points

        X0 = Traj(1,2);
        Y0 = Traj(1,3);
        
        // ---------- Creation of a Butterworth filter

        Butterworth_Filter = iir(1, 'lp', 'butt', 0.0125, [0, 0]);  
        // 1 : Defines the filter order, where a value of 1 creates the simplest and smoothest mathematical curve without adding too much delay.
        // lp : Stands for "low-pass", meaning it allows smooth, slow movements (the track's shape) to pass while blocking sudden, jerky noises.
        // butt : Selects the Butterworth filter design, which is famous for keeping the signal perfectly flat without creating artificial waves.
        // 0.0125 : Sets the normalized cutoff frequency, determining the exact threshold where the smoothing starts.
        // [0, 0] : Defines the ripple tolerance in the passband and stopband, set to zero here because a Butterworth filter naturally has no ripples.
        

        // ---------- Center the trajectory on (0,0)

        X = Traj(:,2) - X0;
        Y = Traj(:,3) - Y0;
        
        // ---------- Prepare the output matrix

        Smoothed_Traj = zeros(size(Traj,1), size(Traj,2));                 // Preallocation of memories and construction of the table by extraction of the 2 dimension of 'Traj'
        Smoothed_Traj(:,1) = Traj(:,1);                                    // Extraction of the time stamp locating in the 1st column
        
        // ---------- Apply the filter and add the initial offset back

        Smoothed_Traj(:,2) = flts(X', Butterworth_Filter)' + X0;          // flts (Filter Time Series) applies the previously designed mathematical filter to our actual sequence of data points in order to physically smooth out the trajectory.
        Smoothed_Traj(:,3) = flts(Y', Butterworth_Filter)' + Y0;

    endfunction
    ```

---

## Closest\_Point.sce

Iterates over all waypoints using **vectorized squared-distance computation** (no `sqrt` needed) to find the index of the trajectory point closest to the robot's current position. Called at every simulation tick to anchor the Frenet frame.

!!! scilab "Closest_Point.sce"
    ```matlab
    function Closest_Point_Index = Find_Closest_Point_Index(Current_Position)

        // ============================================================================================
        //                      Global Trajectory Parameter
        // ============================================================================================
        
        global Smoothed_Traj ;

        // ============================================================================================
        //                      Distance Computation
        // ============================================================================================

        X_Robot = Current_Position(1) ;
        Y_Robot = Current_Position(2) ;

        // Extract the full X and Y columns from the trajectory
        X_Traj = Smoothed_Traj(:, 2) ;
        Y_Traj = Smoothed_Traj(:, 3) ;

        // Calculate squared distances for all points simultaneously
        // Note: Using squared distance saves CPU time (sqrt is not needed to find the minimum)
        Distances_Sq = (X_Traj - X_Robot).^2 + (Y_Traj - Y_Robot).^2 ;

        // Find the index (row number) of the smallest distance
        [Min_Val, Closest_Point_Index] = min(Distances_Sq) ;

    endfunction
    ```

---

## Compute\_Distance.sce

Utility function — returns the **Euclidean distance** between two 2D points. Used internally by several modules to avoid code duplication.

!!! scilab "Compute_Distance.sce"
    ```matlab
    function d = Compute_Distance(Point_A, Point_B)

        // ============================================================================================
        //                      Euclidean Distance Computation
        // ============================================================================================
        // Point_A and Point_B must be arrays of at least 2 elements [X ; Y]

        X_Diff = Point_B(1) - Point_A(1) ;
        Y_Diff = Point_B(2) - Point_A(2) ;

        d = sqrt(X_Diff^2 + Y_Diff^2) ;

    endfunction
    ```

---

## Find\_Current\_Pos\_Desired.sce

From the closest point index, computes the **exact desired position and tangent** on the path at the robot's current arc-length position. Supports both orthogonal projection and polynomial interpolation, selectable via `Projection_Method`.

!!! scilab "Find_Current_Pos_Desired.sce"
    ```matlab
    function Desired_Pos_Now = Current_Pos_Desired(...
    Current_Position, ...
    Closest_Point_Index, ...
    Projection_Method)

        // ---------- Parameters
        
        global Smoothed_Traj ;

        X_Robot = Current_Position(1) ;
        Y_Robot = Current_Position(2) ;

        NbPoints      = size(Smoothed_Traj, 1) ;
        Cl_Pt_Index   = Closest_Point_Index    ;

        // ---------- Safeguards for track boundaries
        if Cl_Pt_Index < 2 then 
            Cl_Pt_Index = 2 ; 
        elseif Cl_Pt_Index > NbPoints - 1 then 
            Cl_Pt_Index = NbPoints - 1 ; 
        end

        // ============================================================================================
        //                      Projection Logic
        // ============================================================================================

        select Projection_Method

            // ============================================================================================
            //                               Polynomial Fitting (Polyfit from Matlab)
            // ============================================================================================
            case 1 then
            
                // ---------- Local Window
                X_Traj = Smoothed_Traj((Cl_Pt_Index-1):(Cl_Pt_Index+1), 2) ;
                Y_Traj = Smoothed_Traj((Cl_Pt_Index-1):(Cl_Pt_Index+1), 3) ;
                
                // ---------- Local time vector 
                t = [-1 ; 0 ; 1] ;
                
                // ---------- Vandermonde Matrix Inversion
                Vandermonde = [t.^2, t, ones(3, 1)] ;
                
                // ---------- Solving X and Y with the "\" operator, a left matrix division, to avoid manual matrix inversion
                Coeffs_X = Vandermonde \ X_Traj ; // Coeffs_X = [Ax, Bx, Cx]
                Coeffs_Y = Vandermonde \ Y_Traj ; // Coeffs_Y = [Ay, By, Cy]
                
                // ---------- Generate 100 fine points along this polynomial curve
                t_calc = -1 : 0.02 : 1 ; 
                X_calc = Coeffs_X(1)*t_calc.^2 + Coeffs_X(2)*t_calc + Coeffs_X(3) ;
                Y_calc = Coeffs_Y(1)*t_calc.^2 + Coeffs_Y(2)*t_calc + Coeffs_Y(3) ;
                
                // ---------- Find the minimum distance in this virtual fine curve
                Distances = (X_calc - X_Robot).^2 + (Y_calc - Y_Robot).^2 ;
                [Min_Dist, Best_Idx] = min(Distances) ;
                
                t_best = t_calc(Best_Idx) ;
                X_Proj = X_calc(Best_Idx) ;
                Y_Proj = Y_calc(Best_Idx) ;
                
                // ---------- Compute tangent angle using the polynomial derivatives
                dX_dt = 2 * Coeffs_X(1) * t_best + Coeffs_X(2) ;
                dY_dt = 2 * Coeffs_Y(1) * t_best + Coeffs_Y(2) ;
                Theta_Proj = atan(dX_dt, -dY_dt) ; // "-" because of the orientation of our robot
                


            // ============================================================================================
            //                               Geometric Projection
            // ============================================================================================
            case 2 then
                
                // ---------- Identify the closest segment
                P_Prev = [Smoothed_Traj(Cl_Pt_Index - 1, 2) ; Smoothed_Traj(Cl_Pt_Index - 1, 3)] ; // X-1 and Y-1
                P_Curr = [Smoothed_Traj(Cl_Pt_Index, 2)     ; Smoothed_Traj(Cl_Pt_Index, 3)]     ; // X and Y
                P_Next = [Smoothed_Traj(Cl_Pt_Index + 1, 2) ; Smoothed_Traj(Cl_Pt_Index + 1, 3)] ; // X+1 and Y+1
                P_Rob  = [X_Robot ; Y_Robot] ;
                
                // ---------- Distances to neighbors to know which segment to project onto
                Dist_Prev = norm(P_Rob - P_Prev) ;
                Dist_Next = norm(P_Rob - P_Next) ;
                
                if Dist_Next < Dist_Prev then
                    A = P_Curr ;
                    B = P_Next ;
                else
                    A = P_Prev ;
                    B = P_Curr ;
                end
                
                // ---------- Vector projection
                AB = B - A ;
                AR = P_Rob - A ;
                
                // Project AR onto AB & Saturation
                Scalar_Projection = (AR(1)*AB(1) + AR(2)*AB(2)) / (AB(1)^2 + AB(2)^2) ; // Scalar_Projection is sigma in the Theory.md
                
                Scalar_Projection = min( 1, Scalar_Projection ) ;
                Scalar_Projection = max( 0, Scalar_Projection ) ;
                
                // ---------- Compute final point and angle
                Point_Proj = A + Scalar_Projection * AB ;
                X_Proj = Point_Proj(1) ;
                Y_Proj = Point_Proj(2) ;
                
                // ---------- Theta_Proj = atan(AB(2), AB(1)) ;
                Theta_Proj = atan(AB(1), -AB(2))  ;
                
        end
        
        // ---------- Output
        
        Desired_Pos_Now = [X_Proj ; Y_Proj ; Theta_Proj] ;

    endfunction
    ```

---

## Find\_Future\_Pos\_Desired.sce

Looks ahead by `Lookahead_Distance` along the arc to return the **future desired position** used by the GPC feedforward layer and the curvature anticipation block.

!!! scilab "Find_Future_Pos_Desired.sce"
    ```matlab
    function [Index_Future,Desired_Pos_Future] = Future_Pos_Desired(...
     Lookahead_Distance,...
     Closest_Point_Index)

        // ============================================================================================
        //                      Global Trajectory Parameter
        // ============================================================================================
        
        global Smoothed_Traj ;

        NbPoints = size(Smoothed_Traj, 1) ;
        
        if Closest_Point_Index < 1 then
            Closest_Point_Index = 1 ;
        elseif Closest_Point_Index > NbPoints - 1 then
            Closest_Point_Index = NbPoints - 1 ;
        end

        // Variables for the loop
        Accumulated_Dist = 0 ;
        Current_Idx      = Closest_Point_Index ;

        // ============================================================================================
        //                      Path Walking Logic (Accumulating distance)
        // ============================================================================================
        
        // We walk forward on the track until we reach the Lookahead_Distance, 
        // OR until we reach the very last point of the track.
        while (Accumulated_Dist < Lookahead_Distance) & (Current_Idx < NbPoints - 1)
            
            // Extract current point and the very next one
            P_Current = [Smoothed_Traj(Current_Idx, 2)     ; Smoothed_Traj(Current_Idx, 3)] ;
            P_Next    = [Smoothed_Traj(Current_Idx + 1, 2) ; Smoothed_Traj(Current_Idx + 1, 3)] ;
            
            // Calculate the small distance between these two consecutive points
            Step_Dist = Compute_Distance(P_Current, P_Next) ;
            
            // Add it to our total traveled distance
            Accumulated_Dist = Accumulated_Dist + Step_Dist ;
            
            // Move our virtual cursor one point forward
            Current_Idx = Current_Idx + 1 ;
            
        end

        // ============================================================================================
        //                      Output Generation
        // ============================================================================================

        Index_Future = Current_Idx ;
        
        X_Desired_Future = Smoothed_Traj(Index_Future, 2) ;
        Y_Desired_Future = Smoothed_Traj(Index_Future, 3) ;
        
        Desired_Pos_Future = [X_Desired_Future ; Y_Desired_Future] ;

    endfunction
    ```

---

## Tracking\_Errors.sce

Computes the two primary control errors in the **Frenet-Serret frame** : lateral error $y$ (signed perpendicular distance to path) and heading error $\tilde{\theta}$ (angular deviation from the path tangent). Both errors feed every controller downstream.

!!! scilab "Tracking_Errors.sce"
    ```matlab
    function Tracking_Errors = Calculate_Tracking_Errors(...
    Current_Position, ...
    Current_Pos_Desired)
    
        // Robot's current state
        X_Robot     = Current_Position(1) ;
        Y_Robot     = Current_Position(2) ;
        Theta_Robot = Current_Position(3) ;
        
        // Projected point on the reference trajectory
        X_Proj     = Current_Pos_Desired(1) ;
        Y_Proj     = Current_Pos_Desired(2) ;
        Theta_Proj = Current_Pos_Desired(3) ;

        // ---------- Computation ----------
        Lat_Err = (X_Robot - X_Proj) * cos(Theta_Proj) + (Y_Robot - Y_Proj) * sin(Theta_Proj) ;
        H_Err   = Theta_Robot - Theta_Proj                                                    ;
        
        // ---------- Angular Fitting ----------
        if H_Err > %pi then
            H_Err = H_Err - 2 * %pi ;
        elseif H_Err < -%pi then
            H_Err = H_Err + 2 * %pi ;
        end
    
        // ---------- Output ----------
        Tracking_Errors = [Lat_Err ; H_Err] ;

    endfunction
    ```

---

## Curvature.sce

Estimates the **local curvature** $\kappa(s)$ of the trajectory at a given arc-length index using a finite-difference approximation on the smoothed waypoints. Used both as a feedforward term in the controllers and as input to the rear axle quadratic law.

!!! scilab "Curvature.sce"
    ```matlab
    function Curvature = Calculate_Curvature(...
    Point_Index, ... 
    Pos_Desired)

        // ============================================================================================
        //                      Global Trajectory Parameter
        // ============================================================================================
        
        global Smoothed_Traj ;

        // ============================================================================================
        //                      Extraction of 3 local points
        // ============================================================================================
        
        NbPoints = size(Smoothed_Traj, 1) ;
        Spacing  = 3                      ;  // Spacing between points to avoid numerical instability (division by zero) if the point are aligned

        // ---------- Window Slide ----------
        // Begin of the track
        if Point_Index <= Spacing then
            p1 = 1               ;
            p2 = 1 + Spacing     ;
            p3 = 1 + 2 * Spacing ;

        // End of the track    
        elseif Point_Index >= (NbPoints - Spacing) then
            p1 = NbPoints - 2 * Spacing ;
            p2 = NbPoints - Spacing     ;
            p3 = NbPoints               ;
        
        // Normal use
        else
            p1 = Point_Index - Spacing ;
            p2 = Point_Index           ;
            p3 = Point_Index + Spacing ;
        end

        // Coordinate extraction centered on the robot
        x1 = Smoothed_Traj(p1, 2) ; y1 = Smoothed_Traj(p1, 3) ;
        x2 = Smoothed_Traj(p2, 2) ; y2 = Smoothed_Traj(p2, 3) ;
        x3 = Smoothed_Traj(p3, 2) ; y3 = Smoothed_Traj(p3, 3) ;

        // ============================================================================================
        //                      Computation of the circumcenter
        // ============================================================================================

        Num_X = ((x1^2 + y1^2 - x2^2 - y2^2)*(y1 - y3) - (x1^2 + y1^2 - x3^2 - y3^2)*(y1 - y2)) ;
        Den_X = (2 * ((x1 - x2)*(y1 - y3) - (x1 - x3)*(y1 - y2))) + 1e-9;
        X_Center = Num_X / Den_X ;

        Num_Y = ((x1^2 + y1^2 - x2^2 - y2^2)*(x1 - x3) - (x1^2 + y1^2 - x3^2 - y3^2)*(x1 - x2)) ;
        Den_Y = (2 * ((y1 - y2)*(x1 - x3) - (y1 - y3)*(x1 - x2))) + 1e-9;
        Y_Center = Num_Y / Den_Y ;

        // ============================================================================================
        //                      Curvature Output
        // ============================================================================================
        
        // If points are aligned -> Curvature is 0
        if abs(X_Center) == %inf | abs(Y_Center) == %inf | isnan(X_Center) then
            Curvature = 0 ;
        else
            X_Proj     = Pos_Desired(1) ;
            Y_Proj     = Pos_Desired(2) ;
            Theta_Proj = Pos_Desired(3) ;
            
            // Signed radius calculation relative to the projected orientation
            Radius_Curvature = (X_Center - X_Proj) * cos(Theta_Proj) + (Y_Center - Y_Proj) * sin(Theta_Proj) ;
            
            if Radius_Curvature == 0 then
                Curvature = 0 ;
            else
                Curvature = 1 / Radius_Curvature ;
            end
        end

    endfunction
    ```
