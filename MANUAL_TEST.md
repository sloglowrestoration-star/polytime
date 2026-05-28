# PolyTime Manual Test Checklist

Run with `npx serve .` and open http://localhost:3000.

## Calendar render
- [ ] Grid shows Mon-Fri columns and 07:00-21:00 time labels every hour.
- [ ] All cells start in the "available" (off-white) color.

## Block-out interaction
- [ ] Mousedown on an empty cell turns it red.
- [ ] Dragging across multiple cells turns each red.
- [ ] Mousedown on a red cell + drag erases (cells go back to off-white).
- [ ] Right-clicking a red cell clears just that one.
- [ ] "Clear Blocks" button removes every red cell.

## Preference toggle
- [ ] Only one of {Morning Person, Night Person} can be selected.
- [ ] Morning is the default on first load.

## Generate Schedule -- happy path
- [ ] With no blocks and all 12 courses checked, "Generate Schedule"
      produces blue blocks on the calendar.
- [ ] Summary panel lists each chosen course with time, professor, rating.
- [ ] Switching to "Night Person" + Generate shifts the chosen sections
      toward later start times (verify via summary panel start times).

## Generate Schedule -- blocked
- [ ] Block out 08:00-12:00 Mon-Fri. Generate. Confirm no blue blocks
      appear inside the red region.

## Generate Schedule -- empty result
- [ ] Block out the entire calendar (drag the full grid red).
- [ ] Click Generate.
- [ ] Calendar shows no blue cells; summary panel shows the
      "No valid schedule found" message.

## Course selection
- [ ] Unchecking a course removes it from the next generated schedule.
- [ ] Re-checking adds it back on the next generate.
