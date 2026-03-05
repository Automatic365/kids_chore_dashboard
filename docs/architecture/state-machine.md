# Mission Economy State Machine

## Primary States

- `Idle`: mission not completed in current eligibility window.
- `Completed`: mission has an applicable completion row.
- `UndoLocked`: completed mission where unspent points are insufficient for undo.

## Transitions

1. `Idle -> Completed`
   - Trigger: mission completion
   - Effects: add mission history row, add profile power, add squad power

2. `Completed -> Idle`
   - Trigger: undo mission
   - Preconditions: completion row exists and undo eligibility passes
   - Effects: remove history row, subtract profile power, subtract squad power

3. `Completed -> UndoLocked`
   - Trigger: undo attempt without enough unspent points (and no force override)
   - Effects: no state mutation

4. `UndoLocked -> Completed`
   - Trigger: reward return(s) restoring enough power
   - Effects: remove claim row(s), restore profile power

5. `Completed -> Idle` (after lock)
   - Trigger: retry undo after reward return(s)

6. `Any -> New Cycle`
   - Trigger: daily reset
   - Effects: cycle date advances, recurring mission eligibility reopens

## Caller Permissions

- Kids: complete mission, normal undo, claim reward, return reward.
- Parents only: force undo, mission/reward/profile/squad management, reset trigger auth.
