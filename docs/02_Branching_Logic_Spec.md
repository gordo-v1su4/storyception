# SYSTEM DOC: DAG BRANCHING & CONVERGENCE LOGIC
PURPOSE: Defines how the story branches and how the "Auto-Fixer" works.

## 1. THE STRUCTURE: DIRECTED ACYCLIC GRAPH (DAG)
- **Node:** A single Story Beat (contains 1x 9-frame Image Grid).
- **Edge:** A User Choice (Branch).
- **Bottleneck:** A mandatory convergence point (e.g., The Midpoint).

## 2. THE "FIXER" MECHANISM (Convergence)
The "Fixer" ensures the story doesn't spiral into infinity.
- **Trigger:** IF (Current_Branch_Depth >= 4) OR (Approaching_Milestone == True).
- **Action:** The AI must generate a "Convergence Event."
- **Logic:** - Input: User's current erratic path (e.g., "Exploring the Basement").
  - Target: The required Story Beat (e.g., "The Villain Attack").
  - Output: The 9-frame grid starts with the User Choice (Basement) but Frame 9 REVEALS the Target (Villain is in the basement).
- **Result:** The graph folds back to the main timeline.

## 3. DATA RELATIONSHIPS
- Each Node must store a `Parent_ID` (Recursive).
- Each Node must store a `Depth_Index` (Integer).
- Each Node must store a `Target_Milestone_ID` (Link to Architecture).